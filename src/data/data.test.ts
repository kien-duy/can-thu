import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LOCATIONS, SPECIES } from '../content'
import { seedSql } from '../content/seedSql'
import { LocalRepository } from './local'
import { aggregateHandbook, type CatchRecord } from './types'

function memStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

const base: Omit<CatchRecord, 'id' | 'weightG' | 'caughtAt' | 'localHour' | 'speciesId'> = {
  sessionId: 's1',
  locationId: 'ho_dong_xanh',
  weatherKind: 'sunny',
  bait: {},
  rig: {},
  fate: 'kept',
}

describe('sổ tay', () => {
  it('tổng hợp theo loài: số con, kỷ lục, lần đầu, giờ hay câu', () => {
    const h = aggregateHandbook([
      { ...base, id: 'a', speciesId: 'ro_phi_den', weightG: 400, caughtAt: 3000, localHour: 7 },
      { ...base, id: 'b', speciesId: 'ro_phi_den', weightG: 900, caughtAt: 1000, localHour: 17 },
      { ...base, id: 'c', speciesId: 'ro_phi_den', weightG: 300, caughtAt: 2000, localHour: 7 },
      { ...base, id: 'd', speciesId: 'chep', weightG: 2000, caughtAt: 5000, localHour: 5 },
    ])
    const rp = h.find((x) => x.speciesId === 'ro_phi_den')!
    expect(rp).toMatchObject({ totalCaught: 3, recordWeightG: 900, firstCaughtAt: 1000, lastCaughtAt: 3000, favouriteHour: 7 })
    expect(h.find((x) => x.speciesId === 'chep')?.totalCaught).toBe(1)
  })

  it('bản lưu trên máy: gửi trùng id thì không đếm hai lần, còn lại sau khi tải lại', async () => {
    const storage = memStorage()
    const repo = new LocalRepository(storage)
    const c: CatchRecord = { ...base, id: 'x', speciesId: 'dieu_hong', weightG: 600, caughtAt: 1, localHour: 8 }
    await repo.recordCatch(c)
    await repo.recordCatch(c)
    const again = new LocalRepository(storage)
    expect((await again.handbook())[0]?.totalCaught).toBe(1)
    expect(await again.recentCatches(10)).toHaveLength(1)
  })
})

describe('seed', () => {
  it('supabase/seed.sql khớp với content (chạy `npm run seed:gen` nếu hỏng)', () => {
    expect(readFileSync('supabase/seed.sql', 'utf8')).toBe(seedSql(SPECIES, LOCATIONS))
  })
})
