import { create } from 'zustand'
import { Alerts } from '../alerts/alerts'
import { LOCATIONS, SPECIES, speciesOf } from '../content'
import {
  type Account,
  type CatchRecord,
  createRepository,
  type GameRepository,
  type HandbookEntry,
  OutboxRepository,
  type SessionRecord,
} from '../data'
import { type GameConfig, type GameEvent, type GameState, initialState, reduce } from '../sim/game'
import { localHour, weatherFor } from '../sim/world'
import * as P from './player'

const params = new URLSearchParams(location.search)
/** `?fast=1`: thu nhỏ thời gian (để test, để thử nhanh): 1 "giờ" vé = 60 giây. `?seed=n`: lượt câu tái hiện được. */
const FAST = params.get('fast') === '1'
const SEED = Number(params.get('seed') ?? Math.floor(Math.random() * 2 ** 31))
const HOUR_MS = FAST ? 60_000 : 3_600_000

export type ViewMode = '3d' | 'office'
export type Panel = 'handbook' | 'tray' | 'shop' | 'account' | null

export interface Toast {
  id: number
  text: string
  tone?: 'ok' | 'error'
}

interface Store {
  cfg: GameConfig
  game: GameState
  now: number
  view: ViewMode
  repo: GameRepository
  repoError?: string
  booted: boolean
  player: P.PlayerState
  playerVersion: number
  session?: SessionRecord
  keepnet: CatchRecord[]
  /** ca đã hết giờ (hoặc người chơi kết thúc sớm): đang hiện bảng tổng kết */
  shiftOver: boolean
  handbook: HandbookEntry[]
  journal: CatchRecord[]
  panel: Panel
  account?: Account
  notifyPrompt: boolean
  toasts: Toast[]
  alerts: Alerts

  boot(): Promise<void>
  dispatch(e: GameEvent): void
  tick(t: number, paused?: boolean): void
  setView(v: ViewMode): void
  openPanel(p: Panel): void
  toast(text: string, tone?: Toast['tone']): void
  /** áp một thao tác lên tiến độ; lỗi thì báo bằng toast. Trả về true nếu thành công. */
  apply(op: (p: P.PlayerState) => P.Op | P.PlayerState): boolean
  /** free: chủ hồ cho ghi sổ (khi hết xu), để người chơi không bị kẹt */
  startShift(hours: number, free?: boolean): Promise<void>
  endShiftEarly(): void
  finishShift(choice: 'sell' | 'release'): Promise<void>
  enableNotifications(): Promise<void>
  dismissNotifyPrompt(): void
  refreshAccount(): Promise<void>
  refreshJournal(): Promise<void>
}

