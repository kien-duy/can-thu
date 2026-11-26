import { describe, expect, it } from 'vitest'
import { BAIT, LOCATIONS, rigOf, floatOf, lineOf, SPECIES } from '../content'
import { planSpeciesBite } from '../sim/bite'
import { type GameConfig, initialState, reduce } from '../sim/game'
import { createRng } from '../sim/rng'
import { chumNow, CHUM_HALF_LIFE_MS, mixAxes, type Setup } from '../sim/setup'
import { eligible, nextVisit } from '../sim/wildlife'
import { buyGear, canFishAt, chumLevel, claimQuest, newPlayer, salePrice, throwChum } from './player'
import { advanceQuests, canClaim, dailyQuests, freshQuestState, rollover } from './quests'

const pond = LOCATIONS[0]!
const river = LOCATIONS.find((l) => l.id === 'ben_song_lang')!
const mountain = LOCATIONS.find((l) => l.id === 'ho_nui_may')!
const setup = (over: Partial<Setup> = {}): Setup => ({
  bait: mixAxes(BAIT.recipes[0]!.scoops),
  rig: rigOf('can4_cau2'),
  float: floatOf('phao_nano'),
  line: lineOf('day_10'),
  depthCm: pond.bottomDepthCm,
  waterTempC: 27,
  strength: 1,
  castBonusM: 0,
  ...over,
})

describe('mồi rã', () => {
  it('mồi tơi rã nhanh hơn mồi chắc; mồi rã trước khi cá tới thì lượt đó không có cá', () => {
    const loose = planSpeciesBite(createRng(1), pond, SPECIES, { castAt: 0, settledAt: 0, hour: 12, setup: setup({ bait: { fishy: 0.5, sweet: 0, sour: 0, loose: 1 } }) })
    const firm = planSpeciesBite(createRng(1), pond, SPECIES, { castAt: 0, settledAt: 0, hour: 12, setup: setup({ bait: { fishy: 0.5, sweet: 0, sour: 0, loose: 0 } }) })
    expect(loose.dissolveAt).toBeLessThan(firm.dissolveAt)
    let empties = 0
    const rng = createRng(5)
    for (let i = 0; i < 400; i++) {
      const bait = mixAxes(BAIT.recipes.find((r) => r.id === 'me_trang_toi')!.scoops) // bài hợp mè trắng, mồi tơi rã nhanh
      const p = planSpeciesBite(rng, mountain, SPECIES, { castAt: 0, settledAt: 0, hour: 12, setup: setup({ bait, depthCm: mountain.bottomDepthCm - 10, rig: rigOf('lung_10') }) })
      if (p.empty) empties++
    }
    expect(empties).toBeGreaterThan(0) // hồ núi chờ lâu: có lượt mồi rã trước
    expect(empties).toBeLessThan(200) // mồi hợp thì phần lớn lượt vẫn có cá
  })
  it('lượt không có cá: phao nổi dần, giật là "chưa có cá", để lâu thì báo mồi rã', () => {
    const cfg: GameConfig = { location: mountain, species: SPECIES, seed: 0, timeScale: 1 }
    let found: ReturnType<typeof reduce> | undefined
    for (let seed = 0; seed < 200 && !found; seed++) {
      let s = reduce({ ...cfg, seed }, initialState(0), { type: 'charge', t: 0 })
      s = reduce({ ...cfg, seed }, s, { type: 'release', t: 900, hour: 12, setup: setup({ bait: null, depthCm: mountain.bottomDepthCm }) })
      if (s.bite?.empty) found = s
    }
    expect(found).toBeDefined()
    const s = { ...found!, phase: 'waiting' as const }
    expect(reduce(cfg, s, { type: 'strike', t: s.bite!.dissolveAt - 1000 }).result?.kind).toBe('nothing')
    expect(reduce(cfg, s, { type: 'tick', t: s.bite!.dissolveAt + 1 }).result?.kind).toBe('bait_gone')
  })
})

describe('mồi xả, ổ', () => {
  it('xả mồi tốn viên trong chậu, ổ đậm thêm và nhạt dần theo thời gian', () => {
    const r = throwChum(newPlayer(), pond.id, 1000)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.bowl!.uses).toBe(BAIT.usesPerBowl - 3)
    expect(chumLevel(r.state, pond.id, 1000)).toBeCloseTo(0.35)
    expect(chumLevel(r.state, pond.id, 1000 + CHUM_HALF_LIFE_MS)).toBeCloseTo(0.175)
    expect(chumNow(1, 0, 3 * CHUM_HALF_LIFE_MS)).toBeCloseTo(0.125)
  })
  it('ổ đậm làm cá tới nhanh hơn', () => {
    const mean = (chum: number) => {
      const rng = createRng(3)
      let w = 0
      for (let i = 0; i < 500; i++) w += planSpeciesBite(rng, pond, SPECIES, { castAt: 0, settledAt: 0, hour: 12, setup: setup({ chum }) }).nibbleStart
      return w / 500
    }
    expect(mean(1)).toBeLessThan(mean(0) * 0.7)
  })
})

