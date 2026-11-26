/**
 * Nhiệm vụ ngày: mỗi ngày (theo giờ máy) một bộ 3 nhiệm vụ, tất định theo ngày và cấp,
 * nên tải lại trang hay đổi máy vẫn thấy cùng bộ. Tiến độ lưu trong player state.
 */
import { QUESTS, type QuestTemplate } from '../content'
import { between, createRng } from '../sim/rng'

export interface Quest {
  id: string
  templateId: string
  kind: QuestTemplate['kind']
  text: string
  target: number
  rewardXu: number
  rewardXp: number
  species?: string
  location?: string
  minWeightG?: number
}

export interface QuestState {
  date: string
  progress: Record<string, number>
  claimed: string[]
}

export type QuestEvent =
  | { type: 'catch'; speciesId: string; weightG: number; locationId: string }
  | { type: 'sighting' }
  | { type: 'profit_shift' }

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function dailyQuests(date: string, level: number): Quest[] {
  const rng = createRng(hash(`quests:${date}`))
  const pool = QUESTS.templates.filter((t) => (t.minLevel ?? 1) <= level)
  const picked: QuestTemplate[] = []
  const left = [...pool]
  while (picked.length < QUESTS.perDay && left.length > 0) picked.push(left.splice(Math.floor(rng() * left.length), 1)[0]!)
  return picked.map((t) => {
    const n = t.n ? Math.round(between(rng, t.n[0], t.n[1] + 0.999)) : 1
    const kg = t.kg ? Math.round(between(rng, t.kg[0], t.kg[1] + 0.999)) : undefined
    const reward = Math.round(between(rng, t.rewardXu[0], t.rewardXu[1]) / 5) * 5
    return {
      id: `${date}:${t.id}`,
      templateId: t.id,
      kind: t.kind,
      text: t.textVi.replace('{n}', String(Math.floor(n))).replace('{kg}', String(kg)),
      target: t.kind === 'catch_weight' || t.kind === 'profit_shift' ? 1 : Math.floor(n),
      rewardXu: reward,
      rewardXp: t.rewardXp,
      species: t.species,
      location: t.location,
      minWeightG: kg !== undefined ? kg * 1000 : undefined,
    }
  })
}

export function freshQuestState(date: string): QuestState {
  return { date, progress: {}, claimed: [] }
}

/** Sang ngày mới thì xoá tiến độ cũ. */
export function rollover(q: QuestState | undefined, date: string): QuestState {
  return q && q.date === date ? q : freshQuestState(date)
}

function matches(q: Quest, e: QuestEvent): boolean {
  switch (q.kind) {
    case 'catch_count':
      return e.type === 'catch'
    case 'catch_species':
      return e.type === 'catch' && e.speciesId === q.species
    case 'catch_weight':
      return e.type === 'catch' && e.weightG >= (q.minWeightG ?? 0)
    case 'catch_at':
      return e.type === 'catch' && e.locationId === q.location
    case 'sighting':
      return e.type === 'sighting'
    case 'profit_shift':
      return e.type === 'profit_shift'
  }
}

/** Ghi nhận một sự kiện; trả về state mới và các nhiệm vụ vừa hoàn thành. */
export function advanceQuests(state: QuestState, quests: readonly Quest[], e: QuestEvent): { state: QuestState; completed: Quest[] } {
  const progress = { ...state.progress }
  const completed: Quest[] = []
  for (const q of quests) {
    const cur = progress[q.id] ?? 0
    if (cur >= q.target || !matches(q, e)) continue
    progress[q.id] = cur + 1
    if (cur + 1 >= q.target) completed.push(q)
  }
  return { state: { ...state, progress }, completed }
}

export function canClaim(state: QuestState, q: Quest): boolean {
  return (state.progress[q.id] ?? 0) >= q.target && !state.claimed.includes(q.id)
}
