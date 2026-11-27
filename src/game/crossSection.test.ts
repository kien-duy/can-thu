import { describe, expect, it } from 'vitest'
import { LOCATIONS, SPECIES } from '../content'
import { planSpeciesBite, type SpeciesBitePlan } from '../sim/bite'
import { initFight } from '../sim/fight'
import { createRng } from '../sim/rng'
import {
  ambientShadows,
  anglerPose,
  BITE_SHADOW,
  biteShadow,
  floatRipples,
  flee,
  GENERIC_SIZE,
  hookedShadow,
  moodFor,
  peckAt,
  ringsAt,
  sceneLayout,
  shadowSize,
  splash,
  surfaceY,
} from './crossSection'

/** Mặt cắt 2D: bóng cá đi theo kế hoạch cắn của sim, không lộ loài, không ảnh hưởng gì tới sim. */
const pond = LOCATIONS.find((l) => l.id === 'ho_dong_xanh')!
const l = sceneLayout(1280, 720)
const bait = { x: l.floatX, y: l.bottomY - 6 }

function plan(seed: number): SpeciesBitePlan {
  return planSpeciesBite(createRng(seed), pond, SPECIES, { castAt: 1_000_000, settledAt: 1_003_000, hour: 10 })
}

/** Seed đầu tiên có ít nhất n đợt rỉa và có nhịp phao giật trong pha rỉa đợt đầu. */
function planWithRounds(n: number): SpeciesBitePlan {
  for (let seed = 1; seed < 500; seed++) {
    const p = plan(seed)
    const r0 = p.rounds[0]!
    if (!p.empty && p.rounds.length >= n && p.twitches.some((w) => w.at > r0.nibbleStart && w.at < r0.strikeOpen - 600)) return p
  }
  throw new Error(`không có lượt ${n} đợt`)
}

