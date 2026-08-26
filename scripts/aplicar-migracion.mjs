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
import { TABLA, BOOTSTRAP, planificar, huerfanas, registrar, numeroDe } from './lib/migraciones.mjs'

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


const args = process.argv.slice(2)
if (!args.length) {
  console.error('Uso: node scripts/aplicar-migracion.mjs <número…> | --todas | --estado\n')
  console.error('  --estado   dice en qué esquema está este proyecto, sin tocar nada')
  console.error('  --todas    aplica lo que falte (lo ya aplicado se salta)')
  console.error('  --rehacer  vuelve a aplicarlas aunque ya consten\n')
  console.error('Migraciones disponibles:')
  for (const f of todas) console.error(`  ${numeroDe(f) || '??'}  ${f}`)
  process.exit(1)
}

// ── Registro de lo aplicado ─────────────────────────────────────────────────
// Su tabla se crea sola: es la única que no puede venir de una migración,
// porque haría falta el registro para saber si hay que aplicarla.
await sql(BOOTSTRAP, 'registro de migraciones')
const aplicadas = await sql(`select fichero, huella from ${TABLA};`, 'leer el registro')

const ficheros = todas.map(f => ({ fichero: f, sql: readFileSync(join(dir, f), 'utf8') }))
const plan = planificar(ficheros, aplicadas)
const sueltas = huerfanas(ficheros, aplicadas)
const porFichero = new Map(plan.map(p => [p.fichero, p]))
const MARCA = { aplicada: '·', nueva: '+', cambiada: '!' }

const avisos = () => {
  const cambiadas = plan.filter(p => p.estado === 'cambiada')
  if (cambiadas.length) {
    console.log('\n⚠️  Migración editada DESPUÉS de aplicarse: el esquema de este proyecto')
    console.log('   ya no es el que dice el repo. Revísalo antes de seguir.')
    for (const c of cambiadas) console.log(`   · ${c.fichero}`)
  }
  if (sueltas.length) console.log(`\n⚠️  En la base pero ya no en el repo: ${sueltas.join(', ')}`)
}

if (args.includes('--estado')) {
  console.log(`Proyecto ${REF}\n`)
  for (const p of plan) {
    const cola = p.estado === 'aplicada' ? '' : `   (${p.estado})`
    console.log(`  ${MARCA[p.estado]} ${String(p.numero).padStart(2)}  ${p.fichero}${cola}`)
  }
  const nuevas = plan.filter(p => p.estado === 'nueva').length
  const cambiadas = plan.filter(p => p.estado === 'cambiada').length
  console.log(`\n${plan.length - nuevas - cambiadas} aplicadas · ${nuevas} pendientes · ${cambiadas} cambiadas`)
  avisos()
  process.exit(0)
}

const rehacer = args.includes('--rehacer')
const numeros = args.filter(a => !a.startsWith('--'))
// `--rehacer 34` rehace la 34, no las treinta y cuatro: si se nombran, mandan
// los nombres. Solo sin números se entiende «todas».
const pedidas = (!numeros.length && (args.includes('--todas') || rehacer))
  ? todas
  : numeros.map(n => {
      const f = todas.find(x => numeroDe(x) === String(n).padStart(2, '0'))
      if (!f) { console.error(`No hay ninguna migración ${n}`); process.exit(1) }
      return f
    })

// Lo ya aplicado y sin cambios se salta. Es lo que permite lanzar esto contra
// diez bares sin tener que acordarse de por dónde iba cada uno.
const elegidas = rehacer ? pedidas : pedidas.filter(f => porFichero.get(f)?.estado !== 'aplicada')
const saltadas = pedidas.length - elegidas.length

console.log(`Proyecto ${REF} · ${elegidas.length} por aplicar${saltadas ? ` · ${saltadas} ya estaban` : ''}\n`)
if (!elegidas.length) console.log('Nada que hacer: este proyecto ya está al día.')

for (const f of elegidas) {
  const p = porFichero.get(f)
  await sql(readFileSync(join(dir, f), 'utf8'), f)
  await sql(registrar(f, p.huella), `registrar ${f}`)
  console.log(`✔ ${f}${p.estado === 'cambiada' ? '   (había cambiado)' : ''}`)
}

avisos()
console.log('\nListo.')
console.log('Comprueba de paso que no se ha abierto nada sin querer: npm run permisos')
