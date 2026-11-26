import { describe, expect, it } from 'vitest'
import { LOCATIONS, SPECIES, speciesOf } from '../content'
import { floatOffset } from './bite'
import { advanceFight, initFight, outcomeOf } from './fight'
import { type GameConfig, type GameState, initialState, reduce, waitStatus } from './game'

const loc = LOCATIONS[0]!
const cfg = (seed: number, timeScale = 1): GameConfig => ({ location: loc, species: SPECIES, seed, timeScale })

function castAt(c: GameConfig, t0 = 1_000_000): GameState {
  let s = initialState(t0)
  s = reduce(c, s, { type: 'charge', t: t0 })
  s = reduce(c, s, { type: 'release', t: t0 + 900, hour: 7 })
  return s
}

/** Chiến thuật người chơi đơn giản: ghì khi dây chưa căng, thả khi căng. */
function playFight(c: GameConfig, s: GameState, start: number, threshold = 0.72) {
  let t = start
  for (let i = 0; i < 2400 && (s.phase === 'fighting' || s.phase === 'landable'); i++) {
    if (s.phase === 'landable') return { s: reduce(c, s, { type: 'net', t }), t }
    const want = (s.fight?.tension ?? 0) < threshold
    if (want !== s.reeling) s = reduce(c, s, { type: 'reel', t, on: want })
    t += 50
    s = reduce(c, s, { type: 'tick', t })
  }
  return { s, t }
}

describe('content', () => {
  it('nạp và kiểm tra được', () => {
    expect(SPECIES.length).toBeGreaterThanOrEqual(3)
    expect(loc.species.every((x) => speciesOf(x.id))).toBe(true)
  })
})

describe('vòng câu', () => {
  it('quăng → chờ → giật đúng cửa sổ → kéo → vớt được cá đúng loài, đúng cân', () => {
    const c = cfg(11)
    let s = castAt(c)
    expect(s.phase).toBe('sinking')
    const bite = s.bite!
    s = reduce(c, s, { type: 'tick', t: s.cast!.settledAt + 1 })
    expect(s.phase).toBe('waiting')
    expect(waitStatus(s, bite.nibbleStart + 1)).toBe('nibbling')
    expect(waitStatus(s, bite.strikeOpen + 1)).toBe('window')
    const strikeT = bite.strikeOpen + 300
    s = reduce(c, s, { type: 'strike', t: strikeT })
    expect(s.phase).toBe('fighting')
    const { s: end } = playFight(c, s, strikeT)
    expect(end.phase).toBe('result')
    expect(end.result?.kind).toBe('landed')
    if (end.result?.kind === 'landed') {
      expect(end.result.fish.speciesId).toBe(bite.speciesId)
      expect(end.result.fish.weightG).toBe(bite.weightG)
    }
  })

  it('giật lúc cá đang rỉa là sớm; không giật thì cá bỏ đi', () => {
    const c = cfg(5)
    const s = castAt(c)
    const early = reduce(c, { ...s, phase: 'waiting' }, { type: 'strike', t: s.bite!.nibbleStart + 100 })
    expect(early.result?.kind).toBe('too_early')
    const gone = reduce(c, { ...s, phase: 'waiting' }, { type: 'tick', t: s.bite!.strikeClose + 10_000 })
    expect(gone.result?.kind).toBe('gone')
  })

  it('thả vội (lấy đà quá ngắn) không quăng được', () => {
    const c = cfg(1)
    let s = reduce(c, initialState(0), { type: 'charge', t: 0 })
    s = reduce(c, s, { type: 'release', t: 50, hour: 7 })
    expect(s.result?.kind).toBe('short_cast')
  })

  it('cửa sổ rỉa nằm trong 10–40 s ở chế độ thường', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = castAt(cfg(seed))
      const nibble = (s.bite!.strikeOpen - s.bite!.nibbleStart) / 1000
      expect(nibble).toBeGreaterThanOrEqual(10)
      expect(nibble).toBeLessThanOrEqual(40)
    }
  })

  it('phao: im lúc chưa có cá, báo đúng kiểu từng loài trong cửa sổ giật', () => {
    for (let seed = 0; seed < 60; seed++) {
      const s = castAt(cfg(seed))
      const b = s.bite!
      expect(floatOffset(b, b.nibbleStart - 1)).toBe(0)
      const mid = b.strikeOpen + (b.strikeClose - b.strikeOpen) * 0.9
      const off = floatOffset(b, mid)
      if (b.signal.kind === 'rise') expect(off).toBeLessThan(-0.5)
      else expect(off).toBeGreaterThan(0.5)
    }
  })

  it('tab ẩn giữa trận kéo: trận đứng yên, quay lại kéo tiếp được', () => {
    const c = cfg(11)
    let s = castAt(c)
    s = reduce(c, { ...s, phase: 'waiting' }, { type: 'strike', t: s.bite!.strikeOpen + 100 })
    const before = s.fight!
    for (let i = 1; i <= 600; i++) s = reduce(c, s, { type: 'tick', t: before.elapsedMs + s.lastTick + 1000, paused: true })
    expect(s.fight).toEqual(before)
    expect(s.phase).toBe('fighting')
    // khung hình đầu tiên sau khi quay lại chỉ tiến tối đa 1 s
    s = reduce(c, s, { type: 'tick', t: s.lastTick + 10 * 60_000 })
    expect(s.fight!.elapsedMs - before.elapsedMs).toBeLessThanOrEqual(1000)
  })
})

describe('kéo cá', () => {
  it('khung hình ngắn hơn một bước (60 fps) vẫn làm trận kéo tiến đúng theo thời gian thật', () => {
    const c = cfg(11)
    let s = castAt(c)
    s = reduce(c, { ...s, phase: 'waiting' }, { type: 'strike', t: s.bite!.strikeOpen + 100 })
    const start = s.lastTick
    for (let i = 1; i <= 120; i++) s = reduce(c, s, { type: 'tick', t: start + i * 16.7 }) // ~2 s ở 60 fps
    expect(s.fight!.elapsedMs).toBeGreaterThanOrEqual(1950)
    expect(s.fight!.elapsedMs).toBeLessThanOrEqual(2004)
  })
  it('ghì liên tục với cá to thì đứt thẻo', () => {
    const chep = speciesOf('chep')
    const f = advanceFight(initFight(chep, 5000, 7, 3), 60_000, true)
    expect(outcomeOf(f)).toBe('broke')
  })
  it('chiến thuật hợp lý vớt được hầu hết cá, mỗi trận 5–90 s', () => {
    let landed = 0
    const durations: number[] = []
    const N = 300
    for (let seed = 0; seed < N; seed++) {
      const c = cfg(seed)
      let s = castAt(c)
      const t0 = s.bite!.strikeOpen + 200
      s = reduce(c, { ...s, phase: 'waiting' }, { type: 'strike', t: t0 })
      const { s: end, t } = playFight(c, s, t0)
      if (end.result?.kind === 'landed') {
        landed++
        durations.push((t - t0) / 1000)
      }
    }
    expect(landed / N).toBeGreaterThan(0.85)
    expect(Math.min(...durations)).toBeGreaterThan(5)
    expect(Math.max(...durations)).toBeLessThan(90)
  })
})

describe('đồng hồ', () => {
  it('giờ địa phương theo múi giờ', async () => {
    const { localHour } = await import('./world')
    const t = Date.UTC(2026, 10, 26, 7, 40) // 07:40 UTC
    expect(localHour(t, 'Asia/Ho_Chi_Minh')).toBe(14)
    expect(localHour(t, 'Asia/Tokyo')).toBe(16)
  })
})
