import { LocalRepository } from './local'
import { SupabaseRepository } from './supabase'
import type { GameRepository } from './types'

export * from './types'

/** Có cấu hình Supabase thì lưu lên server, không thì lưu trên máy. `?store=local` ép lưu trên máy (dùng cho test). */
export function createRepository(): GameRepository {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  const forceLocal = new URLSearchParams(location.search).get('store') === 'local'
  if (url && key && !forceLocal) return new SupabaseRepository(url, key)
  return new LocalRepository()
}
