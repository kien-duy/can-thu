// API của Cần Thủ (Hono). Chạy được trên Node (server/index.ts, Vite dev) và sau này trên Cloudflare Workers.
// Client không bao giờ chạm DB: mọi đường dưới /api đều lọc theo người đang đăng nhập (cookie phiên).
import { randomBytes } from 'node:crypto'
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import type { Account } from '../src/data/types'
import { hashPassword, verifyPassword } from './auth/password'
import { createSession, deleteSession, SESSION_LIFETIME_MS, sessionCookie, userForToken } from './auth/session'
import type { DB } from './db/client'
import { users, type User } from './db/schema'
import * as G from './game'

export interface AppOptions {
  db: () => Promise<DB>
  /** Bật nút "Liên kết Google" khi có OAuth client (Google Cloud, loại "Web application"). */
  google?: { clientId: string; clientSecret: string }
  /** Địa chỉ công khai của site, khi request đi qua proxy và không mang đúng host. */
  publicUrl?: string
  secureCookies?: boolean
  now?: () => number
}

type Env = { Variables: { db: DB } }

const credentials = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(8).max(200) })

const MESSAGES: Record<string, string> = {
  invalid: 'Dữ liệu gửi lên không hợp lệ.',
  not_signed_in: 'Chưa có phiên chơi. Tải lại trang.',
  email_taken: 'Email này đã có tài khoản. Dùng "Đăng nhập" thay vì tạo mới.',
  wrong_login: 'Email hoặc mật khẩu chưa đúng.',
  already_linked: 'Tài khoản này đã liên kết rồi.',
  slow_down: 'Bạn thử quá nhiều lần. Đợi ít phút rồi thử lại.',
  csrf: 'Yêu cầu bị chặn.',
}

/** Giới hạn số lần thử trong một khoảng thời gian, giữ trong bộ nhớ. Một tiến độ server là đủ. */
function limiter() {
  const hits = new Map<string, { count: number; reset: number }>()
  return (key: string, max: number, windowMs: number, now: number) => {
    const h = hits.get(key)
    if (!h || h.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs })
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
      return false
    }
    h.count++
    return h.count > max
  }
}

export function toAccount(u: User): Account {
  const providers = [u.passwordHash ? 'email' : null, u.googleSub ? 'google' : null].filter((x): x is string => x !== null)
  return { mode: u.isGuest ? 'guest' : 'linked', email: u.email ?? undefined, providers }
}

