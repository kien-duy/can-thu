import { actionFor } from '../game/hints'
import { kg, useGame } from '../game/store'
import { chargePower } from '../sim/game'
import { clockLabel, dayPart, localHour, WEATHER_LABEL } from '../sim/world'
import { primaryDown, primaryUp } from './controls'

export function StatusCard() {
  const now = useGame((s) => Math.floor(s.now / 30_000)) // vẽ lại mỗi 30 s là đủ
  const session = useGame((s) => s.session)
  const loc = useGame((s) => s.cfg.location)
  const keepnet = useGame((s) => s.keepnet)
  const repoKind = useGame((s) => s.repo.kind)
  const t = now * 30_000
  const w = session?.weather
  const totalG = keepnet.reduce((a, c) => a + c.weightG, 0)
  return (
    <section className="card status" aria-label="Trạng thái">
      <div className="status__time">
        <strong>{clockLabel(t)}</strong> <span>{dayPart(localHour(t))}</span>
      </div>
      <div>{loc.nameVi}</div>
      {w && (
        <div className="muted">
          {WEATHER_LABEL[w.kind]} · {w.tempC}°C · nước {w.waterTempC}°C
        </div>
      )}
      <div className="muted">
        Rọng: {keepnet.length} con · {kg(totalG)} kg
      </div>
      <div className="muted small">{repoKind === 'supabase' ? 'Đang lưu lên server' : 'Đang lưu trên máy này'}</div>
    </section>
  )
}

export function ActionBar() {
  const game = useGame((s) => s.game)
  const now = useGame((s) => s.now)
  const a = actionFor(game, now)
  const power = game.phase === 'charging' && game.chargeStartedAt ? chargePower(game.chargeStartedAt, now) : 0
  return (
    <section className="action" aria-live="polite">
      <p className={`action__hint${a.urgent ? ' is-urgent' : ''}`} data-testid="hint">
        {a.hint}
      </p>
      {(game.phase === 'fighting' || game.phase === 'landable') && game.fight && <FightBars />}
      <button
        type="button"
        className={`action__button${a.urgent ? ' is-urgent' : ''}`}
        data-testid="primary"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          primaryDown()
        }}
        onPointerUp={primaryUp}
        onPointerCancel={primaryUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {a.label}
        {game.phase === 'charging' && <span className="action__power" style={{ width: `${power * 100}%` }} />}
      </button>
      <p className="muted small">Phím tắt: Space · Vớt: E</p>
    </section>
  )
}

function FightBars() {
  const f = useGame((s) => s.game.fight)!
  return (
    <div className="fight" data-testid="fight">
      <Meter label="Sức cá" value={f.stamina} tone="leaf" />
      <Meter label="Độ căng dây" value={f.tension} tone={f.tension > 0.8 ? 'alert' : 'primary'} />
      <div className="muted small">Cách bờ {f.distanceM.toFixed(1)} m</div>
    </div>
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
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
      {err && <div className="toast toast--error">{err}</div>}
    </div>
  )
}
