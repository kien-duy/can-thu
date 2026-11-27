import { describe, expect, it } from 'vitest'
import { GEAR, LOCATIONS, SPECIES } from '../content'
import { biteEvents, floatOffset, judgeStrike, lastRound, planSpeciesBite, REBITE, roundAt, type SpeciesBitePlan } from './bite'
import { type GameConfig, type GameState, initialState, LEAVE_AFTER_MS, reduce, waitStatus } from './game'
import { createRng } from './rng'
import type { Setup } from './setup'

/** Cá không giật kịp thì rỉa lại thành nhiều đợt, tới khi hoảng, hết đợt hoặc mồi rã. */
const pond = LOCATIONS.find((l) => l.id === 'ho_dong_xanh')!
const river = LOCATIONS.find((l) => l.id === 'ben_song_lang')!
const cfg = (seed: number): GameConfig => ({ location: pond, species: SPECIES, seed, timeScale: 1 })

function castAt(c: GameConfig, t0 = 1_000_000): GameState {
  let s = initialState(t0)
  s = reduce(c, s, { type: 'charge', t: t0 })
  return reduce(c, s, { type: 'release', t: t0 + 900, hour: 10 })
}

/** Seed đầu tiên cho ra lượt có ít nhất `n` đợt rỉa. */
function castWithRounds(n: number): { c: GameConfig; s: GameState } {
  for (let seed = 1; seed < 500; seed++) {
    const c = cfg(seed)
    const s = castAt(c)
    if (!s.bite!.empty && s.bite!.rounds.length >= n) return { c, s }
  }
  throw new Error(`không tìm được lượt có ${n} đợt`)
}

/** Mồi tơi hết cỡ: rã sau 120 s. */
const looseBait: Setup = {
  bait: { fishy: 0.6, sweet: 0.3, sour: 0.3, loose: 1 },
  rig: GEAR.rigs[0]!,
  float: GEAR.floats[0]!,
  line: GEAR.lines[0]!,
  depthCm: null,
  waterTempC: 28,
  strength: 1,
  castBonusM: 0,
}

