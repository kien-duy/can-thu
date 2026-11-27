import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  ambientPose,
  ambientShadows,
  anglerPose,
  biteShadow,
  bottomAt,
  flee,
  floatRipples,
  glints,
  hookedShadow,
  liftPose,
  moodFor,
  particleAt,
  particles,
  rainDrops,
  type RippleSource,
  ringsAt,
  sceneLayout,
  type SceneLayout,
  shadowSize,
  type ShadowPose,
  splash,
  surfaceY,
} from '../game/crossSection'
import { setupFor } from '../game/player'
import { floatPose } from '../game/pose'
import { useGame } from '../game/store'
import type { GameState, Result } from '../sim/game'
import { isSurging } from '../sim/fight'
import { baitOffsetCm } from '../sim/setup'
import { localHour } from '../sim/world'

/**
 * Mặt cắt 2D (Cài đặt → Cảnh → Mặt cắt 2D): nhìn ngang bờ, nước đục, chỉ thấy bóng cá. Vẽ bằng SVG, không WebGL.
 * Chỉ vẽ; mọi phép tính vị trí nằm trong `game/crossSection.ts` (có unit test).
 * Đồng hồ vẽ chạy bằng requestAnimationFrame nên tự dừng khi tab ẩn; sim vẫn chạy ở vòng lặp riêng như cũ.
 */

// lúc có kết quả gần nhất (để diễn cảnh cá sổng, nhấc cá lên); ghi ngoài React để render vẫn thuần
let resultSeen: { result?: Result; at: number } = { at: 0 }
// lúc giật dính (vào trận kéo), để bắn bọt chỗ phao
let strikeAt = 0
useGame.subscribe((s, prev) => {
  if (s.game.result !== resultSeen.result) resultSeen = { result: s.game.result, at: Date.now() }
  if (s.game.phase === 'fighting' && (prev.game.phase === 'waiting' || prev.game.phase === 'sinking')) strikeAt = Date.now()
})

const reducedQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null)

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const q = reducedQuery()
      q?.addEventListener('change', cb)
      return () => q?.removeEventListener('change', cb)
    },
    () => reducedQuery()?.matches ?? false,
  )
}

/** Thời gian vẽ: mỗi khung hình (giảm chuyển động: ~12 hình/giây). rAF không chạy khi tab ẩn, nên cảnh tự dừng. */
function useFrameClock(calm: boolean): number {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    let raf = 0
    let last = 0
    const step = (now: number) => {
      if (!calm || now - last > 80) {
        last = now
        setT(Date.now())
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [calm])
  return t
}

function useBoxSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1280, h: 720 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e!.contentRect
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, ...size }
}

/** Một hình bóng cá chung cho mọi loài: mõm ở gốc toạ độ, quay sang phải. */
const FISH_PATH = 'M0,0 C-6,-9 -30,-12 -46,-4 L-60,-11 L-56,0 L-60,11 L-46,4 C-30,12 -6,9 0,0 Z'

function Shadow({ p, k, t, calm, testId }: { p: ShadowPose; k: number; t: number; calm: boolean; testId?: string }) {
  const s = p.size * k
  const wag = calm ? 0 : Math.sin(t / (90 + 140 * (1 - p.beat))) * 4 * p.beat
  return (
    <g data-testid={testId} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(p.heading * s).toFixed(3)} ${s.toFixed(3)}) rotate(${wag.toFixed(2)})`} opacity={p.alpha.toFixed(2)}>
      <path d={FISH_PATH} fill="#0b120e" filter="url(#cs-soft)" />
    </g>
  )
}

const pt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`
const rad = (deg: number) => (deg * Math.PI) / 180

