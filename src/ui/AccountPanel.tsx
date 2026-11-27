import { useEffect, useState } from 'react'
import { levelOf, xpForLevel } from '../game/player'
import { useGame } from '../game/store'
import { Sheet, Tabs, xu } from './Sheet'

export function AccountPanel() {
  const account = useGame((s) => s.account)
  const repo = useGame((s) => s.repo)
  const player = useGame((s) => s.player)
  const toast = useGame((s) => s.toast)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'register' | 'login'>(() => useGame.getState().accountTab)
  const [google, setGoogle] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    repo
      .authConfig()
      .then((c) => setGoogle(c.google))
      .catch(() => setGoogle(false))
  }, [repo])
  const level = levelOf(player.xp)
  const run = async (f: () => Promise<void>, okText: string, refresh = true) => {
    try {
      await f()
      toast(okText)
      if (refresh) await useGame.getState().refreshAccount()
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
          <p>Bản này đang lưu trên trình duyệt của máy này (?store=local). Xoá dữ liệu trình duyệt là mất.</p>
        )}
        {account?.mode === 'guest' && (
          <>
            <p>Bạn đang chơi bằng tài khoản khách. Tạo tài khoản để giữ sổ tay khi đổi máy hay xoá trình duyệt. Mọi thứ đã câu được giữ nguyên.</p>
            {google && (
              <button type="button" className="primary" onClick={() => void run(() => repo.linkGoogle(), 'Đang chuyển sang Google…', false)}>
                Liên kết Google
              </button>
            )}
            <Tabs
              value={mode}
              onChange={setMode}
              options={[
                { id: 'register', label: 'Tạo tài khoản' },
                { id: 'login', label: 'Đã có tài khoản' },
              ]}
            />
            <form
              className="stack"
              data-testid={`${mode}-form`}
              onSubmit={(e) => {
                e.preventDefault()
                if (mode === 'register') void run(() => repo.register(email, password), 'Đã tạo tài khoản. Đăng nhập ở máy khác là thấy cùng sổ tay.')
                else
                  void run(async () => {
                    await repo.login(email, password)
                    location.reload()
                  }, 'Đã đăng nhập.')
              }}
            >
              {mode === 'login' && <p className="warn small">Đăng nhập tài khoản khác thì tiến độ khách đang chơi trên máy này sẽ bị bỏ.</p>}
              <label>
                <span className="muted small">Email</span>
                <input type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                <span className="muted small">Mật khẩu (ít nhất 8 ký tự)</span>
                <input
                  type="password"
                  name="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button type="submit" className={google ? 'ghost' : 'primary'}>
                {mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
              </button>
            </form>
          </>
        )}
        {account?.mode === 'linked' && (
          <>
            <p data-testid="linked">
              Đã liên kết{account.email ? ` với ${account.email}` : ''} ({account.providers.join(', ')}). Đăng nhập cùng tài khoản ở máy khác là thấy cùng sổ tay.
            </p>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                void run(async () => {
                  await repo.logout()
                  location.reload()
                }, 'Đã đăng xuất.')
              }
            >
              Đăng xuất
            </button>
          </>
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
