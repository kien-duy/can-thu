import { describe, expect, it } from 'vitest'
import { LocalRepository } from './local'
import { aggregateHandbook, type CatchRecord } from './types'

function memStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
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

describe('lưu tiến độ', () => {
  it('ghi theo version: máy khác đã lưu bản mới hơn thì trả -1', async () => {
    const repo = new LocalRepository(memStorage())
    expect(await repo.loadPlayer()).toBeNull()
    expect(await repo.savePlayer(0, { coins: 1, xp: 0, state: {} })).toBe(1)
    expect(await repo.savePlayer(1, { coins: 2, xp: 0, state: {} })).toBe(2)
    expect(await repo.savePlayer(1, { coins: 9, xp: 0, state: {} })).toBe(-1)
    expect((await repo.loadPlayer())?.coins).toBe(2)
  })
  it('ca câu: mở ca mới tự đóng ca cũ; đóng ca rồi thì không còn ca mở', async () => {
    const repo = new LocalRepository(memStorage())
    const s = (id: string) => ({ id, locationId: 'ho_dong_xanh', kind: 'paid_shift' as const, ticketCoins: 60, startedAt: 1, plannedEndAt: 2, weather: { kind: 'sunny' as const, tempC: 27, windMs: 1, waterTempC: 26 } })
    await repo.startSession(s('a'))
    await repo.startSession(s('b'))
    expect((await repo.openSession())?.id).toBe('b')
    await repo.endSession('b', 3, 'sold', 50)
    expect(await repo.openSession()).toBeNull()
  })
})

describe('hàng đợi offline', () => {
  function flaky() {
    const inner = new LocalRepository(memStorage())
    let down = true
    const calls: string[] = []
    const wrapped = Object.assign(Object.create(inner), {
      recordCatch: async (c: CatchRecord) => {
        calls.push(c.id)
        if (down) throw new Error('mất mạng')
        return inner.recordCatch(c)
      },
      handbook: async () => {
        if (down) throw new Error('mất mạng')
        return inner.handbook()
      },
    })
    return { inner, wrapped, calls, up: () => (down = false) }
  }

  it('flush lúc hàng đợi trống không làm kẹt các lệnh ghi sau đó', async () => {
    const { OutboxRepository } = await import('./outbox')
    const inner = new LocalRepository(memStorage())
    const box = new OutboxRepository(inner, memStorage())
    await box.init()
    await box.recordCatch({ ...base, id: 'k1', speciesId: 'ro_phi_den', weightG: 500, caughtAt: 1, localHour: 7 })
    expect(box.pending()).toHaveLength(0)
    expect(await inner.recentCatches(10)).toHaveLength(1)
  })

  it('mất mạng: giữ cá trong hàng đợi, sổ tay vẫn thấy; có mạng lại thì gửi đúng thứ tự, không trùng', async () => {
    const { OutboxRepository } = await import('./outbox')
    const f = flaky()
    const box = new OutboxRepository(f.wrapped, memStorage())
    await box.recordCatch({ ...base, id: 'c1', speciesId: 'ro_phi_den', weightG: 500, caughtAt: 1, localHour: 7 })
    await box.recordCatch({ ...base, id: 'c2', speciesId: 'ro_phi_den', weightG: 700, caughtAt: 2, localHour: 7 })
    expect(box.pending()).toHaveLength(2)
    expect(box.failures).toBeGreaterThan(0)
    expect((await box.handbook())[0]).toMatchObject({ totalCaught: 2, recordWeightG: 700 })
    f.up()
    await box.flush()
    expect(box.pending()).toHaveLength(0)
    expect(f.calls.filter((x) => x === 'c1').length).toBeGreaterThanOrEqual(1)
    expect((await box.handbook())[0]).toMatchObject({ totalCaught: 2 }) // không đếm hai lần
    expect((await f.inner.recentCatches(10)).map((c) => c.id)).toEqual(['c2', 'c1'])
  })
})
