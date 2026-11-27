import { expect, test } from '@playwright/test'

/**
 * M1 "done": từ lúc mở game tới lúc có một dòng trong sổ tay.
 * ?fast=1 thu nhỏ thời gian chờ; ?seed cố định loài và nhịp; ?store=local để lưu trên máy, không gọi server.
 */
import { app, castLine, enterShift, fightUntilLandable, strikeOnWindow } from './helpers'

test('câu được con cá đầu tiên và thấy nó trong sổ tay', async ({ page }, info) => {
  test.setTimeout(90_000)
  await enterShift(page)
  await expect(page.getByTestId('primary')).toHaveText('Giữ để quăng')
  await page.screenshot({ path: info.outputPath('01-ready.png') })

  await castLine(page)
  await expect(app(page)).toHaveAttribute('data-wait', 'nibbling', { timeout: 20_000 })
  await page.screenshot({ path: info.outputPath('02-nibbling.png') })
  await strikeOnWindow(page)
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

  // tải lại trang: sổ tay vẫn còn, ca câu và rọng được khôi phục
  await page.reload()
  await expect(app(page)).toHaveAttribute('data-shift', 'on')
  await expect(page.getByText(/Rọng: 1 con/)).toBeVisible()
  await page.getByTestId('open-handbook').click()
  await expect(page.locator('[data-caught="yes"]')).toHaveCount(1)
  await page.getByRole('tab', { name: 'Nhật ký câu' }).click()
  await expect(page.getByTestId('journal').locator('tbody tr')).toHaveCount(1)
})

test('giật lúc cá mới rỉa là sớm', async ({ page }) => {
  await enterShift(page)
  await castLine(page)
  await expect(app(page)).toHaveAttribute('data-wait', 'nibbling', { timeout: 20_000 })
  await page.keyboard.press('Space')
  await expect(page.getByTestId('hint')).toContainText('Sớm quá')
})

test('chế độ văn phòng không vẽ 3D', async ({ page }) => {
  await enterShift(page, '/?store=local', '3d')
  await page.getByText('Thêm').click()
  await page.getByRole('button', { name: 'Chế độ văn phòng' }).click()
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByLabel('Cận cảnh phao')).toBeVisible()
})