describe('cá rỉa lại nhiều đợt', () => {
  it('lỡ cửa sổ đợt đầu (tab ẩn): cá chưa bỏ đi, đợt sau vẫn giật dính được đúng con cá đó', () => {
    const { c, s: s0 } = castWithRounds(2)
    const b = s0.bite!
    const [r1, r2] = b.rounds
    let s = s0
    // người chơi vắng mặt: tab ẩn, tick thưa, qua hẳn đợt đầu và quá LEAVE_AFTER_MS
    for (let t = s.cast!.settledAt; t < r2!.nibbleStart - 500; t += 2_000) s = reduce(c, s, { type: 'tick', t, paused: true })
    expect(r2!.nibbleStart - r1!.strikeClose).toBeGreaterThanOrEqual(REBITE.minPauseMs)
    expect(s.phase).toBe('waiting')
    expect(waitStatus(s, r1!.strikeClose + 1_000)).toBe('after')
    expect(waitStatus(s, r2!.nibbleStart + 1)).toBe('nibbling')
    expect(waitStatus(s, r2!.strikeOpen + 1)).toBe('window')
    s = reduce(c, s, { type: 'tick', t: r2!.strikeOpen + 100 })
    s = reduce(c, s, { type: 'strike', t: r2!.strikeOpen + 200 })
    expect(s.phase).toBe('fighting')
    expect(s.fight?.speciesId).toBe(b.speciesId)
    expect(s.fight?.weightG).toBe(b.weightG)
  })

  it('kỹ năng giữ nguyên: giật sớm trong đợt sau vẫn hỏng, giật lúc cá vừa nhả mồi là muộn', () => {
    const { s } = castWithRounds(2)
    const b = s.bite!
    const [r1, r2] = b.rounds
    expect(judgeStrike(b, r2!.nibbleStart + 200)).toBe('too_early')
    expect(judgeStrike(b, (r1!.strikeClose + r2!.nibbleStart) / 2)).toBe('too_late')
    expect(judgeStrike(b, r2!.strikeOpen + 10)).toBe('hooked')
    expect(judgeStrike(b, r2!.strikeClose + 1)).not.toBe('hooked')
    // cửa sổ giật mỗi đợt dài đúng bằng đợt đầu
    expect(r2!.strikeClose - r2!.strikeOpen).toBeCloseTo(r1!.strikeClose - r1!.strikeOpen)
  })

  it('hết đợt thì cá bỏ đi; giữa hai đợt thì chưa', () => {
    const { c, s } = castWithRounds(2)
    const b = s.bite!
    const waiting = { ...s, phase: 'waiting' as const }
    const between = reduce(c, waiting, { type: 'tick', t: b.rounds[0]!.strikeClose + LEAVE_AFTER_MS + 1 })
    if (b.rounds[1]!.nibbleStart > b.rounds[0]!.strikeClose + LEAVE_AFTER_MS + 1) expect(between.phase).toBe('waiting')
    expect(reduce(c, waiting, { type: 'tick', t: lastRound(b).strikeClose + LEAVE_AFTER_MS - 1 }).phase).toBe('waiting')
    expect(reduce(c, waiting, { type: 'tick', t: lastRound(b).strikeClose + LEAVE_AFTER_MS + 1 }).result?.kind).toBe('gone')
  })

  it('không có đợt nào sau khi mồi rã; số đợt có trần; đợt nối tiếp nhau không chồng', () => {
    let multi = 0
    let cut = 0
    for (let seed = 0; seed < 400; seed++) {
      for (const loc of [pond, river]) {
        const p = planSpeciesBite(createRng(seed), loc, SPECIES, { castAt: 0, settledAt: 0, hour: 10, setup: looseBait })
        if (p.empty) {
          expect(p.rounds).toHaveLength(1)
          continue
        }
        expect(p.rounds.length).toBeLessThanOrEqual(REBITE.maxRounds)
        expect(p.rounds[0]).toEqual({ nibbleStart: p.nibbleStart, strikeOpen: p.strikeOpen, strikeClose: p.strikeClose })
        for (let i = 1; i < p.rounds.length; i++) {
          const r = p.rounds[i]!
          expect(r.strikeClose).toBeLessThanOrEqual(p.dissolveAt)
          expect(r.nibbleStart).toBeGreaterThanOrEqual(p.rounds[i - 1]!.strikeClose + REBITE.minPauseMs)
          expect(r.strikeOpen).toBeGreaterThan(r.nibbleStart)
        }
        if (p.rounds.length > 1) multi++
        if (p.rounds.length < REBITE.maxRounds && lastRound(p).strikeClose + 60_000 > p.dissolveAt) cut++
      }
    }
    // có cả lượt nhiều đợt lẫn lượt bị mồi rã cắt ngang (mồi 120 s)
    expect(multi).toBeGreaterThan(50)
    expect(cut).toBeGreaterThan(10)
  })

  it('tất định: cùng seed cho cùng kế hoạch, kể cả các đợt rỉa lại', () => {
    const plan = (seed: number) => planSpeciesBite(createRng(seed), river, SPECIES, { castAt: 0, settledAt: 3000, hour: 9, setup: looseBait })
    for (let seed = 0; seed < 50; seed++) expect(plan(seed)).toEqual(plan(seed))
    const a = castAt(cfg(42)).bite!
    const b = castAt(cfg(42)).bite!
    expect(a).toEqual(b)
  })

  it('phao: im giữa hai đợt, báo ăn thật trong cửa sổ của từng đợt; floatOffset vẫn là hàm thuần', () => {
    let checked = 0
    for (let seed = 0; seed < 200 && checked < 30; seed++) {
      const b: SpeciesBitePlan = castAt(cfg(seed)).bite!
      if (b.rounds.length < 2) continue
      checked++
      for (let i = 0; i < b.rounds.length; i++) {
        const r = b.rounds[i]!
        const mid = r.strikeOpen + (r.strikeClose - r.strikeOpen) * 0.9
        const off = floatOffset(b, mid)
        if (b.signal.kind === 'rise') expect(off).toBeLessThan(-0.5)
        else expect(off).toBeGreaterThan(0.5)
        expect(floatOffset(b, mid)).toBe(off)
        expect(roundAt(b, mid)).toBe(r)
        const next = b.rounds[i + 1]
        if (next) expect(floatOffset(b, r.strikeClose + 2_800)).toBe(0)
      }
    }
    expect(checked).toBe(30)
  })

  it('mỗi đợt có bộ mốc rỉa / mở / đóng riêng, theo thứ tự thời gian (để báo động lại từng đợt)', () => {
    const { s } = castWithRounds(3)
    const ev = biteEvents(s.bite!)
    expect(ev).toHaveLength(s.bite!.rounds.length * 3)
    expect(ev.filter((e) => e.kind === 'nibble_start').map((e) => e.at)).toEqual(s.bite!.rounds.map((r) => r.nibbleStart))
    for (let i = 1; i < ev.length; i++) expect(ev[i]!.at).toBeGreaterThan(ev[i - 1]!.at)
  })
})
