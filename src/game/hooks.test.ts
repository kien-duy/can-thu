import { describe, expect, it } from 'vitest'
import { LOCATIONS } from '../content'
import { buyGear, equip, newPlayer, parsePlayer, PlayerStateSchema, setupFor, shopRisk, unhookTip } from './player'

const loc = LOCATIONS[0]!

describe('lưỡi câu trong túi đồ', () => {
  it('người mới có sẵn lưỡi số 3, lắp vào bộ câu', () => {
    const p = newPlayer()
    expect(p.owned.hooks).toEqual(['luoi_3'])
    expect(p.equipped.hook).toBe('luoi_3')
    expect(setupFor(p, loc, 27).hook?.id).toBe('luoi_3')
  })
  it('bản lưu cũ chưa có lưỡi: lấp lưỡi khởi đầu, giữ nguyên đồ và xu đã có', () => {
    const old = {
      coins: 1234,
      xp: 300,
      owned: { rods: ['can_tre_36', 'can_carbon_45'], lines: ['day_10'], floats: ['phao_nano'] },
      equipped: { rod: 'can_carbon_45', line: 'day_10', float: 'phao_nano', rig: 'lung_10' },
    }
    const p = parsePlayer(old)
    expect(p.coins).toBe(1234)
    expect(p.owned.rods).toEqual(['can_tre_36', 'can_carbon_45'])
    expect(p.equipped.rod).toBe('can_carbon_45')
    expect(p.equipped.rig).toBe('lung_10')
    expect(p.owned.hooks).toEqual(['luoi_3'])
    expect(p.equipped.hook).toBe('luoi_3')
  })
  it('bản lưu mới giữ nguyên lưỡi đã chọn', () => {
    const p = parsePlayer({ ...newPlayer(), owned: { ...newPlayer().owned, hooks: ['luoi_3', 'luoi_1'] }, equipped: { ...newPlayer().equipped, hook: 'luoi_1' } })
    expect(p.owned.hooks).toEqual(['luoi_3', 'luoi_1'])
    expect(p.equipped.hook).toBe('luoi_1')
  })
  it('mua lưỡi: trừ xu, tự buộc vào; khoá theo cấp và báo thiếu xu như đồ khác', () => {
    const r = buyGear(newPlayer(), 'hooks', 'luoi_1')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.coins).toBe(420)
    expect(r.state.equipped.hook).toBe('luoi_1')
    expect(buyGear(r.state, 'hooks', 'luoi_1')).toEqual({ ok: false, error: 'Đã có rồi.' })
    expect(buyGear(newPlayer(), 'hooks', 'luoi_5')).toEqual({ ok: false, error: 'Cần đạt cấp 2 mới mua được.' })
    expect(buyGear({ ...newPlayer(), coins: 100, xp: 240 }, 'hooks', 'luoi_8')).toEqual({ ok: false, error: 'Thiếu 300 xu.' })
  })
  it('đổi lưỡi chỉ với lưỡi đã có', () => {
    expect(equip(newPlayer(), 'hooks', 'luoi_8')).toEqual({ ok: false, error: 'Chưa có món này.' })
    const r = buyGear(newPlayer(), 'hooks', 'luoi_1')
    if (!r.ok) throw new Error(r.error)
    const back = equip(r.state, 'hooks', 'luoi_3')
    expect(back.ok && back.state.equipped.hook).toBe('luoi_3')
  })
})

describe('gợi ý sau lần tuột lưỡi đầu tiên', () => {
  it('người mới cấp 1: gợi ý lưỡi số 5 kèm giá và cấp mở', () => {
    expect(unhookTip(newPlayer())).toBe('Lưỡi số 3 chỉ giữ chắc cá tới 2 kg. Mua lưỡi số 5 ở Cửa hàng (150 xu, mở ở cấp 2) để giữ cá to.')
  })
  it('đã đủ cấp thì không nhắc cấp; đã có lưỡi số 5 thì nhắc buộc vào', () => {
    const p = { ...newPlayer(), xp: 60 }
    expect(unhookTip(p)).toBe('Lưỡi số 3 chỉ giữ chắc cá tới 2 kg. Mua lưỡi số 5 ở Cửa hàng (150 xu) để giữ cá to.')
    const owns = { ...p, owned: { ...p.owned, hooks: ['luoi_3', 'luoi_5'] } }
    expect(unhookTip(owns)).toContain('Bạn có lưỡi số 5 rồi')
  })
  it('chỉ một lần: đã hiện thì thôi; đang buộc lưỡi to nhất thì không gợi ý', () => {
    expect(unhookTip({ ...newPlayer(), hookTipShown: true })).toBeNull()
    const big = newPlayer()
    expect(unhookTip({ ...big, equipped: { ...big.equipped, hook: 'luoi_8' } })).toBeNull()
  })
  it('bản lưu cũ chưa có cờ này vẫn đọc được, coi như chưa gợi ý', () => {
    const old: Partial<ReturnType<typeof newPlayer>> = newPlayer()
    delete old.hookTipShown
    expect(PlayerStateSchema.parse(old).hookTipShown).toBe(false)
    expect(parsePlayer({ ...old, coins: 777 })).toMatchObject({ coins: 777, hookTipShown: false })
    expect(parsePlayer({ ...newPlayer(), hookTipShown: true }).hookTipShown).toBe(true)
  })
})

describe('cửa hàng cảnh báo dây khoẻ hơn cần', () => {
  it('cần tre + dây 1.0: dây 1.5 và 2.5 bị cảnh báo, dây 1.0 thì không', () => {
    const p = newPlayer()
    expect(shopRisk(p, 'lines', 'day_15')).toBe('Khoẻ hơn cần tre 3m6 đang lắp: quá tải thì cần gãy trước thẻo.')
    expect(shopRisk(p, 'lines', 'day_25')).not.toBeNull()
    expect(shopRisk(p, 'lines', 'day_10')).toBeNull()
    expect(shopRisk(p, 'rods', 'can_carbon_45')).toBeNull()
    expect(shopRisk(p, 'hooks', 'luoi_5')).toBeNull()
  })
  it('đang lắp dây 2.5: cần yếu hơn dây bị cảnh báo; cần cứng thì không', () => {
    const p = newPlayer()
    const q = { ...p, owned: { ...p.owned, lines: ['day_10', 'day_25'] }, equipped: { ...p.equipped, line: 'day_25', rod: 'can_cung_54' } }
    expect(shopRisk(q, 'rods', 'can_carbon_45')).toBe('Yếu hơn dây đang lắp: quá tải thì cần gãy trước thẻo.')
    expect(shopRisk(q, 'rods', 'can_cung_54')).toBeNull()
    expect(shopRisk(q, 'lines', 'day_15')).toBeNull()
  })
})