export function createApp(opts: AppOptions) {
  const now = opts.now ?? Date.now
  const limited = limiter()
  const app = new Hono<Env>().basePath('/api')

  const fail = (c: Context, status: number, code: string) =>
    c.json({ error: { code, message: MESSAGES[code] ?? code } }, status as 400)

  app.use('*', async (c, next) => {
    // Chống CSRF: mọi lệnh ghi phải là JSON. Trang web khác không gửi được JSON tới đây mà không qua
    // preflight CORS, và server không bao giờ trả lời CORS.
    const m = c.req.method
    if (m !== 'GET' && m !== 'HEAD' && !c.req.header('content-type')?.startsWith('application/json')) return fail(c, 415, 'csrf')
    c.set('db', await opts.db())
    c.header('Cache-Control', 'no-store')
    await next()
  })

  app.onError((e, c) => {
    if (e instanceof G.GameError) return fail(c, e.status, e.code)
    if (e instanceof z.ZodError || e instanceof SyntaxError) return fail(c, 400, 'invalid')
    console.error(e)
    return fail(c, 500, 'server_error')
  })

  const setSession = (c: Context, token: string) =>
    setCookie(c, sessionCookie(), token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: opts.secureCookies ?? false,
      path: '/',
      maxAge: SESSION_LIFETIME_MS / 1000,
    })

  const currentUser = (c: Context<Env>) => userForToken(c.var.db, getCookie(c, sessionCookie()))

  async function requireUser(c: Context<Env>): Promise<User> {
    const u = await currentUser(c)
    if (!u) throw new G.GameError('not_signed_in', 401)
    return u
  }

  /** Chuyển cookie sang người dùng khác. Khách cũ không còn đường quay lại nên bị xoá (giao diện đã báo trước). */
  async function switchTo(c: Context<Env>, from: User | null, to: User) {
    const db = c.var.db
    await deleteSession(db, getCookie(c, sessionCookie()))
    if (from && from.id !== to.id && from.isGuest) await db.delete(users).where(eq(users.id, from.id))
    setSession(c, await createSession(db, to.id))
  }

  const body = async <T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> => schema.parse(await c.req.json())

  // ---------------------------------------------------------------- phiên, tài khoản

  /** Mở game: trả về người chơi hiện tại, chưa có thì tạo khách mới. */
  app.post('/session', async (c) => {
    const db = c.var.db
    let u = await currentUser(c)
    if (!u) {
      if (limited(`guest:${clientIp(c)}`, 60, 10 * 60_000, now())) return fail(c, 429, 'slow_down')
      ;[u] = await db.insert(users).values({}).returning()
      setSession(c, await createSession(db, u!.id))
    }
    await G.ensurePlayer(db, u!.id)
    return c.json(toAccount(u!))
  })

  app.get('/account', async (c) => c.json(toAccount(await requireUser(c))))

  app.get('/auth/config', (c) => c.json({ google: !!opts.google }))

  /** Khách đặt email + mật khẩu: thành tài khoản chính thức, giữ nguyên mọi thứ đã câu. */
  app.post('/account/register', async (c) => {
    const { email, password } = await body(c, credentials)
    if (limited(`register:${clientIp(c)}`, 10, 10 * 60_000, now())) return fail(c, 429, 'slow_down')
    const db = c.var.db
    const u = await requireUser(c)
    if (u.passwordHash) return fail(c, 409, 'already_linked')
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, u.id)))
    if (taken) return fail(c, 409, 'email_taken')
    const [updated] = await db
      .update(users)
      .set({ email, passwordHash: await hashPassword(password), isGuest: false })
      .where(eq(users.id, u.id))
      .returning()
    return c.json(toAccount(updated!))
  })

  /** Đăng nhập tài khoản có sẵn (máy khác, hoặc sau khi đăng xuất). */
  app.post('/auth/login', async (c) => {
    const { email, password } = await body(c, credentials)
    const t = now()
    if (limited(`login:${clientIp(c)}`, 20, 10 * 60_000, t) || limited(`login:${email}`, 8, 10 * 60_000, t)) return fail(c, 429, 'slow_down')
    const db = c.var.db
    const [u] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
    // Cùng một câu trả lời cho email không có và sai mật khẩu.
    if (!u?.passwordHash || !(await verifyPassword(password, u.passwordHash))) return fail(c, 401, 'wrong_login')
    await switchTo(c, await currentUser(c), u)
    return c.json(toAccount(u))
  })

  app.post('/auth/logout', async (c) => {
    await deleteSession(c.var.db, getCookie(c, sessionCookie()))
    deleteCookie(c, sessionCookie(), { path: '/' })
    return c.json({ ok: true })
  })

  app.delete('/account', async (c) => {
    const u = await requireUser(c)
    await c.var.db.delete(users).where(eq(users.id, u.id)) // xoá dây chuyền mọi bảng có user_id
    deleteCookie(c, sessionCookie(), { path: '/' })
    return c.json({ ok: true })
  })

  // ---------------------------------------------------------------- Google (chỉ khi có OAuth client)

  const STATE_COOKIE = 'can_thu_google_state'
  const origin = (c: Context) => opts.publicUrl?.replace(/\/$/, '') ?? new URL(c.req.url).origin
  const callbackUrl = (c: Context) => `${origin(c)}/api/auth/google/callback`

  app.get('/auth/google', async (c) => {
    if (!opts.google) return fail(c, 404, 'google_off')
    const state = randomBytes(16).toString('base64url')
    setCookie(c, STATE_COOKIE, state, { httpOnly: true, sameSite: 'Lax', secure: opts.secureCookies ?? false, path: '/api/auth/google', maxAge: 600 })
    const q = new URLSearchParams({
      client_id: opts.google.clientId,
      redirect_uri: callbackUrl(c),
      response_type: 'code',
      scope: 'openid email',
      state,
      prompt: 'select_account',
    })
    return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`)
  })

  app.get('/auth/google/callback', async (c) => {
    const back = (result: string) => c.redirect(`${origin(c)}/?google=${result}`)
    if (!opts.google) return back('off')
    const state = getCookie(c, STATE_COOKIE)
    deleteCookie(c, STATE_COOKIE, { path: '/api/auth/google' })
    const code = c.req.query('code')
    if (!code || !state || c.req.query('state') !== state) return back('failed')
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: opts.google.clientId,
        client_secret: opts.google.clientSecret,
        redirect_uri: callbackUrl(c),
        grant_type: 'authorization_code',
      }),
    })
    if (!res.ok) return back('failed')
    const { id_token } = (await res.json()) as { id_token?: string }
    // id_token nhận thẳng từ Google qua TLS (không qua trình duyệt) nên đọc payload là đủ tin cậy.
    const claims = id_token ? (JSON.parse(Buffer.from(id_token.split('.')[1] ?? '', 'base64url').toString()) as { sub?: string; email?: string; email_verified?: boolean; aud?: string }) : {}
    if (!claims.sub || claims.aud !== opts.google.clientId) return back('failed')
    const db = c.var.db
    const me = await currentUser(c)
    const [owner] = await db.select().from(users).where(eq(users.googleSub, claims.sub))
    if (owner) {
      if (!me || owner.id !== me.id) await switchTo(c, me, owner)
      return back('signed_in')
    }
    const email = claims.email_verified ? claims.email?.toLowerCase() : undefined
    if (!me) {
      const [u] = await db.insert(users).values({ isGuest: false, googleSub: claims.sub, email }).returning()
      await G.ensurePlayer(db, u!.id)
      setSession(c, await createSession(db, u!.id))
      return back('signed_in')
    }
    const [emailOwner] = email
      ? await db
          .select({ id: users.id })
          .from(users)
          .where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, me.id)))
      : []
    await db
      .update(users)
      .set({ googleSub: claims.sub, isGuest: false, email: me.email ?? (emailOwner ? null : email) })
      .where(and(eq(users.id, me.id), or(isNull(users.googleSub), eq(users.googleSub, claims.sub))))
    return back('linked')
  })

  // ---------------------------------------------------------------- game

  app.get('/player', async (c) => c.json(await G.loadPlayer(c.var.db, (await requireUser(c)).id)))
  app.put('/player', async (c) => {
    const u = await requireUser(c)
    return c.json({ version: await G.savePlayer(c.var.db, u.id, await body(c, G.playerBody)) })
  })

  app.get('/sessions/open', async (c) => c.json(await G.openSession(c.var.db, (await requireUser(c)).id)))
  app.post('/sessions', async (c) => {
    const u = await requireUser(c)
    await G.startSession(c.var.db, u.id, await body(c, G.sessionBody), now())
    return c.json({ ok: true })
  })
  app.post('/sessions/:id/end', async (c) => {
    const u = await requireUser(c)
    await G.endSession(c.var.db, u.id, z.string().uuid().parse(c.req.param('id')), await body(c, G.endSessionBody), now())
    return c.json({ ok: true })
  })

  app.get('/catches', async (c) => {
    const u = await requireUser(c)
    return c.json(await G.recentCatches(c.var.db, u.id, Number(c.req.query('limit') ?? 50) || 50))
  })
  app.post('/catches', async (c) => {
    const u = await requireUser(c)
    await G.recordCatch(c.var.db, u.id, await body(c, G.catchBody), now())
    return c.json({ ok: true })
  })
  app.patch('/catches/:id', async (c) => {
    const u = await requireUser(c)
    await G.setCatchFate(c.var.db, u.id, z.string().uuid().parse(c.req.param('id')), (await body(c, G.fateBody)).fate)
    return c.json({ ok: true })
  })

  app.get('/handbook', async (c) => c.json(await G.handbook(c.var.db, (await requireUser(c)).id)))

  app.get('/sightings', async (c) => c.json(await G.sightings(c.var.db, (await requireUser(c)).id)))
  app.post('/sightings', async (c) => {
    const u = await requireUser(c)
    await G.recordSighting(c.var.db, u.id, await body(c, G.sightingBody), now())
    return c.json({ ok: true })
  })

  app.notFound((c) => fail(c, 404, 'not_found'))
  return app
}

function clientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

/** Cấu hình lấy từ biến môi trường (xem .env.example). */
export function optionsFromEnv(db: () => Promise<DB>): AppOptions {
  const env = process.env
  return {
    db,
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : undefined,
    publicUrl: env.PUBLIC_URL || undefined,
    secureCookies: env.NODE_ENV === 'production',
  }
}
