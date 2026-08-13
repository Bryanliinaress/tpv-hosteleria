// ────────────────────────────────────────────────────────────────────────────
// Compara los permisos REALES de la base con lo que dice el repo.
//
//   npm run permisos
//
// Por qué existe: Supabase concede EXECUTE a `anon` y `authenticated` en
// cuanto se crea una función. Así que el permiso de verdad NO está escrito en
// ninguna parte del repo — lo pone la base sola, y leer el SQL no lo detecta.
// Pasó dos veces; una de ellas dejaba cerrar la cuenta sin pagar.
//
// Sale con código 1 si algo no cuadra, para poder meterlo en el deploy.
// Usa la service_role key de `.env.puente`; no hace falta token de la cuenta.
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const esperado = JSON.parse(readFileSync(join(RAIZ, 'supabase', 'permisos-esperados.json'), 'utf8'))

const env = Object.fromEntries(readFileSync(join(RAIZ, '.env.puente'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.puente')
  process.exit(1)
}

const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/revision_permisos`, {
  method: 'POST',
  headers: {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
})
if (!r.ok) {
  console.error(`No pude consultar los permisos: HTTP ${r.status}`)
  console.error((await r.text()).slice(0, 300))
  console.error('\n¿Está aplicada la migración 19? → node scripts/aplicar-migracion.mjs 19')
  process.exit(1)
}

const vivo = await r.json()
const permitidasAnon = new Set(esperado.anon.funciones)
const soloServidor = new Set(esperado.solo_servidor.funciones)

const abiertasDeMas = []   // el cliente puede llamarlas y no debería
const cerradasDeMas = []   // debería poder y no puede: función rota
const servidorAbierto = [] // las de dinero, al alcance de alguien

for (const f of vivo) {
  if (soloServidor.has(f.funcion)) {
    if (f.anon || f.autenticado) servidorAbierto.push(f)
    continue
  }
  if (f.anon && !permitidasAnon.has(f.funcion)) abiertasDeMas.push(f)
  if (!f.anon && permitidasAnon.has(f.funcion)) cerradasDeMas.push(f)
}

console.log(`${vivo.length} funciones en la base · ${permitidasAnon.size} permitidas al cliente\n`)

let mal = false

if (servidorAbierto.length) {
  mal = true
  console.error('🚨 FUNCIONES DE SERVIDOR AL ALCANCE DEL CLIENTE:')
  for (const f of servidorAbierto) {
    console.error(`   ${f.funcion}  (anon: ${f.anon}, autenticado: ${f.autenticado})`)
  }
  console.error('   → añade `revoke all on function … from public, anon, authenticated;`\n')
}

if (abiertasDeMas.length) {
  mal = true
  console.error('⚠️  ABIERTAS AL CLIENTE SIN ESTAR EN LA LISTA:')
  for (const f of abiertasDeMas) console.error(`   ${f.funcion}`)
  console.error('   → o es intencionado (añádela a permisos-esperados.json y explica por qué),')
  console.error('     o se abrió sola al crearla (ciérrala con un revoke).\n')
}

if (cerradasDeMas.length) {
  mal = true
  console.error('❌ EL CLIENTE NO PUEDE LLAMARLAS Y DEBERÍA (algo está roto):')
  for (const f of cerradasDeMas) console.error(`   ${f.funcion}`)
  console.error('')
}

if (!mal) console.log('✔ Los permisos de la base coinciden con lo que dice el repo.')
process.exit(mal ? 1 : 0)
