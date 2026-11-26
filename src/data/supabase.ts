import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Account,
  CatchRecord,
  GameRepository,
  HandbookEntry,
  SessionOutcome,
  SessionRecord,
  StoredPlayer,
  WeatherKind,
} from './types'

const iso = (ms: number) => new Date(ms).toISOString()

/** Bản Supabase: khách ẩn danh, ghi qua RPC (xem supabase/migrations/0001_init.sql), đọc qua RLS. */
export class SupabaseRepository implements GameRepository {
  readonly kind = 'supabase' as const
  private readonly db: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.db = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  }

  private async uid(): Promise<string> {
    const { data } = await this.db.auth.getSession()
    if (!data.session) throw new Error('Chưa đăng nhập')
    return data.session.user.id
  }

  async init() {
    const { data } = await this.db.auth.getSession()
    if (data.session) return
    const { error } = await this.db.auth.signInAnonymously()
    if (error) throw error
  }

  async loadPlayer(): Promise<StoredPlayer | null> {
    const { data, error } = await this.db.from('player_state').select('version, coins, xp, state').eq('user_id', await this.uid()).maybeSingle()
    if (error) throw error
    return data ? { version: data.version, coins: data.coins, xp: data.xp, state: data.state } : null
  }

  async savePlayer(expectedVersion: number, p: Omit<StoredPlayer, 'version'>) {
    const { data, error } = await this.db.rpc('save_player_state', {
      p_expected_version: expectedVersion,
      p_coins: p.coins,
      p_xp: p.xp,
      p_state: p.state,
      p_state_schema: 1,
    })
    if (error) throw error
    return data as number
  }

  async openSession(): Promise<SessionRecord | null> {
    const { data, error } = await this.db.from('fishing_sessions').select('*').is('ended_at', null).maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      id: data.id,
      locationId: data.location_id,
      kind: data.kind,
      ticketCoins: data.ticket_coins,
      startedAt: Date.parse(data.started_at),
      plannedEndAt: data.planned_end_at ? Date.parse(data.planned_end_at) : undefined,
      weather: {
        kind: data.weather.kind ?? 'sunny',
        tempC: data.weather.temp_c ?? 27,
        windMs: data.weather.wind_ms ?? 1,
        waterTempC: data.weather.water_temp_c ?? 26,
      },
    }
  }

  async startSession(s: SessionRecord) {
    const { error } = await this.db.rpc('start_session', {
      p_id: s.id,
      p_location_id: s.locationId,
      p_kind: s.kind,
      p_ticket_coins: s.ticketCoins,
      p_started_at: iso(s.startedAt),
      p_planned_end_at: s.plannedEndAt === undefined ? null : iso(s.plannedEndAt),
      p_weather: { kind: s.weather.kind, temp_c: s.weather.tempC, wind_ms: s.weather.windMs, water_temp_c: s.weather.waterTempC },
    })
    if (error) throw error
  }

  async endSession(id: string, endedAt: number, outcome: SessionOutcome, earnedCoins: number) {
    const { error } = await this.db.rpc('end_session', { p_id: id, p_ended_at: iso(endedAt), p_outcome: outcome, p_earned_coins: earnedCoins })
    if (error) throw error
  }

  async recordCatch(c: CatchRecord) {
    const { error } = await this.db.rpc('record_catch', {
      p: {
        id: c.id,
        session_id: c.sessionId,
        species_id: c.speciesId,
        weight_g: c.weightG,
        caught_at: iso(c.caughtAt),
        local_hour: c.localHour,
        weather_kind: c.weatherKind,
        water_temp_c: c.waterTempC ?? null,
        depth_cm: c.depthCm ?? null,
        bait: c.bait,
        rig: c.rig,
        fate: c.fate,
      },
    })
    if (error) throw error
  }

  async setCatchFate(id: string, fate: CatchRecord['fate']) {
    const { error } = await this.db.rpc('set_catch_fate', { p_id: id, p_fate: fate })
    if (error) throw error
  }

  async handbook(): Promise<HandbookEntry[]> {
    const { data, error } = await this.db.from('handbook_entries').select('*')
    if (error) throw error
    return (data ?? []).map((r) => ({
      speciesId: r.species_id,
      totalCaught: Number(r.total_caught),
      recordWeightG: r.record_weight_g,
      firstCaughtAt: Date.parse(r.first_caught_at),
      lastCaughtAt: Date.parse(r.last_caught_at),
      locations: r.locations,
      favouriteHour: r.favourite_hour,
    }))
  }

  async recentCatches(limit: number): Promise<CatchRecord[]> {
    const { data, error } = await this.db.from('catches').select('*').order('caught_at', { ascending: false }).limit(limit)
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      speciesId: r.species_id,
      locationId: r.location_id,
      weightG: r.weight_g,
      caughtAt: Date.parse(r.caught_at),
      localHour: r.local_hour,
      weatherKind: r.weather_kind as WeatherKind,
      waterTempC: r.water_temp_c === null ? undefined : Number(r.water_temp_c),
      depthCm: r.depth_cm ?? undefined,
      bait: r.bait,
      rig: r.rig,
      fate: r.fate,
    }))
  }

  async account(): Promise<Account> {
    const { data } = await this.db.auth.getUser()
    const u = data.user
    if (!u) return { mode: 'guest', providers: [] }
    const providers = (u.identities ?? []).map((i) => i.provider)
    return { mode: u.is_anonymous ? 'guest' : 'linked', email: u.email ?? undefined, providers }
  }

  async linkGoogle() {
    // Cần bật "Manual linking" trong Supabase. Trình duyệt chuyển sang Google rồi quay về, user_id giữ nguyên.
    const { error } = await this.db.auth.linkIdentity({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
    if (error) throw error
  }

  async linkEmail(email: string) {
    const { error } = await this.db.auth.updateUser({ email }, { emailRedirectTo: location.origin + location.pathname })
    if (error) throw error
  }

  async deleteAccount() {
    // Xoá user cần service role: làm ở Edge Function (supabase/functions/delete-account).
    const { error } = await this.db.functions.invoke('delete-account', { method: 'POST' })
    if (error) throw error
    await this.db.auth.signOut()
  }
}
