import type { Location, Species } from '../content'
import { between, type Rng, weighted } from './rng'

/**
 * Kế hoạch một lượt cá cắn câu, tính ngay lúc quăng.
 *
 *   cast ── mồi chìm ── chờ cá ──▶ nibbleStart ── rỉa ──▶ strikeOpen ─ cửa sổ giật ─▶ strikeClose ─▶ cá bỏ đi
 *
 * Cửa sổ rỉa dài (10–40 s) là chủ ý: người đang làm việc nhận báo động lúc cá bắt đầu rỉa,
 * quay lại kịp xem phao trước khi tới cửa sổ giật.
 */
export interface BiteParams {
  waitSec: readonly [number, number]
  nibbleSec: readonly [number, number]
  strikeWindowSec: number
}

export const DEFAULT_BITE: BiteParams = {
  waitSec: [20, 120],
  nibbleSec: [10, 40],
  strikeWindowSec: 1.0,
}

export interface Twitch {
  at: number
  durMs: number
  /** nấc, dương = phao chìm xuống */
  amp: number
}

export interface BitePlan {
  castAt: number
  nibbleStart: number
  strikeOpen: number
  strikeClose: number
}

export interface SpeciesBitePlan extends BitePlan {
  speciesId: string
  weightG: number
  signal: Species['bite']['signal']
  twitches: Twitch[]
}

export function planBite(rng: Rng, castAt: number, p: BiteParams = DEFAULT_BITE): BitePlan {
  const nibbleStart = castAt + between(rng, p.waitSec[0], p.waitSec[1]) * 1000
  const strikeOpen = nibbleStart + between(rng, p.nibbleSec[0], p.nibbleSec[1]) * 1000
  return { castAt, nibbleStart, strikeOpen, strikeClose: strikeOpen + p.strikeWindowSec * 1000 }
}

/** Hệ số "giờ ăn": loài đang trong giờ ăn mạnh thì dễ tới hơn. */
export function hourFactor(s: Species, hour: number): number {
  return s.activeHours.includes(hour) ? 1.8 : 1
}

/** Cân nặng lệch về phía cỡ thường gặp, thỉnh thoảng mới có con lớn. */
export function sampleWeight(rng: Rng, s: Species): number {
  const [min, max] = s.weightG
  const u = rng()
  const skewed = u < 0.85 ? (u / 0.85) * (s.typicalG - min) * 1.4 + min : s.typicalG + ((u - 0.85) / 0.15) * (max - s.typicalG)
  return Math.round(Math.min(max, Math.max(min, skewed)))
}

export interface PlanOptions {
  /** Thời điểm mồi chạm đáy (sau khi chìm). */
  settledAt: number
  castAt: number
  hour: number
  /** Thu nhỏ thời gian chờ và rỉa (chế độ test). 1 = bình thường. */
  timeScale?: number
}

export function planSpeciesBite(
  rng: Rng,
  loc: Location,
  speciesList: readonly Species[],
  o: PlanOptions,
): SpeciesBitePlan {
  const scale = o.timeScale ?? 1
  const byId = new Map(speciesList.map((s) => [s.id, s]))
  const species = weighted(
    rng,
    loc.species.map((ls) => {
      const s = byId.get(ls.id)!
      return { item: s, weight: ls.weight * hourFactor(s, o.hour) }
    }),
  )
  const nibbleStart = o.settledAt + between(rng, loc.waitSec[0], loc.waitSec[1]) * 1000 * scale
  const strikeOpen = nibbleStart + between(rng, species.bite.nibbleSec[0], species.bite.nibbleSec[1]) * 1000 * scale
  const windowMs = species.bite.windowSec * 1000 * Math.max(scale, 1)
  const twitches: Twitch[] = []
  let t = nibbleStart
  const [eMin, eMax] = species.bite.decoy.everySec
  while (true) {
    t += between(rng, eMin, eMax) * 1000 * Math.max(scale, 0.25)
    if (t > strikeOpen - 700) break
    twitches.push({ at: t, durMs: between(rng, 250, 500), amp: species.bite.decoy.amp * between(rng, 0.6, 1.2) })
  }
  if (species.bite.signal.kind === 'slow_sink') {
    // chép: "chớp đầu" ngay trước khi ăn thật. Phao tụt rồi bật về, cá mới ngậm hờ.
    twitches.push({ at: strikeOpen - 650, durMs: 380, amp: 0.55 })
  }
  return {
    castAt: o.castAt,
    nibbleStart,
    strikeOpen,
    strikeClose: strikeOpen + windowMs,
    speciesId: species.id,
    weightG: sampleWeight(rng, species),
    signal: species.bite.signal,
    twitches,
  }
}

export type StrikeResult = 'hooked' | 'too_early' | 'too_late' | 'nothing'

/** Chấm cú giật tại thời điểm t. */
export function judgeStrike(plan: BitePlan, t: number): StrikeResult {
  if (t < plan.nibbleStart) return 'nothing'
  if (t < plan.strikeOpen) return 'too_early'
  if (t <= plan.strikeClose) return 'hooked'
  return 'too_late'
}

export type BiteEventKind = 'nibble_start' | 'strike_open' | 'strike_close'

export function biteEvents(plan: BitePlan): { at: number; kind: BiteEventKind }[] {
  return [
    { at: plan.nibbleStart, kind: 'nibble_start' },
    { at: plan.strikeOpen, kind: 'strike_open' },
    { at: plan.strikeClose, kind: 'strike_close' },
  ]
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/**
 * Phao lệch bao nhiêu nấc so với nấc câu ở thời điểm t (dương = chìm, âm = nổi).
 * Hàm thuần theo thời gian: cảnh 3D, khung phao và test đều gọi chung.
 */
export function floatOffset(plan: SpeciesBitePlan, t: number): number {
  let off = 0
  for (const w of plan.twitches) {
    const x = (t - w.at) / w.durMs
    if (x > 0 && x < 1) off += w.amp * Math.sin(Math.PI * x)
  }
  if (t >= plan.strikeOpen) {
    const { kind, amp } = plan.signal
    const sinceOpen = t - plan.strikeOpen
    const windowMs = plan.strikeClose - plan.strikeOpen
    const holdEnd = plan.strikeClose + 1200
    const fade = 1 - ease((t - holdEnd) / 1500) // cá nhả mồi, phao trả về nấc cũ
    const shape = kind === 'slow_sink' ? ease(sinceOpen / windowMs) : ease(sinceOpen / 180)
    off += (kind === 'rise' ? -amp : amp) * shape * fade
  }
  return off
}
