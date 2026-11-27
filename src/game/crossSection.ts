import { roundsOf, type SpeciesBitePlan } from '../sim/bite'
import { type FightState, isSurging } from '../sim/fight'
import type { Phase, Result } from '../sim/game'
import { createRng } from '../sim/rng'

/**
 * Mặt cắt 2D: phần toán vị trí, thuần theo thời gian. Không đọc đồng hồ, không đụng DOM; `CrossSection.tsx` chỉ vẽ.
 *
 * Nước đục: bóng cá chỉ là một khối tối mờ, cùng một hình cho mọi loài. Cỡ bóng lấy từ seed trong một khoảng nhỏ
 * chung (GENERIC_SIZE), không bao giờ theo loài hay cân nặng thật, để nhìn bóng không đoán được cá gì.
 *
 * Bóng cá cắn câu đi theo đúng kế hoạch cắn của sim (bite.ts): tới lúc rỉa thì bơi lại mồi, mỗi nhịp phao giật
 * (`twitches`) là một lần đớp, tới cửa sổ giật thì ngậm mồi, lỡ cửa sổ thì lùi ra lượn vòng chờ đợt sau,
 * hết đợt thì bỏ đi. Kế hoạch rỗng (mồi rã, không có cá) thì không có bóng nào tới.
 * Bóng cá lượn ngoài (ambient) chỉ để trang trí: tính từ seed và thời gian, không ảnh hưởng gì tới sim.
 */

/** Chiều cao gốc của cảnh; mọi khoảng cách "đơn vị" bên dưới nhân với k = cao thật / WORLD_H. */
export const WORLD_H = 600

/** Khoảng cỡ chung của mọi bóng cá (bội số của cỡ gốc). Hẹp có chủ ý: không dùng cỡ bóng để đoán loài. */
export const GENERIC_SIZE = [0.85, 1.15] as const

export interface SceneLayout {
  w: number
  h: number
  /** px trên mỗi đơn vị gốc */
  k: number
  waterY: number
  /** mép bờ ở mặt nước */
  bankX: number
  floatX: number
  /** đáy sâu nhất (vùng phẳng ngoài xa) */
  bottomY: number
  /** chỗ hông người câu ngồi */
  seatX: number
  seatY: number
}

/** Bố cục theo khung thật: bờ bên trái, phao ở giữa-phải (khung phao cận cảnh nằm sát mép phải). */
export function sceneLayout(w: number, h: number): SceneLayout {
  const k = h / WORLD_H
  const waterY = Math.round(h * 0.47)
  const bankX = Math.round(Math.min(Math.max(w * 0.2, 150 * k), 300 * k))
  const floatX = Math.round(bankX + (w - bankX) * 0.6)
  const bottomY = Math.round(h * 0.78)
  return { w, h, k, waterY, bankX, floatX, bottomY, seatX: bankX - 70 * k, seatY: waterY - 58 * k }
}

