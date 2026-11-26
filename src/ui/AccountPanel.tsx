import { useState } from 'react'
import { levelOf, xpForLevel } from '../game/player'
import { useGame } from '../game/store'
import { Sheet, xu } from './Sheet'

export function AccountPanel() {
  const account = useGame((s) => s.account)
  const repo = useGame((s) => s.repo)
  const player = useGame((s) => s.player)
  const toast = useGame((s) => s.toast)
  const [email, setEmail] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const level = levelOf(player.xp)
  const run = async (f: () => Promise<void>, okText: string) => {
    try {
      await f()
      toast(okText)
      await useGame.getState().refreshAccount()
    } catch (e) {
      toast(String((e as Error).message ?? e), 'error')
    }
  }
  return (
    <Sheet title="Tài khoản">
      <div className="stack">
        <section className="card-row">
          <div>
            <div className="muted small">Cấp</div>
            <strong>{level}</strong> <span className="muted small">({player.xp}/{xpForLevel(level + 1)} xp)</span>
          </div>
          <div>
            <div className="muted small">Xu</div>
            <strong>{xu(player.coins)}</strong>
          </div>
        </section>
        {account?.mode === 'local' && (
          <p>
            Bản này chưa nối server: tiến độ và sổ tay nằm trên trình duyệt của máy này. Xoá dữ liệu trình duyệt là mất. (Chủ game bật Supabase là tự chuyển sang lưu server.)
          </p>
        )}
        {account?.mode === 'guest' && (
          <>
            <p>Bạn đang chơi bằng tài khoản khách. Liên kết để giữ sổ tay khi đổi máy hay xoá trình duyệt. Mọi thứ đã câu được giữ nguyên.</p>
            <button type="button" className="primary" onClick={() => void run(() => repo.linkGoogle(), 'Đang chuyển sang Google…')}>
              Liên kết Google
            </button>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                void run(() => repo.linkEmail(email), `Đã gửi thư xác nhận tới ${email}. Bấm link trong thư là xong.`)
              }}
            >
              <label className="sr-only" htmlFor="link-email">
                Email
              </label>
              <input id="link-email" type="email" required placeholder="email@cuaban.vn" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="ghost">
                Liên kết email
              </button>
            </form>
          </>
        )}
        {account?.mode === 'linked' && (
          <p>
            Đã liên kết{account.email ? ` với ${account.email}` : ''} ({account.providers.join(', ')}). Đăng nhập cùng tài khoản ở máy khác là thấy cùng sổ tay.
          </p>
        )}
        <h3>Xoá dữ liệu</h3>
        {!confirmDelete ? (
          <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
            {account?.mode === 'local' ? 'Xoá dữ liệu trên máy này' : 'Xoá tài khoản'}
          </button>
        ) : (
          <div className="stack">
            <p className="warn">Xoá hết tiến độ, sổ tay, nhật ký câu. Không khôi phục được.</p>
            <div className="row">
              <button
                type="button"
                className="danger"
                onClick={() =>
                  void run(async () => {
                    await repo.deleteAccount()
                    location.reload()
                  }, 'Đã xoá.')
                }
              >
                Xoá vĩnh viễn
              </button>
              <button type="button" className="ghost" onClick={() => setConfirmDelete(false)}>
                Thôi
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
