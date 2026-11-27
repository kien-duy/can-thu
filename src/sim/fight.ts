import type { Species } from '../content'
import { rngStep } from './rng'

/**
 * Kéo cá: giữ = ghì (thu dây), thả = tay mềm (cần tự đỡ, cá lấy dây).
 * Dòng cá: cá vật thì chạy sang một bên; dòng cần ngược phía cá chạy là đúng bài, cùng phía là thiệt.
 * Trạng thái thuần, bước thời gian cố định, nên test chạy được hàng nghìn ván.
 */
export interface FightState {
  speciesId: string
  weightG: number
  distanceM: number
  /** 1 = cá còn sung, 0 = cá đuối hẳn */
  stamina: number
  /** 0..1, chạm 1 là đứt thẻo */
  tension: number
  pull: number
  surgeUntil: number
  nextSurgeAt: number
  elapsedMs: number
  rng: number
  /** sức và độ bền của con cá cụ thể này, tính sẵn khi dính */
  power: number
  staminaScale: number
  surge: number
  /** sức chịu của bộ cần + dây (1 = đồ khởi đầu); lực vượt mức này là đứt */
  strength: number
  /** sức chịu riêng của cần và của dây; quá tải thì phần yếu hơn hỏng trước (bằng nhau thì thẻo đứt) */
  rodStrength: number
  lineStrength: number
  /** dây đã quá tải liên tục bao lâu (ms); cần đỡ sốc được một nhịp, quá OVERLOAD_MS mới đứt */
  overloadMs: number
  /** cá đang chạy về phía nào: -1 trái, 1 phải, 0 ghì thẳng ra xa */
  fishDir: -1 | 0 | 1
  /** người chơi đang dòng cần sang phía nào (-1 trái, 1 phải, 0 giữ thẳng) */
  rodSide: -1 | 0 | 1
  /** chuỗi RNG riêng cho hướng cá chạy, để không xáo nhịp vật vốn có */
  dirRng: number
  /** cá nặng hơn ngần này (g) thì lưỡi nhỏ so với cá, mỗi nhịp vùng chạy có thể tuột; không có = lưỡi vừa */
  hookMaxG?: number
  /** true = lưỡi đã tuột khỏi miệng cá */
  unhooked?: boolean
}

export type FightOutcome = 'fighting' | 'landable' | 'broke' | 'escaped'

export const LANDABLE_DISTANCE_M = 3
export const LANDABLE_STAMINA = 0.25
export const ESCAPE_DISTANCE_M = 25
export const STEP_MS = 50
/** Cần đỡ sốc: dây phải quá tải liên tục ngần này mới đứt. Lớn hơn phản xạ người (~250 ms) để kịp thả tay. */
export const OVERLOAD_MS = 400
/** Dòng cần ngược hướng cá chạy: cá mất sức nhanh hơn, lấy được ít dây hơn. */
export const STEER_GOOD_STAMINA = 1.6
export const STEER_GOOD_LINE = 0.6
/** Dòng cần cùng hướng cá chạy: dây căng thêm, cá lấy thêm dây. */
export const STEER_BAD_TENSION = 0.15
export const STEER_BAD_LINE = 1.3

export function initFight(s: Species, weightG: number, distanceM: number, seed: number, strength = 1, rodStrength = 1, lineStrength = 1, hookMaxG?: number): FightState {
  const size = Math.min(2.2, Math.max(0.4, weightG / s.typicalG))
  const [r, rng] = rngStep(seed)
  return {
    speciesId: s.id,
    weightG,
    distanceM,
    stamina: 1,
    tension: 0.3,
    pull: 0,
    surgeUntil: 0,
    nextSurgeAt: 1200 + r * 2000,
    elapsedMs: 0,
    rng,
    power: Math.min(0.85, s.fight.power * (0.55 + 0.45 * size)),
    staminaScale: s.fight.stamina * (0.5 + 0.5 * size),
    surge: s.fight.surge,
    strength,
    rodStrength,
    lineStrength,
    overloadMs: 0,
    fishDir: 0,
    rodSide: 0,
    dirRng: (seed ^ 0x5bd1e995) >>> 0,
    hookMaxG,
  }
}

/** +1 khi dòng cần ngược hướng cá chạy (đúng bài), -1 khi dòng cùng hướng, 0 khi không ảnh hưởng. */
export function steerEffect(f: Pick<FightState, 'fishDir' | 'rodSide'>): -1 | 0 | 1 {
  if (f.fishDir === 0 || f.rodSide === 0) return 0
  return f.rodSide === -f.fishDir ? 1 : -1
}

