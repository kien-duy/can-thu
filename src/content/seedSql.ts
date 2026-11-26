// Sinh supabase/seed.sql từ content/*.json. Hàm thuần, không import gì ngoài type,
// để script Node (scripts/gen-seed.ts) và Vitest cùng dùng được.
import type { Location, Species } from './index'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

export function seedSql(species: readonly Species[], locations: readonly Location[], contentRev = 1): string {
  const lines = [
    '-- TỰ SINH từ content/*.json bằng `npm run seed:gen`. Đừng sửa tay.',
    'begin;',
    'insert into species (id, name_vi, min_weight_g, max_weight_g, content_rev) values',
    species.map((s) => `  (${q(s.id)}, ${q(s.nameVi)}, ${s.weightG[0]}, ${s.weightG[1]}, ${contentRev})`).join(',\n'),
    'on conflict (id) do update set name_vi = excluded.name_vi, min_weight_g = excluded.min_weight_g,',
    '  max_weight_g = excluded.max_weight_g, content_rev = excluded.content_rev;',
    'insert into locations (id, name_vi, kind) values',
    locations.map((l) => `  (${q(l.id)}, ${q(l.nameVi)}, ${q(l.kind)})`).join(',\n'),
    'on conflict (id) do update set name_vi = excluded.name_vi, kind = excluded.kind;',
    `delete from location_species where location_id in (${locations.map((l) => q(l.id)).join(', ')});`,
    'insert into location_species (location_id, species_id) values',
    locations.flatMap((l) => l.species.map((s) => `  (${q(l.id)}, ${q(s.id)})`)).join(',\n') + ';',
    'commit;',
    '',
  ]
  return lines.join('\n')
}
