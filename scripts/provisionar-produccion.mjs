// Aprovisiona el proyecto de producción DE PUNTA A PUNTA:
//   1. Aplica todas las migraciones de supabase/migrations/ (idempotentes).
//   2. Siembra el local desde el estado de la demo (carta, mesas, personal
//      con PIN hasheado) — sin tocar el proyecto de la demo (solo lectura).
//   3. Crea el usuario ADMIN (email) con app_metadata.local_id en el JWT y
//      genera un enlace de invitación para que el dueño fije SU contraseña.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx ADMIN_EMAIL=tu@email.com \
//     node scripts/provisionar-produccion.mjs
//
// Requiere el access token de la cuenta (Management API). Revócalo al acabar.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REF = process.env.PROJECT_REF || 'tesilntyomnovjcuieho'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
if (!TOKEN) { console.error('Falta SUPABASE_ACCESS_TOKEN'); process.exit(1) }
if (!ADMIN_EMAIL) { console.error('Falta ADMIN_EMAIL'); process.exit(1) }

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const api = `https://api.supabase.com/v1/projects/${REF}`

async function sql(query, etiqueta) {
  const r = await fetch(`${api}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${etiqueta}: HTTP ${r.status} — ${JSON.stringify(body).slice(0, 300)}`)
  return body
}

const q = s => `'${String(s).replace(/'/g, "''")}'`   // literal SQL seguro
const qj = o => `${q(JSON.stringify(o))}::jsonb`

// ── 1. Migraciones ──────────────────────────────────────────────────────────
const dir = join(raiz, 'supabase', 'migrations')
for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await sql(readFileSync(join(dir, f), 'utf8'), f)
  console.log(`✔ migración ${f}`)
}

