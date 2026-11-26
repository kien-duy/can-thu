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

export type SessionOutcome = 'sold' | 'released' | 'mixed' | 'abandoned'

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

export interface Sighting {
  creatureId: string
  firstLocation: string
  firstSeenAt: number
  lastSeenAt: number
  timesSeen: number
}

export interface StoredPlayer {
  version: number
  coins: number
  xp: number
  state: unknown
}

export interface Account {
  /** 'local' = chưa nối server, dữ liệu chỉ ở máy này */
  mode: 'local' | 'guest' | 'linked'
  email?: string
  providers: string[]
}

export interface GameRepository {
  readonly kind: 'local' | 'supabase'
  /** Đăng nhập khách nếu chưa có phiên. */
  init(): Promise<void>
  loadPlayer(): Promise<StoredPlayer | null>
  /** Trả về version mới, hoặc -1 nếu trên server đã có bản mới hơn (máy khác vừa lưu). */
  savePlayer(expectedVersion: number, p: Omit<StoredPlayer, 'version'>): Promise<number>
  openSession(): Promise<SessionRecord | null>
  startSession(s: SessionRecord): Promise<void>
  endSession(id: string, endedAt: number, outcome: SessionOutcome, earnedCoins: number): Promise<void>
  recordCatch(c: CatchRecord): Promise<void>
  setCatchFate(id: string, fate: CatchRecord['fate']): Promise<void>
  handbook(): Promise<HandbookEntry[]>
  recentCatches(limit: number): Promise<CatchRecord[]>
  recordSighting(creatureId: string, locationId: string, seenAt: number): Promise<void>
  sightings(): Promise<Sighting[]>
  account(): Promise<Account>
  linkGoogle(): Promise<void>
  /** Gửi thư xác nhận; tài khoản thành chính thức khi bấm link trong thư. */
  linkEmail(email: string): Promise<void>
  deleteAccount(): Promise<void>
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

/** Gộp sổ tay từ server với những con cá còn nằm trong hàng đợi offline. */
export function mergeHandbook(a: readonly HandbookEntry[], b: readonly HandbookEntry[]): HandbookEntry[] {
  const out = new Map(a.map((e) => [e.speciesId, { ...e }]))
  for (const e of b) {
    const x = out.get(e.speciesId)
    if (!x) {
      out.set(e.speciesId, { ...e })
      continue
    }
    out.set(e.speciesId, {
      speciesId: e.speciesId,
      totalCaught: x.totalCaught + e.totalCaught,
      recordWeightG: Math.max(x.recordWeightG, e.recordWeightG),
      firstCaughtAt: Math.min(x.firstCaughtAt, e.firstCaughtAt),
      lastCaughtAt: Math.max(x.lastCaughtAt, e.lastCaughtAt),
      locations: [...new Set([...x.locations, ...e.locations])].sort(),
      favouriteHour: x.totalCaught >= e.totalCaught ? x.favouriteHour : e.favouriteHour,
    })
  }
  return [...out.values()]
}
