import { describe, expect, it } from 'vitest'
import { LOCATIONS } from '../content'
import { buyGear, equip, newPlayer, parsePlayer, setupFor } from './player'

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
