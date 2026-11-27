// Các thao tác ghi/đọc dữ liệu của một người chơi, kèm kiểm tra giới hạn cơ bản (chống gian lận thô).
// Thay cho các hàm RPC security definer của bản Supabase cũ; quy tắc giữ nguyên.
import { and, desc, eq, gt, isNull, lte, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { CREATURES, LOCATIONS, SPECIES } from '../src/content'
import type { CatchRecord, HandbookEntry, SessionRecord, Sighting, StoredPlayer } from '../src/data/types'
import type { DB } from './db/client'
import { catches, fishingSessions, playerState, wildlifeSightings } from './db/schema'

export class GameError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code)
  }
}

const MIN = 60_000
const CLOCK_SKEW_MS = 2 * MIN // đồng hồ máy người chơi được lệch tối đa chừng này
const MAX_SHIFT_MS = 8 * 60 * MIN
const LATE_CATCH_MS = 10 * MIN // con cá cuối có thể lên bờ sau giờ hết vé một chút
const MAX_CATCHES_PER_MINUTE = 6
const MAX_STATE_BYTES = 64 * 1024

const uuid = z.string().uuid()
const ms = z.number().int().nonnegative()
const json = z.record(z.string(), z.unknown())
const weatherKind = z.enum(['sunny', 'cloudy', 'rain', 'storm', 'fog'])
const fate = z.enum(['kept', 'released', 'sold'])

export const sessionBody = z.object({
  id: uuid,
  locationId: z.string(),
  kind: z.enum(['paid_shift', 'free']),
  ticketCoins: z.number().int().min(0).max(100_000),
  startedAt: ms,
  plannedEndAt: ms.optional(),
  weather: z.object({ kind: weatherKind, tempC: z.number(), windMs: z.number(), waterTempC: z.number() }),
})
export const endSessionBody = z.object({
  endedAt: ms,
  outcome: z.enum(['sold', 'released', 'mixed', 'abandoned']),
  earnedCoins: z.number().int().min(0).max(1_000_000),
})
export const catchBody = z.object({
  id: uuid,
  sessionId: uuid,
  speciesId: z.string(),
  locationId: z.string(),
  weightG: z.number().int().positive(),
  caughtAt: ms,
  localHour: z.number().int().min(0).max(23),
  weatherKind,
  waterTempC: z.number().min(-10).max(60).optional(),
  depthCm: z.number().int().min(0).max(2000).optional(),
  bait: json,
  rig: json,
  fate,
})
export const fateBody = z.object({ fate })
export const playerBody = z.object({
  expectedVersion: z.number().int().min(0),
  coins: z.number().int().min(0),
  xp: z.number().int().min(0),
  state: z.unknown(),
})
export const sightingBody = z.object({ creatureId: z.string(), locationId: z.string(), seenAt: ms })

const speciesById = new Map(SPECIES.map((s) => [s.id, s]))
const locationById = new Map(LOCATIONS.map((l) => [l.id, l]))
const creatureIds = new Set(CREATURES.map((c) => c.id))

// ---------------------------------------------------------------- tiến độ

export async function ensurePlayer(db: DB, userId: string) {
  await db.insert(playerState).values({ userId }).onConflictDoNothing()
}

export async function loadPlayer(db: DB, userId: string): Promise<StoredPlayer | null> {
  const [row] = await db.select().from(playerState).where(eq(playerState.userId, userId))
  return row ? { version: row.version, coins: row.coins, xp: row.xp, state: row.state } : null
}

/** Chỉ ghi khi version trên server bằng version client đang giữ. Trả về version mới, hoặc -1 nếu máy khác vừa lưu. */
export async function savePlayer(db: DB, userId: string, p: z.infer<typeof playerBody>): Promise<number> {
  if (JSON.stringify(p.state ?? {}).length > MAX_STATE_BYTES) throw new GameError('state_too_large', 413)
  await ensurePlayer(db, userId)
  const rows = await db
    .update(playerState)
    .set({ version: sql`${playerState.version} + 1`, coins: p.coins, xp: p.xp, state: p.state ?? {} })
    .where(and(eq(playerState.userId, userId), eq(playerState.version, p.expectedVersion)))
    .returning({ version: playerState.version })
  return rows[0]?.version ?? -1
}

// ---------------------------------------------------------------- ca câu

type SessionRow = typeof fishingSessions.$inferSelect

function toSession(r: SessionRow): SessionRecord {
  const w = r.weather as Partial<SessionRecord['weather']>
  return {
    id: r.id,
    locationId: r.locationId,
    kind: r.kind,
    ticketCoins: r.ticketCoins,
    startedAt: r.startedAt.getTime(),
    plannedEndAt: r.plannedEndAt?.getTime(),
    weather: { kind: w.kind ?? 'sunny', tempC: w.tempC ?? 27, windMs: w.windMs ?? 1, waterTempC: w.waterTempC ?? 26 },
  }
}

