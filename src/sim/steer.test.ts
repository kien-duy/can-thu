import { describe, expect, it } from 'vitest'
import { LOCATIONS, SPECIES } from '../content'
import { advanceFight, type FightState, initFight, isSurging, outcomeOf, STEP_MS } from './fight'
import { type GameConfig, initialState, reduce } from './game'

type Steer = 'none' | 'opposite' | 'same'

/**
 * Người chơi giả: cứ `look` bước (50 ms một bước) mới nhìn thanh căng dây một lần,
 * ghì khi dây dưới `threshold`, thả khi trên. Dòng cần theo kiểu `steer` ngay khi cá đổi hướng.
 */
function play(f0: FightState, steer: Steer, look: number, threshold = 0.8) {
  let f = f0
  let reeling = false
  let given = 0
  for (let i = 0; i < 2400; i++) {
    const o = outcomeOf(f)
    if (o !== 'fighting') return { o, ms: f.elapsedMs, given }
    if (i % look === 0) reeling = f.tension < threshold
    const side = steer === 'none' ? 0 : steer === 'opposite' ? ((-f.fishDir) as -1 | 0 | 1) : f.fishDir
    const before = f.distanceM
    f = advanceFight({ ...f, rodSide: side }, STEP_MS, reeling)
    given += Math.max(0, f.distanceM - before)
  }
  return { o: 'timeout' as const, ms: f.elapsedMs, given }
}

/** Chạy cả bộ loài, mỗi loài 40 con cỡ `size` lần cân thường gặp. */
function stats(steer: Steer, look: number, size: number) {
  let ms = 0
  let landed = 0
  let broke = 0
  let given = 0
  let n = 0
  for (const sp of SPECIES)
    for (let seed = 0; seed < 40; seed++) {
      const r = play(initFight(sp, sp.typicalG * size, 8, seed), steer, look)
      n++
      given += r.given
      if (r.o === 'broke') broke++
      if (r.o === 'landable') {
        landed++
        ms += r.ms
      }
    }
  return { avgMs: ms / Math.max(1, landed), broke, given: given / n, landed }
}