/** Độ sâu đáy tại x: dốc từ mép bờ xuống, ra xa thì phẳng, gợn nhẹ. */
export function bottomAt(l: SceneLayout, x: number): number {
  if (x <= l.bankX) return l.waterY
  const slope = Math.min(1, (x - l.bankX) / ((l.floatX - l.bankX) * 0.7))
  const s = slope * slope * (3 - 2 * slope)
  return l.waterY + (l.bottomY - l.waterY) * s + Math.sin(x / (90 * l.k)) * 5 * l.k * s
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Cỡ chung lấy từ một số nguyên: đều trong GENERIC_SIZE. */
export function genericSize(seed: number): number {
  const r = createRng(seed ^ 0x2c1b3c6d)()
  return lerp(GENERIC_SIZE[0], GENERIC_SIZE[1], r)
}

// ---------------------------------------------------------------- bóng cá cắn câu

/** Cỡ bóng của con cá trong lượt câu này: theo lúc quăng, không theo loài hay cân nặng. Cá dính câu giữ nguyên cỡ đó. */
export function shadowSize(plan: Pick<SpeciesBitePlan, 'castAt'>): number {
  return genericSize(Math.floor(plan.castAt))
}

export type BiteShadowState = 'approach' | 'nibble' | 'take' | 'circle' | 'leave'

export const BITE_SHADOW = {
  /** bơi từ chỗ đục ra tới mồi trong ngần này (ms), ngắn lại nếu khoảng nghỉ giữa hai đợt ngắn */
  approachMs: 6_000,
  /** mõm cách mồi bao nhiêu đơn vị lúc lượn quanh rỉa */
  hoverDx: 34,
  /** cá còn ngậm mồi sau khi cửa sổ giật đóng, khớp với lúc phao trả về nấc cũ (bite.ts: floatOffset) */
  holdMs: 1_200,
  /** lùi ra trong ngần này rồi lượn vòng */
  backOffMs: 1_500,
  circleRx: 120,
  circleRy: 34,
  circleMs: 7_000,
  leaveMs: 3_500,
  /** chỗ bóng hiện ra từ nước đục, tính từ mồi */
  farDx: 420,
} as const

export interface ShadowPose {
  /** px, vị trí mõm cá */
  x: number
  y: number
  /** 1 = quay mặt sang phải (ra hồ), -1 = quay vào bờ */
  heading: -1 | 1
  /** 0..1 */
  alpha: number
  /** bội số cỡ gốc, luôn trong GENERIC_SIZE (cá dính câu đổi chút theo hướng chạy) */
  size: number
  /** nhịp vẫy đuôi, 0 = đứng yên, 1 = vẫy mạnh */
  beat: number
}

export interface BiteShadow extends ShadowPose {
  state: BiteShadowState
  /** đợt rỉa thứ mấy (0 = đợt đầu) */
  round: number
  /** 0..1: mõm đang đớp mồi tới đâu (khớp nhịp phao giật) */
  peck: number
}

/** Lực đớp tại t: 0 khi không có nhịp phao nào, lên 1 giữa nhịp. Cùng công thức hình sin với floatOffset. */
export function peckAt(plan: SpeciesBitePlan, t: number): number {
  let p = 0
  for (const w of plan.twitches) {
    const x = (t - w.at) / w.durMs
    if (x > 0 && x < 1) p = Math.max(p, Math.sin(Math.PI * x))
  }
  return p
}

function circlePoint(t: number, start: number, k: number) {
  const { circleRx: rx, circleRy: ry, circleMs } = BITE_SHADOW
  // bắt đầu ở điểm gần mồi nhất (góc π), đi vòng ra xa rồi về
  const a = Math.PI + ((t - start) / circleMs) * 2 * Math.PI
  return { dx: (rx + 24 + rx * Math.cos(a)) * k, dy: (-34 + ry * Math.sin(a)) * k, heading: (Math.sin(a) < 0 ? 1 : -1) as -1 | 1 }
}

/**
 * Bóng cá cắn câu tại t, tính từ kế hoạch cắn. `bait` là vị trí mồi trên màn hình (px).
 * Trả null khi chưa có cá tới, kế hoạch rỗng, hoặc cá đã bỏ đi hẳn.
 */
export function biteShadow(plan: SpeciesBitePlan | undefined, t: number, bait: { x: number; y: number }, k: number, calm = false): BiteShadow | null {
  if (!plan || plan.empty) return null
  const B = BITE_SHADOW
  const rs = roundsOf(plan)
  const size = shadowSize(plan)
  const bob = calm ? 0.4 : 1
  const hover = (time: number) => ({ dx: B.hoverDx * k + Math.sin(time / 900) * 4 * k * bob, dy: (-6 + Math.sin(time / 650) * 3 * bob) * k })
  const pose = (dx: number, dy: number, heading: -1 | 1, alpha: number, beat: number, state: BiteShadowState, round: number, peck = 0): BiteShadow => ({
    x: bait.x + dx,
    y: bait.y + dy,
    heading,
    alpha,
    size,
    beat,
    state,
    round,
    peck,
  })
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!
    const holdEnd = r.strikeClose + B.holdMs
    const prevEnd = i === 0 ? plan.castAt : rs[i - 1]!.strikeClose + B.holdMs
    const gap = Math.max(0, r.nibbleStart - prevEnd)
    const appr = i === 0 ? Math.min(B.approachMs, gap) : Math.min(B.approachMs, gap * 0.45)
    const apprStart = r.nibbleStart - appr
    if (t < apprStart) {
      if (i === 0) return null
      // giữa hai đợt: lùi ra rồi lượn vòng chờ đợt sau
      const take = { dx: 0, dy: 0 }
      const c = circlePoint(t, prevEnd + B.backOffMs, k)
      const u = ease((t - prevEnd) / B.backOffMs)
      return pose(lerp(take.dx, c.dx, u), lerp(take.dy, c.dy, u), u < 1 ? 1 : c.heading, 1, 0.5, 'circle', i - 1)
    }
    if (t < r.nibbleStart) {
      const h = hover(r.nibbleStart)
      const from =
        i === 0
          ? { dx: B.farDx * k, dy: -60 * k }
          : (() => {
              const c = circlePoint(apprStart, prevEnd + B.backOffMs, k)
              return { dx: c.dx, dy: c.dy }
            })()
      const u = appr <= 0 ? 1 : ease((t - apprStart) / appr)
      return pose(lerp(from.dx, h.dx, u), lerp(from.dy, h.dy, u), from.dx >= h.dx ? -1 : 1, i === 0 ? ease(u * 2) : 1, 0.6, 'approach', i)
    }
    if (t < r.strikeOpen) {
      const h = hover(t)
      const peck = peckAt(plan, t)
      return pose(h.dx * (1 - peck), h.dy * (1 - peck), -1, 1, 0.3 + 0.5 * peck, 'nibble', i, peck)
    }
    if (t < holdEnd) {
      // ngậm mồi, kéo mồi theo hướng phao báo: chìm thì kéo xuống, nổi thì nâng lên
      const u = ease((t - r.strikeOpen) / 200)
      const tug = (plan.signal.kind === 'rise' ? -4 : 4) * u * k
      // từ chỗ đang lượn lao vào ngậm mồi trong 200 ms, không nhảy cóc
      const h = hover(r.strikeOpen)
      const p0 = 1 - peckAt(plan, r.strikeOpen)
      return pose(h.dx * p0 * (1 - u), h.dy * p0 * (1 - u) + tug, -1, 1, 0.8, 'take', i, 1)
    }
    if (i === rs.length - 1) {
      const u = (t - holdEnd) / B.leaveMs
      if (u >= 1) return null
      const e = ease(u)
      return pose(lerp(0, (B.farDx + 120) * k, e), lerp(0, -90 * k, e), 1, 1 - ease((u - 0.4) / 0.6), 1, 'leave', i)
    }
  }
  return null
}