describe('địa điểm, cấp', () => {
  it('sông mở ở cấp 2, hồ núi ở cấp 4; đồ xịn cũng cần cấp', () => {
    const p = newPlayer()
    expect(canFishAt(p, pond)).toBe(true)
    expect(canFishAt(p, river)).toBe(false)
    expect(canFishAt({ ...p, xp: 60 }, river)).toBe(true)
    expect(canFishAt({ ...p, xp: 60 }, mountain)).toBe(false)
    expect(buyGear({ ...p, coins: 5000 }, 'rods', 'can_carbon_45')).toEqual({ ok: false, error: 'Cần đạt cấp 2 mới mua được.' })
  })
  it('cá sông bán cho lái cá rẻ hơn', () => {
    expect(salePrice('chep', 1000, river.saleFactor)).toBeLessThan(salePrice('chep', 1000))
  })
  it('mỗi loài có ở ít nhất một địa điểm', () => {
    for (const s of SPECIES) expect(LOCATIONS.some((l) => l.species.some((x) => x.id === s.id)), s.id).toBe(true)
  })
})

describe('sinh vật ghé qua', () => {
  it('đúng địa điểm, giờ, thời tiết: trâu ở bến sông buổi trưa, nai ở hồ núi sáng sớm, đom đóm ban đêm', () => {
    expect(eligible('ben_song_lang', 12, 'sunny').map((c) => c.id)).toContain('trau')
    expect(eligible('ho_dong_xanh', 12, 'sunny').map((c) => c.id)).not.toContain('trau')
    expect(eligible('ho_nui_may', 6, 'fog').map((c) => c.id)).toContain('nai')
    expect(eligible('ben_song_lang', 21, 'sunny').map((c) => c.id)).toContain('dom_dom')
    expect(eligible('ben_song_lang', 21, 'sunny').map((c) => c.id)).not.toContain('buom_vang')
  })
  it('lượt ghé kế tiếp nằm sau 90–300 s', () => {
    const v = nextVisit(createRng(1), 'ben_song_lang', 12, 'sunny', 1000)!
    expect(v.at - 1000).toBeGreaterThanOrEqual(90_000)
    expect(v.at - 1000).toBeLessThanOrEqual(300_000)
    expect(nextVisit(createRng(1), 'ho_dong_xanh', 3, 'storm', 0)).toBeNull()
  })
})

describe('nhiệm vụ ngày', () => {
  it('cùng ngày ra cùng bộ; khác ngày khác bộ; nhiệm vụ địa điểm chưa mở thì không ra', () => {
    expect(dailyQuests('2026-11-26', 1)).toEqual(dailyQuests('2026-11-26', 1))
    expect(dailyQuests('2026-11-26', 1).map((q) => q.templateId)).not.toEqual(dailyQuests('2026-11-27', 1).map((q) => q.templateId))
    for (let d = 1; d <= 28; d++) {
      const qs = dailyQuests(`2026-11-${String(d).padStart(2, '0')}`, 1)
      expect(qs).toHaveLength(3)
      expect(qs.some((q) => q.location)).toBe(false)
    }
  })
  it('câu cá cộng tiến độ, đủ thì nhận thưởng một lần; sang ngày mới thì làm lại', () => {
    const qs = dailyQuests('2026-11-26', 4)
    let st = freshQuestState('2026-11-26')
    for (let i = 0; i < 10; i++) st = advanceQuests(st, qs, { type: 'catch', speciesId: 'chep', weightG: 2500, locationId: 'ben_song_lang' }).state
    st = advanceQuests(st, qs, { type: 'sighting' }).state
    st = advanceQuests(st, qs, { type: 'sighting' }).state
    st = advanceQuests(st, qs, { type: 'profit_shift' }).state
    const done = qs.filter((q) => canClaim(st, q))
    expect(done.length).toBeGreaterThan(0)
    const p = { ...newPlayer(), quests: st }
    const r = claimQuest(p, done[0]!)
    expect(r.ok && r.state.coins).toBe(500 + done[0]!.rewardXu)
    if (r.ok) expect(claimQuest(r.state, done[0]!).ok).toBe(false)
    expect(rollover(st, '2026-11-27').progress).toEqual({})
  })
})
