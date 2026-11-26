import { Component, lazy, type ReactNode, Suspense, useEffect } from 'react'
import { useGame } from './game/store'
import { waitStatus } from './sim/game'
import { AccountPanel } from './ui/AccountPanel'
import { useGameLoop, useKeyboard } from './ui/controls'
import { FloatView } from './ui/FloatView'
import { Handbook } from './ui/Handbook'
import { ActionBar, NotifyPrompt, StatusCard, Toasts } from './ui/Hud'
import { claimableCount, QuestsPanel } from './ui/QuestsPanel'
import { SettingsPanel } from './ui/SettingsPanel'
import { ShiftPicker, ShiftSummary } from './ui/Shift'
import { Shop } from './ui/Shop'
import { Tray } from './ui/Tray'

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
  const panel = useGame((s) => s.panel)
  const booted = useGame((s) => s.booted)
  const inShift = useGame((s) => !!s.session)
  const shiftOver = useGame((s) => s.shiftOver)
  const paidShift = useGame((s) => s.session?.kind === 'paid_shift')
  const wide = useGame((s) => s.prefs.wide)
  const claimable = useGame(claimableCount)
  useGameLoop()
  useKeyboard()
  useEffect(() => {
    void useGame.getState().boot()
  }, [])
  const open = useGame.getState().openPanel

  return (
    <div
      className={`app app--${view}`}
      data-testid="app"
      data-phase={phase}
      data-wait={wait ?? ''}
      data-tension={tension.toFixed(2)}
      data-repo={repoKind}
      data-shift={!booted ? 'loading' : shiftOver ? 'over' : inShift ? 'on' : 'none'}
    >
      {view === '3d' && (
        <SceneBoundary>
          <Suspense fallback={<div className="scene" />}>
            <Scene3D />
          </Suspense>
        </SceneBoundary>
      )}
      <header className="topbar">
        <StatusCard />
        <nav className="topbar__actions" aria-label="Menu">
          <button type="button" className="ghost" onClick={() => open('tray')} data-testid="open-tray">
            Chuẩn bị
          </button>
          <button type="button" className="ghost" onClick={() => open('handbook')} data-testid="open-handbook">
            Sổ tay
          </button>
          <button type="button" className="ghost" onClick={() => open('quests')} data-testid="open-quests">
            Nhiệm vụ{claimable > 0 && <span className="badge" aria-label={`${claimable} nhiệm vụ nhận thưởng được`}>{claimable}</span>}
          </button>
          <button type="button" className="ghost" onClick={() => open('shop')} data-testid="open-shop">
            Cửa hàng
          </button>
          <details className="more">
            <summary className="ghost">Thêm</summary>
            <div className="more__menu card" onClick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')}>
              <button type="button" className="ghost" onClick={() => useGame.getState().setView(view === '3d' ? 'office' : '3d')}>
                {view === '3d' ? 'Chế độ văn phòng' : 'Cảnh 3D'}
              </button>
              {view === '3d' && (
                <button type="button" className="ghost" onClick={() => useGame.getState().setPrefs({ wide: !wide })}>
                  {wide ? 'Góc ngồi câu' : 'Góc rộng toàn cảnh'}
                </button>
              )}
              {inShift && (
                <button type="button" className="ghost" data-testid="end-shift" onClick={() => useGame.getState().endShiftEarly()}>
                  {paidShift ? 'Kết thúc ca sớm' : 'Về (cân cá)'}
                </button>
              )}
              <button type="button" className="ghost" onClick={() => open('settings')}>
                Cài đặt
              </button>
              <button type="button" className="ghost" onClick={() => open('account')}>
                Tài khoản
              </button>
            </div>
          </details>
        </nav>
      </header>
      <div className={`float-slot float-slot--${view}`}>
        <FloatView size={view === 'office' ? 'full' : 'inset'} />
      </div>
      <ActionBar />
      <NotifyPrompt />
      <Toasts />
      {booted && !inShift && <ShiftPicker />}
      {shiftOver && <ShiftSummary />}
      {panel === 'handbook' && <Handbook />}
      {panel === 'tray' && <Tray />}
      {panel === 'shop' && <Shop />}
      {panel === 'account' && <AccountPanel />}
      {panel === 'quests' && <QuestsPanel />}
      {panel === 'settings' && <SettingsPanel />}
    </div>
  )
}
