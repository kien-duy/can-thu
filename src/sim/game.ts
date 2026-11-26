/**
 * Máy trạng thái của một ô câu. Hàm thuần: (state, event) -> state. Không đọc đồng hồ, không đụng DOM.
 *
 *   ready ─giữ─▶ charging ─thả─▶ sinking ─▶ waiting ─giật đúng─▶ fighting ⇄ landable ─vớt─▶ result(landed)
 *                                              └─giật sai / cá bỏ đi──────────▶ result(missed)
 *                                                      fighting ─đứt / sổng─▶ result(lost)
 */
import { type Location, type Species, speciesOf } from '../content'
import { judgeStrike, planSpeciesBite, type SpeciesBitePlan } from './bite'
import { advanceFight, type FightState, initFight, outcomeOf, STEP_MS } from './fight'
import { createRng } from './rng'
import type { Setup } from './setup'

export const CHARGE_FULL_MS = 1200
export const MIN_POWER = 0.15
export const SINK_MS = 3000
/** Cá bỏ đi sau khi cửa sổ giật đóng bao lâu. */
export const LEAVE_AFTER_MS = 3500
/** Máy lag (khung hình thưa) thì trận kéo vẫn tiến, nhưng không quá ngần này mỗi nhịp. */
export const MAX_FIGHT_TICK_MS = 1000
/** Cá đuối nổi đầu cạnh bờ chờ vớt ngần này; quá thì cá hồi sức, lặn xuống kéo tiếp. */
export const LANDABLE_GRACE_MS = 5000

export interface GameConfig {
  location: Location
  species: readonly Species[]
  seed: number
  timeScale: number
}

export interface LandedFish {
  speciesId: string
  weightG: number
  caughtAt: number
  distanceM: number
}

export type Result =
  | { kind: 'landed'; fish: LandedFish }
  | { kind: 'short_cast' }
  | { kind: 'nothing' }
  | { kind: 'too_early'; speciesId: string }
  | { kind: 'too_late'; speciesId: string }
  | { kind: 'gone'; speciesId: string }
  | { kind: 'broke'; speciesId: string; weightG: number }
  | { kind: 'escaped'; speciesId: string }

export type Phase = 'ready' | 'charging' | 'sinking' | 'waiting' | 'fighting' | 'landable' | 'result'

export interface GameState {
  phase: Phase
  casts: number
  chargeStartedAt?: number
  cast?: { at: number; settledAt: number; distanceM: number; power: number; strength: number }
  bite?: SpeciesBitePlan
  fight?: FightState
  reeling: boolean
  result?: Result
  lastTick: number
  landableSince?: number
}

export type GameEvent =
  | { type: 'charge'; t: number }
  | { type: 'release'; t: number; hour: number; setup?: Setup }
  /** paused: tab đang ẩn. Trận kéo đứng yên (không ai cầm cần), các mốc theo giờ vẫn chạy. */
  | { type: 'tick'; t: number; paused?: boolean }
  | { type: 'strike'; t: number }
  | { type: 'reel'; t: number; on: boolean }
  | { type: 'net'; t: number }
  | { type: 'reset'; t: number }

export function initialState(t: number): GameState {
  return { phase: 'ready', casts: 0, reeling: false, lastTick: t }
}

export function chargePower(startedAt: number, t: number): number {
  return Math.min(1, Math.max(0, (t - startedAt) / CHARGE_FULL_MS))
}

