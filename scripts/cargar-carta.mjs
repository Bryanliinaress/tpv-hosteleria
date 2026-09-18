// ────────────────────────────────────────────────────────────────────────────
// Carga la carta de un bar desde un fichero JSON a SU proyecto de Supabase.
//
//   node scripts/cargar-carta.mjs casa-loli ruta/carta.json            → dice qué haría
//   node scripts/cargar-carta.mjs casa-loli ruta/carta.json --aplicar  → la escribe
//
// Nació con el primer cliente real. `copiar-carta.mjs` copia la carta de la
// demo y la plantilla de fábrica siembra una de ejemplo: ninguna sirve para un
// bar que llega con la suya. Casa Loli son 75 productos, y a mano son 75
// oportunidades de teclear mal un precio.
//
// ── Lo que NO hace, a propósito ─────────────────────────────────────────────
// No borra nada. Si el local ya tiene productos, se planta y lo dice: en la
// base de un cliente, «lo dejo como estaba» siempre es mejor respuesta que
// adivinar. Para rellenar huecos en una carta que ya existe está
// `copiar-carta.mjs`, que solo añade.
//
// ── La clave de servicio ────────────────────────────────────────────────────
// Cada bar tiene su proyecto, así que cada uno tiene su `service_role`. En
// `.env.puente` van como `SUPABASE_SERVICE_KEY_<SLUG>` (el slug en mayúsculas,
// con guiones bajos):
//
//     SUPABASE_SERVICE_KEY_CASA_LOLI=eyJ...
//
// La URL NO se coge del entorno: sale del perfil del local. Con una sola
// `SUPABASE_URL` en el entorno, apuntar al bar equivocado es cuestión de
// tiempo, y aquí eso significa escribirle la carta de otro.
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { revisarCarta, filasCategorias, filasProductos, resumen } from './lib/carta.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const [slug, fichero] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const aplicar = process.argv.includes('--aplicar')

if (!slug || !fichero) {
  console.error('Uso: node scripts/cargar-carta.mjs <slug> <carta.json> [--aplicar]')
  process.exit(1)
}

// ── Perfil del local y clave de servicio ────────────────────────────────────
let perfil
try {
  perfil = JSON.parse(readFileSync(join(RAIZ, 'locales', slug, 'perfil.json'), 'utf8'))
} catch {
  console.error(`✖ No encuentro locales/${slug}/perfil.json`)
  process.exit(1)
}
if (!perfil.supabase?.url) {
  console.error(`✖ El perfil de «${slug}» no tiene todavía su proyecto de Supabase (supabase.url está a null).`)
  process.exit(1)
}

// `.env.puente` puede no existir (una máquina recién montada, o CI). Eso no es
// un error si la clave viene por entorno; lo que sí lo es es no tenerla, y eso
// se dice abajo con su nombre en vez de con un ENOENT en crudo.
let env = {}
try {
  env = Object.fromEntries(
    readFileSync(join(RAIZ, '.env.puente'), 'utf8')
      .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
} catch { /* sin fichero: se tira del entorno */ }

const CLAVE = `SUPABASE_SERVICE_KEY_${slug.toUpperCase().replace(/-/g, '_')}`
const servicioKey = process.env[CLAVE] || env[CLAVE]
if (!servicioKey) {
  console.error(`✖ Falta ${CLAVE} en .env.puente (la service_role del proyecto de «${slug}»).`)
  process.exit(1)
}

const api = `${perfil.supabase.url}/rest/v1`
const cab = {
  apikey: servicioKey,
  Authorization: `Bearer ${servicioKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}
const pedir = async (ruta, opciones = {}) => {
  const r = await fetch(`${api}${ruta}`, { ...opciones, headers: cab })
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status} — ${JSON.stringify(cuerpo).slice(0, 300)}`)
  return cuerpo
}

// ── La carta, revisada antes de mirar siquiera la base ──────────────────────
let carta
try {
  carta = JSON.parse(readFileSync(fichero, 'utf8'))
} catch (e) {
  console.error(`✖ No pude leer «${fichero}»: ${e.message}`)
  process.exit(1)
}

const fallos = revisarCarta(carta)
if (fallos.length) {
  console.error(`✖ La carta tiene ${fallos.length} problema(s). No toco nada:\n`)
  for (const f of fallos) console.error(`   · ${f}`)
  process.exit(1)
}

// ── Qué hay ya en el destino ────────────────────────────────────────────────
const locales = await pedir('/locales?select=id,nombre')
if (!locales.length) {
  console.error(`✖ El proyecto de «${slug}» no tiene ningún local. Aplica antes las migraciones.`)
  process.exit(1)
}
const local = locales[0]
const yaHay = await pedir('/productos?select=id&limit=1')
if (yaHay.length) {
  console.error(`✖ «${local.nombre}» ya tiene productos. No los piso ni los borro.`)
  console.error('   Si quieres AÑADIR lo que falte, usa copiar-carta.mjs.')
  console.error('   Si de verdad quieres empezar de cero, vacía la carta a mano y vuelve.')
  process.exit(1)
}

// ── Lo que se va a escribir ─────────────────────────────────────────────────
const r = resumen(carta)
console.log(`\nCarta para «${local.nombre}» (${slug} · ${perfil.supabase.ref || perfil.supabase.url})\n`)
for (const c of r.porCategoria) console.log(`  ${String(c.cuantos).padStart(3)}  ${c.nombre}`)
console.log(`\n  ${r.productos} productos · ${r.conMenu} con grupos de menú · ${r.sinAlergenos} sin alérgenos declarados`)
if (r.sinAlergenos) {
  console.log('\n  ⚠️  Los que no declaran alérgenos salen como «sin alérgenos» en la carta')
  console.log('     del cliente. Si es que no se han rellenado, mejor rellenarlos antes.')
}

if (!aplicar) {
  console.log('\n(no he escrito nada — repite con --aplicar)\n')
  process.exit(0)
}

// ── Escribir ────────────────────────────────────────────────────────────────
const cats = await pedir('/categorias', {
  method: 'POST', body: JSON.stringify(filasCategorias(carta, local.id)),
})
const idDe = {}
carta.categorias.forEach((c) => { idDe[c.id] = cats.find(x => x.nombre === c.nombre)?.id })

const productos = filasProductos(carta, local.id, idDe)
await pedir('/productos', { method: 'POST', body: JSON.stringify(productos) })

// Que la petición no diera error dice que se PIDIÓ, no que esté. Se vuelve a
// leer y se cuenta: es la misma lección que la impresora que decía imprimir
// durante dieciséis días sin sacar un papel.
const [catsEnBase, prodsEnBase] = await Promise.all([
  pedir('/categorias?select=id'),
  pedir('/productos?select=id'),
])
if (catsEnBase.length !== cats.length || prodsEnBase.length !== productos.length) {
  console.error(`\n✖ Escribí ${cats.length} categorías y ${productos.length} productos,`)
  console.error(`   pero la base tiene ${catsEnBase.length} y ${prodsEnBase.length}. Revísalo antes de seguir.`)
  process.exit(1)
}

console.log(`\n✔ ${cats.length} categorías y ${productos.length} productos creados en «${local.nombre}»,`)
console.log('   y releídos de la base para confirmarlo.')
console.log('   Aun así, ábrelo en Admin › Carta antes de dar el día por bueno.\n')
