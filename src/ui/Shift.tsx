import { useState } from 'react'
import { LOCATIONS, locationOf, speciesOf } from '../content'
import { canFishAt, levelOf, salePrice } from '../game/player'
import { HOUR_MS, kg, useGame } from '../game/store'
import { WEATHER_LABEL, weatherFor } from '../sim/world'
import { xu } from './Sheet'

const KIND_LABEL = { fee_pond: 'Hồ dịch vụ', river: 'Sông', mountain_lake: 'Hồ núi' } as const

/** Chọn chỗ câu (S03 làm lại): mỗi địa điểm một thẻ, vé cho hồ dịch vụ, câu tự do cho sông, hồ núi. */
export function ShiftPicker() {
  const player = useGame((s) => s.player)
  const now = useGame((s) => Math.floor(s.now / 60_000) * 60_000)
  const start = useGame((s) => s.startShift)
  const [pick, setPick] = useState(LOCATIONS[0]!.id)
  const level = levelOf(player.xp)
  const loc = locationOf(pick)
  const w = weatherFor(now, loc)
  const open = canFishAt(player, loc)
  const cheapest = Math.min(...loc.tickets.map((t) => t.priceXu))
  return (
    <div className="overlay">
      <section className="dialog dialog--wide" aria-label="Chọn chỗ câu">
        <h2>Hôm nay câu ở đâu?</h2>
        <p className="muted">
          Bạn có <strong data-testid="coins">{xu(player.coins)}</strong> · Cấp {level}
        </p>
        <div className="loc-row" role="radiogroup" aria-label="Địa điểm">
          {LOCATIONS.map((l) => {
            const locked = !canFishAt(player, l)
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={pick === l.id}
                className={`loc-card loc-card--${l.theme}${pick === l.id ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
                data-testid={`loc-${l.id}`}
                onClick={() => setPick(l.id)}
              >
                <span className="loc-card__kind">{KIND_LABEL[l.kind]}</span>
                <strong>{l.nameVi}</strong>
                <span className="small">{locked ? `Mở ở cấp ${l.minLevel}` : l.tickets.length ? `Vé từ ${xu(Math.min(...l.tickets.map((t) => t.priceXu)))}` : 'Câu tự do, không mất vé'}</span>
              </button>
            )
          })}
        </div>
        <p>{loc.summary}</p>
        <p className="muted">
          Hôm nay ở đây: {WEATHER_LABEL[w.kind]}, {w.tempC}°C, nước {w.waterTempC}°C · {loc.species.length} loài
        </p>
        {!open ? (
          <p className="warn">Lên cấp {loc.minLevel} để mở chỗ này (bạn đang cấp {level}).</p>
        ) : loc.tickets.length > 0 ? (
          <>
            <div className="ticket-row">
              {loc.tickets.map((t) => (
                <button key={t.hours} type="button" className="ticket" data-testid={`ticket-${t.hours}`} disabled={player.coins < t.priceXu} onClick={() => void start(loc.id, t.hours)}>
                  <strong>{t.hours} tiếng</strong>
                  <span>{xu(t.priceXu)}</span>
                </button>
              ))}
            </div>
            <p className="muted small">Ca tính theo giờ thật. Hết giờ thì cân cá: bán theo kg hoặc thả lại hồ.</p>
            {player.coins < cheapest && (
              <div className="stack">
                <p className="warn">Không đủ xu mua vé.</p>
                <button type="button" className="ghost" data-testid="ticket-credit" onClick={() => void start(loc.id, 1, true)}>
                  Chủ hồ cho ghi sổ một ca 1 tiếng
                </button>
              </div>
            )}
          </>
        ) : (
          <button type="button" className="primary" data-testid="go-free" onClick={() => void start(loc.id, null)}>
            Ra {loc.nameVi}
          </button>
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
  const factor = locationOf(session.locationId).saleFactor
  const paid = session.kind === 'paid_shift'
  const total = keepnet.reduce((a, c) => a + c.weightG, 0)
  const value = keepnet.reduce((a, c) => a + salePrice(c.speciesId, c.weightG, factor), 0)
  const net = value - session.ticketCoins
  return (
    <div className="overlay">
      <section className="dialog" aria-label="Hết ca">
        <h2>{paid ? 'Hết ca' : 'Về thôi'}</h2>
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
                  <td>{xu(salePrice(c.speciesId, c.weightG, factor))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {keepnet.length > 0 ? (
          paid ? (
            <p>
              Bán được {xu(value)}, vé {xu(session.ticketCoins)}: <strong className={net >= 0 ? 'good' : 'warn'}>{net >= 0 ? `lãi ${xu(net)}` : `lỗ ${xu(-net)}`}</strong>
            </p>
          ) : (
            <p>Lái cá ở chợ trả {xu(value)} (bằng {Math.round(factor * 100)}% giá hồ dịch vụ).</p>
          )
        ) : (
          <p className="muted">Hôm nay cá không ăn. Thử bài mồi khác, xả mồi mở ổ, dò đáy lại, hoặc câu vào sáng sớm hay chiều tà.</p>
        )}
        {keepnet.length === 0 ? (
          <button type="button" className="primary" data-testid="sell" onClick={() => void finish('sell')}>
            Về thôi, mai câu tiếp
          </button>
        ) : (
          <div className="row">
            <button type="button" className="primary" data-testid="sell" onClick={() => void finish('sell')}>
              {paid ? 'Bán cho chủ hồ' : 'Bán cho lái cá'}
            </button>
            <button type="button" className="ghost" onClick={() => void finish('release')}>
              Thả lại (cộng kinh nghiệm)
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
