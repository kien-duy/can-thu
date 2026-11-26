import { floatPose, type FloatPose } from '../game/pose'
import { useGame } from '../game/store'
import { waitStatus } from '../sim/game'
import { baitOffsetCm } from '../sim/setup'
import { setupFor } from '../game/player'

/** Cận cảnh phao bằng SVG: khung phao trong chế độ 3D, cả màn hình ở chế độ văn phòng, và kho nhịp phao. */
const SEGMENTS = 10
const SEG = 22 // px mỗi nấc
const ABOVE = 2 // nấc câu: 2 nấc nổi trên mặt nước
const COLOURS = ['#C2410C', '#F2C94C', '#C2410C', '#1E2A2F']

export interface XRay {
  /** mồi cách đáy bao nhiêu cm (âm = treo lửng) */
  baitOffsetCm: number
  /** có cá đang quanh mồi */
  fishNear: boolean
}

export function FloatSvg({ pose, label, alert, xray, width = 120, height = 320 }: { pose: FloatPose; label?: string; alert?: boolean; xray?: XRay; width?: number; height?: number }) {
  const waterY = 150
  const topY = waterY - (ABOVE - pose.sink) * SEG
  const floatBottom = topY + SEGMENTS * SEG + 70
  // dưới nước: đáy cách chân phao một khoảng cố định trên hình; mồi lệch theo baitOffsetCm (1 cm = 1,4 px, có kẹp)
  const bottomY = height - 14
  const baitY = Math.min(bottomY, Math.max(floatBottom + 20, bottomY + (xray ? -Math.max(-40, Math.min(40, -xray.baitOffsetCm)) * 1.4 : 0)))
  const cx = width / 2
  return (
    <figure className="float-view" data-alert={alert ? 'on' : 'off'} aria-label="Cận cảnh phao">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="fv-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--water)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--water)" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={waterY} fill="var(--sky, #dfe9ee)" />
        <rect x="0" y={waterY} width={width} height={height - waterY} fill="url(#fv-water)" />
        {xray && <rect x="0" y={bottomY} width={width} height={height - bottomY} fill="#5b4630" opacity="0.8" />}
        {pose.visible ? (
          <g transform={`rotate(${(pose.tilt * 180) / Math.PI} ${cx} ${waterY})`}>
            <line x1={cx} x2={cx} y1={0} y2={topY} stroke="var(--text-muted)" strokeWidth="0.8" />
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <rect key={i} x={cx - 4} y={topY + i * SEG} width={8} height={SEG - 2} rx={2} fill={COLOURS[i % COLOURS.length]} opacity={topY + i * SEG > waterY ? 0.55 : 1} />
            ))}
            <rect x={cx - 6} y={topY + SEGMENTS * SEG} width={12} height={70} rx={6} fill="#E8DCC3" opacity={0.6} />
            {xray && (
              <g>
                <line x1={cx} x2={cx} y1={floatBottom} y2={baitY - 18} stroke="#ECE6DA" strokeWidth="0.8" />
                <rect x={cx - 3} y={baitY - 24} width={6} height={6} fill="#8a8f96" />
                <line x1={cx} x2={cx - 10} y1={baitY - 18} y2={baitY} stroke="#ECE6DA" strokeWidth="0.6" />
                <line x1={cx} x2={cx + 10} y1={baitY - 18} y2={baitY - 6} stroke="#ECE6DA" strokeWidth="0.6" />
                <circle cx={cx - 10} cy={baitY} r={3.5} fill="#E8B86B" />
                <circle cx={cx + 10} cy={baitY - 6} r={3.5} fill="#E8B86B" />
              </g>
            )}
          </g>
        ) : (
          <text x={cx} y={waterY - 20} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {label}
          </text>
        )}
        {xray && pose.visible && xray.fishNear && <ellipse className="fish-shadow" cx={cx + 22} cy={baitY - 8} rx={22} ry={7} fill="#0f1a1f" opacity="0.55" />}
        <line x1="0" x2={width} y1={waterY} y2={waterY} stroke="var(--on-water)" strokeOpacity="0.6" />
        {[1, 2].map((n) => (
          <text key={n} x="8" y={waterY - (n - 0.5) * SEG + 4} fontSize="10" fill="var(--text-muted)">
            {n}
          </text>
        ))}
      </svg>
    </figure>
  )
}

export function FloatView({ size = 'inset' }: { size?: 'inset' | 'full' }) {
  const game = useGame((s) => s.game)
  const now = useGame((s) => s.now)
  const prefs = useGame((s) => s.prefs)
  const player = useGame((s) => s.player)
  const loc = useGame((s) => s.cfg.location)
  const pose = floatPose(game, now)
  const w = waitStatus(game, now)
  const xray: XRay | undefined = prefs.xray ? { baitOffsetCm: baitOffsetCm(loc, setupFor(player, loc, 27)), fishNear: w === 'nibbling' || w === 'window' } : undefined
  return (
    <div className={`float-frame float-frame--${size} float-frame--${prefs.floatSize}`}>
      <FloatSvg
        pose={pose}
        alert={w === 'nibbling' || w === 'window'}
        xray={xray}
        label={game.phase === 'fighting' || game.phase === 'landable' ? 'Cá đang kéo' : 'Chưa quăng'}
      />
    </div>
  )
}
