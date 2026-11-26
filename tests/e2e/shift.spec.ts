import { expect, test } from '@playwright/test'
import { app, castLine, enterShift, fightUntilLandable, strikeOnWindow } from './helpers'
const coins = async (page: import('@playwright/test').Page) => Number((await page.getByTestId('hud-coins').textContent())!.replace(/\D/g, ''))

test('một ca trọn vẹn: vé, dò đáy, trộn mồi, câu, hết ca, bán cá', async ({ page }) => {
  test.setTimeout(120_000)
  await enterShift(page)
  expect(await coins(page)).toBe(440) // 500 − vé 1 tiếng 60

  // chuẩn bị: dò đáy, trộn bài mồi rô phi
  await page.getByTestId('open-tray').click()
  await page.getByTestId('sound-bottom').click()
  await expect(page.getByTestId('depth')).toHaveText('180 cm')
  await page.getByRole('tab', { name: 'Mồi' }).click()
  await page.getByTestId('recipe-ro_phi').click()
  await expect(page.getByTestId('bowl')).toContainText('còn 40 lần móc')
  await page.getByRole('button', { name: 'Đóng chuẩn bị' }).click()

  // câu một con
  await castLine(page)
  await strikeOnWindow(page)
  await fightUntilLandable(page)
  await page.keyboard.press('KeyE')
  await expect(page.getByText(/vào rọng/).first()).toBeVisible()

  // kết thúc ca sớm, bán cá
  await page.getByText('Thêm').click()
  await page.getByTestId('end-shift').click()
  await expect(app(page)).toHaveAttribute('data-shift', 'over')
  await expect(page.getByText(/Rọng có 1 con/)).toBeVisible()
  await page.getByTestId('sell').click()
  await expect(app(page)).toHaveAttribute('data-shift', 'none')
  await expect(page.getByText(/Cân cá xong: 1 con/)).toBeVisible()
  const after = Number((await page.getByTestId('coins').textContent())!.replace(/\D/g, ''))
  expect(after).toBeGreaterThan(440)

  // tiến độ còn sau khi tải lại
  await page.reload()
  expect(Number((await page.getByTestId('coins').textContent())!.replace(/\D/g, ''))).toBe(after)
})

test('cửa hàng: mua dây 1.5, đủ xu thì trừ, có trong khay đồ nghề; đồ cấp cao bị khoá', async ({ page }) => {
  await enterShift(page)
  await page.getByTestId('open-shop').click()
  await expect(page.getByText('Cấp 2').first()).toBeVisible() // cần carbon, phao cỏ lau cần cấp 2
  await page.getByRole('button', { name: '250 xu' }).click()
  await expect(page.getByTestId('shop-coins')).toHaveText('190 xu')
  await page.getByRole('button', { name: 'Đóng cửa hàng' }).click()
  await page.getByTestId('open-tray').click()
  await page.getByRole('tab', { name: 'Đồ nghề' }).click()
  await expect(page.getByRole('button', { name: /Dây 1.5/ })).toHaveAttribute('aria-pressed', 'true')
})
