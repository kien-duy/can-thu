import { describe, expect, it } from 'vitest'
import { BAIT, LOCATIONS } from '../content'
import {
  buyGear,
  buyIngredient,
  buyTicket,
  levelOf,
  mixBowl,
  newPlayer,
  parsePlayer,
  salePrice,
  sell,
  setRig,
  setupFor,
  soundBottom,
  useBait,
  xpForLevel,
  type PlayerState,
} from './player'

const loc = LOCATIONS[0]!

describe('người chơi mới', () => {
  it('có 500 xu, đồ khởi đầu và một chậu mồi trộn sẵn', () => {
    const p = newPlayer()
    expect(p.coins).toBe(500)
    expect(p.bowl?.uses).toBe(BAIT.usesPerBowl)
    expect(setupFor(p, loc, 27).bait).not.toBeNull()
  })
  it('dữ liệu hỏng thì lấp bằng giá trị mới, không làm vỡ game', () => {
    expect(parsePlayer('rác').coins).toBe(500)
    expect(parsePlayer({ coins: 900 }).coins).toBe(900)
    expect(parsePlayer({ coins: -5 }).coins).toBe(500)
  })
})

describe('cửa hàng', () => {
  it('mua cần: trừ xu, có trong túi, tự lắp vào', () => {
    let p = { ...newPlayer(), coins: 1000, xp: 60 } // cần carbon mở ở cấp 2
    const r = buyGear(p, 'rods', 'can_carbon_45')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    p = r.state
    expect(p.coins).toBe(200)
    expect(p.equipped.rod).toBe('can_carbon_45')
    expect(buyGear(p, 'rods', 'can_carbon_45')).toEqual({ ok: false, error: 'Đã có rồi.' })
  })
  it('không đủ xu thì báo thiếu bao nhiêu', () => {
    expect(buyGear({ ...newPlayer(), xp: 240 }, 'rods', 'can_cung_54')).toEqual({ ok: false, error: 'Thiếu 1700 xu.' })
  })
  it('mua nguyên liệu cộng muỗng vào kho', () => {
    const r = buyIngredient(newPlayer(), 'bot_tom')
    expect(r.ok && r.state.stock.bot_tom).toBe(12)
  })
})

describe('mồi', () => {
  it('trộn chậu trừ nguyên liệu; thiếu thì báo rõ', () => {
    const p = newPlayer()
    const r = mixBowl(p, { bot_nen: 3, bot_sua_ngo: 3 }, 'thử')
    expect(r.ok && r.state.stock.bot_sua_ngo).toBe(1)
    expect(mixBowl(p, { bot_sua_ngo: 9 }, 'x')).toEqual({ ok: false, error: 'Không đủ Bột sữa ngô (còn 4 muỗng).' })
  })
  it('mỗi lần quăng tốn một viên, hết chậu thì lưỡi không mồi', () => {
    let p: PlayerState = { ...newPlayer(), bowl: { ...newPlayer().bowl!, uses: 1 } }
    p = useBait(p)
    expect(p.bowl).toBeNull()
    expect(setupFor(p, loc, 27).bait).toBeNull()
  })
})

describe('cân phao', () => {
  it('dò đáy đặt độ sâu theo kiểu cân; đổi kiểu cân thì độ sâu dời theo', () => {
    let p = soundBottom(newPlayer(), loc)
    expect(p.depthCm[loc.id]).toBe(loc.bottomDepthCm)
    p = setRig(p, loc, 'lung_10')
    expect(p.depthCm[loc.id]).toBe(loc.bottomDepthCm - 10)
  })
})

describe('ca câu và bán cá', () => {
  it('vé trừ xu; không đủ thì không vào được', () => {
    expect(buyTicket(newPlayer(), loc, 2)).toMatchObject({ ok: true, state: { coins: 400 } })
    expect(buyTicket({ ...newPlayer(), coins: 10 }, loc, 1).ok).toBe(false)
  })
  it('bán cá theo kg', () => {
    expect(salePrice('ro_phi_den', 1000)).toBe(35)
    const r = sell(newPlayer(), [{ speciesId: 'dieu_hong', weightG: 800 }, { speciesId: 'diec', weightG: 250 }])
    expect(r.earned).toBe(40 + 30)
    expect(r.state.coins).toBe(570)
  })
  it('một ca 2 tiếng câu bình thường có lãi (khoảng 8 con rô phi cỡ thường)', () => {
    const fish = Array.from({ length: 8 }, () => ({ speciesId: 'ro_phi_den', weightG: 450 }))
    const r = sell({ ...newPlayer(), coins: 0 }, fish)
    expect(r.earned).toBeGreaterThan(loc.tickets.find((t) => t.hours === 2)!.priceXu * 1.2)
  })
})

describe('cấp độ', () => {
  it('cấp tăng theo căn bậc hai của xp', () => {
    expect(levelOf(0)).toBe(1)
    expect(levelOf(59)).toBe(1)
    expect(levelOf(60)).toBe(2)
    expect(levelOf(xpForLevel(5))).toBe(5)
  })
})
