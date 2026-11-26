import { aggregateHandbook, type CatchRecord, type GameRepository, type SessionRecord } from './types'

/** Lưu trên máy (localStorage). Dùng khi chưa cấu hình Supabase, và cho test. */
export class LocalRepository implements GameRepository {
  readonly kind = 'local' as const
  private readonly key: string

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = globalThis.localStorage,
    namespace = 'can-thu:v1',
  ) {
    this.key = namespace
  }

  private read(): { sessions: SessionRecord[]; catches: CatchRecord[] } {
    try {
      const raw = this.storage.getItem(this.key)
      if (raw) return JSON.parse(raw)
    } catch {
      /* dữ liệu hỏng hoặc bị chặn: bắt đầu lại */
    }
    return { sessions: [], catches: [] }
  }

  private write(d: { sessions: SessionRecord[]; catches: CatchRecord[] }) {
    try {
      this.storage.setItem(this.key, JSON.stringify(d))
    } catch {
      /* chế độ riêng tư: chỉ giữ trong phiên */
    }
  }

  async init() {}

  async startSession(s: SessionRecord) {
    const d = this.read()
    if (!d.sessions.some((x) => x.id === s.id)) d.sessions.push(s)
    this.write(d)
  }

  async recordCatch(c: CatchRecord) {
    const d = this.read()
    if (!d.catches.some((x) => x.id === c.id)) d.catches.push(c) // gửi trùng: bỏ qua, giống RPC
    this.write(d)
  }

  async handbook() {
    return aggregateHandbook(this.read().catches)
  }

  async recentCatches(limit: number) {
    return [...this.read().catches].sort((a, b) => b.caughtAt - a.caughtAt).slice(0, limit)
  }
}
