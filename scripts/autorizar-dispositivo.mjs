// ────────────────────────────────────────────────────────────────────────────
// Autoriza un dispositivo desde fuera de la app.
//
//   node scripts/autorizar-dispositivo.mjs             → lista las solicitudes
//   node scripts/autorizar-dispositivo.mjs 418302      → autoriza esa
//   node scripts/autorizar-dispositivo.mjs 418302 "Tablet barra"
//   node scripts/autorizar-dispositivo.mjs --revocar <id>
//
// POR QUÉ EXISTE: normalmente los dispositivos los autoriza el encargado desde
// Admin → Dispositivos. Pero el PRIMERO no puede — para entrar al panel hay que
// estar autorizado, y para autorizar hay que estar dentro. El huevo y la
// gallina.
//
// Lo resuelve quien monta el bar, que por definición ya tiene la llave: la
// service key de `.env.puente`. El día de la instalación abres el TPV en el PC
// del local, te sale su código, y lo autorizas desde aquí. A partir de ese
// momento el encargado ya puede autorizar los demás desde su panel.
//
// También es la salida si algún día se revocan todos los dispositivos por
// error y nadie puede entrar: esto no depende de que haya nadie dentro.
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

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
  Prefer: 'return=representation',
}
const api = (ruta, opts = {}) => fetch(`${env.SUPABASE_URL}/rest/v1/${ruta}`, { headers: hdr, ...opts })

const cuando = (t) => t ? new Date(t).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const [arg1, arg2] = process.argv.slice(2)

// ── Revocar ─────────────────────────────────────────────────────────────────
if (arg1 === '--revocar') {
  if (!arg2) { console.error('Uso: node scripts/autorizar-dispositivo.mjs --revocar <id>'); process.exit(1) }
  const fila = await api(`dispositivos?id=eq.${arg2}&select=id,nombre,user_id`).then(r => r.json())
  if (!fila.length) { console.error(`No hay ningún dispositivo con id ${arg2}`); process.exit(1) }

  await api(`dispositivos?id=eq.${arg2}`, { method: 'PATCH', body: JSON.stringify({ estado: 'revocado' }) })
  // Su cuenta muere con él: si no, la sesión que ya tiene seguiría valiendo.
  if (fila[0].user_id) {
    await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${fila[0].user_id}`, { method: 'DELETE', headers: hdr })
  }
  console.log(`✔ «${fila[0].nombre}» revocado. Su sesión deja de valer ahora mismo.`)
  process.exit(0)
}

// ── Listar ──────────────────────────────────────────────────────────────────
if (!arg1) {
  const todos = await api('dispositivos?select=id,nombre,codigo,estado,creado_en,aprobado_en,ultimo_uso&order=creado_en.desc')
    .then(r => r.json())

  const pendientes = todos.filter(d => d.estado === 'pendiente')
  const activos = todos.filter(d => d.estado === 'aprobado')

  if (!pendientes.length && !activos.length) {
    console.log('Todavía no hay ningún dispositivo.\n')
    console.log('Abre el TPV en el aparato que quieras conectar: te dará un código de 6')
    console.log('dígitos. Luego vuelve aquí y ejecútalo con ese código.')
    process.exit(0)
  }

  if (pendientes.length) {
    console.log(`\nESPERANDO AUTORIZACIÓN (${pendientes.length}):\n`)
    for (const d of pendientes) {
      console.log(`  ${d.codigo}   ${d.nombre.padEnd(22)} pidió acceso ${cuando(d.creado_en)}`)
    }
    console.log(`\n  → node scripts/autorizar-dispositivo.mjs ${pendientes[0].codigo}`)
  } else {
    console.log('\nNo hay solicitudes pendientes.')
  }

  if (activos.length) {
    console.log(`\nAUTORIZADOS (${activos.length}):\n`)
    for (const d of activos) {
      console.log(`  ${d.nombre.padEnd(22)} desde ${cuando(d.aprobado_en)} · último uso ${cuando(d.ultimo_uso)}`)
      console.log(`  ${''.padEnd(22)} id ${d.id}`)
    }
    console.log('\n  → para quitar uno: node scripts/autorizar-dispositivo.mjs --revocar <id>')
  }
  console.log('')
  process.exit(0)
}

// ── Autorizar ───────────────────────────────────────────────────────────────
const codigo = arg1.replace(/\D/g, '')
if (codigo.length !== 6) {
  console.error(`«${arg1}» no parece un código de 6 dígitos.`)
  process.exit(1)
}

const fila = await api(`dispositivos?codigo=eq.${codigo}&estado=eq.pendiente&select=id,nombre`).then(r => r.json())
if (!fila.length) {
  console.error(`No hay ninguna solicitud pendiente con el código ${codigo}.`)
  console.error('Los códigos caducan a la hora: si ha pasado más tiempo, vuelve a pedirlo en el aparato.')
  process.exit(1)
}

const cambios = { estado: 'aprobado', aprobado_en: new Date().toISOString() }
if (arg2) cambios.nombre = arg2

const r = await api(`dispositivos?id=eq.${fila[0].id}`, { method: 'PATCH', body: JSON.stringify(cambios) })
if (!r.ok) { console.error('✖ no se pudo autorizar:', r.status, (await r.text()).slice(0, 200)); process.exit(1) }

console.log(`\n✔ Autorizado: «${cambios.nombre || fila[0].nombre}»`)
console.log('  El aparato entra solo en unos segundos, sin tocar nada.')
console.log('  A partir de ahora el encargado puede autorizar los demás desde Admin → Dispositivos.\n')
