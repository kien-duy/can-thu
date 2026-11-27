import { describe, expect, it } from 'vitest'
import { speciesOf } from '../content'
import { initFight } from '../sim/fight'
import { initialState, type GameState } from '../sim/game'
import { actionFor, ANNOUNCE_TIGHT, announceFor } from './hints'

/** trận kéo đang diễn ra, chỉnh vài thông số của cá */
function fighting(over: Partial<NonNullable<GameState['fight']>> = {}, reeling = false): GameState {
  const fight = { ...initFight(speciesOf('chep'), 1500, 7, 1), ...over }
  return { ...initialState(0), phase: 'fighting', fight, reeling, lastTick: 0 }
}

describe('lời đọc cho trình đọc màn hình', () => {
  it('trong trận kéo: lời gợi ý trên màn hình đổi theo tay ghì và tay dòng, lời đọc thì không', () => {
    const a = fighting({ fishDir: -1, rodSide: 0, tension: 0.5 }, false)
    const b = fighting({ fishDir: -1, rodSide: 1, tension: 0.7, stamina: 0.6, distanceM: 5 }, true)
    expect(actionFor(a, 0).hint).not.toBe(actionFor(b, 0).hint)
    expect(actionFor(a, 0).label).not.toBe(actionFor(b, 0).label)
    const said = announceFor(a, 0, undefined, '')
    expect(said).toBe('Cá chạy sang trái, dòng cần sang phải.')
    expect(announceFor(b, 0, undefined, said)).toBe(said)
  })
  it('cá đổi hướng thì đọc lời mới', () => {
    expect(announceFor(fighting({ fishDir: 1 }), 0, undefined, '')).toBe('Cá chạy sang phải, dòng cần sang trái.')
    expect(announceFor(fighting({ fishDir: 0 }), 0, undefined, '')).toBe('Cá ghì thẳng.')
  })
  it('dây căng quá thì cảnh báo, giữ lời cảnh báo tới khi căng dưới 0.6 để không đọc đi đọc lại', () => {
    expect(announceFor(fighting({ tension: 0.85 }), 0, undefined, 'Cá ghì thẳng.')).toBe(ANNOUNCE_TIGHT)
    expect(announceFor(fighting({ tension: 0.7 }), 0, undefined, ANNOUNCE_TIGHT)).toBe(ANNOUNCE_TIGHT)
    expect(announceFor(fighting({ tension: 0.7, fishDir: 0 }), 0, undefined, 'Cá ghì thẳng.')).toBe('Cá ghì thẳng.')
    expect(announceFor(fighting({ tension: 0.5, fishDir: 0 }), 0, undefined, ANNOUNCE_TIGHT)).toBe('Cá ghì thẳng.')
  })
  it('cá đuối thì báo; ngoài trận kéo đọc đúng lời gợi ý (kết quả, vớt cá)', () => {
    expect(announceFor(fighting({ stamina: 0.2, distanceM: 6 }), 0, undefined, '')).toBe('Cá đuối rồi, thu dây vào bờ.')
    const landable = { ...fighting(), phase: 'landable' as const }
    expect(announceFor(landable, 0, undefined, '')).toBe(actionFor(landable, 0).hint)
    const result: GameState = { ...initialState(0), phase: 'result', result: { kind: 'broke', speciesId: 'chep', weightG: 1500 } }
    expect(announceFor(result, 0, undefined, '')).toContain('Thẻo đứt')
  })
})
