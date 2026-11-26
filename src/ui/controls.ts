import { useEffect } from 'react'
import { useGame } from '../game/store'
import { localHour } from '../sim/world'

/** Một nút hành động chính, cùng nghĩa cho chuột, chạm và phím Space. */
export function primaryDown() {
  const { game, dispatch } = useGame.getState()
  const t = Date.now()
  switch (game.phase) {
    case 'ready':
      return dispatch({ type: 'charge', t })
    case 'sinking':
    case 'waiting':
      return dispatch({ type: 'strike', t })
    case 'fighting':
      return dispatch({ type: 'reel', t, on: true })
    case 'landable':
      return dispatch({ type: 'net', t })
    case 'result':
      return dispatch({ type: 'reset', t })
  }
}

export function primaryUp() {
  const { game, dispatch } = useGame.getState()
  const t = Date.now()
  if (game.phase === 'charging') dispatch({ type: 'release', t, hour: localHour(t) })
  if (game.phase === 'fighting' || game.phase === 'landable') dispatch({ type: 'reel', t, on: false })
}

/** Dòng cá: nghiêng cần sang trái (-1), phải (1) hoặc về thẳng (0). Ngoài trận kéo thì không có tác dụng. */
export function steer(side: -1 | 0 | 1) {
  useGame.getState().dispatch({ type: 'steer', t: Date.now(), side })
}

const STEER_KEYS: Record<string, -1 | 1> = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 }

export function useKeyboard() {
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    // các phím dòng đang giữ, phím bấm sau cùng thắng; nhả ra thì quay về phím còn giữ, hoặc về thẳng
    const held: (-1 | 1)[] = []
    const steerHeld = () => steer(held[held.length - 1] ?? 0)
    const down = (e: KeyboardEvent) => {
      if (isTyping(e) || e.repeat) return
      const side = STEER_KEYS[e.code]
      if (side) {
        const phase = useGame.getState().game.phase
        if (phase === 'fighting' || phase === 'landable') e.preventDefault()
        held.push(side)
        steerHeld()
      }
      if (e.code === 'Space') {
        e.preventDefault()
        primaryDown()
      }
      if (e.code === 'KeyE' && useGame.getState().game.phase === 'landable') primaryDown()
      if (e.code === 'Escape') useGame.getState().openPanel(null)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        primaryUp()
      }
      const side = STEER_KEYS[e.code]
      if (side) {
        const i = held.lastIndexOf(side)
        if (i >= 0) held.splice(i, 1)
        steerHeld()
      }
    }
    // rời cửa sổ giữa chừng thì không nhận được keyup: coi như buông hết phím dòng
    const blur = () => {
      if (held.length === 0) return
      held.length = 0
      steer(0)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
}

/** Vòng lặp: requestAnimationFrame khi tab đang hiện; interval thưa khi ẩn để pha vẫn tiến (cá bỏ đi, v.v.). */
export function useGameLoop() {
  useEffect(() => {
    let raf = 0
    const frame = () => {
      useGame.getState().tick(Date.now())
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const slow = setInterval(() => {
      if (document.hidden) useGame.getState().tick(Date.now(), true)
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(slow)
    }
  }, [])
}
