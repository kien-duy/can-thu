import { expect, type Page } from '@playwright/test'

/** Tiện ích chung cho e2e. ?fast=1 thu nhỏ thời gian; ?seed cố định loài và nhịp; ?store=local không cần Supabase. */
export const app = (page: Page) => page.getByTestId('app')

export async function enterShift(page: Page, url = '/?fast=1&seed=3&store=local') {
  await page.goto(url)
  await page.getByTestId('ticket-1').click()
  await expect(app(page)).toHaveAttribute('data-shift', 'on')
}

export async function castLine(page: Page) {
  const btn = page.getByTestId('primary')
  await btn.hover()
  await page.mouse.down()
  await page.waitForTimeout(900)
  await page.mouse.up()
  await expect(app(page)).toHaveAttribute('data-phase', /sinking|waiting/)
}

/**
 * Kéo cá như một người chơi bình thường: cứ 120 ms nhìn thanh căng dây một lần (phản xạ người),
 * ghì khi dây chưa căng, thả khi căng. Chạy hẳn trong trang để độ trễ của Playwright không làm sai lệch.
 */
export async function fightUntilLandable(page: Page) {
  const end = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const app = document.querySelector<HTMLElement>('[data-testid=app]')!
        const key = (type: 'keydown' | 'keyup') => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }))
        let holding = false
        const started = Date.now()
        const timer = setInterval(() => {
          const phase = app.dataset.phase
          if (phase !== 'fighting') {
            if (holding) key('keyup')
            clearInterval(timer)
            resolve(phase === 'landable' ? 'landable' : `${phase}: ${document.querySelector('[data-testid=hint]')?.textContent}`)
            return
          }
          const tension = Number(app.dataset.tension)
          if (tension < 0.7 && !holding) {
            key('keydown')
            holding = true
          } else if (tension >= 0.7 && holding) {
            key('keyup')
            holding = false
          }
          if (Date.now() - started > 90_000) {
            clearInterval(timer)
            resolve('quá lâu')
          }
        }, 120)
      }),
  )
  if (end !== 'landable') throw new Error(`trận kéo kết thúc ở pha ${end}`)
}

/** Đợi phao báo ăn thật rồi giật ngay trong trang (như người đang nhìn phao), tránh độ trễ của Playwright. */
export async function strikeOnWindow(page: Page, timeoutMs = 30_000) {
  const r = await page.evaluate(
    (timeout) =>
      new Promise<string>((resolve) => {
        const app = document.querySelector<HTMLElement>('[data-testid=app]')!
        const started = Date.now()
        const timer = setInterval(() => {
          if (app.dataset.wait === 'window') {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }))
            clearInterval(timer)
            resolve('ok')
          } else if (app.dataset.phase === 'result' || Date.now() - started > timeout) {
            clearInterval(timer)
            resolve(`không thấy cửa sổ giật (pha ${app.dataset.phase}): ${document.querySelector('[data-testid=hint]')?.textContent}`)
          }
        }, 40)
      }),
    timeoutMs,
  )
  if (r !== 'ok') throw new Error(r)
  await expect(app(page)).toHaveAttribute('data-phase', /fighting|landable/)
}