export function CrossSection() {
  const phase = useGame((s) => s.game.phase)
  const bite = useGame((s) => s.game.bite)
  const fight = useGame((s) => s.game.fight)
  const cast = useGame((s) => s.game.cast)
  const reeling = useGame((s) => s.game.reeling)
  const result = useGame((s) => s.game.result)
  const seed = useGame((s) => s.cfg.seed)
  const loc = useGame((s) => s.cfg.location)
  const player = useGame((s) => s.player)
  const hour = useGame((s) => localHour(Math.floor(s.now / 600_000) * 600_000)) // đổi trời mỗi 10 phút, như cảnh 3D
  const weather = useGame((s) => s.session?.weather.kind ?? 'sunny')
  const mood = useMemo(() => moodFor(hour, weather), [hour, weather])
  const calm = useReducedMotion()
  const t = useFrameClock(calm)
  const { ref, w, h } = useBoxSize()
  const l: SceneLayout = useMemo(() => sceneLayout(w, h), [w, h])
  const ambient = useMemo(() => ambientShadows(seed, calm ? 3 : 6), [seed, calm])
  const specks = useMemo(() => particles(seed, calm ? 24 : 48), [seed, calm])
  const offsetCm = useMemo(() => baitOffsetCm(loc, setupFor(player, loc, 27)), [loc, player])
  const { k, waterY } = l

  const sinceResult = result && resultSeen.result === result ? Math.max(0, t - resultSeen.at) : 1e9
  const resultAt = t - sinceResult
  const pose = anglerPose(phase, reeling, fight?.tension ?? 0, result, sinceResult)

  // ------------------------------------------------ người câu, cần
  const hip = { x: l.seatX, y: l.seatY }
  const lean = rad(pose.lean + (pose.straining && !calm && (fight?.tension ?? 0) > 0.7 ? Math.sin(t / 45) * 1.2 : 0))
  const torso = 46 * k
  const shoulder = { x: hip.x - Math.sin(lean) * torso, y: hip.y - Math.cos(lean) * torso }
  const head = { x: shoulder.x - Math.sin(lean) * 15 * k, y: shoulder.y - Math.cos(lean) * 15 * k }
  const grip = { x: shoulder.x + Math.cos(lean) * 30 * k, y: shoulder.y + 14 * k + Math.sin(lean) * 8 * k }
  const R = 230 * k
  const a = rad(pose.rodAngle)
  const tipA = a - rad(pose.bend * 30)
  const tip = { x: grip.x + Math.cos(tipA) * R, y: grip.y - Math.sin(tipA) * R }
  const ctrl = { x: grip.x + Math.cos(a) * R * 0.55, y: grip.y - Math.sin(a) * R * 0.55 }
  const joint = { x: grip.x + Math.cos(a) * R * 0.55, y: grip.y - Math.sin(a) * R * 0.55 }
  const brokenTip = { x: joint.x + 22 * k, y: joint.y + R * 0.4 }
  const lineFrom = pose.snapped ? brokenTip : tip

  // ------------------------------------------------ phao, mồi
  const fp = floatPose({ phase, casts: 0, reeling, lastTick: 0, cast, bite } satisfies GameState, t)
  const restBaitY = bottomAt(l, l.floatX) - 5 * k - Math.min(40, Math.max(0, -offsetCm)) * 0.9 * k
  const sinkP = phase === 'sinking' && cast ? Math.min(1, Math.max(0, (t - cast.at) / Math.max(1, cast.settledAt - cast.at))) : 1
  const bait = { x: l.floatX, y: waterY + (restBaitY - waterY) * (sinkP * sinkP * (3 - 2 * sinkP)) }

  // ------------------------------------------------ bóng cá cắn câu / cá dính câu
  let main: ShadowPose | null = null
  let mainState = 'none'
  let lifted: ReturnType<typeof liftPose> | null = null
  let baitDy = 0
  if ((phase === 'sinking' || phase === 'waiting') && bite) {
    const b = biteShadow(bite, t, bait, k, calm)
    if (b) {
      main = b
      mainState = b.state
      if (b.state === 'take') baitDy = b.y - bait.y
    }
  } else if ((phase === 'fighting' || phase === 'landable') && fight && cast && bite) {
    main = hookedShadow(fight, cast.distanceM, shadowSize(bite), t, l, calm)
    if (phase === 'landable') main = { ...main, y: waterY + 9 * k, beat: 0.2 }
    mainState = 'hooked'
  } else if (phase === 'result' && result && bite) {
    if (result.kind === 'landed' && fight && cast) {
      const from = hookedShadow(fight, cast.distanceM, shadowSize(bite), resultAt, l, calm)
      lifted = liftPose({ x: from.x, y: waterY + 6 * k }, lineFrom, sinceResult, k)
      mainState = 'lifted'
    } else if ((result.kind === 'broke' || result.kind === 'rod_broke' || result.kind === 'escaped') && fight && cast) {
      main = flee(hookedShadow(fight, cast.distanceM, shadowSize(bite), resultAt, l, calm), sinceResult, k)
      mainState = main ? 'fleeing' : 'none'
    } else if (result.kind === 'too_early' || result.kind === 'too_late' || result.kind === 'nothing' || result.kind === 'gone') {
      const at = biteShadow(bite, resultAt, bait, k, calm)
      if (at && result.kind === 'gone') {
        main = biteShadow(bite, t, bait, k, calm)
        mainState = main ? 'leave' : 'none'
      } else if (at) {
        main = flee(at, sinceResult, k)
        mainState = main ? 'fleeing' : 'none'
      }
    }
  }

  // ------------------------------------------------ dây
  let lineState: 'rig' | 'cast' | 'taut' | 'slack' | 'lifted' = 'rig'
  let linePath = ''
  const rigHang = { x: lineFrom.x + 4 * k, y: lineFrom.y + 46 * k }
  // phao nhấp nhô theo sóng, cộng thêm độ lệch nấc từ sim (floatOffset)
  const sy = (x: number) => surfaceY(l, x, t, mood.chop, calm)
  const floatWaterY = sy(l.floatX)
  const floatTop = { x: l.floatX, y: floatWaterY - 9 * k + fp.sink * 4 * k }
  if ((phase === 'sinking' || phase === 'waiting') && fp.visible) {
    lineState = 'cast'
    const mx = (lineFrom.x + floatTop.x) / 2
    const my = Math.max(lineFrom.y, floatTop.y) + 26 * k
    linePath = `M${pt(lineFrom.x, lineFrom.y)} Q${pt(mx, my)} ${pt(floatTop.x, floatTop.y)}`
  } else if ((phase === 'fighting' || phase === 'landable') && main) {
    lineState = 'taut'
    const sag = (1 - Math.min(1, fight?.tension ?? 0)) * 60 * k
    linePath = `M${pt(lineFrom.x, lineFrom.y)} Q${pt((lineFrom.x + main.x) / 2, (lineFrom.y + main.y) / 2 + sag)} ${pt(main.x, main.y)}`
  } else if (lifted) {
    lineState = 'lifted'
    linePath = `M${pt(lineFrom.x, lineFrom.y)} L${pt(lifted.x, lifted.y)}`
  } else if (pose.slack) {
    lineState = 'slack'
    linePath = `M${pt(lineFrom.x, lineFrom.y)} Q${pt(lineFrom.x + 50 * k, waterY + 14 * k)} ${pt(lineFrom.x + 150 * k, waterY + 1 * k)} L${pt(lineFrom.x + 260 * k, waterY + 4 * k)}`
  } else {
    linePath = `M${pt(lineFrom.x, lineFrom.y)} L${pt(rigHang.x, rigHang.y)}`
  }

  const nibbling = mainState === 'nibble' || mainState === 'take'
  const surfacePts = Array.from({ length: 49 }, (_, i) => {
    const x = l.bankX + ((l.w - l.bankX) * i) / 48
    return pt(x, sy(x))
  })
  const surfacePath = `M${surfacePts.join(' L')}`
  // nước thật phủ tới đường sóng: phần trời dưới đường sóng được tô bằng màu nước
  const waterTopPath = `M${pt(l.bankX, waterY + 8 * k)} L${surfacePts.join(' L')} L${pt(w, waterY + 8 * k)} Z`

  // gợn: quanh phao, lúc quăng, lúc giật dính, lúc nhấc cá, hạt mưa
  const sources: RippleSource[] = []
  if ((phase === 'sinking' || phase === 'waiting') && fp.visible) sources.push(...floatRipples(bite, cast?.at, l.floatX, t))
  if (strikeAt && t - strikeAt < 2_500) sources.push({ x: l.floatX, at: strikeAt, strength: 3 })
  if (lifted) sources.push({ x: lifted.x, at: resultAt + 150, strength: 2.6 })
  if (main && mainState === 'hooked' && main.y - waterY < 30 * k) sources.push({ x: main.x, at: Math.floor(t / 700) * 700, strength: 1.2 })
  const rainW = w - l.bankX
  if (mood.rain > 0) for (const d of rainDrops(seed, calm ? Math.ceil(mood.rain / 3) : mood.rain, t)) sources.push({ ...d, x: l.bankX + d.x * rainW })
  const rings = ringsAt(sources, t, k)
  const spray = main && mainState === 'hooked' && fight ? splash(main, isSurging(fight), t, l, seed, calm) : []
  const sparkle = calm ? [] : glints(seed, 18, t)
  const rays = calm || mood.light < 0.2 ? [] : [0.18, 0.37, 0.55, 0.74, 0.9]
  const groundPath = (() => {
    const top = waterY - 34 * k
    const pts = [`M0 ${top.toFixed(1)}`, `L${pt(l.bankX - 46 * k, top)}`, `Q${pt(l.bankX - 18 * k, top + 6 * k)} ${pt(l.bankX, waterY)}`]
    for (let i = 1; i <= 40; i++) {
      const x = l.bankX + ((l.w - l.bankX) * i) / 40
      pts.push(`L${pt(x, bottomAt(l, x))}`)
    }
    pts.push(`L${l.w} ${l.h}`, `L0 ${l.h}`, 'Z')
    return pts.join(' ')
  })()
  const tSpeck = calm ? 0 : t

  return (
    <div
      ref={ref}
      className="scene cross-section"
      data-testid="cross-section"
      data-shadow={mainState}
      data-line={lineState}
      data-calm={calm ? 'yes' : 'no'}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
        <defs>
          <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mood.skyTop} />
            <stop offset="1" stopColor={mood.skyLow} />
          </linearGradient>
          <linearGradient id="cs-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mood.waterTop} />
            <stop offset="1" stopColor={mood.waterBottom} />
          </linearGradient>
          {/* nước đục: càng sâu càng dày, ra xa phao cũng mù dần */}
          <linearGradient id="cs-murk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4a5a3a" stopOpacity="0.05" />
            <stop offset="0.4" stopColor="#3c4a30" stopOpacity="0.55" />
            <stop offset="1" stopColor="#232b1c" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="cs-murk-far" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#323d28" stopOpacity="0" />
            <stop offset="0.55" stopColor="#323d28" stopOpacity="0" />
            <stop offset="1" stopColor="#2a3322" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="cs-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mood.groundTop} />
            <stop offset="1" stopColor={mood.groundBottom} />
          </linearGradient>
          {/* vệt nắng xuyên xuống nước, tắt dần vào chỗ đục */}
          <linearGradient id="cs-ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f1c8" stopOpacity={0.22 * mood.light} />
            <stop offset="1" stopColor="#f4f1c8" stopOpacity="0" />
          </linearGradient>
          {/* quanh lưỡi câu nước bớt đục một chút: thấy mồi và con cá đang rỉa, không thấy cả hồ */}
          <radialGradient id="cs-clear-g" gradientUnits="userSpaceOnUse" cx={bait.x} cy={bait.y - 10 * k} r={120 * k}>
            <stop offset="0" stopColor="#6a6a6a" />
            <stop offset="0.6" stopColor="#c8c8c8" />
            <stop offset="1" stopColor="#ffffff" />
          </radialGradient>
          <mask id="cs-clear" maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
            <rect x="0" y="0" width={w} height={h} fill="url(#cs-clear-g)" />
          </mask>
          <filter id="cs-soft" x="-40%" y="-80%" width="180%" height="260%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        {/* trời, hàng cây bờ xa */}
        <rect x="0" y="0" width={w} height={waterY} fill="url(#cs-sky)" />
        <path
          d={`M${l.bankX} ${waterY} ${Array.from({ length: 14 }, (_, i) => {
            const x = l.bankX + ((w - l.bankX) * (i + 0.5)) / 14
            return `L${pt(x, waterY - (16 + ((i * 37) % 23)) * k)}`
          }).join(' ')} L${w} ${waterY} Z`}
          fill={mood.trees}
        />

        {/* nước, đáy */}
        <rect x="0" y={waterY} width={w} height={h - waterY} fill="url(#cs-water)" />
        <path d={waterTopPath} fill={mood.waterTop} />
        <path d={groundPath} fill="url(#cs-ground)" />
        <g data-testid="light-rays">
          {rays.map((f, i) => {
            const x = l.bankX + (w - l.bankX) * f + Math.sin(t / 2300 + i * 1.7) * 14 * k
            const top = sy(x)
            const len = (h - waterY) * 0.55
            return <path key={i} d={`M${pt(x - 9 * k, top)} L${pt(x + 9 * k, top)} L${pt(x + 9 * k + len * 0.32, top + len)} L${pt(x - 18 * k + len * 0.32, top + len)} Z`} fill="url(#cs-ray)" opacity={(0.6 + 0.4 * Math.sin(t / 1300 + i * 2.1)).toFixed(2)} />
          })}
        </g>

        {/* bóng cá: dưới lớp nước đục, nên càng sâu càng mờ */}
        <g data-testid="ambient-shadows">
          {ambient.map((s, i) => (
            <Shadow key={i} p={ambientPose(s, t, l, calm)} k={k * 0.9} t={t} calm={calm} />
          ))}
        </g>
        {main && <Shadow p={main} k={k} t={t} calm={calm} testId="bite-shadow" />}

        <g mask="url(#cs-clear)">
          <rect x="0" y={waterY} width={w} height={h - waterY} fill="url(#cs-murk)" />
          <rect x="0" y={waterY} width={w} height={h - waterY} fill="url(#cs-murk-far)" />
        </g>
        <g fill="#c9c6a2" opacity="0.28">
          {specks.map((p, i) => {
            const q = particleAt(p, tSpeck)
            return <circle key={i} cx={(q.x * w).toFixed(1)} cy={(waterY + 8 * k + q.y * (h - waterY - 8 * k)).toFixed(1)} r={(p.r * k).toFixed(2)} />
          })}
        </g>

        {/* dây dưới phao, chì, lưỡi, mồi: vẽ trên lớp đục cho người chơi luôn thấy */}
        {(phase === 'sinking' || phase === 'waiting') && fp.visible && (
          <g data-testid="rig" opacity="0.92">
            <line x1={l.floatX} y1={waterY + 16 * k + fp.sink * 4 * k} x2={bait.x} y2={bait.y - 24 * k + baitDy} stroke="#e6dfc8" strokeWidth={0.9} />
            <rect x={bait.x - 3 * k} y={bait.y - 28 * k + baitDy} width={6 * k} height={7 * k} rx={1.5 * k} fill="#9aa0a6" />
            <path d={`M${pt(bait.x, bait.y - 21 * k + baitDy)} L${pt(bait.x - 9 * k, bait.y + baitDy)} M${pt(bait.x, bait.y - 21 * k + baitDy)} L${pt(bait.x + 8 * k, bait.y - 6 * k + baitDy)}`} stroke="#e6dfc8" strokeWidth={0.7} fill="none" />
            <circle cx={bait.x - 9 * k} cy={bait.y + baitDy} r={3.6 * k} fill="#e8b86b" />
            <circle cx={bait.x + 8 * k} cy={bait.y - 6 * k + baitDy} r={3.6 * k} fill="#e8b86b" />
          </g>
        )}

        {/* mặt nước: đường sóng, lấp lánh, gợn, bọt */}
        <path d={surfacePath} stroke="#dfe8d8" strokeOpacity={0.4 + 0.3 * mood.light} strokeWidth={1.5} fill="none" data-testid="surface" />
        <g stroke="#fffbe6" strokeWidth={1.4 * k} strokeLinecap="round">
          {sparkle.map((g, i) => {
            const x = l.bankX + (w - l.bankX) * g.x
            const y = sy(x) - 0.6 * k
            return g.alpha > 0.05 ? <line key={i} x1={x - (g.len * k) / 2} x2={x + (g.len * k) / 2} y1={y} y2={y} opacity={(g.alpha * mood.light * 0.9).toFixed(2)} /> : null
          })}
        </g>
        <g data-testid="ripples" data-count={rings.length} fill="none" stroke="#eef3e6">
          {rings.map((r, i) => (
            <ellipse key={i} cx={r.x.toFixed(1)} cy={sy(r.x).toFixed(1)} rx={r.rx.toFixed(1)} ry={r.ry.toFixed(1)} strokeOpacity={r.alpha.toFixed(2)} strokeWidth={1.2} />
          ))}
        </g>
        {spray.length > 0 && (
          <g data-testid="splash" fill="#eef5ec" opacity="0.85">
            {spray.map((d, i) => (
              <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r.toFixed(2)} />
            ))}
          </g>
        )}

        {/* phao */}
        {(phase === 'sinking' || phase === 'waiting') && fp.visible && (
          <g data-testid="float-2d" data-alert={nibbling ? 'on' : 'off'} transform={`rotate(${((fp.tilt * 180) / Math.PI).toFixed(1)} ${l.floatX} ${floatWaterY.toFixed(1)})`}>
            {Array.from({ length: 6 }, (_, i) => (
              <rect key={i} x={l.floatX - 1.6 * k} y={floatTop.y + i * 4 * k} width={3.2 * k} height={3.6 * k} fill={i % 2 ? '#f2c94c' : '#c2410c'} />
            ))}
            <ellipse cx={l.floatX} cy={floatTop.y + 30 * k} rx={3.4 * k} ry={8 * k} fill="#e8dcc3" opacity="0.75" />
          </g>
        )}

        {/* cá được nhấc lên: vẫn chỉ là bóng, kết quả mới nói cá gì */}
        {lifted && (
          <g data-testid="lifted-fish" transform={`translate(${pt(lifted.x, lifted.y)}) rotate(${(-90 + lifted.sway * 12).toFixed(1)}) scale(${(k * (bite ? shadowSize(bite) : 1)).toFixed(3)})`}>
            <path d={FISH_PATH} fill="#141c17" />
          </g>
        )}

        {/* bờ, ghế, người câu */}
        <g
          data-testid="angler"
          data-straining={pose.straining ? 'yes' : 'no'}
          data-rod={pose.snapped ? 'snapped' : 'ok'}
          data-lean={Math.round(pose.lean)}
        >
          <path d={`M0 ${(waterY - 34 * k).toFixed(1)} L${pt(l.bankX - 46 * k, waterY - 34 * k)}`} stroke="#5f7d3e" strokeWidth={5 * k} />
          {/* ghế */}
          <path d={`M${pt(hip.x - 14 * k, hip.y + 4 * k)} L${pt(hip.x + 12 * k, hip.y + 4 * k)} M${pt(hip.x - 10 * k, hip.y + 4 * k)} L${pt(hip.x + 8 * k, waterY - 34 * k)} M${pt(hip.x + 8 * k, hip.y + 4 * k)} L${pt(hip.x - 10 * k, waterY - 34 * k)}`} stroke="#3b2f22" strokeWidth={3 * k} strokeLinecap="round" />
          {/* chân */}
          <path d={`M${pt(hip.x, hip.y)} L${pt(hip.x + 26 * k, hip.y - 2 * k)} L${pt(hip.x + 30 * k, waterY - 36 * k)}`} stroke="#2f3a44" strokeWidth={8 * k} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* thân, đầu, nón lá */}
          <line x1={hip.x} y1={hip.y} x2={shoulder.x} y2={shoulder.y} stroke="#4f7a8c" strokeWidth={14 * k} strokeLinecap="round" />
          <circle cx={head.x} cy={head.y} r={8 * k} fill="#d9a77c" />
          <path d={`M${pt(head.x - 17 * k, head.y - 2 * k)} L${pt(head.x - Math.sin(lean) * 14 * k, head.y - 16 * k)} L${pt(head.x + 17 * k, head.y - 2 * k)} Z`} fill="#e9d9a6" stroke="#b9a46c" strokeWidth={1} />
          {/* tay cầm cần: gồng thì tay duỗi căng về sau */}
          <path d={`M${pt(shoulder.x, shoulder.y + 2 * k)} L${pt((shoulder.x + grip.x) / 2 + 2 * k, (shoulder.y + grip.y) / 2 + (pose.straining ? 2 : 8) * k)} L${pt(grip.x, grip.y)}`} stroke="#4f7a8c" strokeWidth={6 * k} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx={grip.x} cy={grip.y} r={3.6 * k} fill="#d9a77c" />
          {/* cần */}
          {pose.snapped ? (
            <g data-testid="rod-snapped">
              <line x1={grip.x} y1={grip.y} x2={joint.x} y2={joint.y} stroke="#7a5a2e" strokeWidth={3.2 * k} strokeLinecap="round" />
              <line x1={joint.x} y1={joint.y} x2={brokenTip.x} y2={brokenTip.y} stroke="#8a6a3a" strokeWidth={2 * k} strokeLinecap="round" />
              <path d={`M${pt(joint.x, joint.y)} l${pt(5 * k, -6 * k)} M${pt(joint.x, joint.y)} l${pt(7 * k, -1 * k)} M${pt(joint.x, joint.y)} l${pt(2 * k, -8 * k)}`} stroke="#f3e2b5" strokeWidth={1.4 * k} />
            </g>
          ) : (
            <path d={`M${pt(grip.x, grip.y)} Q${pt(ctrl.x, ctrl.y)} ${pt(tip.x, tip.y)}`} stroke="#7a5a2e" strokeWidth={2.6 * k} strokeLinecap="round" fill="none" />
          )}
        </g>

        {mood.dim > 0 && <rect x="0" y="0" width={w} height={h} fill="#0b1620" opacity={mood.dim} />}

        {/* dây câu */}
        <path d={linePath} stroke="#e8f25a" strokeWidth={Math.max(1, 1.1 * k)} fill="none" strokeLinecap="round" opacity={lineState === 'slack' ? 0.75 : 0.95} />
        {lineState === 'rig' && phase !== 'result' && (
          <g>
            <rect x={rigHang.x - 1.5 * k} y={rigHang.y - 22 * k} width={3 * k} height={14 * k} fill="#c2410c" />
            <circle cx={rigHang.x} cy={rigHang.y + 2 * k} r={3.4 * k} fill="#e8b86b" />
          </g>
        )}
      </svg>
    </div>
  )
}