const location0 = LOCATIONS[0]!
let toastId = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useGame = create<Store>((set, get) => ({
  cfg: { location: location0, species: SPECIES, seed: SEED, timeScale: FAST ? 0.08 : 1 },
  game: initialState(Date.now()),
  now: Date.now(),
  view: (readPref('can-thu:view') as ViewMode | null) ?? '3d',
  repo: createRepository(),
  booted: false,
  player: P.newPlayer(),
  playerVersion: 0,
  keepnet: [],
  shiftOver: false,
  handbook: [],
  journal: [],
  panel: null,
  notifyPrompt: false,
  toasts: [],
  alerts: new Alerts(() => location0.nameVi),

  async boot() {
    const { repo } = get()
    try {
      await repo.init()
      const stored = await repo.loadPlayer()
      if (stored) set({ player: P.parsePlayer({ ...(stored.state as object), coins: stored.coins, xp: stored.xp }), playerVersion: stored.version })
      const open = await repo.openSession()
      if (open) {
        const recent = await repo.recentCatches(200)
        set({ session: open, keepnet: recent.filter((c) => c.sessionId === open.id && c.fate === 'kept').reverse() })
      }
      set({ handbook: await repo.handbook(), repoError: undefined })
    } catch (e) {
      set({ repoError: `Chưa nối được server, đang lưu tạm trên máy: ${errText(e)}` })
    }
    set({ booted: true })
    void get().refreshAccount()
    if (repo instanceof OutboxRepository) {
      addEventListener('online', () => void repo.flush().then(syncRepoError))
      setInterval(() => void repo.flush().then(syncRepoError), 30_000)
    }
  },

  dispatch(e) {
    const { cfg, game, alerts, player, session } = get()
    if (e.type === 'charge' || e.type === 'strike' || e.type === 'reel') alerts.unlockAudio()
    if (e.type === 'charge' && (!session || get().shiftOver)) return
    const ev: GameEvent = e.type === 'release' ? { ...e, setup: P.setupFor(player, cfg.location, session?.weather.waterTempC ?? 27) } : e
    const next = reduce(cfg, game, ev)
    if (next === game) return
    set({ game: next, now: e.t })
    onTransition(game, next)
  },

  tick(t, paused) {
    const { cfg, game, session, shiftOver } = get()
    const next = reduce(cfg, game, { type: 'tick', t, paused })
    set({ game: next, now: t })
    if (next.phase !== game.phase) onTransition(game, next)
    // hết giờ ca: đợi xong trận kéo đang dở rồi mới tổng kết
    const busy = next.phase === 'fighting' || next.phase === 'landable'
    if (session?.plannedEndAt && t >= session.plannedEndAt && !shiftOver && !busy) {
      set({ shiftOver: true })
      get().alerts.clear()
    }
  },

  setView(v) {
    writePref('can-thu:view', v)
    set({ view: v })
  },

  openPanel(p) {
    set({ panel: p })
    if (p === 'account') void get().refreshAccount()
    if (p === 'handbook') void get().refreshJournal()
  },

  toast(text, tone = 'ok') {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500)
  },

  apply(op) {
    const r = op(get().player)
    if ('ok' in r) {
      if (!r.ok) {
        get().toast(r.error, 'error')
        return false
      }
      set({ player: r.state })
    } else {
      set({ player: r })
    }
    scheduleSave()
    return true
  },

  async startShift(hours, free = false) {
    const { player, cfg, repo } = get()
    const r: P.Op = free ? { ok: true, state: player } : P.buyTicket(player, cfg.location, hours)
    if (!r.ok) return void get().toast(r.error, 'error')
    const now = Date.now()
    const ticket = cfg.location.tickets.find((t) => t.hours === hours)!
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      locationId: cfg.location.id,
      kind: 'paid_shift',
      ticketCoins: free ? 0 : ticket.priceXu,
      startedAt: now,
      plannedEndAt: now + hours * HOUR_MS,
      weather: weatherFor(now, cfg.location),
    }
    set({ player: r.state, session, keepnet: [], shiftOver: false, game: initialState(now) })
    scheduleSave(0)
    try {
      await repo.startSession(session)
    } catch (e) {
      set({ repoError: `Chưa lưu được ca câu lên server: ${errText(e)}` })
    }
    get().toast(`Vào ca ${hours} tiếng ở ${cfg.location.nameVi}. Chúc câu tay!`)
  },

  endShiftEarly() {
    const busy = get().game.phase === 'fighting' || get().game.phase === 'landable'
    if (busy) return void get().toast('Đang dắt cá, vớt xong đã rồi hãy về.', 'error')
    set({ shiftOver: true })
    get().alerts.clear()
  },

  async finishShift(choice) {
    const { session, keepnet, player, repo } = get()
    if (!session) return
    let next = player
    let earned = 0
    if (choice === 'sell') {
      const r = P.sell(player, keepnet)
      next = r.state
      earned = r.earned
    } else {
      next = P.addXp(player, P.releaseXp(keepnet))
    }
    const fate = choice === 'sell' ? 'sold' : 'released'
    const outcome = keepnet.length === 0 ? 'abandoned' : choice === 'sell' ? 'sold' : 'released'
    set({ player: next, session: undefined, keepnet: [], shiftOver: false, game: initialState(Date.now()) })
    scheduleSave(0)
    const net = earned - session.ticketCoins
    get().toast(
      choice === 'sell'
        ? `Cân cá xong: ${keepnet.length} con, được ${earned} xu (${net >= 0 ? 'lãi' : 'lỗ'} ${Math.abs(net)} xu so với vé).`
        : `Thả ${keepnet.length} con về hồ. Cộng kinh nghiệm.`,
    )
    try {
      for (const c of keepnet) await repo.setCatchFate(c.id, fate)
      await repo.endSession(session.id, Date.now(), outcome, earned)
    } catch (e) {
      set({ repoError: `Chưa lưu được kết quả ca lên server: ${errText(e)}` })
    }
  },

  async enableNotifications() {
    set({ notifyPrompt: false })
    get().apply((p) => ({ ...p, notifyAsked: true }))
    if (typeof Notification === 'undefined') return void get().toast('Trình duyệt này không có thông báo hệ thống.', 'error')
    const r = await Notification.requestPermission().catch(() => 'denied' as const)
    get().alerts.setNotify(r === 'granted')
    get().toast(r === 'granted' ? 'Đã bật. Cá rỉa mồi lúc bạn ở cửa sổ khác thì máy sẽ báo.' : 'Trình duyệt chưa cho phép thông báo. Vẫn có tiếng và tiêu đề tab.')
  },

  dismissNotifyPrompt() {
    set({ notifyPrompt: false })
    get().apply((p) => ({ ...p, notifyAsked: true }))
  },

  async refreshAccount() {
    try {
      set({ account: await get().repo.account() })
    } catch {
      /* offline */
    }
  },

  async refreshJournal() {
    try {
      set({ journal: await get().repo.recentCatches(50) })
    } catch {
      /* offline */
    }
  },
}))

