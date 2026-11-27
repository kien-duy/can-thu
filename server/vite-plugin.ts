// Gắn API vào Vite dev server: `npm run dev` là một tiến trình, một cổng, như bản production.
// Module server được nạp qua ssrLoadModule nên sửa code server là có hiệu lực ngay ở request sau;
// kết nối DB nằm trên globalThis (server/db/client.ts) nên không bị mở lại.
import { getRequestListener } from '@hono/node-server'
import type { Plugin } from 'vite'

export function apiPlugin(): Plugin {
  return {
    name: 'can-thu-api',
    configureServer(server) {
      process.env.PORT ??= String(server.config.server.port ?? 5173)
      // Giữ một app cho mỗi phiên bản module (bộ đếm giới hạn đăng nhập nằm trong app).
      const apps = new WeakMap<object, ReturnType<typeof getRequestListener>>()
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const mod = (await server.ssrLoadModule('/server/app.ts')) as typeof import('./app')
          const { getDb } = (await server.ssrLoadModule('/server/db/client.ts')) as typeof import('./db/client')
          let listener = apps.get(mod.createApp)
          if (!listener) {
            listener = getRequestListener(mod.createApp(mod.optionsFromEnv(getDb)).fetch)
            apps.set(mod.createApp, listener)
          }
          await listener(req, res)
        } catch (e) {
          next(e)
        }
      })
    },
  }
}
