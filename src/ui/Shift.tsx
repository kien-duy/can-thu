import { speciesOf } from '../content'
import { levelOf, salePrice } from '../game/player'
import { HOUR_MS, kg, useGame } from '../game/store'
import { WEATHER_LABEL, weatherFor } from '../sim/world'
import { xu } from './Sheet'

/** Màn mua vé vào ca (S03 rút gọn): chỉ một hồ, ba loại vé. */
export function ShiftPicker() {
  const loc = useGame((s) => s.cfg.location)
  const player = useGame((s) => s.player)
  const now = useGame((s) => Math.floor(s.now / 60_000) * 60_000)
  const start = useGame((s) => s.startShift)
  const w = weatherFor(now, loc)
  return (
    <div className="overlay">
      <section className="dialog" aria-label="Vào ca câu">
        <h2>{loc.nameVi}</h2>
        <p className="muted">{loc.summary}</p>
        <p>
          Hôm nay: {WEATHER_LABEL[w.kind]}, {w.tempC}°C, nước {w.waterTempC}°C · Bạn có <strong data-testid="coins">{xu(player.coins)}</strong> · Cấp {levelOf(player.xp)}
        </p>
        <div className="ticket-row">
          {loc.tickets.map((t) => (
            <button key={t.hours} type="button" className="ticket" data-testid={`ticket-${t.hours}`} disabled={player.coins < t.priceXu} onClick={() => void start(t.hours)}>
              <strong>{t.hours} tiếng</strong>
              <span>{xu(t.priceXu)}</span>
            </button>
          ))}
        </div>
        <p className="muted small">Ca tính theo giờ thật. Hết giờ thì cân cá: bán theo kg hoặc thả lại hồ.</p>
        {player.coins < Math.min(...loc.tickets.map((t) => t.priceXu)) && (
          <div className="stack">
            <p className="warn">Không đủ xu mua vé.</p>
            <button type="button" className="ghost" data-testid="ticket-credit" onClick={() => void start(1, true)}>
              Chủ hồ cho ghi sổ một ca 1 tiếng
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

/** Tổng kết cuối ca (S24): rọng có gì, bán được bao nhiêu, lãi lỗ so với vé. */
export function ShiftSummary() {
  const keepnet = useGame((s) => s.keepnet)
  const session = useGame((s) => s.session)!
  const finish = useGame((s) => s.finishShift)
  const total = keepnet.reduce((a, c) => a + c.weightG, 0)
  const value = keepnet.reduce((a, c) => a + salePrice(c.speciesId, c.weightG), 0)
  const net = value - session.ticketCoins
  return (
    <div className="overlay">
      <section className="dialog" aria-label="Hết ca">
        <h2>Hết ca</h2>
        <p>
          Rọng có <strong>{keepnet.length} con</strong>, {kg(total)} kg.{keepnet.length > 0 && ' Bán hay thả?'}
        </p>
        {keepnet.length > 0 && (
          <table className="table">
            <tbody>
              {keepnet.map((c) => (
                <tr key={c.id}>
                  <td>{speciesOf(c.speciesId).nameVi}</td>
                  <td>{kg(c.weightG)} kg</td>
                  <td>{xu(salePrice(c.speciesId, c.weightG))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {keepnet.length > 0 ? (
          <p>
            Bán được {xu(value)}, vé {xu(session.ticketCoins)}: <strong className={net >= 0 ? 'good' : 'warn'}>{net >= 0 ? `lãi ${xu(net)}` : `lỗ ${xu(-net)}`}</strong>
          </p>
        ) : (
          <p className="muted">Hôm nay cá không ăn. Thử bài mồi khác, dò đáy lại, hoặc câu vào sáng sớm hay chiều tà.</p>
        )}
        {keepnet.length === 0 ? (
          <button type="button" className="primary" data-testid="sell" onClick={() => void finish('sell')}>
            Về thôi, mai câu tiếp
          </button>
        ) : (
          <div className="row">
            <button type="button" className="primary" data-testid="sell" onClick={() => void finish('sell')}>
              Bán cho chủ hồ
            </button>
            <button type="button" className="ghost" onClick={() => void finish('release')}>
              Thả lại hồ (cộng kinh nghiệm)
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export function shiftRemaining(plannedEndAt: number | undefined, now: number): string {
  if (!plannedEndAt) return ''
  const ms = Math.max(0, plannedEndAt - now)
  const h = Math.floor(ms / HOUR_MS)
  const m = Math.floor((ms % HOUR_MS) / (HOUR_MS / 60))
  return `${h}:${String(m).padStart(2, '0')}`
}