describe('bóng cá cắn câu theo kế hoạch cắn', () => {
  it('chưa tới giờ rỉa thì chưa có bóng; rỉa thì lượn sát mồi; cửa sổ giật thì ngậm mồi', () => {
    const p = planWithRounds(2)
    const [r0] = p.rounds
    expect(biteShadow(p, p.castAt + 10, bait, l.k)).toBeNull()
    expect(biteShadow(p, r0!.nibbleStart - BITE_SHADOW.approachMs - 1, bait, l.k)).toBeNull()
    const appr = biteShadow(p, r0!.nibbleStart - 1_000, bait, l.k)!
    expect(appr.state).toBe('approach')
    expect(appr.x).toBeGreaterThan(bait.x)
    const nib = biteShadow(p, (r0!.nibbleStart + r0!.strikeOpen) / 2, bait, l.k)!
    expect(nib.state).toBe('nibble')
    expect(nib.round).toBe(0)
    expect(Math.abs(nib.x - bait.x)).toBeLessThanOrEqual((BITE_SHADOW.hoverDx + 5) * l.k)
    const take = biteShadow(p, r0!.strikeOpen + 300, bait, l.k)!
    expect(take.state).toBe('take')
    expect(take.x).toBeCloseTo(bait.x, 5)
  })

  it('mỗi nhịp phao giật là một lần đớp: giữa nhịp mõm chạm mồi, ngoài nhịp thì lùi ra', () => {
    const p = planWithRounds(1)
    const r0 = p.rounds[0]!
    const w = p.twitches.find((x) => x.at > r0.nibbleStart && x.at < r0.strikeOpen - 600)!
    const mid = biteShadow(p, w.at + w.durMs / 2, bait, l.k)!
    expect(peckAt(p, w.at + w.durMs / 2)).toBeCloseTo(1, 5)
    expect(mid.peck).toBeCloseTo(1, 5)
    expect(Math.abs(mid.x - bait.x)).toBeLessThan(1)
    const before = biteShadow(p, w.at - 1, bait, l.k)!
    if (peckAt(p, w.at - 1) === 0) expect(before.x - bait.x).toBeGreaterThan(20 * l.k)
  })

  it('lỡ cửa sổ: lùi ra lượn vòng tới đợt sau, rỉa lại; sau đợt cuối thì bỏ đi rồi mất hẳn', () => {
    const p = planWithRounds(2)
    const [r0, r1] = p.rounds
    const gapMid = (r0!.strikeClose + BITE_SHADOW.holdMs + r1!.nibbleStart) / 2
    const circ = biteShadow(p, r0!.strikeClose + BITE_SHADOW.holdMs + 200, bait, l.k)!
    expect(circ.state).toBe('circle')
    expect(['circle', 'approach']).toContain(biteShadow(p, gapMid, bait, l.k)!.state)
    const again = biteShadow(p, (r1!.nibbleStart + r1!.strikeOpen) / 2, bait, l.k)!
    expect(again.state).toBe('nibble')
    expect(again.round).toBe(1)
    const last = p.rounds[p.rounds.length - 1]!
    const leave = biteShadow(p, last.strikeClose + BITE_SHADOW.holdMs + 500, bait, l.k)!
    expect(leave.state).toBe('leave')
    expect(biteShadow(p, last.strikeClose + BITE_SHADOW.holdMs + BITE_SHADOW.leaveMs + 1, bait, l.k)).toBeNull()
  })

  it('vị trí liền mạch: không nhảy cóc giữa các pha (bước 50 ms)', () => {
    const p = planWithRounds(2)
    const last = p.rounds[p.rounds.length - 1]!
    let prev = biteShadow(p, p.rounds[0]!.nibbleStart - 3_000, bait, l.k)!
    for (let t = p.rounds[0]!.nibbleStart - 3_000; t < last.strikeClose + BITE_SHADOW.holdMs + BITE_SHADOW.leaveMs - 100; t += 50) {
      const s = biteShadow(p, t, bait, l.k)!
      expect(Math.hypot(s.x - prev.x, s.y - prev.y)).toBeLessThan(30 * l.k)
      prev = s
    }
  })

  it('kế hoạch rỗng (mồi rã, không có cá) hoặc chưa quăng: không có bóng nào tới', () => {
    const p = { ...plan(1), empty: true }
    for (let t = p.castAt; t < p.castAt + 600_000; t += 997) expect(biteShadow(p, t, bait, l.k)).toBeNull()
    expect(biteShadow(undefined, 0, bait, l.k)).toBeNull()
  })

  it('bóng không lộ loài hay cân nặng: đổi loài, đổi cân thì bóng y hệt', () => {
    const p = planWithRounds(1)
    const other = { ...p, speciesId: 'something_else', weightG: p.weightG * 7 }
    for (const t of [p.rounds[0]!.nibbleStart - 500, p.rounds[0]!.nibbleStart + 100, p.rounds[0]!.strikeOpen + 100]) {
      expect(biteShadow(other, t, bait, l.k)).toEqual(biteShadow(p, t, bait, l.k))
    }
    expect(shadowSize(other)).toBe(shadowSize(p))
  })

  it('cá hoảng: vụt ra xa, mờ dần rồi mất', () => {
    const from = { x: 100, y: 300, heading: -1 as const, alpha: 1, size: 1, beat: 0.5 }
    const a = flee(from, 600, 1)!
    expect(a.x).toBeGreaterThan(100)
    expect(a.alpha).toBeLessThan(1)
    expect(flee(from, 5_000, 1)).toBeNull()
  })
})

describe('bóng cá lượn (trang trí)', () => {
  it('cỡ chỉ trong khoảng chung hẹp, chỉ phụ thuộc seed (không nhận loài hay cân nặng)', () => {
    const a = ambientShadows(42, 50)
    expect(a).toEqual(ambientShadows(42, 50))
    for (const s of a) {
      expect(s.size).toBeGreaterThanOrEqual(GENERIC_SIZE[0])
      expect(s.size).toBeLessThanOrEqual(GENERIC_SIZE[1])
    }
    expect(ambientShadows.length).toBe(2)
  })

  it('cỡ bóng của mọi lượt câu đều trong khoảng chung, dù cá to hay nhỏ', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = shadowSize(plan(seed))
      expect(s).toBeGreaterThanOrEqual(GENERIC_SIZE[0])
      expect(s).toBeLessThanOrEqual(GENERIC_SIZE[1])
    }
  })
})