/** Cá hoảng hay sổng: từ chỗ cũ vụt ra xa, chìm dần vào nước đục rồi mất hẳn. Hết đường thì null. */
export function flee(from: ShadowPose, sinceMs: number, k: number): ShadowPose | null {
  const u = sinceMs / 1_800
  if (u >= 1) return null
  const e = ease(u)
  return { ...from, x: from.x + 380 * k * e, y: from.y + 50 * k * e, heading: 1, alpha: from.alpha * (1 - ease(u)), beat: 1 }
}

// ---------------------------------------------------------------- bóng cá lượn ngoài (trang trí)

export interface AmbientSpec {
  /** 0 = sát mặt, 1 = sát đáy */
  depth: number
  /** chu kỳ đi một lượt qua lại (ms) */
  periodMs: number
  phase: number
  size: number
  /** khoảng ngang bóng lượn, phần của bề rộng vùng nước */
  from: number
  to: number
  alpha: number
}

/** Danh sách bóng lượn, chỉ phụ thuộc seed: cùng seed cùng đàn. Không nhận loài hay cân nặng nào. */
export function ambientShadows(seed: number, n: number): AmbientSpec[] {
  const rng = createRng(seed ^ 0x51ed270b)
  return Array.from({ length: n }, () => {
    const a = rng()
    const span = 0.35 + rng() * 0.55
    const from = rng() * (1 - span)
    return {
      depth: 0.25 + 0.7 * rng(),
      periodMs: 26_000 + rng() * 34_000,
      phase: rng() * Math.PI * 2,
      size: lerp(GENERIC_SIZE[0], GENERIC_SIZE[1], rng()),
      from,
      to: from + span,
      alpha: 0.35 + 0.35 * a,
    }
  })
}

