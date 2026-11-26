// Nội dung game: đọc JSON trong /content và kiểm tra bằng zod ngay khi nạp module.
// Thêm loài hay địa điểm = thêm dữ liệu, không phải sửa code.
import { z } from 'zod'
import locationsJson from '../../content/locations.json'
import speciesJson from '../../content/species.json'

const range = z.tuple([z.number().nonnegative(), z.number().positive()]).refine(([a, b]) => b > a, 'range: max phải > min')
const id = z.string().regex(/^[a-z0-9_]{2,40}$/)

export const SpeciesSchema = z.object({
  id,
  nameVi: z.string().min(1),
  scientific: z.string().min(1),
  weightG: range,
  typicalG: z.number().positive(),
  summary: z.string().min(1),
  facts: z.array(z.string().min(1)).min(1),
  depth: z.string().min(1),
  floatTell: z.string().min(1),
  activeHours: z.array(z.number().int().min(0).max(23)),
  fight: z.object({
    power: z.number().min(0).max(1),
    stamina: z.number().positive().max(1),
    surge: z.number().min(0).max(1),
  }),
  bite: z.object({
    nibbleSec: range,
    windowSec: z.number().positive().max(5),
    decoy: z.object({ amp: z.number().min(0).max(1), everySec: range }),
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
  species: z.array(z.object({ id, weight: z.number().positive() })).min(1),
})

export type Species = z.infer<typeof SpeciesSchema>
export type Location = z.infer<typeof LocationSchema>

export const SPECIES: readonly Species[] = z.array(SpeciesSchema).parse(speciesJson)
export const LOCATIONS: readonly Location[] = z.array(LocationSchema).parse(locationsJson)

const speciesById = new Map(SPECIES.map((s) => [s.id, s]))
for (const loc of LOCATIONS) {
  for (const s of loc.species) {
    if (!speciesById.has(s.id)) throw new Error(`content: địa điểm ${loc.id} trỏ tới loài không có: ${s.id}`)
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
