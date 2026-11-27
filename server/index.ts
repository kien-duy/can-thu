// Server production: một tiến trình phục vụ cả API (/api) lẫn bản build trong dist/.
// Chạy bằng `npm start` (sau `npm run build`). Khi dev, Vite gắn cùng API vào dev server (vite.config.ts).
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createApp, optionsFromEnv } from './app'
import { closeDb, getDb } from './db/client'

const port = Number(process.env.PORT || 8787)
const hostname = process.env.HOST ?? '0.0.0.0'
process.env.PORT = String(port) // tên cookie phiên đọc PORT

const root = new Hono()
root.get('/healthz', (c) => c.json({ ok: true }))
root.route('/', createApp(optionsFromEnv(getDb)))
root.use('/assets/*', serveStatic({ root: './dist', onFound: (_p, c) => void c.header('Cache-Control', 'public, max-age=31536000, immutable') }))
root.use('*', serveStatic({ root: './dist' }))
// Mọi đường khác (không phải /api) trả về trang game.
root.get('*', serveStatic({ path: './dist/index.html' }))

// Mở DB (và chạy migration) trước khi nhận request đầu tiên.
await getDb()
const server = serve({ fetch: root.fetch, port, hostname }, () => {
  console.log(`> Cần Thủ: http://localhost:${port}`)
})

let closing = false
const stop = (signal: string) => {
  if (closing) return
  closing = true
  console.log(`> ${signal}: đang đóng`)
  setTimeout(() => process.exit(1), 10_000).unref()
  server.close()
  closeDb()
    .catch((e) => console.error('đóng DB lỗi', e))
    .finally(() => process.exit(0))
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
