import type { Species } from '../content'
import { rngStep } from './rng'

/**
 * Kéo cá: giữ = ghì (thu dây), thả = tay mềm (cần tự đỡ, cá lấy dây).
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
  /** dây đã quá tải liên tục bao lâu (ms); cần đỡ sốc được một nhịp, quá OVERLOAD_MS mới đứt */
  overloadMs: number
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

export function initFight(s: Species, weightG: number, distanceM: number, seed: number, strength = 1, hookMaxG?: number): FightState {
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
    overloadMs: 0,
    hookMaxG,
  }
}

function step(f: FightState, reeling: boolean): FightState {
  const dt = STEP_MS / 1000
  let { rng, surgeUntil, nextSurgeAt } = f
  const elapsedMs = f.elapsedMs + STEP_MS
  if (elapsedMs >= nextSurgeAt) {
    let a: number, b: number
    ;[a, rng] = rngStep(rng)
    ;[b, rng] = rngStep(rng)
    surgeUntil = elapsedMs + 700 + a * 900
    nextSurgeAt = surgeUntil + 1800 + b * 3200
  }
  const surging = elapsedMs < surgeUntil
  const pull = f.power * (0.35 + 0.65 * f.stamina) * (surging ? 1 + f.surge * 1.5 : 1)
  // độ căng hiển thị = lực trên dây ÷ sức chịu của bộ đồ (1 = sắp đứt)
  const target = (reeling ? pull + 0.45 : pull * 0.35) / f.strength
  // thả tay ("tay mềm") thì ngọn cần chùng ngay, lực tụt nhanh hơn lúc ghì lên
  const tension = f.tension + (target - f.tension) * Math.min(1, dt * (reeling ? 4 : 10))
  let distanceM = f.distanceM
  if (reeling && tension < 0.95) distanceM -= 1.6 * (1 - 0.8 * pull) * dt
  if (!reeling) distanceM += pull * 1.2 * dt
  distanceM = Math.max(0.5, distanceM)
  const stamina = Math.max(0, f.stamina - (dt * (0.008 + 0.055 * tension)) / f.staminaScale)
  const overloadMs = tension >= 1 ? f.overloadMs + STEP_MS : 0
  return { ...f, rng, surgeUntil, nextSurgeAt, elapsedMs, pull, tension, distanceM, stamina, overloadMs }
}

/** Cơ hội tuột lưỡi mỗi lần cá vùng chạy: 0 khi lưỡi vừa; cá nặng gấp đôi sức lưỡi thì 1/4, trần 1/2. */
export function unhookChance(weightG: number, hookMaxG?: number): number {
  if (hookMaxG === undefined || weightG <= hookMaxG) return 0
  return Math.min(0.5, 0.25 * (weightG / hookMaxG - 1))
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

export function isSurging(f: FightState): boolean {
  return f.elapsedMs < f.surgeUntil
}
