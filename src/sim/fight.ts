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
}

export type FightOutcome = 'fighting' | 'landable' | 'broke' | 'escaped'

export const LANDABLE_DISTANCE_M = 3
export const LANDABLE_STAMINA = 0.25
export const ESCAPE_DISTANCE_M = 25
export const STEP_MS = 50

export function initFight(s: Species, weightG: number, distanceM: number, seed: number): FightState {
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
  const target = reeling ? pull + 0.45 : pull * 0.35
  const tension = f.tension + (target - f.tension) * Math.min(1, dt * 4)
  let distanceM = f.distanceM
  if (reeling && tension < 0.95) distanceM -= 1.6 * (1 - 0.8 * pull) * dt
  if (!reeling) distanceM += pull * 1.2 * dt
  distanceM = Math.max(0.5, distanceM)
  const stamina = Math.max(0, f.stamina - (dt * (0.008 + 0.055 * tension)) / f.staminaScale)
  return { ...f, rng, surgeUntil, nextSurgeAt, elapsedMs, pull, tension, distanceM, stamina }
}

export function outcomeOf(f: FightState): FightOutcome {
  if (f.tension >= 1) return 'broke'
  if (f.distanceM > ESCAPE_DISTANCE_M) return 'escaped'
  if (f.distanceM <= LANDABLE_DISTANCE_M && f.stamina <= LANDABLE_STAMINA) return 'landable'
  return 'fighting'
}

/** Tiến trận kéo thêm `ms` mili-giây. Dừng sớm nếu đứt hoặc sổng. */
export function advanceFight(f: FightState, ms: number, reeling: boolean): FightState {
  let s = f
  for (let left = ms; left >= STEP_MS; left -= STEP_MS) {
    s = step(s, reeling)
    const o = outcomeOf(s)
    if (o === 'broke' || o === 'escaped') break
  }
  return s
}

export function isSurging(f: FightState): boolean {
  return f.elapsedMs < f.surgeUntil
}
