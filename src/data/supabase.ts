import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { CatchRecord, GameRepository, HandbookEntry, SessionRecord, WeatherKind } from './types'

const iso = (ms: number) => new Date(ms).toISOString()

/** Bản Supabase: khách ẩn danh, ghi qua RPC (xem supabase/migrations/0001_init.sql), đọc qua RLS. */
export class SupabaseRepository implements GameRepository {
  readonly kind = 'supabase' as const
  private readonly db: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.db = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  }

  async init() {
    const { data } = await this.db.auth.getSession()
    if (data.session) return
    const { error } = await this.db.auth.signInAnonymously()
    if (error) throw error
  }

  async startSession(s: SessionRecord) {
    const { error } = await this.db.rpc('start_session', {
      p_id: s.id,
      p_location_id: s.locationId,
      p_kind: s.kind,
      p_ticket_coins: s.ticketCoins,
      p_started_at: iso(s.startedAt),
      p_planned_end_at: s.plannedEndAt === undefined ? null : iso(s.plannedEndAt),
      p_weather: {
        kind: s.weather.kind,
        temp_c: s.weather.tempC,
        wind_ms: s.weather.windMs,
        water_temp_c: s.weather.waterTempC,
      },
    })
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
}
