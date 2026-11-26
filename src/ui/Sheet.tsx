import type { ReactNode } from 'react'
import { useGame } from '../game/store'

/** Bảng trượt từ phải: dùng chung cho sổ tay, khay chuẩn bị, cửa hàng, tài khoản. */
export function Sheet({ title, aside, children, onClose }: { title: string; aside?: ReactNode; children: ReactNode; onClose?: () => void }) {
  const close = onClose ?? (() => useGame.getState().openPanel(null))
  return (
    <div className="sheet-backdrop" onClick={close}>
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>{title}</h2>
          {aside && <span className="muted">{aside}</span>}
          <button type="button" className="ghost" onClick={close} aria-label={`Đóng ${title.toLowerCase()}`}>
            Đóng
          </button>
        </header>
        {children}
      </aside>
    </div>
  )
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className={value === o.id ? 'is-active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const xu = (n: number) => `${n.toLocaleString('vi-VN')} xu`
