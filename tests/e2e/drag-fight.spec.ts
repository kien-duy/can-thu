import { expect, type Page, test } from '@playwright/test'
import { app, castLine, enterShift, strikeOnWindow } from './helpers'

/**
 * Kéo cá bằng một ngón tay trên mặt kéo cá: chạm giữ = ghì, nhấc lên = tay mềm, rê ngang (khi đang chạm) = dòng cần.
 * Chạy hẳn trong trang (như fightUntilLandable) để độ trễ của Playwright không làm sai lệch; cứ 120 ms nhìn dây một lần.
 */
async function fightByTouch(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ end: string; steeredRight: number }>((resolve) => {
        const app = document.querySelector<HTMLElement>('[data-testid=app]')!
        const pad = () => document.querySelector<HTMLElement>('[data-testid=fight-pad]')
        let holding = false
        let steeredRight = 0
        const touch = (type: 'pointerdown' | 'pointermove' | 'pointerup', x: number) => {
          const el = pad()
          if (!el) return
          const r = el.getBoundingClientRect()
          const init = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: r.top + r.height * 0.4, bubbles: true }
          el.dispatchEvent(new PointerEvent(type, init))
        }
        const started = Date.now()
        const timer = setInterval(() => {
          const phase = app.dataset.phase
          const el = pad()
          if (phase !== 'fighting' || !el) {
            if (holding) touch('pointerup', 0)
            clearInterval(timer)
            resolve({ end: phase === 'landable' ? 'landable' : `${phase}: ${document.querySelector('[data-testid=hint]')?.textContent}`, steeredRight })
            return
          }
          const r = el.getBoundingClientRect()
          const dir = Number(app.dataset.fishDir ?? 0)
          const want = dir === 1 || dir === -1 ? -dir : 0
          const x = r.left + r.width * (0.5 + want * 0.35)
          if (want !== 0 && Number(el.dataset.rodSide) === want) steeredRight++
          const tension = Number(app.dataset.tension)
          if (tension < 0.7 && !holding) {
            touch('pointerdown', x)
            holding = true
          } else if (holding) {
            touch('pointermove', x)
            if (tension >= 0.7) {
              touch('pointerup', x)
              holding = false
            }
          }
          if (Date.now() - started > 90_000) {
            clearInterval(timer)
            resolve({ end: 'quá lâu', steeredRight })
          }
        }, 120)
      }),
  )
}

test('kiểu kéo "rê": chọn trong Cài đặt, rê để dòng cần, một ngón tay kéo và vớt được cá', async ({ page }) => {
  test.setTimeout(120_000)
  await enterShift(page)
  await expect(app(page)).toHaveAttribute('data-fight-style', 'keys')
  await expect(page.getByTestId('controls-hint')).toHaveText('Space · Dòng: A/D · Vớt: E')

  await page.getByText('Thêm').click()
  await page.getByRole('button', { name: 'Cài đặt' }).click()
  await page.getByRole('button', { name: /Rê chuột, ngón tay/ }).click()
  await expect(app(page)).toHaveAttribute('data-fight-style', 'drag')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('controls-hint')).toContainText('rê ngang để dòng')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('can-thu:prefs') ?? '{}').fightStyle)).toBe('drag')

  await castLine(page)
  await strikeOnWindow(page)
  await expect(app(page)).toHaveAttribute('data-phase', 'fighting')

  // chuột: rê (không cần giữ) sang trái, phải, về giữa là cần đổi góc theo
  const pad = page.getByTestId('fight-pad')
  const box = (await pad.boundingBox())!
  const y = box.y + box.height * 0.4
  await page.mouse.move(box.x + box.width * 0.1, y)
  await expect(pad).toHaveAttribute('data-rod-side', '-1')
  await page.mouse.move(box.x + box.width * 0.9, y, { steps: 4 })
  await expect(pad).toHaveAttribute('data-rod-side', '1')
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 2 })
  await expect(pad).toHaveAttribute('data-rod-side', '0')

  const r = await fightByTouch(page)
  expect(r.end).toBe('landable')
  expect(r.steeredRight).toBeGreaterThan(0)

  // cũng ngón tay đó chạm thêm một lần là vớt
  await expect(page.getByTestId('primary')).toHaveText('Vớt')
  await page.mouse.click(box.x + box.width * 0.5, y)
  await expect(app(page)).toHaveAttribute('data-phase', 'result')
  await expect(page.getByText(/vào rọng/)).toBeVisible()
  await expect(pad).toHaveCount(0)
})
