import { aggregateHandbook, type CatchRecord, type GameRepository, mergeHandbook, type SessionOutcome, type SessionRecord, type StoredPlayer } from './types'

/**
 * Hàng đợi ghi offline. Mọi lệnh ghi vào server đi qua đây: lưu xuống máy trước, gửi theo đúng thứ tự,
 * mất mạng thì giữ lại và gửi lại sau. Id do client sinh nên gửi lại bao nhiêu lần cũng không trùng.
 * Riêng lưu tiến độ không xếp hàng: luôn chỉ cần bản mới nhất.
 */
type Op =
  | { op: 'startSession'; s: SessionRecord }
  | { op: 'endSession'; id: string; endedAt: number; outcome: SessionOutcome; earnedCoins: number }
  | { op: 'recordCatch'; c: CatchRecord }
  | { op: 'setCatchFate'; id: string; fate: CatchRecord['fate'] }

type Store = Pick<Storage, 'getItem' | 'setItem'>

export class OutboxRepository implements GameRepository {
  readonly kind
  private flushing: Promise<void> | null = null
  /** số lần gửi hỏng liên tiếp, để báo lên UI */
  failures = 0
  lastError: string | undefined

  constructor(
    private readonly inner: GameRepository,
    private readonly storage: Store = globalThis.localStorage,
    private readonly key = 'can-thu:outbox:v1',
  ) {
    this.kind = inner.kind
  }

  pending(): Op[] {
    try {
      return JSON.parse(this.storage.getItem(this.key) ?? '[]')
    } catch {
      return []
    }
  }

  private save(ops: Op[]) {
    try {
      this.storage.setItem(this.key, JSON.stringify(ops))
    } catch {
      /* đầy bộ nhớ: bỏ qua */
    }
  }

  private enqueue(op: Op) {
    this.save([...this.pending(), op])
    return this.flush()
  }

  /** Gửi hết hàng đợi theo thứ tự. Lỗi thì dừng, giữ phần còn lại cho lần sau. */
  flush(): Promise<void> {
    this.flushing ??= (async () => {
      try {
        let ops = this.pending()
        while (ops.length > 0) {
          await this.send(ops[0]!)
          ops = this.pending().slice(1)
          this.save(ops)
        }
        this.failures = 0
        this.lastError = undefined
      } catch (e) {
        this.failures++
        this.lastError = (e as Error).message ?? String(e)
      } finally {
        this.flushing = null
      }
    })()
    return this.flushing
  }

  private send(o: Op): Promise<void> {
    switch (o.op) {
      case 'startSession':
        return this.inner.startSession(o.s)
      case 'endSession':
        return this.inner.endSession(o.id, o.endedAt, o.outcome, o.earnedCoins)
      case 'recordCatch':
        return this.inner.recordCatch(o.c)
      case 'setCatchFate':
        return this.inner.setCatchFate(o.id, o.fate)
    }
  }

  init() {
    return this.inner.init().then(() => this.flush())
  }
  loadPlayer() {
    return this.inner.loadPlayer()
  }
  savePlayer(v: number, p: Omit<StoredPlayer, 'version'>) {
    return this.inner.savePlayer(v, p)
  }
  async openSession() {
    const queued = this.pending().filter((o) => o.op === 'startSession' || o.op === 'endSession')
    const last = queued.at(-1)
    if (last?.op === 'startSession') return last.s
    if (last?.op === 'endSession') return null
    return this.inner.openSession()
  }
  startSession(s: SessionRecord) {
    return this.enqueue({ op: 'startSession', s })
  }
  endSession(id: string, endedAt: number, outcome: SessionOutcome, earnedCoins: number) {
    return this.enqueue({ op: 'endSession', id, endedAt, outcome, earnedCoins })
  }
  recordCatch(c: CatchRecord) {
    return this.enqueue({ op: 'recordCatch', c })
  }
  setCatchFate(id: string, fate: CatchRecord['fate']) {
    return this.enqueue({ op: 'setCatchFate', id, fate })
  }
  private queuedCatches(): CatchRecord[] {
    return this.pending().flatMap((o) => (o.op === 'recordCatch' ? [o.c] : []))
  }
  async handbook() {
    const queued = aggregateHandbook(this.queuedCatches())
    try {
      return mergeHandbook(await this.inner.handbook(), queued)
    } catch {
      return queued
    }
  }
  async recentCatches(limit: number) {
    const queued = this.queuedCatches()
    let remote: CatchRecord[] = []
    try {
      remote = await this.inner.recentCatches(limit)
    } catch {
      /* offline */
    }
    const ids = new Set(remote.map((c) => c.id))
    return [...queued.filter((c) => !ids.has(c.id)), ...remote].sort((a, b) => b.caughtAt - a.caughtAt).slice(0, limit)
  }
  account() {
    return this.inner.account()
  }
  linkGoogle() {
    return this.inner.linkGoogle()
  }
  linkEmail(email: string) {
    return this.inner.linkEmail(email)
  }
  async deleteAccount() {
    await this.inner.deleteAccount()
    this.save([])
  }
}
