import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // Bản production thật (API + dist trên một cổng), DB PGlite trong bộ nhớ: mỗi lần chạy là DB trống.
    command: 'npm run build && PORT=4173 PGLITE_DIR=memory npm start',
    url: 'http://localhost:4173/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
