// Schema Postgres của Cần Thủ, viết bằng Drizzle. `npm run db:generate` sinh migration trong drizzle/.
// Nguyên tắc (giữ từ bản Supabase cũ):
//   * Nội dung game (loài, địa điểm, đồ nghề, mồi) nằm trong content/*.json. Server đọc chính các file đó
//     để kiểm tra (loài có ở hồ này không, cân nặng có hợp lý không), nên DB không cần bảng tham chiếu.
//   * Mọi dữ liệu của người chơi có cột user_id. Client không bao giờ chạm DB: chỉ gọi API trong server/app.ts,
//     và API luôn lọc theo người đang đăng nhập.
//   * id của ca câu và con cá do client sinh (uuid): gửi lại lần hai thì "on conflict do nothing", nhờ đó
//     hàng đợi offline gửi lại được an toàn.
//   * Thời gian là timestamptz (UTC). Xu và cân nặng (gam) là integer.
import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, numeric, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
const tstz = (name: string) => timestamp(name, { withTimezone: true })

/** Khách được tạo ngay lần đầu mở game. Liên kết email + mật khẩu hoặc Google thì thành tài khoản chính thức, id giữ nguyên. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    isGuest: boolean('is_guest').notNull().default(true),
    email: text('email'),
    passwordHash: text('password_hash'),
    googleSub: text('google_sub'),
    displayName: text('display_name'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('display_name_length', sql`${t.displayName} is null or char_length(${t.displayName}) between 2 and 24`),
    check('account_has_login', sql`${t.isGuest} or ${t.passwordHash} is not null or ${t.googleSub} is not null`),
    uniqueIndex('users_email_lower').on(sql`lower(${t.email})`),
    uniqueIndex('users_google_sub').on(t.googleSub),
  ],
)

/** Phiên đăng nhập. Chỉ lưu hash của token trong cookie: lộ bảng này cũng không đăng nhập được. */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: tstz('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('auth_sessions_user').on(t.userId), index('auth_sessions_expires').on(t.expiresAt)],
)

/** Ảnh chụp tiến độ (túi đồ, cân phao, chậu mồi, nhiệm vụ). Client là nguồn sự thật; version chống ghi đè giữa hai máy. */
export const playerState = pgTable(
  'player_state',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(0),
    coins: integer('coins').notNull().default(500),
    xp: integer('xp').notNull().default(0),
    state: jsonb('state').notNull().default({}),
    stateSchema: integer('state_schema').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('player_state_nonneg', sql`${t.version} >= 0 and ${t.coins} >= 0 and ${t.xp} >= 0`)],
)

/** Một ca câu. Hồ dịch vụ: vé theo giờ thật. Sông, hồ núi: miễn phí, không giới hạn giờ. */
export const fishingSessions = pgTable(
  'fishing_sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    locationId: text('location_id').notNull(),
    kind: text('kind', { enum: ['paid_shift', 'free'] }).notNull(),
    ticketCoins: integer('ticket_coins').notNull().default(0),
    startedAt: tstz('started_at').notNull(),
    plannedEndAt: tstz('planned_end_at'),
    endedAt: tstz('ended_at'),
    outcome: text('outcome', { enum: ['sold', 'released', 'mixed', 'abandoned'] }),
    earnedCoins: integer('earned_coins').notNull().default(0),
    /** {kind, tempC, windMs, waterTempC} lúc bắt đầu */
    weather: jsonb('weather').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('session_kind', sql`${t.kind} in ('paid_shift','free')`),
    check('session_outcome', sql`${t.outcome} is null or ${t.outcome} in ('sold','released','mixed','abandoned')`),
    check('session_coins', sql`${t.ticketCoins} >= 0 and ${t.earnedCoins} >= 0`),
    check('paid_has_end', sql`${t.kind} = 'free' or ${t.plannedEndAt} is not null`),
    check('end_after_start', sql`${t.endedAt} is null or ${t.endedAt} >= ${t.startedAt}`),
    check('planned_after_start', sql`${t.plannedEndAt} is null or ${t.plannedEndAt} > ${t.startedAt}`),
    index('fishing_sessions_user_started').on(t.userId, t.startedAt.desc()),
    // mỗi người chỉ có tối đa một ca đang mở
    uniqueIndex('one_open_session_per_user')
      .on(t.userId)
      .where(sql`${t.endedAt} is null`),
  ],
)

/** Mỗi con cá đã lên bờ: nguồn dữ liệu cho nhật ký và kỷ lục trong sổ tay. */
export const catches = pgTable(
  'catches',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => fishingSessions.id, { onDelete: 'cascade' }),
    speciesId: text('species_id').notNull(),
    locationId: text('location_id').notNull(),
    weightG: integer('weight_g').notNull(),
    caughtAt: tstz('caught_at').notNull(),
    localHour: smallint('local_hour').notNull(),
    weatherKind: text('weather_kind', { enum: ['sunny', 'cloudy', 'rain', 'storm', 'fog'] }).notNull(),
    waterTempC: numeric('water_temp_c', { precision: 4, scale: 1, mode: 'number' }),
    depthCm: integer('depth_cm'),
    bait: jsonb('bait').notNull().default({}),
    rig: jsonb('rig').notNull().default({}),
    fate: text('fate', { enum: ['kept', 'released', 'sold'] })
      .notNull()
      .default('kept'),
    createdAt: createdAt(),
  },
  (t) => [
    check('catch_weight', sql`${t.weightG} > 0`),
    check('catch_hour', sql`${t.localHour} between 0 and 23`),
    check('catch_weather', sql`${t.weatherKind} in ('sunny','cloudy','rain','storm','fog')`),
    check('catch_depth', sql`${t.depthCm} is null or ${t.depthCm} between 0 and 2000`),
    check('catch_fate', sql`${t.fate} in ('kept','released','sold')`),
    index('catches_user_caught').on(t.userId, t.caughtAt.desc()),
    index('catches_user_species_weight').on(t.userId, t.speciesId, t.weightG.desc()),
    index('catches_session').on(t.sessionId),
  ],
)

/** Sinh vật đã gặp (bướm, cò, trâu...). Danh mục sinh vật nằm trong content/creatures.json. */
export const wildlifeSightings = pgTable(
  'wildlife_sightings',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    creatureId: text('creature_id').notNull(),
    firstLocation: text('first_location').notNull(),
    firstSeenAt: tstz('first_seen_at').notNull(),
    lastSeenAt: tstz('last_seen_at').notNull(),
    timesSeen: integer('times_seen').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.creatureId] }), check('sighting_times', sql`${t.timesSeen} > 0`)],
)

export type User = typeof users.$inferSelect
