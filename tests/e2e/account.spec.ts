import { expect, test, type Page } from '@playwright/test'
import { app, castLine, enterShift, fightUntilLandable, strikeOnWindow } from './helpers'

/**
 * Lưu lên server của game (không có ?store=local): câu một con bằng tài khoản khách, tạo tài khoản,
 * rồi đăng nhập ở "máy khác" (một trình duyệt mới, không chung cookie) và thấy cùng sổ tay.
 */
async function openAccount(page: Page) {
  await page.getByText('Thêm', { exact: true }).click()
  await page.getByRole('button', { name: 'Tài khoản' }).click()
}

test('khách câu được cá, tạo tài khoản, đăng nhập ở máy khác thấy cùng sổ tay', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@can-thu.test`

  await enterShift(page, '/?fast=1&seed=3')
  await expect(app(page)).toHaveAttribute('data-repo', 'server')
  await castLine(page)
  await expect(app(page)).toHaveAttribute('data-wait', 'nibbling', { timeout: 20_000 })
  await strikeOnWindow(page)
  await fightUntilLandable(page)
  await page.keyboard.press('KeyE')
  await expect(app(page)).toHaveAttribute('data-phase', 'result')
  await expect(page.getByText('Đang lưu lên server')).toBeVisible()

  await openAccount(page)
  const reg = page.getByTestId('register-form')
  await reg.getByLabel('Email').fill(email)
  await reg.getByLabel(/Mật khẩu/).fill('mat-khau-e2e')
  await reg.getByRole('button', { name: 'Tạo tài khoản' }).click()
  await expect(page.getByTestId('linked')).toContainText(email)

  const other = await browser.newContext()
  const p2 = await other.newPage()
  await p2.goto('/?fast=1')
  await expect(app(p2)).toHaveAttribute('data-repo', 'server')
  // máy mới: màn chọn vé có lối đăng nhập, mở thẳng thẻ "Đã có tài khoản"
  await p2.getByTestId('picker-login').click()
  const login = p2.getByTestId('login-form')
  await login.getByLabel('Email').fill(email)
  await login.getByLabel(/Mật khẩu/).fill('mat-khau-e2e')
  await login.getByRole('button', { name: 'Đăng nhập' }).click()
  // trang tải lại sau khi đăng nhập: ca câu đang mở và sổ tay đến từ server
  await expect(app(p2)).toHaveAttribute('data-shift', 'on', { timeout: 15_000 })
  await p2.getByTestId('open-handbook').click()
  await expect(p2.locator('[data-caught="yes"]')).toHaveCount(1)
  await other.close()
})