export function reduce(cfg: GameConfig, s: GameState, e: GameEvent): GameState {
  switch (e.type) {
    case 'charge':
      if (s.phase !== 'ready' && s.phase !== 'result') return s
      return { ...s, phase: 'charging', chargeStartedAt: e.t, result: undefined, bite: undefined, fight: undefined }

    case 'release': {
      if (s.phase !== 'charging' || s.chargeStartedAt === undefined) return s
      const power = chargePower(s.chargeStartedAt, e.t)
      if (power < MIN_POWER) return { ...s, phase: 'result', result: { kind: 'short_cast' }, chargeStartedAt: undefined }
      const [dMin, dMax] = cfg.location.castDistanceM
      const settledAt = e.t + SINK_MS * Math.min(1, cfg.timeScale * 4)
      const rng = createRng(cfg.seed + s.casts * 7919)
      const bite = planSpeciesBite(rng, cfg.location, cfg.species, {
        castAt: e.t,
        settledAt,
        hour: e.hour,
        timeScale: cfg.timeScale,
        setup: e.setup,
      })
      return {
        ...s,
        phase: 'sinking',
        casts: s.casts + 1,
        chargeStartedAt: undefined,
        cast: { at: e.t, settledAt, distanceM: dMin + (dMax - dMin) * power + (e.setup?.castBonusM ?? 0) * power, power, strength: e.setup?.strength ?? 1 },
        bite,
        lastTick: e.t,
      }
    }

    case 'tick':
      return tick(cfg, s, e.t, e.paused ?? false)

    case 'strike': {
      if (s.phase !== 'waiting' && s.phase !== 'sinking') return s
      const bite = s.bite!
      const r = judgeStrike(bite, e.t)
      if (r === 'hooked') {
        const sp = speciesOf(bite.speciesId)
        return {
          ...s,
          phase: 'fighting',
          fight: initFight(sp, bite.weightG, s.cast!.distanceM, cfg.seed ^ (s.casts * 104729), s.cast!.strength),
          reeling: false,
          lastTick: e.t,
        }
      }
      const result: Result =
        r === 'nothing' ? { kind: 'nothing' } : { kind: r, speciesId: bite.speciesId }
      return { ...s, phase: 'result', result }
    }

    case 'reel':
      return { ...s, reeling: e.on }

    case 'net': {
      if (s.phase !== 'landable' || !s.fight) return s
      const f = s.fight
      return {
        ...s,
        phase: 'result',
        reeling: false,
        result: {
          kind: 'landed',
          fish: { speciesId: f.speciesId, weightG: f.weightG, caughtAt: e.t, distanceM: s.cast!.distanceM },
        },
      }
    }

    case 'reset':
      if (s.phase !== 'result') return s
      return { ...s, phase: 'ready', result: undefined, bite: undefined, fight: undefined, cast: undefined }
  }
}

function tick(_cfg: GameConfig, s: GameState, t: number, paused: boolean): GameState {
  if (s.phase === 'sinking' && t >= s.cast!.settledAt) s = { ...s, phase: 'waiting' }
  if (s.phase === 'waiting' && t > s.bite!.strikeClose + LEAVE_AFTER_MS) {
    return { ...s, phase: 'result', result: { kind: 'gone', speciesId: s.bite!.speciesId }, lastTick: t }
  }
  if ((s.phase === 'fighting' || s.phase === 'landable') && s.fight) {
    if (paused) return { ...s, reeling: false, lastTick: t, landableSince: s.landableSince === undefined ? undefined : t }
    if (s.phase === 'landable') {
      if (t - (s.landableSince ?? t) <= LANDABLE_GRACE_MS) return { ...s, lastTick: t }
      // cá hồi sức, lặn xuống: kéo tiếp
      return { ...s, phase: 'fighting', landableSince: undefined, fight: { ...s.fight, stamina: 0.45, distanceM: 4 }, lastTick: t }
    }
    const raw = Math.max(0, t - s.lastTick)
    const dt = Math.min(MAX_FIGHT_TICK_MS, raw)
    const consumed = Math.floor(dt / STEP_MS) * STEP_MS
    // Phần lẻ chưa đủ một bước (khung hình 16–20 ms) được giữ lại cho nhịp sau, không bị bỏ mất.
    const nextTick = raw > MAX_FIGHT_TICK_MS ? t : s.lastTick + consumed
    if (consumed === 0) return s
    const fight = advanceFight(s.fight, consumed, s.reeling)
    const o = outcomeOf(fight)
    if (o === 'broke') return { ...s, fight, phase: 'result', result: { kind: 'broke', speciesId: fight.speciesId, weightG: fight.weightG }, lastTick: nextTick }
    if (o === 'escaped') return { ...s, fight, phase: 'result', result: { kind: 'escaped', speciesId: fight.speciesId }, lastTick: nextTick }
    if (o === 'landable') return { ...s, fight, phase: 'landable', landableSince: t, reeling: false, lastTick: nextTick }
    return { ...s, fight, phase: 'fighting', lastTick: nextTick }
  }
  return { ...s, lastTick: t }
}

/** Trạng thái phao trong lúc chờ, để hiển thị và gợi ý. */
export type WaitStatus = 'settling' | 'quiet' | 'nibbling' | 'window' | 'after'

export function waitStatus(s: GameState, t: number): WaitStatus | undefined {
  if (s.phase === 'sinking') return 'settling'
  if (s.phase !== 'waiting' || !s.bite) return undefined
  if (t < s.bite.nibbleStart) return 'quiet'
  if (t < s.bite.strikeOpen) return 'nibbling'
  if (t <= s.bite.strikeClose) return 'window'
  return 'after'
}