// ---------------------------------------------------------------- side effects

function readPref(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function writePref(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* bỏ qua */
  }
}

const errText = (e: unknown) => String((e as Error)?.message ?? e)

function syncRepoError() {
  const repo = useGame.getState().repo
  if (repo instanceof OutboxRepository) {
    const n = repo.pending().length
    useGame.setState({ repoError: n > 0 && repo.lastError ? `Mất kết nối, còn ${n} việc chờ gửi lên server. Vẫn câu bình thường.` : undefined })
  }
}

/** Lưu tiến độ, gom nhiều thay đổi thành một lần ghi (mặc định sau 3 s). */
function scheduleSave(delayMs = 3000) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    void savePlayer()
  }, delayMs)
}

let saving: Promise<void> | null = null
let dirty = false

/** Các lần lưu chạy nối tiếp: hai lần chồng nhau sẽ tưởng nhầm là "máy khác vừa lưu". */
async function savePlayer(): Promise<void> {
  if (saving) {
    dirty = true
    return saving
  }
  saving = saveOnce().finally(() => {
    saving = null
    if (dirty) {
      dirty = false
      void savePlayer()
    }
  })
  return saving
}

async function saveOnce() {
  const { repo, player, playerVersion } = useGame.getState()
  const { coins, xp, ...state } = player
  try {
    const v = await repo.savePlayer(playerVersion, { coins, xp, state })
    if (v >= 0) return void useGame.setState({ playerVersion: v })
    // máy khác vừa lưu bản mới hơn: lấy bản đó, không ghi đè
    const stored = await repo.loadPlayer()
    if (stored) {
      useGame.setState({ player: P.parsePlayer({ ...(stored.state as object), coins: stored.coins, xp: stored.xp }), playerVersion: stored.version })
      useGame.getState().toast('Tiến độ vừa được cập nhật từ máy khác.')
    }
  } catch (e) {
    useGame.setState({ repoError: `Chưa lưu được tiến độ: ${errText(e)}` })
  }
}

// rời tab, đóng tab, tải lại trang: lưu ngay phần đang chờ
const flushSave = () => {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = undefined
  void savePlayer()
}
addEventListener('visibilitychange', () => {
  if (document.hidden) flushSave()
})
addEventListener('pagehide', flushSave)