export async function openSession(db: DB, userId: string): Promise<SessionRecord | null> {
  const [row] = await db
    .select()
    .from(fishingSessions)
    .where(and(eq(fishingSessions.userId, userId), isNull(fishingSessions.endedAt)))
  return row ? toSession(row) : null
}

export async function startSession(db: DB, userId: string, s: z.infer<typeof sessionBody>, now = Date.now()) {
  if (!locationById.has(s.locationId)) throw new GameError('unknown_location')
  if (s.startedAt > now + CLOCK_SKEW_MS || s.startedAt < now - 24 * 60 * MIN) throw new GameError('bad_start_time')
  if (s.kind === 'paid_shift' && (s.plannedEndAt === undefined || s.plannedEndAt - s.startedAt > MAX_SHIFT_MS)) {
    throw new GameError('bad_shift_length')
  }
  if (s.plannedEndAt !== undefined && s.plannedEndAt <= s.startedAt) throw new GameError('bad_shift_length')
  await db.transaction(async (tx) => {
    // ca cũ còn mở (đóng tab giữa chừng) thì tự đóng thành 'abandoned'
    await tx
      .update(fishingSessions)
      .set({
        endedAt: sql`greatest(${fishingSessions.startedAt}, least(coalesce(${fishingSessions.plannedEndAt}, ${new Date(s.startedAt)}), ${new Date(s.startedAt)}))`,
        outcome: sql`coalesce(${fishingSessions.outcome}, 'abandoned')`,
      })
      .where(and(eq(fishingSessions.userId, userId), isNull(fishingSessions.endedAt), ne(fishingSessions.id, s.id)))
    await tx
      .insert(fishingSessions)
      .values({
        id: s.id,
        userId,
        locationId: s.locationId,
        kind: s.kind,
        ticketCoins: s.ticketCoins,
        startedAt: new Date(s.startedAt),
        plannedEndAt: s.plannedEndAt === undefined ? null : new Date(s.plannedEndAt),
        weather: s.weather,
      })
      .onConflictDoNothing({ target: fishingSessions.id })
    const [row] = await tx.select({ userId: fishingSessions.userId }).from(fishingSessions).where(eq(fishingSessions.id, s.id))
    if (row?.userId !== userId) throw new GameError('session_id_taken', 409)
  })
}

export async function endSession(db: DB, userId: string, id: string, e: z.infer<typeof endSessionBody>, now = Date.now()) {
  const endAt = new Date(Math.min(e.endedAt, now + CLOCK_SKEW_MS))
  const rows = await db
    .update(fishingSessions)
    .set({
      endedAt: sql`coalesce(${fishingSessions.endedAt}, greatest(${fishingSessions.startedAt}, ${endAt}))`,
      outcome: sql`coalesce(${fishingSessions.outcome}, ${e.outcome})`,
      earnedCoins: sql`case when ${fishingSessions.endedAt} is null then ${e.earnedCoins} else ${fishingSessions.earnedCoins} end`,
    })
    .where(and(eq(fishingSessions.id, id), eq(fishingSessions.userId, userId)))
    .returning({ id: fishingSessions.id })
  if (rows.length === 0) throw new GameError('session_not_found', 404)
}

// ---------------------------------------------------------------- cá

/**
 * Kiểm tra: ca thuộc về người gọi; thời điểm câu nằm trong ca (cho trễ 10 phút); cân nặng trong giới hạn của loài;
 * loài có ở địa điểm đó; không quá 6 con mỗi 60 giây. Gửi lại cùng id thì bỏ qua.
 */
