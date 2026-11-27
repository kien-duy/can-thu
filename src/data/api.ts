import type { Account, CatchRecord, GameRepository, HandbookEntry, SessionOutcome, SessionRecord, Sighting, StoredPlayer } from './types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/** Bản gọi server của chính game (server/app.ts). Phiên đăng nhập nằm trong cookie httpOnly. */
export class ApiRepository implements GameRepository {
  readonly kind = 'server' as const

  constructor(private readonly base = '/api') {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      credentials: 'same-origin',
      // Lệnh ghi luôn là JSON: server dựa vào đó để chặn CSRF.
      headers: method === 'GET' ? undefined : { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    })
    const data = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null
    if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'http_' + res.status, data?.error?.message ?? `Server trả lỗi ${res.status}`)
    return data as T
  }

  async init() {
    await this.call<Account>('POST', '/session')
  }
  loadPlayer() {
    return this.call<StoredPlayer | null>('GET', '/player')
  }
  async savePlayer(expectedVersion: number, p: Omit<StoredPlayer, 'version'>) {
    return (await this.call<{ version: number }>('PUT', '/player', { expectedVersion, ...p })).version
  }
  openSession() {
    return this.call<SessionRecord | null>('GET', '/sessions/open')
  }
  async startSession(s: SessionRecord) {
    await this.call('POST', '/sessions', s)
  }
  async endSession(id: string, endedAt: number, outcome: SessionOutcome, earnedCoins: number) {
    await this.call('POST', `/sessions/${id}/end`, { endedAt, outcome, earnedCoins })
  }
  async recordCatch(c: CatchRecord) {
    await this.call('POST', '/catches', c)
  }
  async setCatchFate(id: string, fate: CatchRecord['fate']) {
    await this.call('PATCH', `/catches/${id}`, { fate })
  }
  handbook() {
    return this.call<HandbookEntry[]>('GET', '/handbook')
  }
  recentCatches(limit: number) {
    return this.call<CatchRecord[]>('GET', `/catches?limit=${limit}`)
  }
  async recordSighting(creatureId: string, locationId: string, seenAt: number) {
    await this.call('POST', '/sightings', { creatureId, locationId, seenAt })
  }
  sightings() {
    return this.call<Sighting[]>('GET', '/sightings')
  }
  account() {
    return this.call<Account>('GET', '/account')
  }
  authConfig() {
    return this.call<{ google: boolean }>('GET', '/auth/config')
  }
  async linkGoogle() {
    location.assign(this.base + '/auth/google')
  }
  async register(email: string, password: string) {
    await this.call('POST', '/account/register', { email, password })
  }
  async login(email: string, password: string) {
    await this.call('POST', '/auth/login', { email, password })
  }
  async logout() {
    await this.call('POST', '/auth/logout')
  }
  async deleteAccount() {
    await this.call('DELETE', '/account')
  }
}
