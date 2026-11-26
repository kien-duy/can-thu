import { create } from 'zustand'
import { Alerts } from '../alerts/alerts'
import { LOCATIONS, SPECIES, speciesOf } from '../content'
import { type CatchRecord, createRepository, type GameRepository, type HandbookEntry, type SessionRecord } from '../data'
import { type GameConfig, type GameEvent, type GameState, initialState, reduce } from '../sim/game'
import { localHour, weatherFor } from '../sim/world'

const params = new URLSearchParams(location.search)
/** `?fast=1`: thu nhỏ thời gian chờ và rỉa (để test, để thử nhanh). `?seed=n`: lượt câu tái hiện được. */
const FAST = params.get('fast') === '1'
const SEED = Number(params.get('seed') ?? Math.floor(Math.random() * 2 ** 31))

export type ViewMode = '3d' | 'office'

export interface Toast {
  id: number
  text: string
}

interface Store {
  cfg: GameConfig
  game: GameState
  now: number
  view: ViewMode
  repo: GameRepository
  repoError?: string
  session?: SessionRecord
  keepnet: CatchRecord[]
  handbook: HandbookEntry[]
  handbookOpen: boolean
  toasts: Toast[]
  alerts: Alerts
  boot(): Promise<void>
  dispatch(e: GameEvent): void
  tick(t: number, paused?: boolean): void
  setView(v: ViewMode): void
  toggleHandbook(open?: boolean): void
  toast(text: string): void
}

const location0 = LOCATIONS[0]!
let toastId = 0

export const useGame = create<Store>((set, get) => ({
  cfg: { location: location0, species: SPECIES, seed: SEED, timeScale: FAST ? 0.08 : 1 },
  game: initialState(Date.now()),
  now: Date.now(),
  view: (localStorage.getItem('can-thu:view') as ViewMode | null) ?? '3d',
  repo: createRepository(),
  keepnet: [],
  handbook: [],
  handbookOpen: false,
  toasts: [],
  alerts: new Alerts(() => location0.nameVi),

  async boot() {
    const { repo } = get()
    const now = Date.now()
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      locationId: location0.id,
      kind: 'free',
      ticketCoins: 0,
      startedAt: now,
      weather: weatherFor(now, location0),
    }
    set({ session })
    try {
      await repo.init()
      await repo.startSession(session)
      set({ handbook: await repo.handbook(), repoError: undefined })
    } catch (e) {
      set({ repoError: `Chưa lưu lên server được: ${String((e as Error).message ?? e)}` })
    }
  },

  dispatch(e) {
    const { cfg, game, alerts } = get()
    if (e.type === 'charge' || e.type === 'strike' || e.type === 'reel') alerts.unlockAudio()
    const next = reduce(cfg, game, e)
    if (next === game) return
    set({ game: next, now: e.t })
    onTransition(game, next)
  },

  tick(t, paused) {
    const { cfg, game } = get()
    const next = reduce(cfg, game, { type: 'tick', t, paused })
    set({ game: next, now: t })
    if (next.phase !== game.phase) onTransition(game, next)
  },

  setView(v) {
    try {
      localStorage.setItem('can-thu:view', v)
    } catch {
      /* bỏ qua */
    }
    set({ view: v })
  },

  toggleHandbook(open) {
    set((s) => ({ handbookOpen: open ?? !s.handbookOpen }))
  },

  toast(text) {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500)
  },
}))

const kg = (g: number) => (g / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Tác dụng phụ khi đổi pha: hẹn báo động, ghi cá, hiện thông báo. Reducer vẫn thuần. */
function onTransition(prev: GameState, next: GameState) {
  const st = useGame.getState()
  if (prev.phase === 'charging' && next.phase === 'sinking' && next.bite) {
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
    depthCm: st.cfg.location.bottomDepthCm,
    bait: {},
    rig: {},
    fate: 'kept',
  }
  const isNew = !st.handbook.some((h) => h.speciesId === fish.speciesId)
  useGame.setState((s) => ({ keepnet: [...s.keepnet, record] }))
  st.toast(`${sp.nameVi} ${kg(fish.weightG)} kg, vào rọng.`)
  if (isNew) st.toast(`Trang mới trong sổ tay: ${sp.nameVi}.`)
  try {
    await st.repo.recordCatch(record)
    useGame.setState({ handbook: await st.repo.handbook(), repoError: undefined })
  } catch (e) {
    useGame.setState({ repoError: `Chưa lưu được con cá này lên server: ${String((e as Error).message ?? e)}` })
  }
}

export { kg }
