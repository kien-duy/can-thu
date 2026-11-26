import { LOCATIONS, SPECIES } from '../content'
import { kg, useGame } from '../game/store'
import { dateTimeLabel as date } from '../sim/world'

export function Handbook() {
  const open = useGame((s) => s.handbookOpen)
  const entries = useGame((s) => s.handbook)
  const close = () => useGame.getState().toggleHandbook(false)
  if (!open) return null
  const caught = new Map(entries.map((e) => [e.speciesId, e]))
  return (
    <div className="sheet-backdrop" onClick={close}>
      <aside className="sheet" role="dialog" aria-modal="true" aria-label="Sổ tay" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>Sổ tay</h2>
          <span className="muted">
            {caught.size}/{SPECIES.length} loài
          </span>
          <button type="button" className="ghost" onClick={close} aria-label="Đóng sổ tay">
            Đóng
          </button>
        </header>
        <ul className="species-list">
          {SPECIES.map((s) => {
            const e = caught.get(s.id)
            const where = LOCATIONS.filter((l) => l.species.some((x) => x.id === s.id)).map((l) => l.nameVi)
            return (
              <li key={s.id} className={`species${e ? '' : ' species--unknown'}`} data-testid={`species-${s.id}`} data-caught={e ? 'yes' : 'no'}>
                <h3>
                  {e ? s.nameVi : 'Chưa câu được'} {e && <em className="muted">{s.scientific}</em>}
                </h3>
                {e ? (
                  <>
                    <dl className="stats">
                      <div>
                        <dt>Đã câu</dt>
                        <dd>{e.totalCaught} con</dd>
                      </div>
                      <div>
                        <dt>Kỷ lục</dt>
                        <dd>{kg(e.recordWeightG)} kg</dd>
                      </div>
                      <div>
                        <dt>Lần đầu</dt>
                        <dd>{date(e.firstCaughtAt)}</dd>
                      </div>
                      <div>
                        <dt>Hay câu lúc</dt>
                        <dd>{e.favouriteHour} giờ</dd>
                      </div>
                    </dl>
                    <p>{s.summary}</p>
                    <ul className="facts">
                      {s.facts.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p>
                      <strong>Tầng nước:</strong> {s.depth}
                    </p>
                    <p>
                      <strong>Cách ăn phao:</strong> {s.floatTell}
                    </p>
                  </>
                ) : (
                  <p className="muted">Có ở: {where.join(', ')}. Câu được một con để mở trang này.</p>
                )}
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}
