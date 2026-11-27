import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { apiPlugin } from './server/vite-plugin.ts'

export default defineConfig({
  plugins: [react(), apiPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        spike: resolve(import.meta.dirname, 'spike.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    env: { PGLITE_DIR: 'memory' },
    environment: 'node',
  },
})