const kg = (g: number) => (g / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Tác dụng phụ khi đổi pha: hẹn báo động, tốn mồi, ghi cá, hiện thông báo. Reducer vẫn thuần. */
function onTransition(prev: GameState, next: GameState) {
  const st = useGame.getState()
  if (prev.phase === 'charging' && next.phase === 'sinking' && next.bite) {
    st.apply((p) => P.useBait(p))
    st.alerts.schedule([
      { at: next.bite.nibbleStart, kind: 'nibble' },
      { at: next.bite.strikeOpen, kind: 'window' },
    ])
  }
  if (next.phase === 'fighting' || next.phase === 'result') st.alerts.clear()
  if (next.phase === 'result' && prev.phase !== 'result' && next.result?.kind === 'landed') void saveCatch(next)
}

async function saveCatch(g: GameState) {
  if (g.result?.kind !== 'landed') return
  const st = useGame.getState()
  const fish = g.result.fish
  const sp = speciesOf(fish.speciesId)
  const session = st.session!
  const player = st.player
  const record: CatchRecord = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    speciesId: fish.speciesId,
    locationId: session.locationId,
    weightG: fish.weightG,
    caughtAt: fish.caughtAt,
    localHour: localHour(fish.caughtAt),
    weatherKind: session.weather.kind,
    waterTempC: session.weather.waterTempC,
    depthCm: player.depthCm[session.locationId],
    bait: player.bowl ? { label: player.bowl.label, ...player.bowl.axes } : {},
    rig: { rig: player.equipped.rig, float: player.equipped.float, line: player.equipped.line, rod: player.equipped.rod },
    fate: 'kept',
  }
  const firstEver = st.handbook.length === 0
  const isNew = !st.handbook.some((h) => h.speciesId === fish.speciesId)
  const before = P.levelOf(player.xp)
  st.apply((p) => P.addXp(p, P.catchXp(fish.weightG, isNew)))
  const after = P.levelOf(useGame.getState().player.xp)
  const prevRecord = st.handbook.find((h) => h.speciesId === fish.speciesId)?.recordWeightG ?? 0
  useGame.setState((s) => ({
    keepnet: [...s.keepnet, record],
    // sổ tay cập nhật ngay trên máy, không đợi server
    handbook: optimisticHandbook(s.handbook, record),
    notifyPrompt: firstEver && !player.notifyAsked && typeof Notification !== 'undefined' && Notification.permission === 'default',
  }))
  st.toast(`${sp.nameVi} ${kg(fish.weightG)} kg, vào rọng.`)
  if (isNew) st.toast(`Trang mới trong sổ tay: ${sp.nameVi}.`)
  else if (fish.weightG > prevRecord) st.toast(`${sp.nameVi} ${kg(fish.weightG)} kg: kỷ lục mới của bạn.`)
  if (after > before) st.toast(`Lên cấp ${after}.`)
  try {
    await st.repo.recordCatch(record)
    useGame.setState({ handbook: await st.repo.handbook() })
    syncRepoError()
  } catch (e) {
    useGame.setState({ repoError: `Chưa lưu được con cá này lên server: ${errText(e)}` })
  }
}

function optimisticHandbook(h: HandbookEntry[], c: CatchRecord): HandbookEntry[] {
  const e = h.find((x) => x.speciesId === c.speciesId)
  if (!e) return [...h, { speciesId: c.speciesId, totalCaught: 1, recordWeightG: c.weightG, firstCaughtAt: c.caughtAt, lastCaughtAt: c.caughtAt, locations: [c.locationId], favouriteHour: c.localHour }]
  return h.map((x) =>
    x === e
      ? { ...x, totalCaught: x.totalCaught + 1, recordWeightG: Math.max(x.recordWeightG, c.weightG), lastCaughtAt: c.caughtAt, locations: [...new Set([...x.locations, c.locationId])] }
      : x,
  )
}

export { HOUR_MS, kg }
