import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { lockFolder } from './lock'
import * as schema from './schema'

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>

// Có DATABASE_URL thì dùng Postgres thật (Neon khi lên mạng). Không có thì dùng PGlite: Postgres biên dịch
// sang WASM, chạy ngay trong tiến trình Node, dữ liệu ở .data/pglite. Máy dev và test không phải cài gì.
// PGLITE_DIR=memory giữ trong bộ nhớ (test, e2e).
//
// Vite dev server nạp lại module server khi sửa code, nên kết nối được giữ trên globalThis: hai PGlite mở
// cùng một thư mục sẽ làm hỏng dữ liệu. Tiến trình khác bị chặn bằng file khoá (./lock.ts).
const KEY = Symbol.for('can-thu.db')
interface Connection {
  db: DB
  close: () => Promise<void>
}
type Holder = { [KEY]?: Promise<Connection> }

const migrationsFolder = path.join(process.cwd(), 'drizzle')

async function connect(): Promise<Connection> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    // pg đọc sslmode trong URL nhưng không đọc channel_binding.
    const options = (connectionString: string) => ({
      connectionString,
      enableChannelBinding: /[?&]channel_binding=require(&|$)/.test(connectionString),
    })
    // Neon cho hai URL: DATABASE_URL đi qua PgBouncer (truy vấn thường), DATABASE_URL_UNPOOLED đi thẳng
    // (chạy migration, vì chế độ transaction của PgBouncer có thể làm hỏng migration).
    const direct = new Pool(options(process.env.DATABASE_URL_UNPOOLED || url))
    try {
      await migrate(drizzle(direct, { schema }), { migrationsFolder })
    } finally {
      await direct.end()
    }
    const pool = new Pool({ ...options(url), max: 10 })
    // Neon đóng kết nối khi máy ngủ: không bắt lỗi này thì cả tiến trình dừng.
    pool.on('error', (e) => console.error('postgres pool:', e.message))
    return { db: drizzle(pool, { schema }) as unknown as DB, close: () => pool.end() }
  }
  // Host xoá đĩa mỗi lần khởi động lại (gói miễn phí của Render) đặt biến này: PGlite ở đó sẽ mất hết dữ liệu.
  if (process.env.REQUIRE_DATABASE_URL) {
    throw new Error('Chưa đặt DATABASE_URL, mà REQUIRE_DATABASE_URL bắt buộc phải có')
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), '.data', 'pglite')
  let release = () => {}
  if (dir !== 'memory') {
    mkdirSync(dir, { recursive: true })
    release = lockFolder(dir)
    process.once('exit', release)
  }
  const client = dir === 'memory' ? new PGlite() : new PGlite(dir)
  const db = drizzle(client, { schema })
  try {
    await migrate(db, { migrationsFolder })
  } catch (e) {
    release()
    throw e
  }
  return {
    db: db as unknown as DB,
    close: async () => {
      await client.close()
      release()
    },
  }
}

/** Một DB PGlite riêng trong bộ nhớ, đã chạy migration. Cho test. */
export async function memoryDb(): Promise<Connection> {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder })
  return { db: db as unknown as DB, close: () => client.close() }
}

function connection(): Promise<Connection> {
  const g = globalThis as Holder
  g[KEY] ??= connect().catch((e) => {
    delete g[KEY]
    throw e
  })
  return g[KEY]
}

export async function getDb(): Promise<DB> {
  return (await connection()).db
}

/** Đóng DB nếu đang mở. PGlite ghi xuống đĩa và bỏ khoá thư mục. */
export async function closeDb() {
  const g = globalThis as Holder
  const open = g[KEY]
  if (!open) return
  delete g[KEY]
  await (await open).close()
}
