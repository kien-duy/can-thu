import {
  type Account,
  aggregateHandbook,
  type CatchRecord,
  type GameRepository,
  type SessionOutcome,
  type SessionRecord,
  type Sighting,
  type StoredPlayer,
} from './types'

interface LocalData {
  sessions: (SessionRecord & { endedAt?: number; outcome?: SessionOutcome; earnedCoins?: number })[]
  catches: CatchRecord[]
  player: StoredPlayer | null
  sightings?: Sighting[]
}

/** Lưu trên máy (localStorage). Dùng khi chưa cấu hình Supabase, và cho test. */
export class LocalRepository implements GameRepository {
  readonly kind = 'local' as const

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = globalThis.localStorage,
    private readonly key = 'can-thu:v1',
  ) {}

  private read(): LocalData {
    try {
      const raw = this.storage.getItem(this.key)
      if (raw) return { sessions: [], catches: [], player: null, ...JSON.parse(raw) }
    } catch {
      /* dữ liệu hỏng hoặc bị chặn: bắt đầu lại */
    }
    return { sessions: [], catches: [], player: null }
  }

  private write(d: LocalData) {
    try {
      this.storage.setItem(this.key, JSON.stringify(d))
    } catch {
      /* chế độ riêng tư: chỉ giữ trong phiên */
    }
  }

  private update(f: (d: LocalData) => void) {
    const d = this.read()
    f(d)
    this.write(d)
  }

  async init() {}

  async loadPlayer() {
    return this.read().player
  }

  async savePlayer(expectedVersion: number, p: Omit<StoredPlayer, 'version'>) {
    let v = -1
    this.update((d) => {
      const cur = d.player?.version ?? 0
      if (cur !== expectedVersion) return
      v = cur + 1
      d.player = { ...p, version: v }
    })
    return v
  }

  async openSession() {
    return this.read().sessions.find((s) => s.endedAt === undefined) ?? null
  }

  async startSession(s: SessionRecord) {
    this.update((d) => {
      // giống RPC start_session: ca cũ còn treo thì đóng thành 'abandoned'
      for (const x of d.sessions) if (x.endedAt === undefined && x.id !== s.id) Object.assign(x, { endedAt: s.startedAt, outcome: 'abandoned' })
      if (!d.sessions.some((x) => x.id === s.id)) d.sessions.push(s)
    })
  }

  async endSession(id: string, endedAt: number, outcome: SessionOutcome, earnedCoins: number) {
    this.update((d) => {
      const s = d.sessions.find((x) => x.id === id)
      if (s && s.endedAt === undefined) Object.assign(s, { endedAt, outcome, earnedCoins })
    })
  }

  async recordCatch(c: CatchRecord) {
    this.update((d) => {
      if (!d.catches.some((x) => x.id === c.id)) d.catches.push(c) // gửi trùng: bỏ qua, giống RPC
    })
  }

  async setCatchFate(id: string, fate: CatchRecord['fate']) {
    this.update((d) => {
      const c = d.catches.find((x) => x.id === id)
      if (c) c.fate = fate
    })
  }

  async handbook() {
    return aggregateHandbook(this.read().catches)
  }

  async recentCatches(limit: number) {
    return [...this.read().catches].sort((a, b) => b.caughtAt - a.caughtAt).slice(0, limit)
  }

  async recordSighting(creatureId: string, locationId: string, seenAt: number) {
    this.update((d) => {
      d.sightings ??= []
      const x = d.sightings.find((s) => s.creatureId === creatureId)
      if (x) Object.assign(x, { lastSeenAt: Math.max(x.lastSeenAt, seenAt), timesSeen: x.timesSeen + 1 })
      else d.sightings.push({ creatureId, firstLocation: locationId, firstSeenAt: seenAt, lastSeenAt: seenAt, timesSeen: 1 })
    })
  }

  async sightings() {
    return this.read().sightings ?? []
  }

  async account(): Promise<Account> {
    return { mode: 'local', providers: [] }
  }

  async linkGoogle() {
    throw new Error('Bản này chưa nối server nên chưa liên kết được tài khoản.')
  }

  async linkEmail() {
    throw new Error('Bản này chưa nối server nên chưa liên kết được tài khoản.')
  }

  async deleteAccount() {
    this.storage.removeItem(this.key)
  }
}