/** Vị trí bóng lượn tại t: qua lại chậm, chậm dần ở hai đầu như cá quay đầu. calm = chậm gấp đôi. */
export function ambientPose(a: AmbientSpec, t: number, l: SceneLayout, calm = false): ShadowPose {
  const ph = (t / (a.periodMs * (calm ? 2 : 1))) * 2 * Math.PI + a.phase
  const u = 0.5 - 0.5 * Math.cos(ph)
  const x0 = l.bankX + 40 * l.k
  const x = lerp(x0, l.w + 40 * l.k, lerp(a.from, a.to, u))
  const floor = bottomAt(l, x)
  const y = lerp(l.waterY + 30 * l.k, floor - 18 * l.k, a.depth) + Math.sin(ph * 3) * 6 * l.k
  return { x, y: Math.min(y, floor - 10 * l.k), heading: Math.sin(ph) >= 0 ? 1 : -1, alpha: a.alpha, size: a.size, beat: 0.3 }
}

// ---------------------------------------------------------------- trận kéo

/**
 * Cá đang dính câu. Khoảng cách cá (distanceM) chia theo tầm quăng: ở tầm quăng thì nằm dưới chỗ phao,
 * kéo gần thì sát bờ, cá lấy dây thì ra xa hơn phao. Cá còn sung thì ở sâu, đuối dần thì nổi lên.
 * Mặt cắt nhìn ngang, còn hướng cá chạy (fishDir) là sang trái/phải của người câu, tức là vào gần hay ra xa
 * người xem: chạy sang trái thì bóng to và đậm lên (gần mắt), sang phải thì nhỏ và nhạt đi.
 * Mõm cá quay về bờ khi bị dắt; lúc vùng chạy thì quay ra hồ, quẫy mạnh.
 */
export function hookedShadow(f: FightState, castDistanceM: number, size: number, t: number, l: SceneLayout, calm = false): ShadowPose {
  const along = clamp(f.distanceM / Math.max(1, castDistanceM), 0, 1.6)
  const x = l.bankX + 24 * l.k + along * (l.floatX - l.bankX)
  const floor = bottomAt(l, x)
  const surging = isSurging(f)
  const depth = clamp(0.15 + 0.55 * f.stamina * Math.min(1, along * 1.4), 0.06, 0.75)
  const amp = (surging ? 1 : 0.35) * (calm ? 0.35 : 1)
  const wiggle = Math.sin(t / 70) * 7 * amp * l.k
  const y = lerp(l.waterY + 14 * l.k, floor - 16 * l.k, depth) + Math.sin(t / 110) * 4 * amp * l.k
  return {
    x: x + wiggle,
    y,
    heading: surging ? 1 : -1,
    alpha: 0.85 - f.fishDir * 0.12,
    size: size * (1 - f.fishDir * 0.08),
    beat: surging ? 1 : 0.5,
  }
}

