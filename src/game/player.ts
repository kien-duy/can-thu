/**
 * Tiến độ người chơi: xu, kinh nghiệm, túi đồ, chậu mồi, độ sâu đã dò. Toàn hàm thuần:
 * mỗi thao tác trả về { ok: true, state } hoặc { ok: false, error } để UI báo lại bằng lời.
 * Lưu lên server ở cột jsonb `player_state.state` (xu và xp nằm ở cột riêng).
 */
import { z } from 'zod'
import { BAIT, floatOf, GEAR, ingredientOf, type Location, lineOf, rigOf, rodOf, speciesOf } from '../content'
import { CHUM_PER_THROW, CHUM_USES, chumNow, mixAxes, type Setup } from '../sim/setup'
import { type Quest, type QuestState, rollover } from './quests'

export const STATE_SCHEMA_VERSION = 1
export const START_COINS = 500

const AxesZ = z.object({ fishy: z.number(), sweet: z.number(), sour: z.number(), loose: z.number() })

export const PlayerStateSchema = z.object({
  coins: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  owned: z.object({ rods: z.array(z.string()), lines: z.array(z.string()), floats: z.array(z.string()) }),
  equipped: z.object({ rod: z.string(), line: z.string(), float: z.string(), rig: z.string() }),
  /** độ sâu phao đã đặt theo từng địa điểm (cm); chưa có = chưa dò đáy */
  depthCm: z.record(z.string(), z.number()),
  stock: z.record(z.string(), z.number().int().nonnegative()),
  bowl: z.object({ axes: AxesZ, uses: z.number().int().nonnegative(), label: z.string() }).nullable(),
  notifyAsked: z.boolean(),
  /** ổ mồi xả theo địa điểm: độ đậm lúc xả gần nhất và thời điểm đó (ms) */
  chum: z.record(z.string(), z.object({ level: z.number(), at: z.number() })),
  quests: z.object({ date: z.string(), progress: z.record(z.string(), z.number()), claimed: z.array(z.string()) }),
})
export type PlayerState = z.infer<typeof PlayerStateSchema>

export type Op = { ok: true; state: PlayerState } | { ok: false; error: string }
const ok = (state: PlayerState): Op => ({ ok: true, state })
const fail = (error: string): Op => ({ ok: false, error })

export function newPlayer(): PlayerState {
  const s = GEAR.starter
  const first = BAIT.recipes[0]!
  return {
    coins: START_COINS,
    xp: 0,
    owned: { rods: [s.rod], lines: [s.line], floats: [s.float] },
    equipped: { ...s },
    depthCm: {},
    stock: { ...BAIT.starterStock },
    // chậu mồi rô phi trộn sẵn: người mới vào là câu được ngay
    bowl: { axes: mixAxes(first.scoops), uses: BAIT.usesPerBowl, label: first.nameVi },
    notifyAsked: false,
    chum: {},
    quests: { date: '', progress: {}, claimed: [] },
  }
}

/** Đọc từ server/máy; dữ liệu hỏng hoặc thiếu trường thì lấp bằng giá trị mới. */
export function parsePlayer(raw: unknown): PlayerState {
  const base = newPlayer()
  const r = PlayerStateSchema.safeParse({ ...base, ...(typeof raw === 'object' && raw ? raw : {}) })
  return r.success ? r.data : base
}

// ---------------------------------------------------------------- cấp độ

/** Cấp = 1 + căn bậc hai (xp / 60), làm tròn xuống. Cấp 2 ở 60 xp, cấp 3 ở 240, cấp 5 ở 960. */
export function levelOf(xp: number): number {
  return 1 + Math.floor(Math.sqrt(xp / 60))
}
export function xpForLevel(level: number): number {
  return 60 * (level - 1) ** 2
}

export function catchXp(weightG: number, isNewSpecies: boolean): number {
  return Math.max(2, Math.round(weightG / 100)) + (isNewSpecies ? 50 : 0)
}

export function addXp(p: PlayerState, xp: number): PlayerState {
  return { ...p, xp: p.xp + Math.max(0, Math.round(xp)) }
}

// ---------------------------------------------------------------- cửa hàng

type Kind = 'rods' | 'lines' | 'floats'
const catalog = { rods: GEAR.rods, lines: GEAR.lines, floats: GEAR.floats }
const slot = { rods: 'rod', lines: 'line', floats: 'float' } as const

