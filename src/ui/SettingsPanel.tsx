import { type Prefs, useGame } from '../game/store'
import { Sheet } from './Sheet'

function Choice<K extends keyof Prefs>({ label, k, options }: { label: string; k: K; options: { v: Prefs[K]; label: string; note?: string }[] }) {
  const value = useGame((s) => s.prefs[k])
  const set = useGame((s) => s.setPrefs)
  return (
    <fieldset className="fieldset">
      <legend>{label}</legend>
      <div className="row">
        {options.map((o) => (
          <button key={String(o.v)} type="button" className={`choice choice--inline${value === o.v ? ' is-active' : ''}`} aria-pressed={value === o.v} onClick={() => set({ [k]: o.v } as Partial<Prefs>)}>
            <strong>{o.label}</strong>
            {o.note && <span className="muted small">{o.note}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function SettingsPanel() {
  return (
    <Sheet title="Cài đặt" aside="Riêng máy này">
      <div className="stack">
        <Choice
          label="Chất lượng đồ hoạ 3D"
          k="quality"
          options={[
            { v: 'low', label: 'Thấp', note: 'Máy văn phòng, đỡ nóng máy' },
            { v: 'medium', label: 'Vừa' },
            { v: 'high', label: 'Cao', note: 'Bóng đổ, nhiều cây cỏ' },
          ]}
        />
        <Choice
          label="Cỡ khung phao"
          k="floatSize"
          options={[
            { v: 's', label: 'Nhỏ' },
            { v: 'm', label: 'Vừa' },
            { v: 'l', label: 'To' },
          ]}
        />
        <Choice
          label="Âm thanh báo"
          k="sound"
          options={[
            { v: true, label: 'Bật' },
            { v: false, label: 'Tắt', note: 'Vẫn đổi tiêu đề tab và thông báo' },
          ]}
        />
        <Choice
          label="Nhìn xuyên nước (chế độ học)"
          k="xray"
          options={[
            { v: false, label: 'Tắt' },
            { v: true, label: 'Bật', note: 'Thấy chì, mồi, bóng cá trong khung phao' },
          ]}
        />
      </div>
    </Sheet>
  )
}
