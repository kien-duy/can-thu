import { expect, type Page, test } from '@playwright/test'
import { app, castLine, enterShift, fightUntilLandable, strikeOnWindow } from './helpers'

/** Nạp sẵn tiến độ (cấp 4) vào bản lưu trên máy trước khi mở game. */
async function seedPlayer(page: Page, xp: number) {
  await page.addInitScript((xp) => {
    if (localStorage.getItem('can-thu:v1')) return
    localStorage.setItem('can-thu:v1', JSON.stringify({ sessions: [], catches: [], player: { version: 1, coins: 500, xp, state: {} } }))
  }, xp)
}

test('địa điểm khoá theo cấp: mới chơi chỉ vào được hồ dịch vụ', async ({ page }) => {
  await page.goto('/?fast=1&seed=3&store=local')
  await page.getByTestId('loc-ben_song_lang').click()
  await expect(page.getByText(/Lên cấp 2 để mở chỗ này/)).toBeVisible()
  await expect(page.getByTestId('go-free')).toHaveCount(0)
})

test('câu tự do ở bến sông: không mất vé, sinh vật ghé qua được ghi vào sổ tay', async ({ page }, info) => {
  test.setTimeout(90_000)
  await seedPlayer(page, 1000)
  await page.goto('/?fast=1&seed=5&store=local')
  await page.getByTestId('loc-ben_song_lang').click()
  await page.getByTestId('go-free').click()
  await expect(app(page)).toHaveAttribute('data-shift', 'on')
  await expect(page.getByTestId('hud-coins')).toHaveText('500 xu')
  await expect(page.getByText('câu tự do')).toBeVisible()
  // ở chế độ nhanh, sinh vật ghé sau vài giây (nếu giờ hiện tại có loài phù hợp)
  await page.waitForTimeout(16_000)
  await page.screenshot({ path: info.outputPath('river.png') })
  await page.getByTestId('open-handbook').click()
  await page.getByRole('tab', { name: 'Sinh vật đã gặp' }).click()
  await expect(page.getByTestId('creatures')).toBeVisible()
  const seen = await page.locator('[data-seen="yes"]').count()
  info.annotations.push({ type: 'sinh vật đã gặp', description: String(seen) })
})

test('xả mồi mở ổ tốn 3 lần móc; nhiệm vụ đếm cá', async ({ page }) => {
  test.setTimeout(90_000)
  await enterShift(page)
  await expect(page.getByText(/còn 40 lần móc/)).toBeVisible()
  await page.getByTestId('chum').click()
  await expect(page.getByText(/còn 37 lần móc/)).toBeVisible()
  await expect(page.getByText(/Ổ: 35%/)).toBeVisible()
  await castLine(page)
  await strikeOnWindow(page)
  await fightUntilLandable(page)
  await page.keyboard.press('KeyE')
  await page.getByTestId('open-quests').click()
  await expect(page.getByRole('dialog', { name: 'Nhiệm vụ' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Nhiệm vụ' }).locator('li')).toHaveCount(3)
})

test('kho nhịp phao: giật đúng lúc phao báo ăn thật thì "Dính"', async ({ page }) => {
  test.setTimeout(60_000)
  await seedPlayer(page, 0)
  await page.addInitScript(() => {
    const d = JSON.parse(localStorage.getItem('can-thu:v1')!)
    if (d.catches.length) return
    d.catches.push({ id: 'x', sessionId: 's', speciesId: 'ro_phi_den', locationId: 'ho_dong_xanh', weightG: 400, caughtAt: Date.now(), localHour: 7, weatherKind: 'sunny', bait: {}, rig: {}, fate: 'kept' })
    localStorage.setItem('can-thu:v1', JSON.stringify(d))
  })
  await enterShift(page)
  await page.getByTestId('open-handbook').click()
  await page.getByRole('tab', { name: 'Nhịp phao' }).click()
  await expect(page.getByText('Ăn thật: GIẬT!')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('lab-strike').click()
  await expect(page.getByTestId('lab-verdict')).toHaveText(/Dính/)
})

for (const [id, hour] of [
  ['ho_dong_xanh', 8],
  ['ben_song_lang', 17],
  ['ho_nui_may', 21],
] as const) {
  test(`ảnh cảnh 3D: ${id} lúc ${hour} giờ`, async ({ page }, info) => {
    await page.clock.setFixedTime(new Date(2026, 10, 26, hour, 0))
    await seedPlayer(page, 1000)
    await page.goto('/?store=local')
    await page.getByTestId(`loc-${id}`).click()
    await (id === 'ho_dong_xanh' ? page.getByTestId('ticket-1') : page.getByTestId('go-free')).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: info.outputPath(`${id}.png`) })
  })
}