describe('dòng cá', () => {
  it('dòng cần ngược hướng cá chạy: trận ngắn hơn, cá lấy ít dây hơn', () => {
    const none = stats('none', 5, 1.6)
    const good = stats('opposite', 5, 1.6)
    expect(good.landed).toBe(none.landed)
    expect(good.avgMs).toBeLessThan(none.avgMs * 0.85)
    expect(good.given).toBeLessThan(none.given * 0.75)
  })

  it('dòng ngược hướng cá còn đỡ đứt thẻo khi tay chậm', () => {
    // nhìn dây 400 ms một lần, cá to: không dòng thì thỉnh thoảng đứt
    const none = stats('none', 8, 2.2)
    const good = stats('opposite', 8, 2.2)
    expect(none.broke).toBeGreaterThan(0)
    expect(good.broke).toBeLessThan(none.broke)
  })

  it('dòng cùng hướng cá chạy thì thiệt: cá lấy nhiều dây hơn, trận dài hơn, dễ đứt hơn', () => {
    const none = stats('none', 5, 1.6)
    const bad = stats('same', 5, 1.6)
    expect(bad.given).toBeGreaterThan(none.given * 1.2)
    expect(bad.avgMs).toBeGreaterThan(none.avgMs)
    expect(stats('same', 8, 2.2).broke).toBeGreaterThan(stats('none', 8, 2.2).broke * 1.5)
  })

  it('giữ cần thẳng (rodSide = 0) thì trận kéo y như trước khi có dòng cá', () => {
    // Ghi từ fight.ts trước khi thêm dòng cá: 5 loài đầu × 3 seed, ghì 4 bước rồi thả 3 bước, tối đa 30 s.
    // Nếu cố ý đổi nhịp kéo cá thì ghi lại bảng này.
    const golden: [string, number, number, number, number, number, number, number, string][] = [
      ['ro_phi_den', 1, 18900, 0.24929895379472228, 0.16599387576464641, 0.5587525358219266, 3599190430, 0, 'landable'],
      ['ro_phi_den', 7, 18900, 0.24951345495810587, 0.12086300995430638, 0.5385172060394823, 3599190436, 0, 'landable'],
      ['ro_phi_den', 42, 18750, 0.24834937458909276, 0.4420004330366537, 0.5, 3599190471, 0, 'landable'],
      ['dieu_hong', 1, 19100, 0.24894651829184447, 0.5855052653984534, 0.5, 3599190430, 0, 'landable'],
      ['dieu_hong', 7, 19150, 0.24913014178481072, 0.279531736621772, 0.5150806557982929, 3599190436, 0, 'landable'],
      ['dieu_hong', 42, 19000, 0.24876056789091422, 0.3397818093019628, 0.5365980867223619, 3599190471, 0, 'landable'],
      ['chep', 1, 30000, 0.004400851091146046, 0.28912080508909077, 3.020940865218242, 2335519090, 0, 'fighting'],
      ['chep', 7, 29500, 0.02478705866831732, 0.35674003745977534, 2.9714410010997194, 2335519096, 0, 'landable'],
      ['chep', 42, 30000, 0.000723037178815347, 0.28811511737976336, 3.1692848482797737, 2335519131, 0, 'fighting'],
      ['diec', 1, 16500, 0.24955373309236023, 0.18369698169742787, 0.5, 4231026100, 0, 'landable'],
      ['diec', 7, 16500, 0.2489670124848756, 0.21228145919134594, 0.5, 3599190436, 0, 'landable'],
      ['diec', 42, 16400, 0.24845574960402714, 0.15261184628532248, 0.5218799964234799, 3599190471, 0, 'landable'],
      ['tram_co', 1, 30000, 0, 0.3043316579676565, 6.002363250593629, 2335519090, 0, 'fighting'],
      ['tram_co', 7, 30000, 0, 0.46382652472081365, 5.545634507533593, 1703683426, 0, 'fighting'],
      ['tram_co', 42, 30000, 0, 0.3043037738830278, 6.105797670594609, 2335519131, 0, 'fighting'],
    ]
    for (const [id, seed, ...want] of golden) {
      const sp = SPECIES.find((s) => s.id === id)!
      let f = initFight(sp, sp.typicalG * 1.5, 8, seed)
      for (let i = 0; i < 600 && outcomeOf(f) === 'fighting'; i++) f = advanceFight(f, 50, i % 7 < 4)
      expect(f.rodSide).toBe(0)
      expect([f.elapsedMs, f.stamina, f.tension, f.distanceM, f.rng, f.overloadMs, outcomeOf(f)]).toEqual(want)
    }
  })

  it('hướng cá chạy tái hiện được theo seed, chỉ đổi lúc cá bắt đầu hoặc thôi vật', () => {
    const chep = SPECIES.find((s) => s.id === 'chep')!
    const trace = (seed: number) => {
      let f = initFight(chep, 3000, 10, seed)
      const dirs: number[] = []
      for (let i = 0; i < 600; i++) {
        const prev = f
        f = advanceFight(f, STEP_MS, false)
        if (f.fishDir !== prev.fishDir) {
          // đổi hướng chỉ ở mép một nhịp vật
          expect(isSurging(f) !== isSurging(prev) || f.surgeUntil !== prev.surgeUntil).toBe(true)
          if (f.fishDir === 0) expect(isSurging(f)).toBe(false)
        }
        dirs.push(f.fishDir)
      }
      return dirs
    }
    expect(trace(9)).toEqual(trace(9))
    expect(trace(9)).not.toEqual(trace(10))
    expect(initFight(chep, 3000, 10, 9).fishDir).toBe(0)
    // qua nhiều seed thì có cả trái, phải và ghì thẳng
    const seen = new Set<number>()
    for (let seed = 0; seed < 20; seed++) for (const d of trace(seed)) seen.add(d)
    expect([...seen].sort()).toEqual([-1, 0, 1])
  })
})

describe('sự kiện steer', () => {
  const loc = LOCATIONS[0]!
  const c: GameConfig = { location: loc, species: SPECIES, seed: 11, timeScale: 1 }
  const hooked = () => {
    let s = initialState(1_000_000)
    s = reduce(c, s, { type: 'charge', t: 1_000_000 })
    s = reduce(c, s, { type: 'release', t: 1_000_900, hour: 7 })
    return reduce(c, { ...s, phase: 'waiting' }, { type: 'strike', t: s.bite!.strikeOpen + 200 })
  }

  it('chỉ có tác dụng trong trận kéo', () => {
    const ready = initialState(0)
    expect(reduce(c, ready, { type: 'steer', t: 1, side: 1 })).toBe(ready)
    const s = reduce(c, hooked(), { type: 'steer', t: 1, side: -1 })
    expect(s.phase).toBe('fighting')
    expect(s.fight!.rodSide).toBe(-1)
    expect(reduce(c, s, { type: 'steer', t: 2, side: 0 }).fight!.rodSide).toBe(0)
  })

  it('tab ẩn thì cần về thẳng', () => {
    let s = reduce(c, hooked(), { type: 'steer', t: 1, side: 1 })
    s = reduce(c, s, { type: 'tick', t: s.lastTick + 1000, paused: true })
    expect(s.fight!.rodSide).toBe(0)
  })
})
