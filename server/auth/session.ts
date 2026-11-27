import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import type { DB } from '../db/client'
import { authSessions, users, type User } from '../db/schema'

const DAY = 24 * 60 * 60 * 1000
export const SESSION_LIFETIME_MS = 365 * DAY // khách không có cách đăng nhập lại: để phiên sống lâu
const RENEW_WHEN_LEFT = 180 * DAY

/** Cookie không phân biệt cổng: đặt tên theo cổng để hai bản chạy cùng máy (dev 5173, e2e 4173) không đăng xuất nhau. */
export function sessionCookie(): string {
  return `can_thu_session_${process.env.PORT || '5173'}`
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(db: DB, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.insert(authSessions).values({ id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS) })
  return token
}

/** Người dùng của token trong cookie, hoặc null. Phiên đã dùng quá nửa đời thì được gia hạn. */
export async function userForToken(db: DB, token: string | undefined | null): Promise<User | null> {
  if (!token) return null
  const id = hashToken(token)
  const rows = await db
    .select({ user: users, expiresAt: authSessions.expiresAt })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.id, id), gt(authSessions.expiresAt, new Date())))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.expiresAt.getTime() - Date.now() < RENEW_WHEN_LEFT) {
    await db
      .update(authSessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS) })
      .where(eq(authSessions.id, id))
  }
  return row.user
}

export async function deleteSession(db: DB, token: string | undefined | null) {
  if (!token) return
  await db.delete(authSessions).where(eq(authSessions.id, hashToken(token)))
}

export async function sweepSessions(db: DB) {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()))
}