export function buyGear(p: PlayerState, kind: Kind, id: string): Op {
  const item = catalog[kind].find((x) => x.id === id)
  if (!item) return fail('Không có món này.')
  if (p.owned[kind].includes(id)) return fail('Đã có rồi.')
  if (levelOf(p.xp) < item.minLevel) return fail(`Cần đạt cấp ${item.minLevel} mới mua được.`)
  if (p.coins < item.priceXu) return fail(`Thiếu ${item.priceXu - p.coins} xu.`)
  return ok({
    ...p,
    coins: p.coins - item.priceXu,
    owned: { ...p.owned, [kind]: [...p.owned[kind], id] },
    equipped: { ...p.equipped, [slot[kind]]: id },
  })
}

export function equip(p: PlayerState, kind: Kind, id: string): Op {
  if (!p.owned[kind].includes(id)) return fail('Chưa có món này.')
  return ok({ ...p, equipped: { ...p.equipped, [slot[kind]]: id } })
}

/**
 * Cần gãy thì bỏ khỏi túi. Lắp lại cần khoẻ nhất còn lại; hết sạch cần thì cấp lại cần tre khởi đầu
 * (miễn phí), để người chơi không bao giờ phải ngồi bờ không cần.
 */
export function breakRod(p: PlayerState, rodId: string): PlayerState {
  const rods = p.owned.rods.filter((id) => id !== rodId)
  if (rods.length === 0) rods.push(GEAR.starter.rod)
  const keep = rods.includes(p.equipped.rod) ? p.equipped.rod : strongestRod(rods)
  return { ...p, owned: { ...p.owned, rods }, equipped: { ...p.equipped, rod: keep } }
}

function strongestRod(ids: readonly string[]): string {
  return ids.reduce((best, id) => (rodOf(id).strength > rodOf(best).strength ? id : best))
}

export function buyIngredient(p: PlayerState, id: string): Op {
  const ing = BAIT.ingredients.find((x) => x.id === id)
  if (!ing) return fail('Không có nguyên liệu này.')
  if (p.coins < ing.packXu) return fail(`Thiếu ${ing.packXu - p.coins} xu.`)
  return ok({ ...p, coins: p.coins - ing.packXu, stock: { ...p.stock, [id]: (p.stock[id] ?? 0) + ing.packScoops } })
}

// ---------------------------------------------------------------- mồi

export function mixBowl(p: PlayerState, scoops: Record<string, number>, label: string): Op {
  const total = Object.values(scoops).reduce((a, b) => a + b, 0)
  if (total < 3) return fail('Chậu mồi cần ít nhất 3 muỗng.')
  for (const [id, n] of Object.entries(scoops)) {
    if (n <= 0) continue
    if ((p.stock[id] ?? 0) < n) return fail(`Không đủ ${ingredientOf(id).nameVi} (còn ${p.stock[id] ?? 0} muỗng).`)
  }
  const stock = { ...p.stock }
  for (const [id, n] of Object.entries(scoops)) if (n > 0) stock[id] = (stock[id] ?? 0) - n
  return ok({ ...p, stock, bowl: { axes: mixAxes(scoops), uses: BAIT.usesPerBowl, label } })
}

/** Mỗi lần quăng móc một viên mồi. Hết chậu thì lưỡi không mồi. */
export function useBait(p: PlayerState): PlayerState {
  if (!p.bowl || p.bowl.uses <= 0) return p
  const uses = p.bowl.uses - 1
  return { ...p, bowl: uses > 0 ? { ...p.bowl, uses } : null }
}

// ---------------------------------------------------------------- cân phao

export function soundBottom(p: PlayerState, loc: Location): PlayerState {
  const rig = rigOf(p.equipped.rig)
  return { ...p, depthCm: { ...p.depthCm, [loc.id]: loc.bottomDepthCm + rig.bottomOffsetCm } }
}

export function nudgeDepth(p: PlayerState, loc: Location, deltaCm: number): PlayerState {
  const cur = p.depthCm[loc.id] ?? loc.bottomDepthCm - 30
  return { ...p, depthCm: { ...p.depthCm, [loc.id]: Math.max(20, Math.min(loc.bottomDepthCm + 40, cur + deltaCm)) } }
}

