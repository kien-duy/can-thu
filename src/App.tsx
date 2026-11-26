import { Component, lazy, type ReactNode, Suspense, useEffect } from 'react'
import { useGame } from './game/store'
import { waitStatus } from './sim/game'
import { useGameLoop, useKeyboard } from './ui/controls'
import { FloatView } from './ui/FloatView'
import { Handbook } from './ui/Handbook'
import { ActionBar, StatusCard, Toasts } from './ui/Hud'

const Scene3D = lazy(() => import('./ui/Scene3D').then((m) => ({ default: m.Scene3D })))

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <p className="scene-fallback muted">Máy này không vẽ được 3D. Vẫn câu bình thường bằng khung phao.</p> : this.props.children
  }
}

export function App() {
  const view = useGame((s) => s.view)
  const phase = useGame((s) => s.game.phase)
  const wait = useGame((s) => waitStatus(s.game, s.now))
  const tension = useGame((s) => s.game.fight?.tension ?? 0)
  const repoKind = useGame((s) => s.repo.kind)
  useGameLoop()
  useKeyboard()
  useEffect(() => {
    void useGame.getState().boot()
  }, [])

  return (
    <div className={`app app--${view}`} data-testid="app" data-phase={phase} data-wait={wait ?? ''} data-tension={tension.toFixed(2)} data-repo={repoKind}>
      {view === '3d' && (
        <SceneBoundary>
          <Suspense fallback={<div className="scene" />}>
            <Scene3D />
          </Suspense>
        </SceneBoundary>
      )}
      <header className="topbar">
        <StatusCard />
        <nav className="topbar__actions">
          <button type="button" className="ghost" onClick={() => useGame.getState().toggleHandbook()} data-testid="open-handbook">
            Sổ tay
          </button>
          <button type="button" className="ghost" onClick={() => useGame.getState().setView(view === '3d' ? 'office' : '3d')}>
            {view === '3d' ? 'Chế độ văn phòng' : 'Cảnh 3D'}
          </button>
        </nav>
      </header>
      <div className={`float-slot float-slot--${view}`}>
        <FloatView size={view === 'office' ? 'full' : 'inset'} />
      </div>
      <ActionBar />
      <Toasts />
      <Handbook />
    </div>
  )
}
