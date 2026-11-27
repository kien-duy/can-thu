import type { Location, Species } from '../content'
import { between, type Rng, weighted } from './rng'
import { dissolveMs, type Setup, signalScale, speciesWeight, waitFactor } from './setup'

/**
 * Kế hoạch một lượt cá cắn câu, tính ngay lúc quăng.
 *
 *   cast ── mồi chìm ── chờ cá ──▶ nibbleStart ── rỉa ──▶ strikeOpen ─ cửa sổ giật ─▶ strikeClose ─▶ cá bỏ đi
 *
 * Cửa sổ rỉa dài (10–40 s) là chủ ý: người đang làm việc nhận báo động lúc cá bắt đầu rỉa,
 * quay lại kịp xem phao trước khi tới cửa sổ giật.
 *
 * Với loài cá thật (planSpeciesBite), cá không giật kịp thì chưa bỏ đi ngay: nhả mồi, lượn một lúc rồi
 * rỉa lại, thành nhiều "đợt" (rounds), mỗi đợt có pha rỉa và cửa sổ giật riêng. Mỗi lần quay lại cá có thể
 * hoảng mà bỏ đi; mồi rã hết thì không còn đợt nào nữa. Cửa sổ giật vẫn ngắn, giật sớm vẫn hỏng:
 * chỉ người vắng mặt lúc đợt đầu là có thêm cơ hội.
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

/** Một đợt cá rỉa: pha rỉa thử rồi cửa sổ ăn thật. */
export interface BiteRound {
  nibbleStart: number
  strikeOpen: number
  strikeClose: number
}

/** nibbleStart, strikeOpen, strikeClose là của đợt đầu tiên. */
export interface BitePlan extends BiteRound {
  castAt: number
  /** mọi đợt rỉa theo thứ tự thời gian, đợt đầu trùng các mốc ở trên; không có = chỉ một đợt */
  rounds?: readonly BiteRound[]
}

/**
 * Cá rỉa lại sau khi nhả mồi. Không giật kịp đợt trước thì cá lượn quanh pauseSec giây rồi rỉa đợt mới
 * (pha rỉa dài như đợt đầu, cùng cỡ cửa sổ giật). Mỗi lần quay lại có spookChance cá bỏ đi hẳn.
 * Tối đa maxRounds đợt, kể cả đợt đầu.
 */
export const REBITE = {
  maxRounds: 4,
  pauseSec: [6, 16] as const,
  spookChance: 0.25,
  /** khoảng lặng tối thiểu giữa hai đợt (ms, cả ở chế độ nhanh): đủ cho phao trả về nấc cũ */
  minPauseMs: 3_000,
}

export interface SpeciesBitePlan extends BitePlan {
  speciesId: string
  weightG: number
  signal: Species['bite']['signal']
  twitches: Twitch[]
  /** lúc mồi rã hết khỏi lưỡi; sau mốc này không còn cá nào ăn */
  dissolveAt: number
  /** true = mồi rã trước khi có cá tới: lượt này không có cá */
  empty: boolean
  rounds: readonly BiteRound[]
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
  /** Đồ nghề, mồi, cân phao, nhiệt độ nước. Không có thì coi như mọi thứ trung tính. */
  setup?: Setup
}

export function planSpeciesBite(
  rng: Rng,
  loc: Location,
  speciesList: readonly Species[],
  o: PlanOptions,
): SpeciesBitePlan {
  const scale = o.timeScale ?? 1
  const byId = new Map(speciesList.map((s) => [s.id, s]))
  const weights = loc.species.map((ls) => {
    const s = byId.get(ls.id)!
    const base = ls.weight * hourFactor(s, o.hour)
    return { item: s, base, weight: o.setup ? speciesWeight(s, ls.weight, hourFactor(s, o.hour), loc, o.setup) : base }
  })
  const species = weighted(rng, weights)
  const attract = weights.reduce((a, w) => a + w.weight, 0) / weights.reduce((a, w) => a + w.base, 0)
  const waitMul = o.setup ? waitFactor(attract, o.setup.bait !== null, o.setup.chum ?? 0) : 1
  const amp = o.setup ? signalScale(loc, o.setup) : 1
  const falseBites = o.setup?.rig.falseBites ?? 1
  const nibbleStart = o.settledAt + between(rng, loc.waitSec[0], loc.waitSec[1]) * 1000 * scale * waitMul
  const strikeOpen = nibbleStart + between(rng, species.bite.nibbleSec[0], species.bite.nibbleSec[1]) * 1000 * scale
  const windowMs = species.bite.windowSec * 1000 * Math.max(scale, 1)
  const twitches: Twitch[] = []
  const [eMin, eMax] = species.bite.decoy.everySec
  const every = (x: number) => (x * 1000 * Math.max(scale, 0.25)) / Math.max(0.3, falseBites)
  const addTwitches = (from: number, open: number) => {
    let t = from
    while (true) {
      t += between(rng, every(eMin), every(eMax))
      if (t > open - 700) break
      twitches.push({ at: t, durMs: between(rng, 250, 500), amp: species.bite.decoy.amp * amp * between(rng, 0.6, 1.2) })
    }
    if (species.bite.signal.kind === 'slow_sink') {
      // chép, trắm: "chớp đầu" ngay trước khi ăn thật. Phao tụt rồi bật về, cá mới ngậm hờ.
      twitches.push({ at: open - 650, durMs: 380, amp: 0.55 * amp })
    }
  }
  addTwitches(nibbleStart, strikeOpen)
  // chế độ nhanh không thu mồi rã nhỏ bằng thời gian chờ, kẻo lượt nào cũng rã trước khi cá tới
  const dissolveAt = o.settledAt + (o.setup ? dissolveMs(o.setup.bait) : 600_000) * Math.max(scale, 0.25)
  const empty = nibbleStart >= dissolveAt
  // cân nặng rút trước các đợt rỉa lại, để cùng seed vẫn ra đúng con cá như trước khi có nhiều đợt
  const weightG = sampleWeight(rng, species)
  const rounds: BiteRound[] = [{ nibbleStart, strikeOpen, strikeClose: strikeOpen + windowMs }]
  while (!empty && rounds.length < REBITE.maxRounds) {
    if (rng() < REBITE.spookChance) break
    const prev = rounds[rounds.length - 1]!
    const start = prev.strikeClose + Math.max(REBITE.minPauseMs, between(rng, REBITE.pauseSec[0], REBITE.pauseSec[1]) * 1000 * scale)
    const open = start + between(rng, species.bite.nibbleSec[0], species.bite.nibbleSec[1]) * 1000 * scale
    // cá chỉ ăn được khi trên lưỡi còn mồi
    if (open + windowMs > dissolveAt) break
    addTwitches(start, open)
    rounds.push({ nibbleStart: start, strikeOpen: open, strikeClose: open + windowMs })
  }
  return {
    dissolveAt,
    empty,
    castAt: o.castAt,
    nibbleStart,
    strikeOpen,
    strikeClose: strikeOpen + windowMs,
    rounds,
    speciesId: species.id,
    weightG,
    signal: { kind: species.bite.signal.kind, amp: species.bite.signal.amp * amp },
    twitches,
  }
}

