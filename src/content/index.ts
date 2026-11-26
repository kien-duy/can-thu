// Nội dung game: đọc JSON trong /content và kiểm tra bằng zod ngay khi nạp module.
// Thêm loài, địa điểm, nguyên liệu, đồ nghề = thêm dữ liệu, không phải sửa code.
import { z } from 'zod'
import baitJson from '../../content/bait.json'
import creaturesJson from '../../content/creatures.json'
import gearJson from '../../content/gear.json'
import locationsJson from '../../content/locations.json'
import questsJson from '../../content/quests.json'
import speciesJson from '../../content/species.json'

const range = z.tuple([z.number(), z.number()]).refine(([a, b]) => b > a, 'range: max phải > min')
const id = z.string().regex(/^[a-z0-9_]{2,40}$/)
const unit = z.number().min(0).max(1)

export const AxesSchema = z.object({ fishy: unit, sweet: unit, sour: unit, loose: unit })
export type Axes = z.infer<typeof AxesSchema>
export const AXES = ['fishy', 'sweet', 'sour', 'loose'] as const
export const AXIS_LABEL: Record<(typeof AXES)[number], string> = { fishy: 'Tanh', sweet: 'Thơm ngọt', sour: 'Chua', loose: 'Độ tơi' }

export const SpeciesSchema = z.object({
  id,
  nameVi: z.string().min(1),
  scientific: z.string().min(1),
  weightG: range,
  typicalG: z.number().positive(),
  summary: z.string().min(1),
  facts: z.array(z.string().min(1)).min(1),
  depth: z.string().min(1),
  layer: z.enum(['bottom', 'mid']),
  floatTell: z.string().min(1),
  activeHours: z.array(z.number().int().min(0).max(23)),
  waterTempC: range,
  prefs: AxesSchema,
  priceXuPerKg: z.number().int().positive(),
  fight: z.object({
    power: unit,
    stamina: z.number().positive().max(1),
    surge: unit,
  }),
  bite: z.object({
    nibbleSec: range,
    windowSec: z.number().positive().max(5),
    decoy: z.object({ amp: unit, everySec: range }),
    signal: z.object({ kind: z.enum(['sink', 'rise', 'slow_sink']), amp: z.number().positive().max(3) }),
  }),
})

export const LocationSchema = z.object({
  id,
  nameVi: z.string().min(1),
  kind: z.enum(['fee_pond', 'river', 'mountain_lake']),
  summary: z.string().min(1),
  bottomDepthCm: z.number().int().positive(),
  castDistanceM: range,
  waitSec: range,
  tickets: z.array(z.object({ hours: z.number().positive().max(8), priceXu: z.number().int().nonnegative() })),
  /** cấp tối thiểu để mở địa điểm */
  minLevel: z.number().int().positive(),
  /** hệ số giá bán so với giá thu của hồ dịch vụ (sông, hồ tự nhiên bán cho lái cá rẻ hơn) */
  saleFactor: z.number().positive().max(1),
  theme: z.enum(['fee_pond', 'river', 'mountain']),
  species: z.array(z.object({ id, weight: z.number().positive() })).min(1),
})

export const IngredientSchema = z.object({
  id,
  nameVi: z.string().min(1),
  note: z.string().min(1),
  axes: z.object({ fishy: unit, sweet: unit, sour: unit, loose: z.number().min(-1).max(1) }),
  packScoops: z.number().int().positive(),
  packXu: z.number().int().positive(),
})

export const RecipeSchema = z.object({
  id,
  nameVi: z.string().min(1),
  for: z.array(id),
  scoops: z.record(id, z.number().int().positive()),
})

const BaitSchema = z.object({
  usesPerBowl: z.number().int().positive(),
  ingredients: z.array(IngredientSchema),
  recipes: z.array(RecipeSchema),
  starterStock: z.record(id, z.number().int().nonnegative()),
})

const priced = { id, nameVi: z.string().min(1), note: z.string().min(1), priceXu: z.number().int().nonnegative(), minLevel: z.number().int().positive() }
export const RigSchema = z.object({
  id,
  nameVi: z.string().min(1),
  tag: z.string().min(1),
  note: z.string().min(1),
  bottomOffsetCm: z.number(),
  sensitivity: z.number().positive(),
  falseBites: z.number().nonnegative(),
})
const GearSchema = z.object({
  rigs: z.array(RigSchema),
  rods: z.array(z.object({ ...priced, strength: z.number().positive(), castBonusM: z.number().nonnegative() })),
  lines: z.array(z.object({ ...priced, strength: z.number().positive(), shyFactor: z.number().positive().max(1) })),
  floats: z.array(z.object({ ...priced, sensitivity: z.number().positive() })),
  /** lưỡi câu: bestForG = khoảng cân nặng cá (g) mà cỡ lưỡi này hợp */
  hooks: z.array(z.object({ ...priced, sizeNo: z.number().int().positive(), bestForG: range })).min(1),
  starter: z.object({ rod: id, line: id, float: id, rig: id, hook: id }),
})

export const CreatureSchema = z.object({
  id,
  nameVi: z.string().min(1),
  visual: z.enum(['butterfly', 'dragonfly', 'firefly', 'bird', 'kingfisher', 'buffalo', 'duck', 'deer', 'monkey', 'frog']),
  locations: z.array(id).min(1),
  hours: z.array(z.number().int().min(0).max(23)).min(1),
  weathers: z.array(z.enum(['sunny', 'cloudy', 'rain', 'storm', 'fog'])).min(1),
  weight: z.number().positive(),
  note: z.string().min(1),
})

