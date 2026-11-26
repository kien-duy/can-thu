import { describe, expect, it } from 'vitest'
import { BAIT, floatOf, hookOf, LOCATIONS, lineOf, rigOf, SPECIES, speciesOf } from '../content'
import { actionFor } from '../game/hints'
import { planSpeciesBite } from './bite'
import { advanceFight, initFight, outcomeOf, unhookChance } from './fight'
import { initialState, reduce } from './game'
import { createRng } from './rng'
import { hookFactor, mixAxes, type Setup } from './setup'

const loc = LOCATIONS[0]!
const recipe = (id: string) => mixAxes(BAIT.recipes.find((r) => r.id === id)!.scoops)

function setup(over: Partial<Setup> = {}): Setup {
  return {
    bait: recipe('ro_phi'),
    rig: rigOf('can4_cau2'),
    float: floatOf('phao_nano'),
    line: lineOf('day_10'),
    depthCm: loc.bottomDepthCm,
    waterTempC: 27,
    strength: 1,
    castBonusM: 0,
    ...over,
  }
}

/** hồ núi có cả diếc lẫn cá to: thấy rõ lưỡi chọn cỡ cá */
const lake = LOCATIONS.find((l) => l.id === 'ho_nui_may')!

function share(s: Setup, n = 3000) {
  const rng = createRng(99)
  const count: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const p = planSpeciesBite(rng, lake, SPECIES, { castAt: 0, settledAt: 0, hour: 12, setup: s })
    count[p.speciesId] = (count[p.speciesId] ?? 0) + 1
  }
  return (id: string) => (count[id] ?? 0) / n
}

describe('lưỡi câu: cá cắn', () => {
  it('lưỡi nhỏ thì diếc ăn nhiều hơn hẳn so với lưỡi to', () => {
    const small = share(setup({ hook: hookOf('luoi_1'), depthCm: lake.bottomDepthCm }))
    const big = share(setup({ hook: hookOf('luoi_8'), depthCm: lake.bottomDepthCm }))
    expect(small('diec')).toBeGreaterThan(big('diec') * 1.5)
  })
  it('cá nhỏ hơn cỡ lưỡi bị giảm dần, sàn 0.4; cá to hơn thì không ảnh hưởng', () => {
    const diec = speciesOf('diec')
    expect(hookFactor(diec, hookOf('luoi_1'))).toBe(1)
    expect(hookFactor(diec, hookOf('luoi_8'))).toBeCloseTo(0.4)
    const mid = hookFactor(diec, hookOf('luoi_5'))
    expect(mid).toBeGreaterThan(0.4)
    expect(mid).toBeLessThan(1)
    expect(hookFactor(speciesOf('tram_den'), hookOf('luoi_1'))).toBe(1)
    expect(hookFactor(diec)).toBe(1)
  })
})

describe('lưỡi câu: tuột lưỡi', () => {
  const chep = speciesOf('chep')
  /** đồ rất khoẻ để không đứt dây: chỉ còn lưỡi quyết định */
  const run = (seed: number, hookMaxG?: number) => advanceFight(initFight(chep, 5000, 7, seed, 10, 1, 1, hookMaxG), 30_000, true)

  it('chỉ có cơ hội tuột khi cá nặng hơn sức lưỡi', () => {
    expect(unhookChance(5000)).toBe(0)
    expect(unhookChance(1500, 2000)).toBe(0)
    expect(unhookChance(4000, 2000)).toBeCloseTo(0.25)
  })
  it('lưỡi số 3 với chép 5 kg hay tuột; lưỡi số 5 thì không bao giờ', () => {
    let small = 0
    let fit = 0
    for (let seed = 1; seed <= 40; seed++) {
      const a = run(seed, hookOf('luoi_3').bestForG[1])
      if (a.unhooked) {
        small++
        expect(outcomeOf(a)).toBe('escaped')
      }
      if (run(seed, hookOf('luoi_5').bestForG[1]).unhooked) fit++
    }
    expect(small).toBeGreaterThan(10)
    expect(fit).toBe(0)
  })
  it('tất định: cùng hạt giống cho cùng kết quả; không có lưỡi thì giữ nguyên trận kéo cũ', () => {
    expect(run(7, 2000)).toEqual(run(7, 2000))
    expect({ ...run(7, 6000), hookMaxG: undefined }).toEqual(run(7))
  })
  it('kết quả trận báo rõ là tuột lưỡi vì lưỡi nhỏ', () => {
    const cfg = { location: loc, species: SPECIES, seed: 1, timeScale: 1 }
    const fight = { ...initFight(chep, 5000, 7, 1, 10, 1, 1, 2000), unhooked: true }
    const s = { ...initialState(0), phase: 'fighting' as const, fight, lastTick: 0 }
    const r = reduce(cfg, s, { type: 'tick', t: 100 })
    expect(r.result).toEqual({ kind: 'escaped', speciesId: 'chep', reason: 'unhooked' })
    expect(actionFor(r, 100).hint).toContain('Tuột lưỡi: lưỡi nhỏ so với cá')
  })
})
