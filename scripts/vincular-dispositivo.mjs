// ────────────────────────────────────────────────────────────────────────────
// Vincula un dispositivo del bar (el PC del mostrador, la tablet del camarero).
//
//   node scripts/vincular-dispositivo.mjs casa-loli
//
// Imprime un enlace de un solo uso. Lo abres EN ESE dispositivo y queda
// emparejado para siempre: a partir de ahí el personal entra con su PIN y no
// vuelve a ver esta pantalla.
//
// POR QUÉ EXISTE: este TPV se monta personalizado para cada bar — el dueño no
// se registra ni crea nada. Lo único que hacía falta era conectar cada aparato
// una vez, y eso se estaba resolviendo con un email y una contraseña que
// alguien tenía que recordar. Con esto no hay contraseña que perder.
//
// El enlace da acceso al local: trátalo como una llave. Caduca en una hora y
// solo sirve una vez.
//
// Lee las claves de `.env.puente` (fuera del repo, en el PC del local).
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const slug = process.argv[2]

if (!slug) {
  console.error('Uso: node scripts/vincular-dispositivo.mjs <slug-del-local>')
  process.exit(1)
}

let perfil
try {
  perfil = JSON.parse(readFileSync(join(RAIZ, 'locales', slug, 'perfil.json'), 'utf8'))
} catch {
  console.error(`No encuentro locales/${slug}/perfil.json`)
  process.exit(1)
}

const destino = perfil.despliegue?.url
if (!destino) {
  console.error(`El perfil de ${slug} no tiene despliegue.url`)
  process.exit(1)
}

// Claves de servicio del local
let env
try {
  env = Object.fromEntries(readFileSync(join(RAIZ, '.env.puente'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
} catch {
  console.error('No encuentro .env.puente (lleva SUPABASE_URL y SUPABASE_SERVICE_KEY).')
  process.exit(1)
}
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
  console.error('A .env.puente le falta SUPABASE_URL o SUPABASE_SERVICE_KEY.')
  process.exit(1)
}

const hdr = {
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// La cuenta del local: la que aprovisionó el alta. Si hubiera varias, la que
// lleva el local_id en el JWT, que es la que ven las policies.
const lista = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers: hdr })
  .then(r => r.json()).catch(() => null)
const usuarios = lista?.users || []
const cuenta = usuarios.find(u => u.app_metadata?.local_id) || usuarios[0]

if (!cuenta) {
  console.error('Este proyecto no tiene ninguna cuenta todavía.')
  console.error('Aprovisiona el local primero: node scripts/provisionar-produccion.mjs')
  process.exit(1)
}

const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: hdr,
  // `redirect_to` va aquí arriba: dentro de `options` se ignora en silencio.
  body: JSON.stringify({ type: 'magiclink', email: cuenta.email, redirect_to: destino }),
})
const body = await r.json().catch(() => null)
if (!r.ok) {
  console.error(`No se pudo generar el enlace: HTTP ${r.status}`)
  console.error(JSON.stringify(body).slice(0, 300))
  process.exit(1)
}

const enlace = body.properties?.action_link || body.action_link
const vuelveA = new URL(enlace).searchParams.get('redirect_to')

console.log(`\n▶ ${perfil.marca?.nombre || slug} · cuenta ${cuenta.email}\n`)
console.log('Abre ESTE enlace en el dispositivo que quieras emparejar:\n')
console.log(enlace)
console.log('\nUn solo uso · caduca en ~1 hora · trátalo como una llave.')

if (vuelveA && !destino.startsWith(vuelveA.replace(/\/$/, ''))) {
  console.log(`\n⚠️  OJO: el enlace devuelve a «${vuelveA}», no a «${destino}».`)
  console.log('   Supabase solo redirige a URLs de su lista blanca; si la de la app')
  console.log('   no está, cae al Site URL del proyecto. Añádela en')
  console.log('   Authentication → URL Configuration (Site URL y Redirect URLs).')
  console.log('   Afecta también a los correos de confirmación y de contraseña.')
}
