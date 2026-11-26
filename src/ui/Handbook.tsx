import { useState } from 'react'
import { LOCATIONS, locationOf, SPECIES, speciesOf } from '../content'
import { kg, useGame } from '../game/store'
import { dateTimeLabel as date, WEATHER_LABEL } from '../sim/world'
import { Sheet, Tabs } from './Sheet'

type Tab = 'species' | 'journal'

export function Handbook() {
  const entries = useGame((s) => s.handbook)
  const [tab, setTab] = useState<Tab>('species')
  const caught = new Map(entries.map((e) => [e.speciesId, e]))
  return (
    <Sheet title="Sổ tay" aside={`${caught.size}/${SPECIES.length} loài`}>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'species', label: 'Các loài' },
          { id: 'journal', label: 'Nhật ký câu' },
        ]}
      />
      {tab === 'species' ? <SpeciesList caught={caught} /> : <Journal />}
    </Sheet>
  )
}

function SpeciesList({ caught }: { caught: Map<string, ReturnType<typeof useGame.getState>['handbook'][number]> }) {
  return (
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
                  <div>
                    <dt>Câu được ở</dt>
                    <dd>{e.locations.map((l) => locationOf(l).nameVi).join(', ')}</dd>
                  </div>
                </dl>
                <p>{s.summary}</p>
                <ul className="facts">
                  {s.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p>
                  <strong>Tầng nước:</strong> {s.depth} <strong>Nước hợp:</strong> {s.waterTempC[0]}–{s.waterTempC[1]}°C
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
  )
}

function Journal() {
  const journal = useGame((s) => s.journal)
  if (journal.length === 0) return <p className="muted">Chưa có con nào. Con cá đầu tiên sẽ được ghi ở đây, kèm giờ, trời, mồi.</p>
  return (
    <table className="table" data-testid="journal">
      <thead>
        <tr>
          <th>Lúc</th>
          <th>Cá</th>
          <th>Điều kiện</th>
        </tr>
      </thead>
      <tbody>
        {journal.map((c) => (
          <tr key={c.id}>
            <td>{date(c.caughtAt)}</td>
            <td>
              <strong>{speciesOf(c.speciesId).nameVi}</strong> {kg(c.weightG)} kg
              <div className="muted small">{locationOf(c.locationId).nameVi}</div>
            </td>
            <td className="small">
              {WEATHER_LABEL[c.weatherKind]}
              {c.waterTempC !== undefined && `, nước ${c.waterTempC}°C`}
              {typeof c.bait.label === 'string' && <div className="muted">Mồi: {c.bait.label}</div>}
              {c.depthCm !== undefined && <div className="muted">Phao: {c.depthCm} cm</div>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
