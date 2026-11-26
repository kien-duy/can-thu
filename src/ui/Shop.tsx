import { useState } from 'react'
import { BAIT, GEAR } from '../content'
import * as P from '../game/player'
import { useGame } from '../game/store'
import { Sheet, Tabs, xu } from './Sheet'

type Tab = 'gear' | 'bait'

export function Shop() {
  const [tab, setTab] = useState<Tab>('gear')
  const player = useGame((s) => s.player)
  const apply = useGame((s) => s.apply)
  const toast = useGame((s) => s.toast)
  const buy = (op: (p: P.PlayerState) => P.Op, what: string) => {
    if (apply(op)) toast(`Đã mua ${what}.`)
  }
  const groups = [
    { kind: 'rods' as const, title: 'Cần', items: GEAR.rods },
    { kind: 'lines' as const, title: 'Dây', items: GEAR.lines },
    { kind: 'floats' as const, title: 'Phao', items: GEAR.floats },
  ]
  return (
    <Sheet title="Cửa hàng" aside={<span data-testid="shop-coins">{xu(player.coins)}</span>}>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'gear', label: 'Đồ nghề' },
          { id: 'bait', label: 'Nguyên liệu mồi' },
        ]}
      />
      {tab === 'gear' &&
        groups.map((g) => (
          <section key={g.kind}>
            <h3>{g.title}</h3>
            <ul className="choice-list">
              {g.items.map((i) => {
                const owned = player.owned[g.kind].includes(i.id)
                return (
                  <li key={i.id} className="shop-item">
                    <div>
                      <strong>{i.nameVi}</strong>
                      <div className="muted small">{i.note}</div>
                    </div>
                    {owned ? (
                      <span className="muted">Đã có</span>
                    ) : (
                      <button type="button" className="primary" disabled={player.coins < i.priceXu} onClick={() => buy((p) => P.buyGear(p, g.kind, i.id), i.nameVi)}>
                        {xu(i.priceXu)}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      {tab === 'bait' && (
        <ul className="choice-list">
          {BAIT.ingredients.map((i) => (
            <li key={i.id} className="shop-item">
              <div>
                <strong>{i.nameVi}</strong> <span className="muted small">· còn {player.stock[i.id] ?? 0} muỗng</span>
                <div className="muted small">{i.note}</div>
              </div>
              <button type="button" className="primary" disabled={player.coins < i.packXu} onClick={() => buy((p) => P.buyIngredient(p, i.id), `${i.packScoops} muỗng ${i.nameVi}`)}>
                +{i.packScoops} · {xu(i.packXu)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
