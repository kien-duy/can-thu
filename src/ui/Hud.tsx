import { useState } from 'react'
import { actionFor, announceFor } from '../game/hints'
import { chumLevel, levelOf } from '../game/player'
import { kg, useGame } from '../game/store'
import { chargePower } from '../sim/game'
import { clockLabel, dayPart, localHour, WEATHER_LABEL } from '../sim/world'
import { primaryDown, primaryUp, steer } from './controls'
import { xu } from './Sheet'
import { shiftRemaining } from './Shift'

export function StatusCard() {
  const minute = useGame((s) => Math.floor(s.now / 1000)) // vẽ lại mỗi giây là đủ
  const session = useGame((s) => s.session)
  const loc = useGame((s) => s.cfg.location)
  const keepnet = useGame((s) => s.keepnet)
  const coins = useGame((s) => s.player.coins)
  const xp = useGame((s) => s.player.xp)
  const repoKind = useGame((s) => s.repo.kind)
  const t = minute * 1000
  const w = session?.weather
  const totalG = keepnet.reduce((a, c) => a + c.weightG, 0)
  return (
    <section className="card status" aria-label="Trạng thái">
      <div className="status__time">
        <strong>{clockLabel(t)}</strong> <span>{dayPart(localHour(t))}</span>
      </div>
      <div>
        {loc.nameVi}
        {session?.plannedEndAt && <span className="muted"> · ca còn <span data-testid="shift-left">{shiftRemaining(session.plannedEndAt, t)}</span></span>}
        {session && !session.plannedEndAt && <span className="muted"> · câu tự do</span>}
      </div>
      {w && (
        <div className="muted">
          {WEATHER_LABEL[w.kind]} · {w.tempC}°C · nước {w.waterTempC}°C
        </div>
      )}
      <div className="muted">
        Rọng: {keepnet.length} con · {kg(totalG)} kg
      </div>
      <div className="muted">
        <span data-testid="hud-coins">{xu(coins)}</span> · Cấp {levelOf(xp)}
      </div>
      <div className="muted small">{repoKind === 'server' ? 'Đang lưu lên server' : 'Đang lưu trên máy này'}</div>
    </section>
  )
}

export function ActionBar() {
  const game = useGame((s) => s.game)
  const now = useGame((s) => s.now)
  const hasBait = useGame((s) => !!s.player.bowl && s.player.bowl.uses > 0)
  const sounded = useGame((s) => s.player.depthCm[s.cfg.location.id] !== undefined)
  const bowl = useGame((s) => s.player.bowl)
  const fightStyle = useGame((s) => s.prefs.fightStyle)
  const chum = useGame((s) => chumLevel(s.player, s.cfg.location.id, Math.floor(s.now / 5000) * 5000))
  const canChum = game.phase === 'ready' || game.phase === 'result'
  const a = actionFor(game, now, { hasBait, sounded, fightStyle })
  const power = game.phase === 'charging' && game.chargeStartedAt ? chargePower(game.chargeStartedAt, now) : 0
  return (
    <section className="action">
      {/* lời gợi ý đổi liên tục trong trận kéo nên không đặt trong vùng aria-live; trình đọc màn hình nghe Announcer */}
      <p className={`action__hint${a.urgent ? ' is-urgent' : ''}`} data-testid="hint">
        {a.hint}
      </p>
      <Announcer />
      {(game.phase === 'fighting' || game.phase === 'landable') && game.fight && <FightBars />}
      <button
        type="button"
        className={`action__button${a.urgent ? ' is-urgent' : ''}`}
        data-testid="primary"
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId) // giữ nút dù ngón tay trượt ra ngoài
          } catch {
            /* thiết bị không hỗ trợ */
          }
          primaryDown()
        }}
        onPointerUp={primaryUp}
        onPointerCancel={primaryUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {a.label}
        {game.phase === 'charging' && <span className="action__power" style={{ width: `${power * 100}%` }} />}
      </button>
      <div className="action__secondary">
        <span className="muted small">
          {bowl ? `Mồi: ${bowl.label}, còn ${bowl.uses} lần móc` : 'Hết mồi'} · Ổ: {chum < 0.05 ? 'chưa có' : `${Math.round(chum * 100)}%`} ·{' '}
          <span data-testid="controls-hint">{CONTROLS_HINT[fightStyle]}</span>
        </span>
        {canChum && (
          <button type="button" className="ghost ghost--small" data-testid="chum" onClick={() => useGame.getState().throwChum()} title="Ném một nắm mồi xả (tốn 3 lần móc) để gom cá về ổ">
            Xả mồi mở ổ
          </button>
        )}
      </div>
    </section>
  )
}

