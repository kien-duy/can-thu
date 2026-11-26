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

export function useKeyboard() {
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    const down = (e: KeyboardEvent) => {
      if (isTyping(e) || e.repeat) return
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
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
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
