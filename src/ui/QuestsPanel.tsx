import { canClaim } from '../game/quests'
import { dayKey, useGame } from '../game/store'
import { Sheet, xu } from './Sheet'

export function QuestsPanel() {
  const player = useGame((s) => s.player)
  const quests = useGame.getState().questsNow()
  const claim = useGame((s) => s.claimQuest)
  const today = useGame((s) => dayKey(s.now))
  const st = player.quests.date === today ? player.quests : { date: today, progress: {}, claimed: [] }
  return (
    <Sheet title="Nhiệm vụ" aside="Làm mới lúc 0 giờ">
      <ul className="choice-list">
        {quests.map((q) => {
          const done = Math.min(q.target, st.progress[q.id] ?? 0)
          const claimed = st.claimed.includes(q.id)
          return (
            <li key={q.id} className="shop-item" data-testid={`quest-${q.templateId}`}>
              <div>
                <strong>{q.text}</strong>
                <div className="muted small">
                  {done}/{q.target} · thưởng {xu(q.rewardXu)}, {q.rewardXp} xp
                </div>
              </div>
              {claimed ? (
                <span className="good">Đã nhận</span>
              ) : (
                <button type="button" className="primary" disabled={!canClaim(st, q)} onClick={() => claim(q)}>
                  Nhận
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

/** Selector: số nhiệm vụ hôm nay đã xong mà chưa nhận thưởng (để hiện chấm trên nút). */
export function claimableCount(s: ReturnType<typeof useGame.getState>): number {
  if (s.player.quests.date !== dayKey(s.now)) return 0
  return s.questsNow().filter((q) => canClaim(s.player.quests, q)).length
}
