import { describe, expect, it } from 'vitest'
import { LOCATIONS, SPECIES } from '../content'
import { type GameConfig, type GameState, initialState, reduce } from '../sim/game'
import { aimAt, DRAG_DEAD_ZONE, sideFromAim } from './dragSteer'

describe('rê để dòng cần', () => {
  it('vị trí ngang → góc ngắm trong [-1, 1], kẹp ngoài mép', () => {
    expect(aimAt(0, 0, 1000)).toBe(-1)
    expect(aimAt(500, 0, 1000)).toBe(0)
    expect(aimAt(1000, 0, 1000)).toBe(1)
    expect(aimAt(350, 100, 500)).toBe(0)
    expect(aimAt(-50, 0, 1000)).toBe(-1)
    expect(aimAt(2000, 0, 1000)).toBe(1)
    expect(aimAt(10, 0, 0)).toBe(0)
  })

  it('vùng giữa giữ cần thẳng, ra ngoài vùng giữa thì dòng hẳn sang phía đó', () => {
    expect(sideFromAim(0)).toBe(0)
    expect(sideFromAim(DRAG_DEAD_ZONE - 0.01)).toBe(0)
    expect(sideFromAim(-DRAG_DEAD_ZONE + 0.01)).toBe(0)
    expect(sideFromAim(DRAG_DEAD_ZONE)).toBe(1)
    expect(sideFromAim(-DRAG_DEAD_ZONE)).toBe(-1)
    expect(sideFromAim(1)).toBe(1)
    expect(sideFromAim(-1)).toBe(-1)
  })

  it('kéo bằng kiểu rê ra đúng trận kéo như phím A/D (cùng luật, không tách nhánh)', () => {
    const c: GameConfig = { location: LOCATIONS[0]!, species: SPECIES, seed: 11, timeScale: 1 }
    let s0 = initialState(1_000_000)
    s0 = reduce(c, s0, { type: 'charge', t: 1_000_000 })
    s0 = reduce(c, s0, { type: 'release', t: 1_000_900, hour: 7 })
    s0 = reduce(c, { ...s0, phase: 'waiting' }, { type: 'strike', t: s0.bite!.strikeOpen + 200 })
    expect(s0.phase).toBe('fighting')

    // cùng một người chơi: ghì khi dây chùng, dòng ngược cá. Bản phím gửi thẳng -1/0/1;
    // bản rê gửi vị trí ngón tay (lệch ngẫu nhiên chút ít quanh đích) trên mặt kéo rộng 800 px.
    const run = (drag: boolean) => {
      let s: GameState = s0
      let t = s.lastTick
      for (let i = 0; i < 1200 && s.phase === 'fighting'; i++) {
        t += 50
        const f = s.fight!
        const want = -f.fishDir as -1 | 0 | 1
        const side = drag ? sideFromAim(aimAt(400 + want * 300 + ((i * 37) % 41) - 20, 0, 800)) : want
        s = reduce(c, s, { type: 'steer', t, side })
        s = reduce(c, s, { type: 'reel', t, on: f.tension < 0.7 })
        s = reduce(c, s, { type: 'tick', t })
      }
      return s
    }
    const keys = run(false)
    const drag = run(true)
    expect(drag).toEqual(keys)
    expect(keys.phase).toBe('landable')
  })
})
