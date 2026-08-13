// ────────────────────────────────────────────────────────────────────────────
// Aplica UNA migración (o varias) a un proyecto de Supabase.
//
// Hasta ahora la única forma de aplicar SQL era `provisionar-produccion.mjs`,
// que además siembra la carta y crea usuarios: demasiado para añadir una
// función. Esto hace solo lo que dice.
//
//   SUPABASE_ACCESS_TOKEN=sbp_… node scripts/aplicar-migracion.mjs 14
//   SUPABASE_ACCESS_TOKEN=sbp_… PROJECT_REF=otro node scripts/aplicar-migracion.mjs --todas
//
// El número es el prefijo del fichero (`…T14_compartir_plato.sql` → `14`).
// Las migraciones están escritas para poder aplicarse más de una vez
// (`create or replace`, `if not exists`), así que repetir no rompe nada.
//
// Revoca el token cuando termines.
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ_ENV = join(dirname(fileURLToPath(import.meta.url)), '..')
// El token vive en `.env.puente` (fuera del repo), junto a las demás claves
// del local. Lo del entorno manda, por si hace falta usar otro puntualmente.
try {
  for (const linea of readFileSync(join(RAIZ_ENV, '.env.puente'), 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* sin fichero: se usa lo que haya en el entorno */ }

const REF = process.env.PROJECT_REF || 'tesilntyomnovjcuieho'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN (Supabase → Account → Access Tokens)')
  process.exit(1)
}

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(raiz, 'supabase', 'migrations')
const todas = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Uso: node scripts/aplicar-migracion.mjs <número…> | --todas\n')
  console.error('Migraciones disponibles:')
  for (const f of todas) console.error(`  ${(f.match(/T(\d+)_/) || [])[1] || '??'}  ${f}`)
  process.exit(1)
}

const elegidas = args.includes('--todas')
  ? todas
  : args.map(n => {
      const f = todas.find(x => (x.match(/T(\d+)_/) || [])[1] === String(n).padStart(2, '0'))
      if (!f) { console.error(`No hay ninguna migración ${n}`); process.exit(1) }
      return f
    })

async function sql(query, etiqueta) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${etiqueta}: HTTP ${r.status} — ${JSON.stringify(body).slice(0, 400)}`)
  return body
}

console.log(`Proyecto ${REF} · ${elegidas.length} migración(es)\n`)
for (const f of elegidas) {
  await sql(readFileSync(join(dir, f), 'utf8'), f)
  console.log(`✔ ${f}`)
}
console.log('\nListo.')
console.log('Comprueba de paso que no se ha abierto nada sin querer: npm run permisos')