/** Vùng đọc ẩn: chỉ nhận lời khi có chuyện (đổi hướng cá, cá đuối, dây sắp đứt, kết quả), xem announceFor. */
function Announcer() {
  const game = useGame((s) => s.game)
  const now = useGame((s) => s.now)
  const hasBait = useGame((s) => !!s.player.bowl && s.player.bowl.uses > 0)
  const sounded = useGame((s) => s.player.depthCm[s.cfg.location.id] !== undefined)
  const fightStyle = useGame((s) => s.prefs.fightStyle)
  const [said, setSaid] = useState('')
  const next = announceFor(game, now, { hasBait, sounded, fightStyle }, said)
  if (next !== said) setSaid(next) // nhớ lời vừa đọc (cập nhật trong lúc vẽ, không cần effect)
  return (
    <p className="sr-only" aria-live="polite" data-testid="announce">
      {next}
    </p>
  )
}

/** Gợi ý điều khiển theo kiểu kéo cá đang chọn (Cài đặt). Phím vẫn dùng được ở cả hai kiểu. */
const CONTROLS_HINT = {
  keys: 'Space · Dòng: A/D · Vớt: E',
  drag: 'Kéo cá: giữ chuột hoặc ngón tay để ghì, rê ngang để dòng · phím vẫn dùng được',
} as const

function FightBars() {
  const f = useGame((s) => s.game.fight)!
  return (
    <div className="fight" data-testid="fight">
      <Meter label="Sức cá" value={f.stamina} tone="leaf" />
      <Meter label="Độ căng dây" value={f.tension} tone={f.tension > 0.8 ? 'alert' : 'primary'} />
      <div className="muted small">Cách bờ {f.distanceM.toFixed(1)} m</div>
      <div className="fight__steer">
        <SteerButton side={-1} active={f.rodSide === -1} />
        <span className="fight__dir small" data-testid="fish-dir">
          {FISH_DIR_LABEL[f.fishDir]}
        </span>
        <SteerButton side={1} active={f.rodSide === 1} />
      </div>
    </div>
  )
}

const FISH_DIR_LABEL = { [-1]: 'Cá chạy sang trái ←', 0: 'Cá đang ghì thẳng', 1: 'Cá chạy sang phải →' } as const

/** Nút dòng cá: giữ để nghiêng cần, nhả ra cần về thẳng. */
function SteerButton({ side, active }: { side: -1 | 1; active: boolean }) {
  const release = () => steer(0)
  return (
    <button
      type="button"
      className={`ghost fight__steer-btn${active ? ' is-active' : ''}`}
      data-testid={side < 0 ? 'steer-left' : 'steer-right'}
      aria-label={side < 0 ? 'Dòng cá sang trái' : 'Dòng cá sang phải'}
      aria-pressed={active}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* thiết bị không hỗ trợ */
        }
        steer(side)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {side < 0 ? '◀' : '▶'}
    </button>
  )
}

function Meter({ label, value, tone }: { label: string; value: number; tone: 'leaf' | 'primary' | 'alert' }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <span className="meter__track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
        <span className={`meter__fill meter__fill--${tone}`} style={{ width: `${Math.min(1, value) * 100}%` }} />
      </span>
    </div>
  )
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const err = useGame((s) => s.repoError)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === 'error' ? ' toast--error' : ''}`}>
          {t.text}
        </div>
      ))}
      {err && <div className="toast toast--error">{err}</div>}
    </div>
  )
}

export function NotifyPrompt() {
  const show = useGame((s) => s.notifyPrompt)
  if (!show) return null
  const { enableNotifications, dismissNotifyPrompt } = useGame.getState()
  return (
    <div className="card notify-prompt" role="dialog" aria-label="Bật thông báo">
      <p>
        <strong>Con cá đầu tiên rồi!</strong> Muốn máy báo khi cá rỉa mồi lúc bạn đang ở cửa sổ khác không?
      </p>
      <div className="row">
        <button type="button" className="primary" onClick={() => void enableNotifications()}>
          Bật thông báo
        </button>
        <button type="button" className="ghost" onClick={dismissNotifyPrompt}>
          Để sau
        </button>
      </div>
    </div>
  )
}