/** Cá đuối được nhấc khỏi nước: từ mặt nước sát bờ lên tới dưới ngọn cần. u: 0..1. */
export function liftPose(from: { x: number; y: number }, tip: { x: number; y: number }, sinceMs: number, k: number) {
  const u = ease(sinceMs / 900)
  return { x: lerp(from.x, tip.x, u), y: lerp(from.y, tip.y + 46 * k, u) - Math.sin(Math.PI * u) * 30 * k, u, sway: Math.sin(sinceMs / 380) * (1 - u * 0.5) }
}

// ---------------------------------------------------------------- người câu

export interface AnglerPose {
  /** độ ngả người ra sau (độ), 0 = ngồi thẳng */
  lean: number
  /** góc cần so với phương ngang (độ), dương = chếch lên */
  rodAngle: number
  /** 0..1: cần cong bao nhiêu */
  bend: number
  /** đang gồng kéo (giữ nút / Space / giữ chuột) */
  straining: boolean
  /** gãy cần: khúc ngọn gập xuống */
  snapped: boolean
  /** dây chùng, không nối với cá */
  slack: boolean
}

export function anglerPose(phase: Phase, reeling: boolean, tension: number, result: Result | undefined, sinceResultMs: number): AnglerPose {
  const still: AnglerPose = { lean: 0, rodAngle: 28, bend: 0.05, straining: false, snapped: false, slack: false }
  switch (phase) {
    case 'ready':
      return { ...still, rodAngle: 62 }
    case 'charging':
      return { ...still, lean: 6, rodAngle: 105 }
    case 'sinking':
    case 'waiting':
      return still
    case 'fighting':
    case 'landable': {
      const tn = clamp(tension, 0, 1)
      return reeling
        ? { lean: 16 + 14 * tn, rodAngle: 52 + 18 * tn, bend: 0.25 + 0.75 * tn, straining: true, snapped: false, slack: false }
        : { lean: 3, rodAngle: 38, bend: 0.15 + 0.4 * tn, straining: false, snapped: false, slack: false }
    }
    case 'result': {
      const kind = result?.kind
      // giật hụt hoặc đứt dây: người hẫng ra sau rồi ngồi lại
      const lurch = 18 * (1 - ease(sinceResultMs / 700))
      if (kind === 'rod_broke') return { lean: lurch, rodAngle: 40, bend: 0, straining: false, snapped: true, slack: true }
      if (kind === 'broke' || kind === 'escaped') return { ...still, lean: lurch, rodAngle: 45, slack: true }
      if (kind === 'landed') return { ...still, lean: 8, rodAngle: 55, bend: 0.3 }
      if (kind === 'too_early' || kind === 'too_late' || kind === 'nothing') return { ...still, lean: 10 * (1 - ease(sinceResultMs / 500)), rodAngle: 60, slack: false }
      return { ...still, rodAngle: 50 }
    }
  }
}

// ---------------------------------------------------------------- hạt lơ lửng

export interface Particle {
  x: number
  y: number
  r: number
  speed: number
}

/** Hạt bùn lơ lửng (phần của vùng nước), từ seed. */
export function particles(seed: number, n: number): Particle[] {
  const rng = createRng(seed ^ 0x7f4a7c15)
  return Array.from({ length: n }, () => ({ x: rng(), y: rng(), r: 0.6 + rng() * 1.6, speed: 0.004 + rng() * 0.01 }))
}

/** Vị trí hạt tại t (phần của vùng nước, 0..1): trôi ngang chậm, lắc nhẹ. */
export function particleAt(p: Particle, t: number): { x: number; y: number } {
  const s = t / 1000
  return { x: (((p.x + s * p.speed) % 1) + 1) % 1, y: p.y + Math.sin(s * 0.5 + p.x * 20) * 0.01 }
}

// ---------------------------------------------------------------- mặt hồ: sóng, gợn, ánh sáng, thời tiết (chỉ để nhìn)

export type WeatherLook = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'fog'

