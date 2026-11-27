import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { aggregateHandbook, type CatchRecord } from '../src/data/types'
import { createApp } from './app'
import { memoryDb, type DB } from './db/client'

let db: DB
let close: () => Promise<void>
const NOW = Date.parse('2026-11-27T02:00:00Z')

beforeAll(async () => {
  ;({ db, close } = await memoryDb())
})
afterAll(() => close())

/** Một trình duyệt giả: giữ cookie giữa các request như trình duyệt thật. */
function browser(app = createApp({ db: async () => db, now: () => NOW })) {
  let cookie = ''
  const req = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request('/api' + path, {
      method,
      headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    })
    const set = res.headers.get('set-cookie')
    if (set) {
      const [pair] = set.split(';')
      cookie = /=$/.test(pair!) || /Max-Age=0/i.test(set) ? '' : pair!
    }
    return { status: res.status, json: (await res.json()) as Record<string, unknown> & { error?: { code: string } } }
  }
  return { req, cookie: () => cookie }
}

const weather = { kind: 'sunny' as const, tempC: 28, windMs: 1, waterTempC: 27 }
const shift = (id = randomUUID(), startedAt = NOW - 10 * 60_000) => ({
  id,
  locationId: 'ho_dong_xanh',
  kind: 'paid_shift',
  ticketCoins: 60,
  startedAt,
  plannedEndAt: startedAt + 3_600_000,
  weather,
})
const fish = (sessionId: string, over: Partial<CatchRecord> = {}): CatchRecord => ({
  id: randomUUID(),
  sessionId,
  speciesId: 'ro_phi_den',
  locationId: 'ho_dong_xanh',
  weightG: 600,
  caughtAt: NOW - 60_000,
  localHour: 9,
  weatherKind: 'sunny',
  bait: {},
  rig: {},
  fate: 'kept',
  ...over,
})

