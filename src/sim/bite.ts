import { between, type Rng } from './rng'

/**
 * Kế hoạch một lượt cá cắn câu, tính ngay lúc quăng.
 *
 *   cast ── chờ cá ──▶ nibbleStart ── rỉa 10–40 s ──▶ strikeOpen ─ ~1 s ─▶ strikeClose ─▶ fish leaves
 *
 * Cửa sổ rỉa dài là chủ ý: người đang làm việc nhận báo động lúc cá bắt đầu rỉa, quay lại
 * kịp xem phao trước khi tới cửa sổ giật.
 */
export interface BiteParams {
  /** Khoảng chờ cá tới, tính bằng giây sau khi mồi nằm đáy. */
  waitSec: readonly [number, number]
  /** Thời gian rỉa trước khi ăn thật, tính bằng giây. */
  nibbleSec: readonly [number, number]
  /** Độ dài cửa sổ giật, tính bằng giây. */
  strikeWindowSec: number
}

export const DEFAULT_BITE: BiteParams = {
  waitSec: [20, 120],
  nibbleSec: [10, 40],
  strikeWindowSec: 1.0,
}

export interface BitePlan {
  castAt: number
  nibbleStart: number
  strikeOpen: number
  strikeClose: number
}

export function planBite(rng: Rng, castAt: number, p: BiteParams = DEFAULT_BITE): BitePlan {
  const nibbleStart = castAt + between(rng, p.waitSec[0], p.waitSec[1]) * 1000
  const strikeOpen = nibbleStart + between(rng, p.nibbleSec[0], p.nibbleSec[1]) * 1000
  return { castAt, nibbleStart, strikeOpen, strikeClose: strikeOpen + p.strikeWindowSec * 1000 }
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