/** Đổi kiểu cân thì độ sâu đã dò dời theo (giữ nguyên "đáy" người chơi đã tìm). */
export function setRig(p: PlayerState, loc: Location, rigId: string): PlayerState {
  const next = { ...p, equipped: { ...p.equipped, rig: rigId } }
  if (p.depthCm[loc.id] === undefined) return next
  const delta = rigOf(rigId).bottomOffsetCm - rigOf(p.equipped.rig).bottomOffsetCm
  return { ...next, depthCm: { ...p.depthCm, [loc.id]: p.depthCm[loc.id]! + delta } }
}

// ---------------------------------------------------------------- mồi xả, ổ

export function chumLevel(p: PlayerState, locId: string, t: number): number {
  const c = p.chum[locId]
  return c ? chumNow(c.level, c.at, t) : 0
}

/** Ném một nắm mồi xả mở ổ: tốn vài viên trong chậu, ổ đậm thêm (tối đa 1). */
export function throwChum(p: PlayerState, locId: string, t: number): Op {
  if (!p.bowl || p.bowl.uses < CHUM_USES) return fail('Chậu mồi không đủ để xả. Trộn chậu mới đã.')
  const level = Math.min(1, chumLevel(p, locId, t) + CHUM_PER_THROW)
  const uses = p.bowl.uses - CHUM_USES
  return ok({ ...p, bowl: uses > 0 ? { ...p.bowl, uses } : null, chum: { ...p.chum, [locId]: { level, at: t } } })
}

export function canFishAt(p: PlayerState, loc: Location): boolean {
  return levelOf(p.xp) >= loc.minLevel
}

// ---------------------------------------------------------------- nhiệm vụ

export function questsToday(p: PlayerState, date: string): PlayerState {
  const q = rollover(p.quests, date)
  return q === p.quests ? p : { ...p, quests: q }
}

export function setQuests(p: PlayerState, quests: QuestState): PlayerState {
  return { ...p, quests }
}

export function claimQuest(p: PlayerState, q: Quest): Op {
  if ((p.quests.progress[q.id] ?? 0) < q.target) return fail('Nhiệm vụ chưa xong.')
  if (p.quests.claimed.includes(q.id)) return fail('Đã nhận thưởng rồi.')
  return ok({ ...p, coins: p.coins + q.rewardXu, xp: p.xp + q.rewardXp, quests: { ...p.quests, claimed: [...p.quests.claimed, q.id] } })
}

export function setupFor(p: PlayerState, loc: Location, waterTempC: number, t = 0): Setup {
  const rod = rodOf(p.equipped.rod)
  const line = lineOf(p.equipped.line)
  return {
    bait: p.bowl && p.bowl.uses > 0 ? p.bowl.axes : null,
    rig: rigOf(p.equipped.rig),
    float: floatOf(p.equipped.float),
    line,
    depthCm: p.depthCm[loc.id] ?? null,
    waterTempC,
    strength: rod.strength * line.strength,
    rodStrength: rod.strength,
    lineStrength: line.strength,
    rodId: rod.id,
    castBonusM: rod.castBonusM,
    chum: t ? chumLevel(p, loc.id, t) : 0,
  }
}

// ---------------------------------------------------------------- ca câu, bán cá

export function buyTicket(p: PlayerState, loc: Location, hours: number): Op {
  const t = loc.tickets.find((x) => x.hours === hours)
  if (!t) return fail('Hồ không bán vé này.')
  if (p.coins < t.priceXu) return fail(`Thiếu ${t.priceXu - p.coins} xu để mua vé ${hours} tiếng.`)
  return ok({ ...p, coins: p.coins - t.priceXu })
}

/** Giá bán một con. factor < 1 ở sông, hồ tự nhiên (bán cho lái cá ở chợ). */
export function salePrice(speciesId: string, weightG: number, factor = 1): number {
  return Math.round((speciesOf(speciesId).priceXuPerKg * weightG * factor) / 1000)
}

export function sell(p: PlayerState, fish: readonly { speciesId: string; weightG: number }[], factor = 1): { state: PlayerState; earned: number } {
  const earned = fish.reduce((a, f) => a + salePrice(f.speciesId, f.weightG, factor), 0)
  return { state: { ...p, coins: p.coins + earned }, earned }
}

/** Thả cá: không có xu, nhưng được thêm chút kinh nghiệm. */
export function releaseXp(fish: readonly { weightG: number }[]): number {
  return fish.reduce((a, f) => a + Math.max(1, Math.round(f.weightG / 300)), 0)
}