describe('trận kéo trên mặt cắt', () => {
  const sp = SPECIES[0]!
  it('cá kéo lại gần thì bóng sát bờ hơn; cá dính câu giữ cỡ của lượt câu, không theo cân nặng', () => {
    const far = initFight(sp, 800, 12, 1)
    const near = { ...far, distanceM: 3 }
    const a = hookedShadow(far, 12, 1, 0, l)
    const b = hookedShadow(near, 12, 1, 0, l)
    expect(b.x).toBeLessThan(a.x)
    const heavy = { ...far, weightG: 9_000, speciesId: 'x' }
    expect(hookedShadow(heavy, 12, 1, 0, l)).toEqual(a)
  })

  it('người câu gồng ngả ra sau, cần cong khi giữ nút; thả thì ngồi thẳng lại', () => {
    const hold = anglerPose('fighting', true, 0.8, undefined, 0)
    const rest = anglerPose('fighting', false, 0.8, undefined, 0)
    expect(hold.straining).toBe(true)
    expect(rest.straining).toBe(false)
    expect(hold.lean).toBeGreaterThan(rest.lean + 10)
    expect(hold.bend).toBeGreaterThan(rest.bend)
  })

  it('gãy cần thì cần gập, dây chùng; đứt dây thì dây chùng', () => {
    const rod = anglerPose('result', false, 0, { kind: 'rod_broke', speciesId: 'a', weightG: 1 }, 100)
    expect(rod.snapped && rod.slack).toBe(true)
    const line = anglerPose('result', false, 0, { kind: 'broke', speciesId: 'a', weightG: 1 }, 100)
    expect(line.snapped).toBe(false)
    expect(line.slack).toBe(true)
  })
})

describe('mặt hồ (chỉ để nhìn)', () => {
  it('sóng nhấp nhô quanh mực nước; giảm chuyển động thì biên độ nhỏ hơn', () => {
    let maxN = 0
    let maxC = 0
    for (let x = 0; x < 1280; x += 13) {
      maxN = Math.max(maxN, Math.abs(surfaceY(l, x, 12_345, 1) - l.waterY))
      maxC = Math.max(maxC, Math.abs(surfaceY(l, x, 12_345, 1, true) - l.waterY))
    }
    expect(maxN).toBeGreaterThan(0.5)
    expect(maxN).toBeLessThan(6 * l.k)
    expect(maxC).toBeLessThan(maxN)
  })

  it('gợn lớn lúc phao chạm nước và mỗi nhịp phao giật, loang rồi tắt', () => {
    const p = planWithRounds(1)
    const castRings = ringsAt(floatRipples(p, p.castAt, 500, p.castAt + 400), p.castAt + 400, 1)
    expect(castRings.length).toBeGreaterThan(0)
    const w = p.twitches[0]!
    const src = floatRipples(p, p.castAt, 500, w.at + 200)
    expect(src.some((s) => s.at === w.at)).toBe(true)
    expect(ringsAt([{ x: 0, at: 0, strength: 1 }], 10_000, 1)).toEqual([])
  })

  it('đêm thì nước tối hơn, mưa thì có hạt mưa', () => {
    expect(moodFor(22, 'sunny').night).toBe(true)
    expect(moodFor(10, 'sunny').rain).toBe(0)
    expect(moodFor(10, 'rain').rain).toBeGreaterThan(0)
    expect(moodFor(22, 'sunny').light).toBeLessThan(moodFor(10, 'sunny').light)
  })

  it('bọt nước chỉ bắn khi cá vùng sát mặt', () => {
    expect(splash({ x: 400, y: l.waterY + 10 }, true, 1000, l, 1)).not.toHaveLength(0)
    expect(splash({ x: 400, y: l.waterY + 10 }, false, 1000, l, 1)).toHaveLength(0)
    expect(splash({ x: 400, y: l.bottomY }, true, 1000, l, 1)).toHaveLength(0)
  })
})
