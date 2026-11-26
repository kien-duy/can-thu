/**
 * Sinh vật ghé qua bờ nước: chọn theo địa điểm, giờ và thời tiết. Chỉ để ngắm và sưu tầm,
 * không ảnh hưởng chuyện câu (đã chốt ở vòng hỏi).
 */
import { type Creature, CREATURES } from '../content'
import type { WeatherKind } from '../data/types'
import { between, type Rng, weighted } from './rng'

export interface Visit {
  creatureId: string
  at: number
  untilMs: number
}

/** Bao lâu một lần có sinh vật ghé (giây, chưa nhân timeScale). */
export const VISIT_GAP_SEC: readonly [number, number] = [90, 300]
/** Một lượt ghé kéo dài bao lâu (giây). */
export const VISIT_LEN_SEC: readonly [number, number] = [12, 25]

export function eligible(locationId: string, hour: number, weather: WeatherKind, list: readonly Creature[] = CREATURES): Creature[] {
  return list.filter((c) => c.locations.includes(locationId) && c.hours.includes(hour) && c.weathers.includes(weather))
}

/** Lượt ghé kế tiếp sau thời điểm `after`. null nếu giờ này ở đây không có con nào. */
export function nextVisit(rng: Rng, locationId: string, hour: number, weather: WeatherKind, after: number, timeScale = 1): Visit | null {
  const gap = between(rng, VISIT_GAP_SEC[0], VISIT_GAP_SEC[1]) * 1000 * timeScale
  const pool = eligible(locationId, hour, weather)
  if (pool.length === 0) return null
  const c = weighted(
    rng,
    pool.map((x) => ({ item: x, weight: x.weight })),
  )
  return { creatureId: c.id, at: after + gap, untilMs: between(rng, VISIT_LEN_SEC[0], VISIT_LEN_SEC[1]) * 1000 }
}
