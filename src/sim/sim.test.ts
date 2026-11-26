import { describe, expect, it } from 'vitest'
import { biteEvents, DEFAULT_BITE, judgeStrike, planBite } from './bite'
import { createRng } from './rng'
import { delayUntil, Timeline } from './timeline'

describe('rng', () => {
  it('cùng seed cho cùng chuỗi', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('nằm trong [0,1)', () => {
    const r = createRng(1)
    for (let i = 0; i < 10_000; i++) {
      const x = r()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('timeline', () => {
  it('rút sự kiện theo thứ tự thời gian dù khai báo lộn xộn', () => {
    const t = new Timeline([
      { at: 300, kind: 'c' },
      { at: 100, kind: 'a' },
      { at: 200, kind: 'b' },
    ])
    expect(t.drain(150).map((e) => e.kind)).toEqual(['a'])
    expect(t.nextAt()).toBe(200)
    expect(t.drain(150)).toEqual([])
  })
  it('timer bị bóp (thức dậy rất trễ) thì vẫn nhận đủ sự kiện, không mất', () => {
    const t = new Timeline([
      { at: 100, kind: 'a' },
      { at: 200, kind: 'b' },
      { at: 300, kind: 'c' },
    ])
    expect(t.drain(10_000).map((e) => e.kind)).toEqual(['a', 'b', 'c'])
    expect(t.done).toBe(true)
    expect(t.nextAt()).toBeUndefined()
  })
  it('delayUntil không âm và có trần', () => {
    expect(delayUntil(undefined, 0)).toBeUndefined()
    expect(delayUntil(50, 100)).toBe(0)
    expect(delayUntil(1_000_000, 0, 60_000)).toBe(60_000)
  })
})

describe('bite', () => {
  it('kế hoạch nằm trong khoảng đã chốt (rỉa 10–40 s, giật ~1 s)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const p = planBite(rng, 0)
      const nibble = (p.strikeOpen - p.nibbleStart) / 1000
      expect(nibble).toBeGreaterThanOrEqual(DEFAULT_BITE.nibbleSec[0])
      expect(nibble).toBeLessThan(DEFAULT_BITE.nibbleSec[1])
      expect(p.strikeClose - p.strikeOpen).toBe(1000)
      expect(p.nibbleStart).toBeGreaterThanOrEqual(DEFAULT_BITE.waitSec[0] * 1000)
    }
  })
  it('chấm cú giật', () => {
    const p = { castAt: 0, nibbleStart: 10_000, strikeOpen: 30_000, strikeClose: 31_000 }
    expect(judgeStrike(p, 5_000)).toBe('nothing')
    expect(judgeStrike(p, 20_000)).toBe('too_early')
    expect(judgeStrike(p, 30_000)).toBe('hooked')
    expect(judgeStrike(p, 31_000)).toBe('hooked')
    expect(judgeStrike(p, 31_001)).toBe('too_late')
  })
  it('sự kiện bite đi theo đúng thứ tự', () => {
    const p = planBite(createRng(3), 1_000)
    expect(biteEvents(p).map((e) => e.kind)).toEqual(['nibble_start', 'strike_open', 'strike_close'])
  })
})
