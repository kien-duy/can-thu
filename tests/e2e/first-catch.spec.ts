import { expect, type Page, test } from '@playwright/test'

/**
 * M1 "done": từ lúc mở game tới lúc có một dòng trong sổ tay.
 * ?fast=1 thu nhỏ thời gian chờ; ?seed cố định loài và nhịp; ?store=local để không cần Supabase.
 */
const app = (page: Page) => page.getByTestId('app')

async function castLine(page: Page) {
  const btn = page.getByTestId('primary')
  await btn.hover()
  await page.mouse.down()
  await page.waitForTimeout(900)
  await page.mouse.up()
  await expect(app(page)).toHaveAttribute('data-phase', /sinking|waiting/)
}

async function fightUntilLandable(page: Page) {
  const btn = page.getByTestId('primary')
  await btn.hover()
  let holding = false
  for (let i = 0; i < 1200; i++) {
    const phase = await app(page).getAttribute('data-phase')
    if (phase === 'landable') {
      if (holding) await page.mouse.up()
      return
    }
    if (phase !== 'fighting') throw new Error(`trận kéo kết thúc ở pha ${phase}: ${await page.getByTestId('hint').textContent()}`)
    const tension = Number(await app(page).getAttribute('data-tension'))
    if (tension < 0.7 && !holding) {
      await page.mouse.down()
      holding = true
    } else if (tension >= 0.7 && holding) {
      await page.mouse.up()
      holding = false
    }
    await page.waitForTimeout(50)
  }
  throw new Error('kéo quá lâu')
}

test('câu được con cá đầu tiên và thấy nó trong sổ tay', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.goto('/?fast=1&seed=3&store=local')
  await expect(page.getByTestId('primary')).toHaveText('Giữ để quăng')
  await page.screenshot({ path: info.outputPath('01-ready.png') })

  await castLine(page)
  await expect(app(page)).toHaveAttribute('data-wait', 'nibbling', { timeout: 20_000 })
  await page.screenshot({ path: info.outputPath('02-nibbling.png') })
  await expect(app(page)).toHaveAttribute('data-wait', 'window', { timeout: 20_000 })
  await page.keyboard.press('Space')
  await expect(app(page)).toHaveAttribute('data-phase', 'fighting')
  await page.screenshot({ path: info.outputPath('03-fighting.png') })

  await fightUntilLandable(page)
  await expect(page.getByTestId('primary')).toHaveText('Vớt')
  await page.keyboard.press('KeyE')
  await expect(app(page)).toHaveAttribute('data-phase', 'result')
  await expect(page.getByText(/vào rọng/)).toBeVisible()

  await page.getByTestId('open-handbook').click()
  const caught = page.locator('[data-caught="yes"]')
  await expect(caught).toHaveCount(1)
  await expect(caught.getByText('Đã câu')).toBeVisible()
  await page.screenshot({ path: info.outputPath('04-handbook.png') })

  // tải lại trang: sổ tay vẫn còn (lưu trên máy)
  await page.reload()
  await page.getByTestId('open-handbook').click()
  await expect(page.locator('[data-caught="yes"]')).toHaveCount(1)
})

test('giật lúc cá mới rỉa là sớm', async ({ page }) => {
  await page.goto('/?fast=1&seed=3&store=local')
  await castLine(page)
  await expect(app(page)).toHaveAttribute('data-wait', 'nibbling', { timeout: 20_000 })
  await page.keyboard.press('Space')
  await expect(page.getByTestId('hint')).toContainText('Sớm quá')
})

test('chế độ văn phòng không vẽ 3D', async ({ page }) => {
  await page.goto('/?store=local')
  await page.getByRole('button', { name: 'Chế độ văn phòng' }).click()
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByLabel('Cận cảnh phao')).toBeVisible()
})
