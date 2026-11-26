/**
 * Cửa vào dữ liệu duy nhất. Game chỉ biết interface này; bản Supabase, bản lưu trên máy
 * (và sau này bản Cloudflare Worker) đều cài cùng một interface.
 */
export type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'fog'

export interface Weather {
  kind: WeatherKind
  tempC: number
  windMs: number
  waterTempC: number
}

export interface SessionRecord {
  id: string
  locationId: string
  kind: 'paid_shift' | 'free'
  ticketCoins: number
  startedAt: number
  plannedEndAt?: number
  weather: Weather
}

export interface CatchRecord {
  id: string
  sessionId: string
  speciesId: string
  locationId: string
  weightG: number
  caughtAt: number
  localHour: number
  weatherKind: WeatherKind
  waterTempC?: number
  depthCm?: number
  bait: Record<string, unknown>
  rig: Record<string, unknown>
  fate: 'kept' | 'released' | 'sold'
}

export interface HandbookEntry {
  speciesId: string
  totalCaught: number
  recordWeightG: number
  firstCaughtAt: number
  lastCaughtAt: number
  locations: string[]
  favouriteHour: number
}

export interface GameRepository {
  readonly kind: 'local' | 'supabase'
  /** Đăng nhập khách nếu chưa có phiên. */
  init(): Promise<void>
  startSession(s: SessionRecord): Promise<void>
  recordCatch(c: CatchRecord): Promise<void>
  handbook(): Promise<HandbookEntry[]>
  recentCatches(limit: number): Promise<CatchRecord[]>
}

/** Tổng hợp sổ tay theo loài. Cùng nghĩa với view handbook_entries trong Postgres. */
export function aggregateHandbook(catches: readonly CatchRecord[]): HandbookEntry[] {
  const by = new Map<string, CatchRecord[]>()
  for (const c of catches) by.set(c.speciesId, [...(by.get(c.speciesId) ?? []), c])
  return [...by.entries()].map(([speciesId, cs]) => {
    const hours = new Map<number, number>()
    for (const c of cs) hours.set(c.localHour, (hours.get(c.localHour) ?? 0) + 1)
    // mode(): giờ xuất hiện nhiều nhất; hoà thì lấy giờ nhỏ hơn (giống "order by" trong SQL)
    const favouriteHour = [...hours.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0]
    return {
      speciesId,
      totalCaught: cs.length,
      recordWeightG: Math.max(...cs.map((c) => c.weightG)),
      firstCaughtAt: Math.min(...cs.map((c) => c.caughtAt)),
      lastCaughtAt: Math.max(...cs.map((c) => c.caughtAt)),
      locations: [...new Set(cs.map((c) => c.locationId))].sort(),
      favouriteHour,
    }
  })
}
