import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, parsePrefs } from './prefs'
import { actionFor } from './hints'
import { initialState } from '../sim/game'
import type { FightState } from '../sim/fight'

describe('cài đặt kiểu kéo cá', () => {
  it('mặc định vẫn là kiểu phím (giữ để ghì, A/D để dòng)', () => {
    expect(DEFAULT_PREFS.fightStyle).toBe('keys')
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS)
  })

  it('bản lưu cũ chưa có kiểu kéo: giữ nguyên các mục khác, kiểu kéo lấy mặc định', () => {
    const p = parsePrefs({ quality: 'low', floatSize: 'l', sound: false, wide: true, xray: true })
    expect(p).toEqual({ quality: 'low', floatSize: 'l', sound: false, wide: true, xray: true, fightStyle: 'keys' })
  })

  it('giữ kiểu rê đã chọn; giá trị lạ thì về mặc định', () => {
    expect(parsePrefs({ fightStyle: 'drag' }).fightStyle).toBe('drag')
    expect(parsePrefs({ fightStyle: 'swipe', quality: 'ultra', sound: 'yes' })).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('rác')).toEqual(DEFAULT_PREFS)
  })

  it('lời gợi ý dòng cá theo kiểu đang dùng', () => {
    const fight = { fishDir: -1, rodSide: 0, tension: 0.4 } as FightState
    const s = { ...initialState(0), phase: 'fighting' as const, fight }
    expect(actionFor(s, 0).hint).toContain('giữ D hoặc ▶')
    expect(actionFor(s, 0, { hasBait: true, sounded: true, fightStyle: 'drag' }).hint).toContain('rê sang phải')
    const right = { ...s, fight: { ...fight, fishDir: 1 as const } }
    expect(actionFor(right, 0, { hasBait: true, sounded: true, fightStyle: 'drag' }).hint).toContain('rê sang trái')
  })
})
