import { expect, test } from '@playwright/test'
import { app, castLine, enterShift, fightUntilLandable, strikeOnWindow } from './helpers'

/**
 * Mặt cắt 2D: chọn trong Cài đặt, cảnh vẽ bằng SVG (không có canvas WebGL, không tải Scene3D), bóng cá theo kế hoạch cắn,
 * người câu gồng khi giữ nút. CS_SHOTS=<thư mục> thì chụp thêm ảnh từng lúc để xem bằng mắt.
 */
const shots = process.env.CS_SHOTS

test('mặt cắt 2D: chọn trong Cài đặt, không gắn 3D, quăng, giật, kéo và vớt được cá', async ({ page }, info) => {
  test.setTimeout(150_000)
  const scene3d: string[] = []
  page.on('request', (r) => {
    if (/Scene3D/.test(r.url())) scene3d.push(r.url())
  })
  const shot = async (name: string) => {
    if (shots) await page.screenshot({ path: `${shots}/${info.project.name}-${name}.png` })
  }

  await enterShift(page)
  await page.getByText('Thêm').click()
  await page.getByRole('button', { name: 'Cài đặt' }).click()
  await page.getByRole('button', { name: /Mặt cắt 2D/ }).click()
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('can-thu:prefs') ?? '{}').scene)).toBe('2d')

  // đang ở chế độ văn phòng: chuyển sang cảnh, nút trong menu nay mang tên mặt cắt
  await page.getByText('Thêm').click()
  await page.getByRole('button', { name: 'Mặt cắt 2D' }).click()
  await expect(app(page)).toHaveAttribute('data-scene', '2d')
  const cs = page.getByTestId('cross-section')
  await expect(cs).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByTestId('surface')).toBeVisible()

  await castLine(page)
  await expect(page.getByTestId('float-2d')).toBeVisible()
  await page.waitForTimeout(250)
  await shot('1-waiting')

  // bóng cá chỉ tới khi kế hoạch cắn tới giờ rỉa
  await expect(cs).toHaveAttribute('data-shadow', 'nibble', { timeout: 30_000 })
  await expect(page.getByTestId('bite-shadow')).toHaveCount(1)
  await shot('2-nibbling')

  await strikeOnWindow(page)
  await expect(app(page)).toHaveAttribute('data-phase', 'fighting')
  await expect(cs).toHaveAttribute('data-shadow', 'hooked')
  const angler = page.getByTestId('angler')
  await expect(angler).toHaveAttribute('data-straining', 'no')
  await page.keyboard.down('Space')
  await expect(angler).toHaveAttribute('data-straining', 'yes')
  await expect(cs).toHaveAttribute('data-line', 'taut')
  await page.waitForTimeout(300)
  await shot('3-fighting-straining')
  await page.keyboard.up('Space')
  await expect(angler).toHaveAttribute('data-straining', 'no')

  await fightUntilLandable(page)
  await expect(page.getByTestId('primary')).toHaveText('Vớt')
  await page.keyboard.press('KeyE')
  await expect(app(page)).toHaveAttribute('data-phase', 'result')
  await expect(cs).toHaveAttribute('data-shadow', 'lifted')
  await expect(page.getByTestId('lifted-fish')).toBeVisible()
  await page.waitForTimeout(700)
  await shot('4-landed')
  await expect(page.getByText(/vào rọng/)).toBeVisible()

  await expect(page.locator('canvas')).toHaveCount(0)
  expect(scene3d).toEqual([])
})