function step(f: FightState, reeling: boolean): FightState {
  const dt = STEP_MS / 1000
  let { rng, surgeUntil, nextSurgeAt, fishDir, dirRng } = f
  const elapsedMs = f.elapsedMs + STEP_MS
  const wasSurging = f.elapsedMs < f.surgeUntil
  if (elapsedMs >= nextSurgeAt) {
    let a: number, b: number
    ;[a, rng] = rngStep(rng)
    ;[b, rng] = rngStep(rng)
    surgeUntil = elapsedMs + 700 + a * 900
    nextSurgeAt = surgeUntil + 1800 + b * 3200
    // mỗi lần vật, cá chọn một phía để chạy
    let d: number
    ;[d, dirRng] = rngStep(dirRng)
    fishDir = d < 0.5 ? -1 : 1
  }
  const surging = elapsedMs < surgeUntil
  if (wasSurging && !surging) {
    // vật xong, chừng một nửa số lần cá quay về ghì thẳng, còn lại chạy tiếp phía cũ
    let k: number
    ;[k, dirRng] = rngStep(dirRng)
    if (k < 0.5) fishDir = 0
  }
  const steer = steerEffect({ fishDir, rodSide: f.rodSide })
  const pull = f.power * (0.35 + 0.65 * f.stamina) * (surging ? 1 + f.surge * 1.5 : 1)
  // độ căng hiển thị = lực trên dây ÷ sức chịu của bộ đồ (1 = sắp đứt)
  const target = (reeling ? pull + 0.45 : pull * 0.35) / f.strength + (steer < 0 ? STEER_BAD_TENSION : 0)
  // thả tay ("tay mềm") thì ngọn cần chùng ngay, lực tụt nhanh hơn lúc ghì lên
  const tension = f.tension + (target - f.tension) * Math.min(1, dt * (reeling ? 4 : 10))
  let distanceM = f.distanceM
  if (reeling && tension < 0.95) distanceM -= 1.6 * (1 - 0.8 * pull) * dt
  if (!reeling) distanceM += pull * 1.2 * dt * (steer > 0 ? STEER_GOOD_LINE : steer < 0 ? STEER_BAD_LINE : 1)
  distanceM = Math.max(0.5, distanceM)
  const stamina = Math.max(0, f.stamina - ((dt * (0.008 + 0.055 * tension)) / f.staminaScale) * (steer > 0 ? STEER_GOOD_STAMINA : 1))
  const overloadMs = tension >= 1 ? f.overloadMs + STEP_MS : 0
  return { ...f, rng, surgeUntil, nextSurgeAt, elapsedMs, pull, tension, distanceM, stamina, overloadMs, fishDir, dirRng }
}

/** Mỗi lần cá vùng chạy, cá vượt sức lưỡi bao nhiêu lần thì thêm ngần này cơ hội tuột (có trần). */
export const UNHOOK_PER_OVER = 0.08
export const UNHOOK_MAX = 0.3

/**
 * Cơ hội tuột lưỡi mỗi lần cá vùng chạy: 0 khi lưỡi vừa; cá nặng gấp đôi sức lưỡi thì 8 %, trần 30 %.
 * Đo với lưỡi số 3 ở Hồ Đồng Xanh, người kéo đúng bài: cá trên 2 kg tuột chừng 1 con trong 5
 * (cá 2–3 kg 5 %, 3–4 kg 17 %, 4–6 kg gần nửa); lưỡi số 5 giữ trọn cá tới 6 kg.
 */
export function unhookChance(weightG: number, hookMaxG?: number): number {
  if (hookMaxG === undefined || weightG <= hookMaxG) return 0
  return Math.min(UNHOOK_MAX, UNHOOK_PER_OVER * (weightG / hookMaxG - 1))
}

/** Vừa bắt đầu một nhịp vùng chạy thì gieo xem lưỡi có giữ nổi không (chỉ gieo khi lưỡi nhỏ so với cá). */
function holdHook(prev: FightState, next: FightState): FightState {
  if (next.unhooked || next.nextSurgeAt === prev.nextSurgeAt) return next
  const chance = unhookChance(next.weightG, next.hookMaxG)
  if (chance <= 0) return next
  const [r, rng] = rngStep(next.rng)
  return r < chance ? { ...next, rng, unhooked: true } : { ...next, rng }
}

export function outcomeOf(f: FightState): FightOutcome {
  if (f.overloadMs >= OVERLOAD_MS) return 'broke'
  if (f.unhooked) return 'escaped'
  if (f.distanceM > ESCAPE_DISTANCE_M) return 'escaped'
  if (f.distanceM <= LANDABLE_DISTANCE_M && f.stamina <= LANDABLE_STAMINA) return 'landable'
  return 'fighting'
}

/** Tiến trận kéo thêm `ms` mili-giây. Dừng sớm nếu đứt hoặc sổng. */
export function advanceFight(f: FightState, ms: number, reeling: boolean): FightState {
  let s = f
  for (let left = ms; left >= STEP_MS; left -= STEP_MS) {
    s = holdHook(s, step(s, reeling))
    const o = outcomeOf(s)
    if (o === 'broke' || o === 'escaped') break
  }
  return s
}

/**
 * Quá tải thì bộ đồ hỏng ở chỗ yếu nhất. Thẻo là điểm yếu được tính sẵn, nên bằng sức nhau thì thẻo đứt;
 * chỉ khi cần yếu hơn dây (dây to lắp cần yếu) thì cần gãy trước.
 */
export function brokenPart(f: FightState): 'rod' | 'line' {
  return f.rodStrength < f.lineStrength ? 'rod' : 'line'
}

export function isSurging(f: FightState): boolean {
  return f.elapsedMs < f.surgeUntil
}