export async function recordCatch(db: DB, userId: string, c: z.infer<typeof catchBody>, now = Date.now()) {
  const [dup] = await db
    .select({ userId: catches.userId })
    .from(catches)
    .where(eq(catches.id, c.id))
  if (dup) {
    if (dup.userId !== userId) throw new GameError('catch_id_taken', 409)
    return
  }
  const [s] = await db
    .select()
    .from(fishingSessions)
    .where(and(eq(fishingSessions.id, c.sessionId), eq(fishingSessions.userId, userId)))
  if (!s) throw new GameError('session_not_found', 404)
  const until = (s.endedAt ?? s.plannedEndAt)?.getTime() ?? now
  if (c.caughtAt < s.startedAt.getTime() || c.caughtAt > until + LATE_CATCH_MS || c.caughtAt > now + CLOCK_SKEW_MS) {
    throw new GameError('catch_outside_session')
  }
  const sp = speciesById.get(c.speciesId)
  if (!sp) throw new GameError('unknown_species')
  if (c.weightG < sp.weightG[0] || c.weightG > sp.weightG[1]) throw new GameError('weight_out_of_range')
  if (!locationById.get(s.locationId)?.species.some((x) => x.id === sp.id)) throw new GameError('species_not_in_location')
  const [{ recent } = { recent: 0 }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(catches)
    .where(and(eq(catches.userId, userId), gt(catches.caughtAt, new Date(c.caughtAt - MIN)), lte(catches.caughtAt, new Date(c.caughtAt))))
  if (recent >= MAX_CATCHES_PER_MINUTE) throw new GameError('too_many_catches', 429)
  await db
    .insert(catches)
    .values({
      id: c.id,
      userId,
      sessionId: s.id,
      speciesId: sp.id,
      locationId: s.locationId, // lấy từ ca, không tin client
      weightG: c.weightG,
      caughtAt: new Date(c.caughtAt),
      localHour: c.localHour,
      weatherKind: c.weatherKind,
      waterTempC: c.waterTempC ?? null,
      depthCm: c.depthCm ?? null,
      bait: c.bait,
      rig: c.rig,
      fate: c.fate,
    })
    .onConflictDoNothing({ target: catches.id })
}

export async function setCatchFate(db: DB, userId: string, id: string, f: z.infer<typeof fate>) {
  await db
    .update(catches)
    .set({ fate: f })
    .where(and(eq(catches.id, id), eq(catches.userId, userId)))
}

export async function recentCatches(db: DB, userId: string, limit: number): Promise<CatchRecord[]> {
  const rows = await db
    .select()
    .from(catches)
    .where(eq(catches.userId, userId))
    .orderBy(desc(catches.caughtAt))
    .limit(Math.max(1, Math.min(500, limit)))
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    speciesId: r.speciesId,
    locationId: r.locationId,
    weightG: r.weightG,
    caughtAt: r.caughtAt.getTime(),
    localHour: r.localHour,
    weatherKind: r.weatherKind,
    waterTempC: r.waterTempC ?? undefined,
    depthCm: r.depthCm ?? undefined,
    bait: r.bait as Record<string, unknown>,
    rig: r.rig as Record<string, unknown>,
    fate: r.fate,
  }))
}

/** Sổ tay theo loài. Cùng nghĩa với aggregateHandbook() ở client (giờ hay câu: giờ nhiều nhất, hoà thì giờ nhỏ hơn). */
export async function handbook(db: DB, userId: string): Promise<HandbookEntry[]> {
  const rows = await db
    .select({
      speciesId: catches.speciesId,
      totalCaught: sql<number>`count(*)::int`,
      recordWeightG: sql<number>`max(${catches.weightG})::int`,
      firstCaughtAt: sql<string>`min(${catches.caughtAt})`,
      lastCaughtAt: sql<string>`max(${catches.caughtAt})`,
      locations: sql<string[]>`array_agg(distinct ${catches.locationId} order by ${catches.locationId})`,
      favouriteHour: sql<number>`(mode() within group (order by ${catches.localHour}))::int`,
    })
    .from(catches)
    .where(eq(catches.userId, userId))
    .groupBy(catches.speciesId)
  return rows.map((r) => ({
    ...r,
    totalCaught: Number(r.totalCaught),
    recordWeightG: Number(r.recordWeightG),
    favouriteHour: Number(r.favouriteHour),
    firstCaughtAt: new Date(r.firstCaughtAt).getTime(),
    lastCaughtAt: new Date(r.lastCaughtAt).getTime(),
  }))
}

// ---------------------------------------------------------------- sinh vật đã gặp

export async function recordSighting(db: DB, userId: string, s: z.infer<typeof sightingBody>, now = Date.now()) {
  if (!creatureIds.has(s.creatureId)) throw new GameError('unknown_creature')
  if (!locationById.has(s.locationId)) throw new GameError('unknown_location')
  const at = new Date(Math.min(s.seenAt, now))
  await db
    .insert(wildlifeSightings)
    .values({ userId, creatureId: s.creatureId, firstLocation: s.locationId, firstSeenAt: at, lastSeenAt: at })
    .onConflictDoUpdate({
      target: [wildlifeSightings.userId, wildlifeSightings.creatureId],
      set: {
        lastSeenAt: sql`greatest(${wildlifeSightings.lastSeenAt}, excluded.last_seen_at)`,
        timesSeen: sql`${wildlifeSightings.timesSeen} + 1`,
      },
    })
}

export async function sightings(db: DB, userId: string): Promise<Sighting[]> {
  const rows = await db.select().from(wildlifeSightings).where(eq(wildlifeSightings.userId, userId))
  return rows.map((r) => ({
    creatureId: r.creatureId,
    firstLocation: r.firstLocation,
    firstSeenAt: r.firstSeenAt.getTime(),
    lastSeenAt: r.lastSeenAt.getTime(),
    timesSeen: r.timesSeen,
  }))
}
