import { describe, expect, it } from 'vitest'
import { GEAR, LOCATIONS, lineOf, rodOf, SPECIES, speciesOf } from '../content'
import { breakRod, newPlayer, type PlayerState, setupFor } from '../game/player'
import { advanceFight, brokenPart, initFight, outcomeOf } from './fight'
import { type GameConfig, type GameState, initialState, reduce } from './game'
import type { Setup } from './setup'

const loc = LOCATIONS[0]!
const cfg: GameConfig = { location: loc, species: SPECIES, seed: 11, timeScale: 1 }

/** Quăng với bộ đồ cho trước, giật đúng cửa sổ rồi ghì liên tục tới khi trận kéo kết thúc. */
function holdUntilEnd(setup: Setup): GameState {
  const t0 = 1_000_000
  let s = initialState(t0)
  s = reduce(cfg, s, { type: 'charge', t: t0 })
  s = reduce(cfg, s, { type: 'release', t: t0 + 900, hour: 7, setup })
  let t = s.bite!.strikeOpen + 100
  s = reduce(cfg, { ...s, phase: 'waiting' }, { type: 'strike', t })
  s = reduce(cfg, s, { type: 'reel', t, on: true })
  for (let i = 0; i < 2400 && s.phase === 'fighting'; i++) {
    t += 50
    s = reduce(cfg, s, { type: 'tick', t })
  }
  return s
}

/** Bộ đồ yếu hẳn đi để chắc chắn quá tải; tỉ lệ cần/dây mới là thứ được kiểm tra. */
function weakSetup(rodStrength: number, lineStrength: number): Setup {
  const base = setupFor(newPlayer(), loc, 27)
  return { ...base, strength: rodStrength * lineStrength, rodStrength, lineStrength }
}

describe('quá tải: phần yếu hơn hỏng trước', () => {
  const chep = speciesOf('chep')
  it('cần yếu hơn dây thì gãy cần', () => {
    const f = advanceFight(initFight(chep, 5000, 7, 3, 1, 1, 1.7), 60_000, true)
    expect(outcomeOf(f)).toBe('broke')
    expect(brokenPart(f)).toBe('rod')
  })
  it('dây yếu hơn cần thì đứt thẻo', () => {
    const f = advanceFight(initFight(chep, 5000, 7, 3, 1, 1.7, 1), 60_000, true)
    expect(outcomeOf(f)).toBe('broke')
    expect(brokenPart(f)).toBe('line')
  })
  it('cần và dây bằng sức thì thẻo đứt (thẻo là điểm yếu tính sẵn)', () => {
    expect(brokenPart(initFight(chep, 5000, 7, 3, 1.69, 1.3, 1.3))).toBe('line')
  })
  it('không truyền sức riêng thì mặc định 1 và 1: vẫn là đứt thẻo như cũ', () => {
    const f = initFight(chep, 5000, 7, 3)
    expect(f.rodStrength).toBe(1)
    expect(f.lineStrength).toBe(1)
    expect(brokenPart(f)).toBe('line')
  })
})

describe('vòng câu: kết quả gãy cần', () => {
  it('cần yếu hơn dây: kết quả rod_broke, kèm cần đang lắp', () => {
    const s = holdUntilEnd(weakSetup(0.3, 1))
    expect(s.phase).toBe('result')
    expect(s.result).toMatchObject({ kind: 'rod_broke', rodId: GEAR.starter.rod })
  })
  it('dây yếu hơn hoặc bằng cần: kết quả broke như cũ', () => {
    expect(holdUntilEnd(weakSetup(1, 0.3)).result?.kind).toBe('broke')
    expect(holdUntilEnd(weakSetup(0.55, 0.55)).result?.kind).toBe('broke')
  })
  it('setupFor tách sức cần và sức dây, tích vẫn như trước', () => {
    const p: PlayerState = { ...newPlayer(), owned: { ...newPlayer().owned, lines: ['day_10', 'day_25'] }, equipped: { ...newPlayer().equipped, line: 'day_25' } }
    const su = setupFor(p, loc, 27)
    expect(su.rodStrength).toBe(rodOf(GEAR.starter.rod).strength)
    expect(su.lineStrength).toBe(lineOf('day_25').strength)
    expect(su.strength).toBeCloseTo(su.rodStrength! * su.lineStrength!)
    expect(su.rodId).toBe(GEAR.starter.rod)
  })
})

describe('breakRod', () => {
  const withRods = (rods: string[], equipped: string): PlayerState => {
    const p = newPlayer()
    return { ...p, owned: { ...p.owned, rods }, equipped: { ...p.equipped, rod: equipped } }
  }
  it('bỏ cần gãy khỏi túi, lắp lại cần khoẻ nhất còn lại', () => {
    const p = breakRod(withRods(['can_tre_36', 'can_carbon_45', 'can_cung_54'], 'can_cung_54'), 'can_cung_54')
    expect(p.owned.rods).toEqual(['can_tre_36', 'can_carbon_45'])
    expect(p.equipped.rod).toBe('can_carbon_45')
  })
  it('hết sạch cần thì cấp lại cần tre khởi đầu', () => {
    const p = breakRod(withRods(['can_carbon_45'], 'can_carbon_45'), 'can_carbon_45')
    expect(p.owned.rods).toEqual([GEAR.starter.rod])
    expect(p.equipped.rod).toBe(GEAR.starter.rod)
  })
  it('gãy chính cần tre khởi đầu cũng được cấp lại', () => {
    const p = breakRod(newPlayer(), GEAR.starter.rod)
    expect(p.owned.rods).toEqual([GEAR.starter.rod])
    expect(p.equipped.rod).toBe(GEAR.starter.rod)
  })
  it('không đụng tới phần còn lại của túi đồ', () => {
    const before = withRods(['can_tre_36', 'can_carbon_45'], 'can_carbon_45')
    const p = breakRod(before, 'can_carbon_45')
    expect(p.owned.lines).toEqual(before.owned.lines)
    expect(p.equipped.line).toBe(before.equipped.line)
    expect(p.coins).toBe(before.coins)
  })
})
