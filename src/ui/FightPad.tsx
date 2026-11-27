import { type PointerEvent, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { primaryDown, primaryUp, steer } from './controls'
import { aimAt, DRAG_DEAD_ZONE, sideFromAim } from './dragSteer'

/**
 * Mặt kéo cá cho kiểu "rê" (Cài đặt → Kiểu kéo cá): phủ cả màn hình trong trận kéo, dưới thanh trên và thanh hành động.
 * Giữ chuột/ngón tay = ghì, nhấc lên = tay mềm; vị trí ngang = góc cần (gửi cùng sự kiện `steer` như phím A/D).
 * Chuột thì rê không cần giữ cũng dòng được; ngón tay nhấc lên thì cần giữ nguyên góc cuối.
 */
export function FightPad() {
  const style = useGame((s) => s.prefs.fightStyle)
  const phase = useGame((s) => s.game.phase)
  const rodSide = useGame((s) => s.game.fight?.rodSide ?? 0)
  const [aim, setAim] = useState(0)
  /** ngón (hoặc chuột) chạm sau cùng; chỉ nhấc ngón này mới là thả tay */
  const pressed = useRef<number | null>(null)
  // chỉ gửi khi rê sang vùng khác, để chuột đứng yên không giành quyền với phím A/D
  const sent = useRef<-1 | 0 | 1 | null>(null)
  if (style !== 'drag' || (phase !== 'fighting' && phase !== 'landable')) return null

  const aimTo = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const a = aimAt(e.clientX, r.left, r.width)
    setAim(a)
    const side = sideFromAim(a)
    if (side !== sent.current) {
      sent.current = side
      steer(side)
    }
  }
  const lift = (e: PointerEvent<HTMLDivElement>) => {
    if (pressed.current !== e.pointerId) return
    pressed.current = null
    primaryUp()
  }
  const zone = `${(1 - DRAG_DEAD_ZONE) * 50}%`

  return (
    <div
      className="fight-pad"
      data-testid="fight-pad"
      data-rod-side={rodSide}
      aria-hidden="true"
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* thiết bị không hỗ trợ */
        }
        pressed.current = e.pointerId
        aimTo(e)
        primaryDown()
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' || pressed.current === e.pointerId) aimTo(e)
      }}
      onPointerUp={lift}
      onPointerCancel={lift}
      onLostPointerCapture={lift}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={`fight-pad__zone fight-pad__zone--left${rodSide === -1 ? ' is-active' : ''}`} style={{ width: zone }} />
      <span className={`fight-pad__zone fight-pad__zone--right${rodSide === 1 ? ' is-active' : ''}`} style={{ width: zone }} />
      <span className="fight-pad__aim" style={{ left: `${(aim + 1) * 50}%` }} />
    </div>
  )
}
