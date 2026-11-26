import { expect, test } from '@playwright/test'

test('trang chủ mở vào ô câu', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Cần Thủ')
  await expect(page.getByTestId('primary')).toBeVisible()
})

test('spike: worker và timer trang đều bắn mốc 5 s, trễ dưới 1,5 s khi tab đang hiện', async ({ page }) => {
  await page.goto('/spike.html')
  await page.locator('#notify').uncheck() // headless không có hộp thoại xin quyền
  await page.getByTestId('start-fast').click()
  for (const path of ['worker', 'main']) {
    const row = page.locator(`[data-testid="row-${path}-5s"]`)
    await expect(row).toHaveAttribute('data-done', 'true', { timeout: 12_000 })
    const late = Number((await row.locator('td').nth(3).textContent())!.replace(/\D/g, ''))
    expect(late).toBeLessThan(1500)
  }
  await expect(page).toHaveTitle(/Phao động/)
})
