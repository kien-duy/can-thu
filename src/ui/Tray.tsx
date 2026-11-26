import { useState } from 'react'
import { AXES, AXIS_LABEL, BAIT, floatOf, GEAR, ingredientOf, lineOf, rodOf, speciesOf } from '../content'
import * as P from '../game/player'
import { useGame } from '../game/store'
import { baitMatch, baitOffsetCm, mixAxes, signalScale, UNSOUNDED_SHORT_CM } from '../sim/setup'
import { Sheet, Tabs } from './Sheet'

type Tab = 'rig' | 'bait' | 'gear'

/** Khay chuẩn bị: cân phao, trộn mồi, đổi đồ. Một chỗ cho mọi việc trước khi quăng. */
export function Tray() {
  const [tab, setTab] = useState<Tab>('rig')
  return (
    <Sheet title="Chuẩn bị">
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'rig', label: 'Cân phao' },
          { id: 'bait', label: 'Mồi' },
          { id: 'gear', label: 'Đồ nghề' },
        ]}
      />
      {tab === 'rig' && <RigTab />}
      {tab === 'bait' && <BaitTab />}
      {tab === 'gear' && <GearTab />}
    </Sheet>
  )
}

function RigTab() {
  const player = useGame((s) => s.player)
  const loc = useGame((s) => s.cfg.location)
  const water = useGame((s) => s.session?.weather.waterTempC ?? 27)
  const apply = useGame((s) => s.apply)
  const setup = P.setupFor(player, loc, water)
  const depth = player.depthCm[loc.id]
  const off = baitOffsetCm(loc, setup)
  const scale = signalScale(loc, setup)
  const where =
    depth === undefined
      ? `Chưa dò đáy: phao đang để mặc định, mồi treo cách đáy khoảng ${UNSOUNDED_SHORT_CM} cm mà bạn không biết.`
      : off < -6
        ? `Mồi treo cách đáy ${-off} cm (câu lửng).`
        : off > 6
          ? `Mồi nằm đáy, thẻo chùng ${off} cm: phao sẽ báo nhỏ (lụt).`
          : 'Mồi vừa chạm đáy.'
  return (
    <div className="stack">
      <p className="muted">Cân phao quyết định mồi nằm ở đâu và phao báo to hay nhỏ. Đổi kiểu cân, phao hay dây thì nên dò đáy lại.</p>
      <div className="card-row">
        <div>
          <div className="muted small">Độ sâu phao</div>
          <strong data-testid="depth">{depth === undefined ? 'chưa dò' : `${depth} cm`}</strong>
        </div>
        <div>
          <div className="muted small">Độ báo của phao</div>
          <strong>{Math.round(scale * 100)}%</strong>
        </div>
      </div>
      <p>{where}</p>
      <div className="row">
        <button type="button" className="primary" data-testid="sound-bottom" onClick={() => apply((p) => P.soundBottom(p, loc))}>
          Dò đáy
        </button>
        <button type="button" className="ghost" onClick={() => apply((p) => P.nudgeDepth(p, loc, -5))} disabled={depth === undefined}>
          Kéo phao lên 5 cm
        </button>
        <button type="button" className="ghost" onClick={() => apply((p) => P.nudgeDepth(p, loc, 5))} disabled={depth === undefined}>
          Đẩy phao xuống 5 cm
        </button>
      </div>
      <h3>Kiểu cân</h3>
      <ul className="choice-list">
        {GEAR.rigs.map((r) => (
          <li key={r.id}>
            <button type="button" className={`choice${player.equipped.rig === r.id ? ' is-active' : ''}`} onClick={() => apply((p) => P.setRig(p, loc, r.id))} aria-pressed={player.equipped.rig === r.id}>
              <strong>{r.nameVi}</strong> <span className="tag">{r.tag}</span>
              <span className="muted">{r.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Axes({ axes }: { axes: Record<(typeof AXES)[number], number> }) {
  return (
    <div className="axes">
      {AXES.map((a) => (
        <div key={a} className="meter">
          <span>{AXIS_LABEL[a]}</span>
          <span className="meter__track">
            <span className="meter__fill meter__fill--primary" style={{ width: `${axes[a] * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

function BaitTab() {
  const player = useGame((s) => s.player)
  const apply = useGame((s) => s.apply)
  const toast = useGame((s) => s.toast)
  const [scoops, setScoops] = useState<Record<string, number>>({})
  const total = Object.values(scoops).reduce((a, b) => a + b, 0)
  const preview = total > 0 ? mixAxes(scoops) : null
  const loc = useGame((s) => s.cfg.location)
  const best = preview
    ? loc.species
        .map((x) => ({ s: speciesOf(x.id), m: baitMatch(speciesOf(x.id), preview) }))
        .sort((a, b) => b.m - a.m)
        .slice(0, 3)
    : []
  const mix = (sc: Record<string, number>, label: string) => {
    if (apply((p) => P.mixBowl(p, sc, label))) {
      toast(`Đã trộn chậu mới: ${label}.`)
      setScoops({})
    }
  }
  return (
    <div className="stack">
      <section className="card-row">
        <div>
          <div className="muted small">Chậu đang dùng</div>
          <strong data-testid="bowl">{player.bowl ? `${player.bowl.label} · còn ${player.bowl.uses} lần móc` : 'Hết mồi'}</strong>
        </div>
      </section>
      {player.bowl && <Axes axes={player.bowl.axes} />}
      <h3>Bài gợi ý</h3>
      <ul className="choice-list">
        {BAIT.recipes.map((r) => {
          const missing = Object.entries(r.scoops).filter(([id, n]) => (player.stock[id] ?? 0) < n)
          return (
            <li key={r.id}>
              <button type="button" className="choice" data-testid={`recipe-${r.id}`} onClick={() => mix(r.scoops, r.nameVi)}>
                <strong>{r.nameVi}</strong>
                <span className="muted">
                  {Object.entries(r.scoops)
                    .map(([id, n]) => `${ingredientOf(id).nameVi} ${n}`)
                    .join(' · ')}
                </span>
                {missing.length > 0 && <span className="warn small">Thiếu: {missing.map(([id]) => ingredientOf(id).nameVi).join(', ')}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      <h3>Tự trộn</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Nguyên liệu</th>
            <th>Còn</th>
            <th>Cho vào</th>
          </tr>
        </thead>
        <tbody>
          {BAIT.ingredients.map((i) => (
            <tr key={i.id}>
              <td>
                <strong>{i.nameVi}</strong>
                <div className="muted small">{i.note}</div>
              </td>
              <td>{player.stock[i.id] ?? 0}</td>
              <td>
                <div className="stepper">
                  <button type="button" aria-label={`Bớt ${i.nameVi}`} onClick={() => setScoops((s) => ({ ...s, [i.id]: Math.max(0, (s[i.id] ?? 0) - 1) }))}>
                    −
                  </button>
                  <span>{scoops[i.id] ?? 0}</span>
                  <button type="button" aria-label={`Thêm ${i.nameVi}`} onClick={() => setScoops((s) => ({ ...s, [i.id]: Math.min(player.stock[i.id] ?? 0, (s[i.id] ?? 0) + 1) }))}>
                    +
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview && (
        <>
          <Axes axes={preview} />
          <p className="muted">Hợp nhất với: {best.map((b) => `${b.s.nameVi} (${Math.round(b.m * 100)}%)`).join(', ')}</p>
        </>
      )}
      <button type="button" className="primary" disabled={total < 3} onClick={() => mix(scoops, 'Mồi tự trộn')}>
        Trộn {total} muỗng
      </button>
    </div>
  )
}

function GearTab() {
  const player = useGame((s) => s.player)
  const apply = useGame((s) => s.apply)
  const rod = rodOf(player.equipped.rod)
  const line = lineOf(player.equipped.line)
  const fl = floatOf(player.equipped.float)
  const groups = [
    { kind: 'rods' as const, title: 'Cần', items: GEAR.rods, cur: rod.id },
    { kind: 'lines' as const, title: 'Dây', items: GEAR.lines, cur: line.id },
    { kind: 'floats' as const, title: 'Phao', items: GEAR.floats, cur: fl.id },
  ]
  return (
    <div className="stack">
      <p className="muted">
        Sức chịu của bộ cần và dây: <strong>{Math.round(rod.strength * line.strength * 100)}%</strong> so với đồ khởi đầu. Mua thêm ở Cửa hàng.
      </p>
      {groups.map((g) => (
        <section key={g.kind}>
          <h3>{g.title}</h3>
          <ul className="choice-list">
            {g.items
              .filter((i) => player.owned[g.kind].includes(i.id))
              .map((i) => (
                <li key={i.id}>
                  <button type="button" className={`choice${g.cur === i.id ? ' is-active' : ''}`} aria-pressed={g.cur === i.id} onClick={() => apply((p) => P.equip(p, g.kind, i.id))}>
                    <strong>{i.nameVi}</strong>
                    <span className="muted">{i.note}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
