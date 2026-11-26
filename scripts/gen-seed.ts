// node --experimental-strip-types scripts/gen-seed.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { seedSql } from '../src/content/seedSql.ts'

const species = JSON.parse(readFileSync('content/species.json', 'utf8'))
const locations = JSON.parse(readFileSync('content/locations.json', 'utf8'))
writeFileSync('supabase/seed.sql', seedSql(species, locations))
console.log(`supabase/seed.sql: ${species.length} loài, ${locations.length} địa điểm`)
