import { expect, type Page, test } from '@playwright/test'
import { app, castLine, enterShift, strikeOnWindow } from './helpers'

/** Nạp sẵn túi đồ: cần tre + cần carbon (đang lắp cần carbon) và dây 2.5 (khoẻ hơn cả hai cần). */
async function seedGear(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('can-thu:v1')) return
    const state = {
      owned: { rods: ['can_tre_36', 'can_carbon_45'], lines: ['day_10', 'day_25'], floats: ['phao_nano'] },
      equipped: { rod: 'can_carbon_45', line: 'day_25', float: 'phao_nano', rig: 'can4_cau2' },
    }
    localStorage.setItem('can-thu:v1', JSON.stringify({ sessions: [], catches: [], player: { version: 1, coins: 500, xp: 60, state } }))
  })
}

test('dây khoẻ hơn cần: Đồ nghề cảnh báo; ghì quá tải thì gãy cần, lắp lại cần còn lại', async ({ page }) => {
  test.setTimeout(60_000)
  await seedGear(page)
  await enterShift(page)
  await page.getByTestId('open-tray').click()
  await page.getByRole('tab', { name: 'Đồ nghề' }).click()
  await expect(page.getByTestId('rod-risk')).toHaveText('Dây khoẻ hơn cần: quá tải thì cần gãy trước thẻo.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Chuẩn bị' })).toHaveCount(0)

  await castLine(page)
  await strikeOnWindow(page)
  await expect(app(page)).toHaveAttribute('data-phase', 'fighting')
  // làm bộ đồ của trận này yếu hẳn đi (qua móc test) để chắc chắn quá tải, giữ nguyên tỉ lệ cần yếu hơn dây
  await page.evaluate(() => {
    type F = Record<string, number>
    const store = (globalThis as unknown as { __canThu: { getState(): { game: { fight: F } }; setState(p: object): void } }).__canThu
    const { game } = store.getState()
    store.setState({ game: { ...game, fight: { ...game.fight, strength: 0.1, rodStrength: 0.1, lineStrength: 1 } } })
  })
  await page.keyboard.down('Space')
  await expect(app(page)).toHaveAttribute('data-phase', 'result', { timeout: 10_000 })
  await page.keyboard.up('Space')
  await expect(page.getByText('Rắc! Gãy cần Cần carbon 4m5. Đã lắp lại Cần tre 3m6.')).toBeVisible()
  await expect(page.getByTestId('hint')).toContainText('gãy cần')
  const rods = await page.evaluate(() => {
    const store = (globalThis as unknown as { __canThu: { getState(): { player: { owned: { rods: string[] }; equipped: { rod: string } } } } }).__canThu
    const { player } = store.getState()
    return { owned: player.owned.rods, equipped: player.equipped.rod }
  })
  expect(rods).toEqual({ owned: ['can_tre_36'], equipped: 'can_tre_36' })
})