export interface Mood {
  night: boolean
  skyTop: string
  skyLow: string
  trees: string
  waterTop: string
  waterBottom: string
  groundTop: string
  groundBottom: string
  /** phủ tối cả cảnh (đêm), 0 = không */
  dim: number
  /** 0..1: độ sáng lấp lánh trên mặt nước và vệt nắng dưới nước */
  light: number
  /** hệ số biên độ sóng */
  chop: number
  /** số hạt mưa rơi xuống mặt hồ cùng lúc (0 = không mưa) */
  rain: number
}

/** Màu trời, màu nước theo giờ và thời tiết (đêm 19h–5h như cảnh 3D). Thuần, rẻ: chỉ là bảng màu. */
export function moodFor(hour: number, weather: WeatherLook): Mood {
  const night = hour < 5 || hour >= 19
  const dusk = !night && (hour < 7 || hour >= 17)
  const grey = weather === 'cloudy' || weather === 'rain' || weather === 'storm' || weather === 'fog'
  const sky = night
    ? { skyTop: '#0b1620', skyLow: '#1c2b35', trees: '#101c16' }
    : dusk
      ? { skyTop: grey ? '#8a8f96' : '#e2a76f', skyLow: grey ? '#b9b5a8' : '#f4d9a8', trees: '#4f5e45' }
      : grey
        ? { skyTop: '#a9b4b8', skyLow: '#d4d7cf', trees: '#7d8c74' }
        : { skyTop: '#9cc7dd', skyLow: '#e8efe0', trees: '#8fa483' }
  const water = night ? { waterTop: '#2b3a32', waterBottom: '#0e140f' } : grey ? { waterTop: '#506650', waterBottom: '#1f281b' } : { waterTop: '#5d7652', waterBottom: '#26301f' }
  const light = night ? 0.15 : weather === 'sunny' ? (dusk ? 0.6 : 1) : weather === 'fog' ? 0.25 : 0.4
  const chop = weather === 'storm' ? 2.2 : weather === 'rain' ? 1.4 : weather === 'fog' ? 0.6 : 1
  const rain = weather === 'storm' ? 14 : weather === 'rain' ? 8 : 0
  const ground = night ? { groundTop: '#3a2d1f', groundBottom: '#17110b' } : { groundTop: '#6b5236', groundBottom: '#3a2b1c' }
  return { night, ...sky, ...water, ...ground, dim: night ? 0.32 : grey ? 0.06 : 0, light, chop, rain }
}

/** Độ cao mặt nước tại x (px): vài sóng sin cộng lại. calm = biên độ nhỏ, chậm hơn. */
export function surfaceY(l: SceneLayout, x: number, t: number, chop = 1, calm = false): number {
  const a = (calm ? 0.3 : 1) * chop * l.k
  const s = t / (calm ? 2 : 1) / 1000
  const u = x / l.k
  return l.waterY + a * (1.6 * Math.sin(u / 38 + s * 1.3) + 0.9 * Math.sin(u / 17 - s * 2.1) + 0.5 * Math.sin(u / 7.5 + s * 3.4))
}

export interface RippleSource {
  x: number
  at: number
  /** 1 = gợn thường quanh phao, 3 = bọt lúc quăng hay giật */
  strength: number
}

export interface Ring {
  x: number
  rx: number
  ry: number
  alpha: number
}

export const RIPPLE_MS = 1_800

/** Vòng gợn đang loang tại t: mỗi nguồn loang ra rồi mờ dần trong RIPPLE_MS × cường độ. */
export function ringsAt(sources: readonly RippleSource[], t: number, k: number): Ring[] {
  const out: Ring[] = []
  for (const s of sources) {
    const life = RIPPLE_MS * (0.7 + 0.3 * s.strength)
    const u = (t - s.at) / life
    if (u < 0 || u >= 1) continue
    const r = (6 + 26 * s.strength * Math.sqrt(u)) * k
    out.push({ x: s.x, rx: r, ry: r * 0.18, alpha: (1 - u) * Math.min(1, 0.35 + 0.2 * s.strength) })
  }
  return out
}