/** Các đợt rỉa của kế hoạch (kế hoạch cũ không có rounds thì coi như một đợt). */
export function roundsOf(plan: BitePlan): readonly BiteRound[] {
  return plan.rounds && plan.rounds.length > 0 ? plan.rounds : [plan]
}

/** Đợt rỉa đã bắt đầu gần nhất tại t (đang rỉa, đang mở cửa sổ, hoặc vừa nhả mồi); trước đợt đầu thì là đợt đầu. */
export function roundAt(plan: BitePlan, t: number): BiteRound {
  const rs = roundsOf(plan)
  let r = rs[0]!
  for (const x of rs) if (x.nibbleStart <= t) r = x
  return r
}

/** Đợt cuối: qua cửa sổ này là cá bỏ đi hẳn. */
export function lastRound(plan: BitePlan): BiteRound {
  const rs = roundsOf(plan)
  return rs[rs.length - 1]!
}

export type StrikeResult = 'hooked' | 'too_early' | 'too_late' | 'nothing'

/** Chấm cú giật tại thời điểm t. Giật lúc cá vừa nhả mồi, giữa hai đợt, cũng là muộn: cá hoảng bỏ đi. */
export function judgeStrike(plan: BitePlan & { empty?: boolean }, t: number): StrikeResult {
  if (plan.empty || t < plan.nibbleStart) return 'nothing'
  const r = roundAt(plan, t)
  if (t < r.strikeOpen) return 'too_early'
  if (t <= r.strikeClose) return 'hooked'
  return 'too_late'
}

export type BiteEventKind = 'nibble_start' | 'strike_open' | 'strike_close'

/** Mốc của mọi đợt rỉa, theo thứ tự thời gian: mỗi đợt một bộ rỉa / mở cửa sổ / đóng cửa sổ. */
export function biteEvents(plan: BitePlan): { at: number; kind: BiteEventKind }[] {
  return roundsOf(plan).flatMap((r) => [
    { at: r.nibbleStart, kind: 'nibble_start' as const },
    { at: r.strikeOpen, kind: 'strike_open' as const },
    { at: r.strikeClose, kind: 'strike_close' as const },
  ])
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/**
 * Phao lệch bao nhiêu nấc so với nấc câu ở thời điểm t (dương = chìm, âm = nổi).
 * Hàm thuần theo thời gian: cảnh 3D, khung phao và test đều gọi chung.
 */
export function floatOffset(plan: SpeciesBitePlan, t: number): number {
  if (plan.empty) {
    // mồi rã dần, lưỡi nhẹ đi: phao nổi lên từng chút về nấc cân
    const x = (t - (plan.dissolveAt - 20_000)) / 20_000
    return x <= 0 ? 0 : -1.5 * Math.min(1, x)
  }
  let off = 0
  for (const w of plan.twitches) {
    const x = (t - w.at) / w.durMs
    if (x > 0 && x < 1) off += w.amp * Math.sin(Math.PI * x)
  }
  const r = roundAt(plan, t)
  if (t >= r.strikeOpen) {
    const { kind, amp } = plan.signal
    const sinceOpen = t - r.strikeOpen
    const windowMs = r.strikeClose - r.strikeOpen
    const holdEnd = r.strikeClose + 1200
    const fade = 1 - ease((t - holdEnd) / 1500) // cá nhả mồi, phao trả về nấc cũ
    const shape = kind === 'slow_sink' ? ease(sinceOpen / windowMs) : ease(sinceOpen / 180)
    off += (kind === 'rise' ? -amp : amp) * shape * fade
  }
  return off
}
