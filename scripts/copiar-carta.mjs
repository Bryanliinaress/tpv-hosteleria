// ────────────────────────────────────────────────────────────────────────────
// Copia a un local los productos de la demo v1 que le falten.
//
//   node scripts/copiar-carta.mjs marchando           → dice qué falta
//   node scripts/copiar-carta.mjs marchando --aplicar → los crea
//
// Nació porque al consolidar los dos enlaces la carta de v2 se había quedado
// atrás: le faltaba el «Menú del día» entero —con sus grupos y suplementos—,
// que es justo una de las cosas que hay que poder enseñar.
//
// Solo AÑADE lo que no existe (compara por nombre). No toca ni borra nada.
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const slug = process.argv[2]
const aplicar = process.argv.includes('--aplicar')

if (!slug) {
  console.error('Uso: node scripts/copiar-carta.mjs <slug> [--aplicar]')
  process.exit(1)
}

const perfil = (s) => JSON.parse(readFileSync(join(RAIZ, 'locales', s, 'perfil.json'), 'utf8'))
const origen = perfil('demo')
const destino = perfil(slug)

const env = Object.fromEntries(readFileSync(join(RAIZ, '.env.puente'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))

const anon = (p) => ({ apikey: p.supabase.anonKey, Authorization: `Bearer ${p.supabase.anonKey}` })
const servicio = {
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

// Origen: el estado de la demo es un único blob JSON
const blob = await fetch(`${origen.supabase.url}/rest/v1/estado?id=eq.1&select=data`, { headers: anon(origen) })
  .then(r => r.json()).then(d => d[0]?.data)
if (!blob) { console.error('No pude leer el estado de la demo'); process.exit(1) }

const [cats, prods] = await Promise.all([
  fetch(`${env.SUPABASE_URL}/rest/v1/categorias?select=id,nombre,orden`, { headers: servicio }).then(r => r.json()),
  fetch(`${env.SUPABASE_URL}/rest/v1/productos?select=nombre,categoria_id,orden`, { headers: servicio }).then(r => r.json()),
])

const yaEstan = new Set(prods.map(p => p.nombre))
const faltan = blob.carta.productos.filter(p => !yaEstan.has(p.nombre))

if (!faltan.length) { console.log('No falta ningún producto: las cartas coinciden.'); process.exit(0) }

// categoría de la demo → categoría del destino, por nombre
const catDemo = Object.fromEntries(blob.carta.categorias.map(c => [c.id, c.nombre]))
const catDestino = Object.fromEntries(cats.map(c => [c.nombre, c.id]))
const localId = (await fetch(`${env.SUPABASE_URL}/rest/v1/locales?select=id`, { headers: servicio }).then(r => r.json()))[0].id
const ordenBase = Math.max(0, ...prods.map(p => p.orden ?? 0)) + 1

console.log(`Faltan ${faltan.length} producto(s) en «${slug}»:\n`)
const filas = []
for (const [i, p] of faltan.entries()) {
  const nombreCat = catDemo[p.categoria]
  const catId = catDestino[nombreCat]
  const marca = p.menu ? '  ← MENÚ DEL DÍA (con sus grupos y suplementos)' : ''
  console.log(`  · ${p.nombre}  [${nombreCat || '¿sin categoría?'}]${marca}`)
  if (!catId) { console.log('      ⚠️  esa categoría no existe en el destino: se omite'); continue }
  filas.push({
    local_id: localId,
    categoria_id: catId,
    nombre: p.nombre,
    descripcion: p.descripcion || '',
    precios: p.precios || { base: p.precio ?? 0 },
    modificadores: {
      ingredientes: p.ingredientes || [],
      imagen: p.imagen || '',
      ...(p.menu ? { menu: p.menu } : {}),
      ...(p.nombreEn ? { nombreEn: p.nombreEn } : {}),
      ...(p.descripcionEn ? { descripcionEn: p.descripcionEn } : {}),
    },
    alergenos: p.alergenos || [],
    disponible: p.disponible !== false,
    orden: ordenBase + i,
  })
}

if (!aplicar) {
  console.log('\n(nada cambiado — vuelve a lanzarlo con --aplicar para crearlos)')
  process.exit(0)
}

const r = await fetch(`${env.SUPABASE_URL}/rest/v1/productos`, {
  method: 'POST', headers: servicio, body: JSON.stringify(filas),
})
if (!r.ok) { console.error('\n✖ falló:', r.status, (await r.text()).slice(0, 300)); process.exit(1) }
console.log(`\n✔ ${filas.length} producto(s) creados en «${slug}».`)
