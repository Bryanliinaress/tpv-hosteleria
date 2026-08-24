// ────────────────────────────────────────────────────────────────────────────
// ¿Cómo está este bar?
//
//   npm run salud                    → el proyecto de .env.puente
//   PROJECT_REF=otro npm run salud   → cualquier otro
//
// Existe porque hasta ahora la única forma de enterarse de que un bar tenía un
// problema era que llamasen. Un comando por bar y en diez segundos sabes si hay
// algo que atender: tickets sin llegar a Hacienda, dinero cobrado que no cuadra
// con ninguna cuenta, pantallas rompiéndose, o un proyecto que Supabase ha
// pausado por inactividad (el plan gratuito lo hace tras ~1 semana).
//
// No manda nada a ningún sitio: solo lee.
// ────────────────────────────────────────────────────────────────────────────
import { entorno, consulta } from './lib/sql-test.mjs'

const env = entorno()
if (!env.token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN (está en .env.puente).')
  process.exit(1)
}

const CONSULTA = `
select
  (select nombre from locales order by creado_en limit 1) as local,
  (select count(*) from mesas where estado <> 'libre') as mesas_abiertas,
  (select count(*) from tickets where cerrado_en > now() - interval '1 day') as tickets_24h,
  (select coalesce(sum(total), 0) from tickets where cerrado_en > now() - interval '1 day') as facturado_24h,
  (select max(cerrado_en) from tickets) as ultimo_ticket,
  (select count(*) from tickets where fiscal_estado in ('pendiente', 'error')) as fiscal_pendiente,
  (select count(*) from pagos_online where ticket is null) as pagos_sin_cuenta,
  (select coalesce(sum(importe), 0) from pagos_online where ticket is null) as importe_sin_cuenta,
  (select count(*) from comandas where estado <> 'listo' and hora_entrada < now() - interval '2 hours') as comandas_atascadas,
  (select count(*) from dispositivos where estado = 'aprobado') as dispositivos,
  (select count(*) from schema_migraciones) as migraciones;`

const INCIDENCIAS = `
select clase, mensaje, pantalla, veces, ultima
  from incidencias
 where ultima > now() - interval '7 days'
 order by ultima desc limit 8;`

const arranque = Date.now()
const { ok, body } = await consulta(env, CONSULTA)
const tardanza = Date.now() - arranque

if (!ok) {
  console.log(`✖ ${env.ref} · NO RESPONDE`)
  console.log(`  ${String(body?.message || '').slice(0, 200)}`)
  console.log('\n  Si el subdominio no resuelve, el plan gratuito de Supabase ha pausado')
  console.log('  el proyecto por inactividad: entra al panel y pulsa «Resume project».')
  process.exit(1)
}

const s = body[0]
const avisos = []
const linea = (etiqueta, valor) => console.log(`  ${etiqueta.padEnd(24)} ${valor}`)
const cuando = (t) => (t ? new Date(t).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—')

console.log(`\n${s.local || '(sin nombre)'} · ${env.ref} · respondió en ${tardanza} ms\n`)
linea('Mesas abiertas', s.mesas_abiertas)
linea('Tickets (24 h)', `${s.tickets_24h}  ·  ${Number(s.facturado_24h).toFixed(2)} €`)
linea('Último ticket', cuando(s.ultimo_ticket))
linea('Dispositivos con acceso', s.dispositivos)
linea('Migraciones aplicadas', s.migraciones)

if (Number(s.fiscal_pendiente) > 0) avisos.push(`${s.fiscal_pendiente} ticket(s) sin registrar en Hacienda`)
if (Number(s.pagos_sin_cuenta) > 0) avisos.push(`${s.pagos_sin_cuenta} cobro(s) sin cuenta · ${Number(s.importe_sin_cuenta).toFixed(2)} € que hay que devolver`)
if (Number(s.comandas_atascadas) > 0) avisos.push(`${s.comandas_atascadas} comanda(s) llevan más de 2 h sin marcarse listas`)
if (Number(s.dispositivos) === 0) avisos.push('ningún dispositivo con acceso: nadie puede entrar al TPV')

const inc = await consulta(env, INCIDENCIAS)
const incidencias = inc.ok ? inc.body : []
if (incidencias.length) {
  console.log('\nSe ha roto algo (últimos 7 días):')
  for (const i of incidencias) {
    console.log(`  ×${String(i.veces).padEnd(4)} ${i.clase.padEnd(8)} ${i.pantalla || '—'}`)
    console.log(`         ${i.mensaje.slice(0, 110)}`)
  }
}

if (avisos.length) {
  console.log('\nPara atender:')
  for (const a of avisos) console.log(`  ⚠️  ${a}`)
} else if (!incidencias.length) {
  console.log('\n✔ Nada que atender.')
}
console.log('')
process.exit(avisos.length ? 1 : 0)
