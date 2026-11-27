import { ApiRepository } from './api'
import { LocalRepository } from './local'
import { OutboxRepository } from './outbox'
import type { GameRepository } from './types'

export * from './types'
export { OutboxRepository }

/** Mặc định lưu lên server của game (qua hàng đợi offline). `?store=local` ép lưu trên máy (test, chơi không cần server). */
export function createRepository(): GameRepository {
  const forceLocal = new URLSearchParams(location.search).get('store') === 'local'
  if (forceLocal) return new LocalRepository()
  return new OutboxRepository(new ApiRepository())
}
