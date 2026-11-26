/**
 * Đồ nghề, mồi, cân phao và điều kiện nước ảnh hưởng tới việc cá cắn. Toàn hàm thuần.
 *
 *   trọng số loài = trọng số ở hồ × giờ ăn × hợp mồi × hợp nhiệt độ × hợp tầng nước × ngại dây
 *   thời gian chờ = cơ bản ÷ độ hấp dẫn tổng (có trần, có sàn)
 *   độ to của phao = cân phao × loại phao × độ sâu có đúng không
 */
import { AXES, type Axes, BAIT, type FloatGear, type Line, type Location, type Rig, type Species } from '../content'

/** Tình trạng câu lúc quăng, gom từ túi đồ của người chơi. */
export interface Setup {
  /** mồi trên lưỡi; null = lưỡi không có mồi */
  bait: Axes | null
  rig: Rig
  float: FloatGear
  line: Line
  /** độ sâu phao đang đặt, cm (null = chưa dò đáy, dùng mặc định) */
  depthCm: number | null
  waterTempC: number
  /** sức chịu của bộ cần + dây; trận kéo đứt khi lực vượt mức này */
  strength: number
  castBonusM: number
  /** độ đậm của ổ mồi xả ở chỗ đang câu, 0..1 (đã tính phân rã theo thời gian) */
  chum?: number
}

/** Ổ mồi xả nhạt dần: sau ngần này thời gian còn một nửa. */
export const CHUM_HALF_LIFE_MS = 10 * 60_000
/** Mỗi nắm mồi xả làm ổ đậm thêm ngần này (tối đa 1). */
export const CHUM_PER_THROW = 0.35
export const CHUM_USES = 3

export function chumNow(level: number, at: number, t: number, halfLifeMs = CHUM_HALF_LIFE_MS): number {
  return level * 0.5 ** (Math.max(0, t - at) / halfLifeMs)
}

/** Mồi trên lưỡi rã sau bao lâu trong nước (ms, chưa nhân timeScale): mồi càng tơi rã càng nhanh. */
export function dissolveMs(bait: Axes | null): number {
  if (!bait) return 60_000
  return (240 - 120 * bait.loose) * 1000
}

/** Độ sâu mặc định khi chưa dò đáy: treo ngắn hơn đáy 30 cm, tức đang câu lửng mà không biết. */
export const UNSOUNDED_SHORT_CM = 30

/** Trộn một chậu mồi: trung bình có trọng số theo số muỗng. */
export function mixAxes(scoops: Record<string, number>): Axes {
  const total = Object.values(scoops).reduce((a, b) => a + b, 0)
  if (total <= 0) return { fishy: 0, sweet: 0, sour: 0, loose: 0 }
  const acc = { fishy: 0, sweet: 0, sour: 0, loose: 0 }
  for (const [id, n] of Object.entries(scoops)) {
    const ing = BAIT.ingredients.find((i) => i.id === id)
    if (!ing) continue
    for (const a of AXES) acc[a] += ing.axes[a] * n
  }
  // mùi (tanh, ngọt, chua) đậm theo tỉ lệ; một muỗng phụ gia mạnh cũng đủ đổi vị, nên nhân lên rồi kẹp
  const strong = (x: number) => Math.min(1, (x / total) * 2.2)
  return {
    fishy: strong(acc.fishy),
    sweet: strong(acc.sweet),
    sour: strong(acc.sour),
    loose: Math.min(1, Math.max(0, 0.35 + acc.loose / total)),
  }
}

/** Mồi hợp khẩu vị loài tới đâu: 0 (lạc đề) .. 1 (đúng ý). */
export function baitMatch(s: Species, bait: Axes): number {
  let d = 0
  for (const a of AXES) d += Math.abs(s.prefs[a] - bait[a])
  return Math.max(0, 1 - d / AXES.length / 0.6)
}

export function tempFactor(s: Species, waterTempC: number): number {
  const [lo, hi] = s.waterTempC
  if (waterTempC >= lo && waterTempC <= hi) return 1
  const off = waterTempC < lo ? lo - waterTempC : waterTempC - hi
  return Math.max(0.2, 1 - off * 0.15)
}

/** Mồi cách đáy bao nhiêu cm (âm = treo lửng, dương = nằm đáy). */
export function baitOffsetCm(loc: Location, setup: Setup): number {
  const depth = setup.depthCm ?? loc.bottomDepthCm - UNSOUNDED_SHORT_CM
  return depth - loc.bottomDepthCm
}

export function layerFactor(s: Species, offsetCm: number): number {
  const hanging = offsetCm < -6
  if (s.layer === 'bottom') return hanging ? Math.max(0.25, 1 + offsetCm / 25) : 1
  return hanging ? 1.6 : 0.8
}

/** Cá nhỏ, nhát (diếc, trôi...) ngại dây to. */
export function shyFactor(s: Species, line: Line): number {
  return s.typicalG < 1000 ? line.shyFactor : 1
}

export function speciesWeight(s: Species, base: number, hourF: number, loc: Location, setup: Setup): number {
  const bait = setup.bait ? 0.3 + 1.7 * baitMatch(s, setup.bait) ** 2 : 0.15
  return base * hourF * bait * tempFactor(s, setup.waterTempC) * layerFactor(s, baitOffsetCm(loc, setup)) * shyFactor(s, setup.line)
}

/**
 * Độ to của tín hiệu phao. Sai độ sâu: mồi nằm đáy quá nhiều thì phao "lụt", báo nhỏ;
 * phao nhạy và cân nhạy làm cả cú rỉa lẫn cú ăn thật hiện rõ hơn.
 */
export function signalScale(loc: Location, setup: Setup): number {
  const off = baitOffsetCm(loc, setup) - setup.rig.bottomOffsetCm
  const lazy = off > 6 ? Math.max(0.5, 1 - (off - 6) / 30) : 1
  return Math.min(1.8, setup.rig.sensitivity * setup.float.sensitivity * lazy)
}

/** Hệ số nhân thời gian chờ: mồi hợp và đúng tầng thì cá tới nhanh hơn. */
export function waitFactor(attractiveness: number, hasBait: boolean, chum = 0): number {
  if (!hasBait) return 3
  // ổ đậm giữ đàn cá quanh chỗ câu: cá tới nhanh hơn, tối đa nhanh gấp đôi
  return Math.min(2.5, Math.max(0.3, (1 / Math.max(0.01, attractiveness)) * (1 - 0.5 * Math.min(1, chum))))
}