// ── 2. Seed desde la demo (solo lectura del proyecto viejo) ─────────────────
const env = Object.fromEntries(readFileSync(join(raiz, '.env'), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const demo = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/estado?id=eq.1&select=data`, {
  headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
}).then(r => r.json()).then(d => d[0]?.data)
if (!demo) { console.error('No pude leer el estado de la demo'); process.exit(1) }

const slug = (demo.local?.nombre || 'mi-local').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const existe = await sql(`select id from locales where slug = ${q(slug)}`, 'check local')
let localId
if (existe.length) {
  localId = existe[0].id
  console.log(`✔ local '${slug}' ya existía (${localId}) — seed omitido`)
} else {
  const config = {
    ...demo.local,
    reservas: demo.reservasConfig || {},
    carta: {
      formatos: demo.carta.formatos, tiposPan: demo.carta.tiposPan,
      extras: demo.carta.extras, etiquetas: demo.carta.etiquetas,
    },
  }
  const res = await sql(
    `insert into locales (slug, nombre, config) values (${q(slug)}, ${q(demo.local.nombre)}, ${qj(config)}) returning id`,
    'insert local')
  localId = res[0].id

  const catSql = demo.carta.categorias.map((c, i) =>
    `insert into categorias (local_id, nombre, tipo, emoji, orden)
     values ('${localId}', ${q(c.nombre)}, ${q(c.tipo)}, ${q(c.emoji || '')}, ${i});`).join('\n')
  await sql(catSql, 'categorias')

  // mapa nombre-de-categoria-demo → id nuevo
  const cats = await sql(`select id, nombre from categorias where local_id = '${localId}'`, 'cats')
  const catId = {}
  demo.carta.categorias.forEach(c => {
    catId[c.id] = cats.find(x => x.nombre === c.nombre)?.id
  })

  const prodSql = demo.carta.productos.map((p, i) => {
    const precios = p.precios || { base: p.precio ?? 0 }
    const mods = { ingredientes: p.ingredientes || [], imagen: p.imagen || '' }
    return `insert into productos (local_id, categoria_id, nombre, descripcion, precios, modificadores, alergenos, disponible, orden)
      values ('${localId}', '${catId[p.categoria]}', ${q(p.nombre)}, ${q(p.descripcion || '')},
              ${qj(precios)}, ${qj(mods)},
              array[${(p.alergenos || []).map(q).join(',') || null}]::text[],
              ${p.disponible !== false}, ${i});`
  }).join('\n')
  await sql(prodSql, 'productos')

  const mesaSql = demo.mesas.map(m =>
    `insert into mesas (local_id, numero, zona, capacidad)
     values ('${localId}', ${m.numero}, ${q(m.zona || 'Sala')}, ${m.capacidad || 4});`).join('\n')
  await sql(mesaSql, 'mesas')

  const empSql = demo.empleados.map(e =>
    `insert into empleados (local_id, nombre, rol, activo, pin_hash)
     values ('${localId}', ${q(e.nombre)}, ${q(e.rol)}, ${e.activo !== false},
             crypt(${q(e.pin)}, gen_salt('bf')));`).join('\n')
  await sql(empSql, 'empleados')

  const n = await sql(`select
    (select count(*) from categorias where local_id='${localId}') cats,
    (select count(*) from productos where local_id='${localId}') prods,
    (select count(*) from mesas where local_id='${localId}') mesas,
    (select count(*) from empleados where local_id='${localId}') emps`, 'verify')
  console.log(`✔ seed '${slug}': ${n[0].cats} categorías · ${n[0].prods} productos · ${n[0].mesas} mesas · ${n[0].emps} empleados (PIN hasheado)`)
}

// ── 3. Usuario admin + invitación ───────────────────────────────────────────
const keys = await fetch(`${api}/api-keys`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json())
const service = keys.find?.(k => k.name === 'service_role')?.api_key
if (!service) { console.error('No pude obtener la service_role key'); process.exit(1) }
const authApi = `https://${REF}.supabase.co/auth/v1`
const authHdr = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }

// ¿existe ya?
const lista = await fetch(`${authApi}/admin/users?page=1&per_page=50`, { headers: authHdr }).then(r => r.json())
let user = (lista.users || []).find(u => u.email === ADMIN_EMAIL)
if (!user) {
  user = await fetch(`${authApi}/admin/users`, {
    method: 'POST', headers: authHdr,
    body: JSON.stringify({ email: ADMIN_EMAIL, email_confirm: true, app_metadata: { local_id: localId } }),
  }).then(r => r.json())
  if (!user.id) { console.error('Error creando usuario:', JSON.stringify(user).slice(0, 300)); process.exit(1) }
  console.log(`✔ usuario admin creado: ${ADMIN_EMAIL}`)
} else {
  await fetch(`${authApi}/admin/users/${user.id}`, {
    method: 'PUT', headers: authHdr,
    body: JSON.stringify({ app_metadata: { local_id: localId } }),
  })
  console.log(`✔ usuario ${ADMIN_EMAIL} ya existía — app_metadata.local_id actualizado`)
}

// vincular con el empleado admin del local
await sql(`update empleados set user_id = '${user.id}'
           where local_id = '${localId}' and rol = 'admin'
             and user_id is null`, 'vincular admin')

// enlace de recuperación → el dueño fija SU contraseña (nadie más la ve)
const link = await fetch(`${authApi}/admin/generate_link`, {
  method: 'POST', headers: authHdr,
  body: JSON.stringify({ type: 'recovery', email: ADMIN_EMAIL }),
}).then(r => r.json())

console.log('\n══════════════════════════════════════════════')
console.log(`LOCAL:    ${slug} (${localId})`)
console.log(`ADMIN:    ${ADMIN_EMAIL} (app_metadata.local_id en el JWT ✓)`)
console.log(`ENLACE para fijar tu contraseña (caduca pronto, úsalo ya):`)
console.log(link.action_link || JSON.stringify(link).slice(0, 300))
console.log('══════════════════════════════════════════════')
console.log('Recuerda: REVOCA el access token sbp_ cuando esto termine.')