const QuestTemplateSchema = z.object({
  id,
  kind: z.enum(['catch_count', 'catch_species', 'catch_weight', 'sighting', 'profit_shift', 'catch_at']),
  textVi: z.string().min(1),
  n: range.or(z.tuple([z.number(), z.number()])).optional(),
  kg: z.tuple([z.number(), z.number()]).optional(),
  species: id.optional(),
  location: id.optional(),
  minLevel: z.number().int().positive().optional(),
  rewardXu: z.tuple([z.number().int(), z.number().int()]),
  rewardXp: z.number().int().nonnegative(),
})
const QuestsSchema = z.object({ perDay: z.number().int().positive(), templates: z.array(QuestTemplateSchema).min(1) })

export type Creature = z.infer<typeof CreatureSchema>
export type QuestTemplate = z.infer<typeof QuestTemplateSchema>
export type Species = z.infer<typeof SpeciesSchema>
export type Location = z.infer<typeof LocationSchema>
export type Ingredient = z.infer<typeof IngredientSchema>
export type Recipe = z.infer<typeof RecipeSchema>
export type Rig = z.infer<typeof RigSchema>
export type Gear = z.infer<typeof GearSchema>
export type Rod = Gear['rods'][number]
export type Line = Gear['lines'][number]
export type FloatGear = Gear['floats'][number]
export type Hook = Gear['hooks'][number]

export const SPECIES: readonly Species[] = z.array(SpeciesSchema).parse(speciesJson)
export const LOCATIONS: readonly Location[] = z.array(LocationSchema).parse(locationsJson)
export const BAIT = BaitSchema.parse(baitJson)
export const GEAR = GearSchema.parse(gearJson)
export const CREATURES: readonly Creature[] = z.array(CreatureSchema).parse(creaturesJson)
export const QUESTS = QuestsSchema.parse(questsJson)

const speciesById = new Map(SPECIES.map((s) => [s.id, s]))
const ingredientIds = new Set(BAIT.ingredients.map((i) => i.id))

// Kiểm tra chéo: mọi id trỏ tới phải có thật.
for (const loc of LOCATIONS) {
  for (const s of loc.species) if (!speciesById.has(s.id)) throw new Error(`content: ${loc.id} trỏ tới loài không có: ${s.id}`)
}
for (const r of BAIT.recipes) {
  for (const k of Object.keys(r.scoops)) if (!ingredientIds.has(k)) throw new Error(`content: bài ${r.id} dùng nguyên liệu không có: ${k}`)
  for (const s of r.for) if (!speciesById.has(s)) throw new Error(`content: bài ${r.id} trỏ tới loài không có: ${s}`)
}
const locationIds = new Set(LOCATIONS.map((l) => l.id))
for (const c of CREATURES) for (const l of c.locations) if (!locationIds.has(l)) throw new Error(`content: sinh vật ${c.id} ở địa điểm không có: ${l}`)
for (const q of QUESTS.templates) {
  if (q.species && !speciesById.has(q.species)) throw new Error(`content: nhiệm vụ ${q.id} trỏ tới loài không có`)
  if (q.location && !locationIds.has(q.location)) throw new Error(`content: nhiệm vụ ${q.id} trỏ tới địa điểm không có`)
}
for (const k of Object.keys(BAIT.starterStock)) if (!ingredientIds.has(k)) throw new Error(`content: starterStock có ${k}`)
{
  const s = GEAR.starter
  if (!GEAR.rods.some((x) => x.id === s.rod) || !GEAR.lines.some((x) => x.id === s.line) || !GEAR.floats.some((x) => x.id === s.float) || !GEAR.rigs.some((x) => x.id === s.rig) || !GEAR.hooks.some((x) => x.id === s.hook)) {
    throw new Error('content: đồ khởi đầu không có trong gear.json')
  }
  const hookIds = new Set<string>()
  for (const h of GEAR.hooks) {
    if (hookIds.has(h.id)) throw new Error(`content: lưỡi ${h.id} bị trùng id`)
    hookIds.add(h.id)
  }
}

export function speciesOf(speciesId: string): Species {
  const s = speciesById.get(speciesId)
  if (!s) throw new Error(`Không có loài ${speciesId}`)
  return s
}

export function locationOf(locationId: string): Location {
  const l = LOCATIONS.find((x) => x.id === locationId)
  if (!l) throw new Error(`Không có địa điểm ${locationId}`)
  return l
}

export function ingredientOf(ingredientId: string): Ingredient {
  const i = BAIT.ingredients.find((x) => x.id === ingredientId)
  if (!i) throw new Error(`Không có nguyên liệu ${ingredientId}`)
  return i
}

export const rodOf = (x: string) => GEAR.rods.find((r) => r.id === x) ?? GEAR.rods[0]!
export const lineOf = (x: string) => GEAR.lines.find((r) => r.id === x) ?? GEAR.lines[0]!
export const floatOf = (x: string) => GEAR.floats.find((r) => r.id === x) ?? GEAR.floats[0]!
export const rigOf = (x: string) => GEAR.rigs.find((r) => r.id === x) ?? GEAR.rigs[0]!
export const hookOf = (x: string) => GEAR.hooks.find((r) => r.id === x) ?? GEAR.hooks.find((r) => r.id === GEAR.starter.hook)!
