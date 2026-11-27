import { expect, type Page } from '@playwright/test'

/** Tiện ích chung cho e2e. ?fast=1 thu nhỏ thời gian; ?seed cố định loài và nhịp; ?store=local lưu trên máy, không gọi server. */
export const app = (page: Page) => page.getByTestId('app')

/**
 * Vào ca ở hồ dịch vụ. Mặc định chạy ở chế độ văn phòng (không WebGL): máy CI vẽ 3D bằng phần mềm,
 * một khung hình có thể chặn trang lâu hơn cả cửa sổ giật. Cảnh 3D được kiểm riêng ở các test chụp ảnh.
 */
export async function enterShift(page: Page, url = '/?fast=1&seed=3&store=local', view: '3d' | 'office' = 'office') {
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('e2e-view-set')) {
      localStorage.setItem('can-thu:view', v)
      sessionStorage.setItem('e2e-view-set', '1')
    }
  }, view)
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
 * ghì khi dây chưa căng, thả khi căng, và dòng cần ngược hướng cá chạy (đọc data-fish-dir; trang cũ không có
 * thuộc tính này thì giữ cần thẳng). Chạy hẳn trong trang để độ trễ của Playwright không làm sai lệch.
 */
export async function fightUntilLandable(page: Page) {
  const end = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const app = document.querySelector<HTMLElement>('[data-testid=app]')!
        const press = (type: 'keydown' | 'keyup', code: string, key: string) => window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true }))
        const key = (type: 'keydown' | 'keyup') => press(type, 'Space', ' ')
        const STEER = { [-1]: ['KeyA', 'a'], [1]: ['KeyD', 'd'] } as Record<number, [string, string]>
        let holding = false
        let side = 0
        const lean = (want: number) => {
          if (want === side) return
          if (STEER[side]) press('keyup', ...STEER[side])
          if (STEER[want]) press('keydown', ...STEER[want])
          side = want
        }
        const started = Date.now()
        const timer = setInterval(() => {
          const phase = app.dataset.phase
          if (phase !== 'fighting') {
            if (holding) key('keyup')
            lean(0)
            clearInterval(timer)
            resolve(phase === 'landable' ? 'landable' : `${phase}: ${document.querySelector('[data-testid=hint]')?.textContent}`)
            return
          }
          const tension = Number(app.dataset.tension)
          const dir = Number(app.dataset.fishDir ?? 0)
          lean(dir === 1 || dir === -1 ? -dir : 0)
          if (tension < 0.7 && !holding) {
            key('keydown')
            holding = true
          } else if (tension >= 0.7 && holding) {
            key('keyup')
            holding = false
          }
          if (Date.now() - started > 90_000) {
            lean(0)
            clearInterval(timer)
            resolve('quá lâu')
          }
        }, 120)
      }),
  )
  if (end !== 'landable') throw new Error(`trận kéo kết thúc ở pha ${end}`)
}

/**
 * Đợi phao báo ăn thật rồi giật (như người đang nhìn phao). Đọc mốc thời gian của lượt câu qua móc test
 * (chỉ có ở ?fast=1) thay vì đợi trang vẽ ra "window": máy CI vẽ 3D bằng phần mềm có khi chỉ vài khung hình
 * mỗi giây, cửa sổ giật 0,8 s có thể trôi qua giữa hai lần vẽ. Cá rỉa nhiều đợt: lỡ cửa sổ đợt này
 * (máy test chậm) thì giật ở cửa sổ của đợt sau.
 */
export async function strikeOnWindow(page: Page, timeoutMs = 30_000) {
  const r = await page.evaluate(
    (timeout) =>
      new Promise<string>((resolve) => {
        type Win = { strikeOpen: number; strikeClose: number }
        type Bite = Win & { empty?: boolean; rounds?: Win[] }
        type St = { game: { phase: string; bite?: Bite } }
        const store = (globalThis as unknown as { __canThu?: { getState(): St } }).__canThu
        if (!store) return resolve('không có móc test: mở trang với ?fast=1')
        const started = Date.now()
        const timer = setInterval(() => {
          const { game } = store.getState()
          const b = game.bite
          const now = Date.now()
          const inWindow = (b?.rounds ?? (b ? [b] : [])).some((w) => now >= w.strikeOpen + 60 && now <= w.strikeClose - 60)
          if (b && !b.empty && (game.phase === 'waiting' || game.phase === 'sinking') && inWindow) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }))
            clearInterval(timer)
            resolve('ok')
          } else if (game.phase === 'result' || b?.empty || now - started > timeout) {
            clearInterval(timer)
            resolve(`không giật được (pha ${game.phase}${b?.empty ? ', mồi rã trước khi cá tới' : ''}): ${document.querySelector('[data-testid=hint]')?.textContent}`)
          }
        }, 20)
      }),
    timeoutMs,
  )
  if (r !== 'ok') throw new Error(r)
  await expect(app(page)).toHaveAttribute('data-phase', /fighting|landable|result/)
}