/**
 * Nguồn gợn quanh phao từ kế hoạch cắn: phao chạm nước lúc quăng (mạnh), mỗi nhịp phao giật (vừa), lúc cá ăn
 * thật ở mỗi đợt (mạnh), cộng một vòng nhỏ đều đặn quanh phao đang nằm yên. Chỉ lấy các nguồn gần t.
 */
export function floatRipples(plan: SpeciesBitePlan | undefined, castAt: number | undefined, x: number, t: number): RippleSource[] {
  const out: RippleSource[] = []
  const near = (at: number) => at <= t && t - at < RIPPLE_MS * 2
  if (castAt !== undefined && near(castAt + 150)) out.push({ x, at: castAt + 150, strength: 3 })
  if (plan) {
    for (const w of plan.twitches) if (near(w.at)) out.push({ x, at: w.at, strength: 1.6 + Math.min(1, Math.abs(w.amp)) })
    if (!plan.empty) for (const r of roundsOf(plan)) if (near(r.strikeOpen)) out.push({ x, at: r.strikeOpen, strength: 2.6 })
  }
  if (castAt !== undefined) {
    const every = 2_600
    const last = Math.floor((t - castAt) / every) * every + castAt
    for (const at of [last, last - every]) if (at > castAt + 1_000 && near(at)) out.push({ x, at, strength: 0.7 })
  }
  return out
}

/** Hạt mưa chạm mặt hồ: mỗi khe 600 ms một lứa vị trí mới từ seed (phần của bề rộng vùng nước). */
export function rainDrops(seed: number, n: number, t: number): RippleSource[] {
  const slot = 600
  const out: RippleSource[] = []
  for (const s of [Math.floor(t / slot), Math.floor(t / slot) - 1]) {
    const rng = createRng((seed ^ (s * 2654435761)) >>> 0)
    for (let i = 0; i < n; i++) out.push({ x: rng(), at: s * slot + rng() * slot, strength: 0.35 })
  }
  return out.filter((d) => d.at <= t)
}

export interface Droplet {
  x: number
  y: number
  r: number
}

/**
 * Bọt nước khi cá dính câu vùng lên sát mặt: chỉ khi đang vùng chạy và mõm cá cách mặt nước chưa tới 50 đơn vị.
 * Mỗi giọt bay theo đường parabol, chu kỳ ngắn, từ seed.
 */
export function splash(fish: { x: number; y: number }, surging: boolean, t: number, l: SceneLayout, seed: number, calm = false): Droplet[] {
  const depth = (fish.y - l.waterY) / l.k
  if (!surging || depth > 50) return []
  const power = 1 - depth / 50
  const rng = createRng(seed >>> 0)
  const n = calm ? 4 : 10
  return Array.from({ length: n }, () => {
    const period = 420 + rng() * 380
    const off = rng() * period
    const u = ((t + off) % period) / period
    const vx = (rng() - 0.5) * 70
    const vy = 40 + rng() * 50
    return {
      x: fish.x + vx * u * l.k * power,
      y: l.waterY - (vy * u - vy * u * u) * 2 * l.k * power,
      r: (1.2 + rng() * 1.6) * l.k,
    }
  })
}

/** Ánh lấp lánh trên mặt nước: vị trí từ seed, sáng tắt theo t. Trả alpha 0..1 cho từng đốm. */
export function glints(seed: number, n: number, t: number): { x: number; alpha: number; len: number }[] {
  const rng = createRng(seed ^ 0x1b873593)
  return Array.from({ length: n }, () => {
    const x = rng()
    const speed = 0.8 + rng() * 1.6
    const ph = rng() * Math.PI * 2
    return { x, len: 6 + rng() * 14, alpha: Math.max(0, Math.sin((t / 1000) * speed + ph)) ** 3 }
  })
}