describe('phiên và tài khoản', () => {
  it('lần đầu mở game tạo khách, lần sau giữ đúng người đó', async () => {
    const b = browser()
    const first = await b.req('POST', '/session')
    expect(first.json).toMatchObject({ mode: 'guest', providers: [] })
    expect(b.cookie()).toMatch(/^can_thu_session_/)
    const c1 = b.cookie()
    await b.req('POST', '/session')
    expect(b.cookie()).toBe(c1)
    expect((await b.req('GET', '/player')).json).toMatchObject({ version: 0, coins: 500 })
  })

  it('cookie chỉ có cờ Secure khi request là HTTPS (WebKit bỏ cookie Secure trên http://localhost)', async () => {
    const app = createApp({ db: async () => db })
    const post = (url: string, headers: Record<string, string> = {}) =>
      app.request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' })
    expect((await post('http://localhost/api/session')).headers.get('set-cookie')).not.toMatch(/Secure/)
    expect((await post('https://cau.vn/api/session')).headers.get('set-cookie')).toMatch(/Secure/)
    expect((await post('http://10.0.0.5/api/session', { 'x-forwarded-proto': 'https' })).headers.get('set-cookie')).toMatch(/Secure/)
  })

  it('chưa có phiên thì không đọc được gì', async () => {
    expect((await browser().req('GET', '/handbook')).status).toBe(401)
  })

  it('lệnh ghi không phải JSON bị chặn (CSRF)', async () => {
    const b = browser()
    await b.req('POST', '/session')
    const app = createApp({ db: async () => db })
    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie: b.cookie(), 'content-type': 'text/plain' }, body: '' })
    expect(res.status).toBe(415)
  })

  it('khách tạo tài khoản: giữ nguyên cá đã câu; máy khác đăng nhập thấy cùng sổ tay', async () => {
    const a = browser()
    await a.req('POST', '/session')
    const s = shift()
    expect((await a.req('POST', '/sessions', s)).status).toBe(200)
    expect((await a.req('POST', '/catches', fish(s.id))).status).toBe(200)
    const reg = await a.req('POST', '/account/register', { email: 'Ca@Vi.vn', password: 'mat-khau-dai' })
    expect(reg.json).toMatchObject({ mode: 'linked', email: 'ca@vi.vn', providers: ['email'] })

    const b = browser()
    await b.req('POST', '/session') // khách khác trên máy khác
    expect((await b.req('POST', '/auth/login', { email: 'ca@vi.vn', password: 'sai-mat-khau' })).status).toBe(401)
    expect((await b.req('POST', '/auth/login', { email: 'ca@vi.vn', password: 'mat-khau-dai' })).status).toBe(200)
    const hb = (await b.req('GET', '/handbook')).json as unknown as { speciesId: string; totalCaught: number }[]
    expect(hb).toEqual([expect.objectContaining({ speciesId: 'ro_phi_den', totalCaught: 1 })])

    // email đã có tài khoản thì không tạo trùng
    const c = browser()
    await c.req('POST', '/session')
    expect((await c.req('POST', '/account/register', { email: 'ca@vi.vn', password: 'mat-khau-khac' })).json.error?.code).toBe('email_taken')
  })

  it('đăng xuất rồi mở lại game là khách mới; xoá tài khoản thì không đăng nhập lại được', async () => {
    const a = browser()
    await a.req('POST', '/session')
    await a.req('POST', '/account/register', { email: 'xoa@vi.vn', password: 'mat-khau-dai' })
    await a.req('POST', '/auth/logout')
    expect(a.cookie()).toBe('')
    expect((await a.req('POST', '/session')).json.mode).toBe('guest')
    await a.req('POST', '/auth/login', { email: 'xoa@vi.vn', password: 'mat-khau-dai' })
    expect((await a.req('DELETE', '/account')).status).toBe(200)
    expect((await a.req('POST', '/auth/login', { email: 'xoa@vi.vn', password: 'mat-khau-dai' })).status).toBe(401)
  })

  it('đăng nhập sai liên tục thì bị chặn một lúc', async () => {
    const app = createApp({ db: async () => db, now: () => NOW })
    const b = browser(app)
    let last = 0
    for (let i = 0; i < 10; i++) last = (await b.req('POST', '/auth/login', { email: 'khong@co.vn', password: 'mat-khau-dai' })).status
    expect(last).toBe(429)
  })

  it('Google chỉ bật khi có OAuth client', async () => {
    expect((await browser().req('GET', '/auth/config')).json).toEqual({ google: false })
    const app = createApp({ db: async () => db, google: { clientId: 'id', clientSecret: 's' }, publicUrl: 'https://cau.vn' })
    const res = await app.request('/api/auth/google')
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('location')!)
    expect(to.host).toBe('accounts.google.com')
    expect(to.searchParams.get('redirect_uri')).toBe('https://cau.vn/api/auth/google/callback')
    // quay về mà state không khớp thì không làm gì
    const back = await app.request('/api/auth/google/callback?code=x&state=khac')
    expect(back.headers.get('location')).toBe('https://cau.vn/?google=failed')
  })
})

