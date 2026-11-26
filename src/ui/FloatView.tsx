import { useGame } from '../game/store'
import { floatPose } from '../game/pose'
import { waitStatus } from '../sim/game'

/** Cận cảnh phao bằng SVG: dùng làm khung phao trong chế độ 3D và làm cả màn hình ở chế độ văn phòng. */
const SEGMENTS = 10
const SEG = 22 // px mỗi nấc
const ABOVE = 2 // nấc câu: 2 nấc nổi trên mặt nước

export function FloatView({ size = 'inset' }: { size?: 'inset' | 'full' }) {
  const game = useGame((s) => s.game)
  const now = useGame((s) => s.now)
  const pose = floatPose(game, now)
  const w = waitStatus(game, now)
  const width = 120
  const height = 320
  const waterY = 150
  const topY = waterY - (ABOVE - pose.sink) * SEG
  const colours = ['#C2410C', '#F2C94C', '#C2410C', '#1E2A2F']

  return (
    <figure className={`float-view float-view--${size}`} data-alert={w === 'nibbling' || w === 'window' ? 'on' : 'off'} aria-label="Cận cảnh phao">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
        <defs>
          <linearGradient id="fv-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--water)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--water)" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={waterY} fill="var(--sky, #dfe9ee)" />
        {pose.visible ? (
          <g transform={`rotate(${(pose.tilt * 180) / Math.PI} ${width / 2} ${waterY})`}>
            <line x1={width / 2} x2={width / 2} y1={0} y2={topY} stroke="var(--text-muted)" strokeWidth="0.8" />
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <rect key={i} x={width / 2 - 4} y={topY + i * SEG} width={8} height={SEG - 2} rx={2} fill={colours[i % colours.length]} />
            ))}
            <rect x={width / 2 - 6} y={topY + SEGMENTS * SEG} width={12} height={70} rx={6} fill="#E8DCC3" />
          </g>
        ) : (
          <text x={width / 2} y={waterY - 20} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {game.phase === 'fighting' || game.phase === 'landable' ? 'Cá đang kéo' : 'Chưa quăng'}
          </text>
        )}
        <rect x="0" y={waterY} width={width} height={height - waterY} fill="url(#fv-water)" />
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
