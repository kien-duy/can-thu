import { describe, expect, it } from 'vitest'
import { BAIT, floatOf, GEAR, LOCATIONS, lineOf, rigOf, rodOf, SPECIES, speciesOf } from '../content'
import { planSpeciesBite } from './bite'
import { advanceFight, initFight, outcomeOf } from './fight'
import { createRng } from './rng'
import { baitMatch, mixAxes, type Setup, signalScale, tempFactor } from './setup'

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

/** Tỉ lệ từng loài qua N lần quăng. */
function share(s: Setup, n = 3000, hour = 12) {
  const rng = createRng(99)
  const count: Record<string, number> = {}
  let waitMs = 0
  for (let i = 0; i < n; i++) {
    const p = planSpeciesBite(rng, loc, SPECIES, { castAt: 0, settledAt: 0, hour, setup: s })
    count[p.speciesId] = (count[p.speciesId] ?? 0) + 1
    waitMs += p.nibbleStart
  }
  const frac = (id: string) => (count[id] ?? 0) / n
  return { frac, meanWaitS: waitMs / n / 1000 }
}

describe('mồi', () => {
  it('bài gợi ý hợp đúng loài nó nhắm tới hơn các loài khác', () => {
    for (const r of BAIT.recipes) {
      const axes = mixAxes(r.scoops)
      for (const target of r.for) {
        const mine = baitMatch(speciesOf(target), axes)
        const others = SPECIES.filter((s) => !r.for.includes(s.id)).map((s) => baitMatch(s, axes))
        expect(mine, `${r.id} → ${target}`).toBeGreaterThan(Math.min(...others))
        expect(mine, `${r.id} → ${target}`).toBeGreaterThan(0.6)
      }
    }
  })
  it('mồi thơm ngọt làm chép, diếc lên nhiều hơn hẳn so với mồi tanh', () => {
    const sweet = share(setup({ bait: recipe('chep_thom') }))
    const fishy = share(setup({ bait: recipe('ro_phi') }))
    expect(sweet.frac('chep') + sweet.frac('diec')).toBeGreaterThan(1.5 * (fishy.frac('chep') + fishy.frac('diec')))
  })
  it('không có mồi thì cá tới rất chậm', () => {
    expect(share(setup({ bait: null }), 500).meanWaitS).toBeGreaterThan(2 * share(setup(), 500).meanWaitS)
  })
})

describe('cân phao, độ sâu', () => {
  it('câu lửng kéo mè, trắm, chim trắng lên; cá đáy ít đi', () => {
    const bottom = share(setup())
    const mid = share(setup({ rig: rigOf('lung_10'), depthCm: loc.bottomDepthCm - 10 }))
    const midIds = ['me_hoa', 'tram_co', 'chim_trang']
    const sum = (r: typeof bottom, ids: string[]) => ids.reduce((a, id) => a + r.frac(id), 0)
    expect(sum(mid, midIds)).toBeGreaterThan(1.5 * sum(bottom, midIds))
    expect(mid.frac('ro_phi_den')).toBeLessThan(bottom.frac('ro_phi_den'))
  })
  it('chưa dò đáy (treo ngắn 30 cm) thì cá đáy hiếm hẳn', () => {
    const sounded = share(setup())
    const unsounded = share(setup({ depthCm: null }))
    expect(unsounded.frac('ro_phi_den')).toBeLessThan(0.7 * sounded.frac('ro_phi_den'))
  })
  it('để mồi nằm đáy quá sâu thì phao lụt, báo nhỏ; phao cỏ lau báo to hơn', () => {
    expect(signalScale(loc, setup({ depthCm: loc.bottomDepthCm + 25 }))).toBeLessThan(signalScale(loc, setup()))
    expect(signalScale(loc, setup({ float: floatOf('phao_co_lau') }))).toBeGreaterThan(signalScale(loc, setup()))
  })
})

describe('nước, dây, cần', () => {
  it('nước lạnh làm rô phi gần như không ăn, diếc vẫn ăn', () => {
    expect(tempFactor(speciesOf('ro_phi_den'), 16)).toBeLessThan(0.5)
    expect(tempFactor(speciesOf('diec'), 16)).toBe(1)
  })
  it('dây to làm diếc, trôi ngại mồi', () => {
    const thin = share(setup({ bait: recipe('chep_thom') }))
    const thick = share(setup({ bait: recipe('chep_thom'), line: lineOf('day_25') }))
    expect(thick.frac('diec')).toBeLessThan(thin.frac('diec'))
  })
  it('cần và dây khoẻ giữ được trắm cỏ lớn mà đồ khởi đầu thì đứt', () => {
    const tram = speciesOf('tram_co')
    const weak = advanceFight(initFight(tram, 9000, 8, 5, 1), 20_000, true)
    const strong = rodOf('can_cung_54').strength * lineOf('day_25').strength
    const ok = advanceFight(initFight(tram, 9000, 8, 5, strong), 20_000, true)
    expect(outcomeOf(weak)).toBe('broke')
    expect(outcomeOf(ok)).not.toBe('broke')
  })
  it('đồ khởi đầu có trong danh sách', () => {
    expect(GEAR.rods[0]!.priceXu).toBe(0)
  })
})