describe('kiểm tra giới hạn khi ghi cá', () => {
  async function fresh() {
    const b = browser()
    await b.req('POST', '/session')
    const s = shift()
    await b.req('POST', '/sessions', s)
    return { b, s }
  }

  it('gửi lại cùng id không đếm hai lần (hàng đợi offline gửi lại an toàn)', async () => {
    const { b, s } = await fresh()
    const c = fish(s.id)
    await b.req('POST', '/catches', c)
    expect((await b.req('POST', '/catches', c)).status).toBe(200)
    expect((await b.req('GET', '/catches?limit=10')).json).toHaveLength(1)
  })

  it.each([
    ['cân nặng ngoài giới hạn của loài', { weightG: 99_000 }, 'weight_out_of_range'],
    ['loài không có ở hồ này', { speciesId: 'ca_hoi_khong_co' }, 'unknown_species'],
    ['câu trước khi mở ca', { caughtAt: NOW - 60 * 60_000 }, 'catch_outside_session'],
    ['thời điểm ở tương lai', { caughtAt: NOW + 10 * 60_000 }, 'catch_outside_session'],
  ])('%s thì từ chối', async (_name, over, code) => {
    const { b, s } = await fresh()
    expect((await b.req('POST', '/catches', fish(s.id, over as Partial<CatchRecord>))).json.error?.code).toBe(code)
  })

  it('không quá 6 con mỗi phút', async () => {
    const { b, s } = await fresh()
    for (let i = 0; i < 6; i++) expect((await b.req('POST', '/catches', fish(s.id, { caughtAt: NOW - 30_000 + i }))).status).toBe(200)
    expect((await b.req('POST', '/catches', fish(s.id, { caughtAt: NOW - 30_000 + 9 }))).json.error?.code).toBe('too_many_catches')
  })

  it('không ghi được cá vào ca của người khác', async () => {
    const { s } = await fresh()
    const other = browser()
    await other.req('POST', '/session')
    expect((await other.req('POST', '/catches', fish(s.id))).status).toBe(404)
  })

  it('sổ tay trên server khớp với cách tính ở client', async () => {
    const { b, s } = await fresh()
    const cs = [
      fish(s.id, { weightG: 400, caughtAt: NOW - 50_000, localHour: 7 }),
      fish(s.id, { weightG: 900, caughtAt: NOW - 40_000, localHour: 17 }),
      fish(s.id, { weightG: 300, caughtAt: NOW - 30_000, localHour: 7 }),
      fish(s.id, { speciesId: 'chep', weightG: 2000, caughtAt: NOW - 20_000, localHour: 5 }),
    ]
    for (const c of cs) await b.req('POST', '/catches', c)
    const server = (await b.req('GET', '/handbook')).json as unknown as ReturnType<typeof aggregateHandbook>
    const byId = (xs: typeof server) => [...xs].sort((x, y) => x.speciesId.localeCompare(y.speciesId))
    expect(byId(server)).toEqual(byId(aggregateHandbook(cs)))
  })
})

describe('ca câu và tiến độ', () => {
  it('mở ca mới tự đóng ca cũ; đóng ca rồi thì không còn ca mở; kết quả ca không bị ghi lại lần hai', async () => {
    const b = browser()
    await b.req('POST', '/session')
    const a = shift()
    const c = shift()
    await b.req('POST', '/sessions', a)
    await b.req('POST', '/sessions', c)
    expect(((await b.req('GET', '/sessions/open')).json as { id: string }).id).toBe(c.id)
    await b.req('POST', `/sessions/${c.id}/end`, { endedAt: NOW, outcome: 'sold', earnedCoins: 120 })
    expect((await b.req('POST', `/sessions/${c.id}/end`, { endedAt: NOW, outcome: 'released', earnedCoins: 9999 })).status).toBe(200)
    expect((await b.req('GET', '/sessions/open')).json).toBeNull()
  })

  it('ca có vé dài quá 8 tiếng thì từ chối', async () => {
    const b = browser()
    await b.req('POST', '/session')
    const s = { ...shift(), plannedEndAt: NOW + 9 * 3_600_000 }
    expect((await b.req('POST', '/sessions', s)).json.error?.code).toBe('bad_shift_length')
  })

  it('lưu tiến độ theo version: máy khác đã lưu bản mới hơn thì trả -1', async () => {
    const b = browser()
    await b.req('POST', '/session')
    expect((await b.req('PUT', '/player', { expectedVersion: 0, coins: 10, xp: 1, state: { a: 1 } })).json.version).toBe(1)
    expect((await b.req('PUT', '/player', { expectedVersion: 0, coins: 99, xp: 1, state: {} })).json.version).toBe(-1)
    expect((await b.req('GET', '/player')).json).toMatchObject({ version: 1, coins: 10, state: { a: 1 } })
  })

  it('sinh vật đã gặp: đếm số lần, giữ nơi gặp đầu tiên', async () => {
    const b = browser()
    await b.req('POST', '/session')
    await b.req('POST', '/sightings', { creatureId: 'buom_vang', locationId: 'ho_dong_xanh', seenAt: NOW - 1000 })
    await b.req('POST', '/sightings', { creatureId: 'buom_vang', locationId: 'ben_song_lang', seenAt: NOW })
    expect((await b.req('GET', '/sightings')).json).toEqual([
      { creatureId: 'buom_vang', firstLocation: 'ho_dong_xanh', firstSeenAt: NOW - 1000, lastSeenAt: NOW, timesSeen: 2 },
    ])
    expect((await b.req('POST', '/sightings', { creatureId: 'rong', locationId: 'ho_dong_xanh', seenAt: NOW })).status).toBe(400)
  })
})
