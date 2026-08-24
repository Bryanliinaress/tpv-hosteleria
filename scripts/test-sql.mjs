// ────────────────────────────────────────────────────────────────────────────
// Pruebas del SQL del dinero, contra la base de verdad y sin dejar rastro.
//
//   npm run test:sql
//
// Cada prueba corre dentro de una transacción que SIEMPRE se deshace, así que
// se puede lanzar contra el proyecto de la demo sin ensuciarlo. Necesita
// `SUPABASE_ACCESS_TOKEN` (vive en `.env.puente`, fuera del repo), por eso no
// corre en CI: los tests de JS sí, estos son para antes de tocar el SQL.
// ────────────────────────────────────────────────────────────────────────────
import { entorno, consulta, envolver, comprobar, comprobarIgual, FIN } from './lib/sql-test.mjs'
import { PRUEBAS } from './lib/pruebas-dinero.mjs'

const env = entorno()
if (!env.token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN (está en .env.puente).')
  process.exit(1)
}

// Foto de antes: al terminar tiene que ser idéntica, o alguna prueba habrá
// dejado algo escrito y eso invalidaría el resto.
const FOTO = `select
  (select count(*) from tickets) tickets,
  (select count(*) from comensales) comensales,
  (select count(*) from lineas_pedido) lineas,
  (select count(*) from pagos_online) pagos,
  (select count(*) from mesas where estado <> 'libre') ocupadas;`

const antes = (await consulta(env, FOTO)).body?.[0]

console.log(`Proyecto ${env.ref} · ${PRUEBAS.length} pruebas del dinero\n`)

let fallos = 0
for (const { nombre, cuerpo } of PRUEBAS) {
  const { body } = await consulta(env, envolver(cuerpo({ comprobar, comprobarIgual })))
  const mensaje = String(body?.message || '')
  if (mensaje.includes(FIN)) {
    console.log(`  ✔ ${nombre}`)
  } else {
    fallos++
    const limpio = mensaje.replace(/^Failed to run sql query: ERROR:\s*/, '').split('\n')[0]
    console.log(`  ✖ ${nombre}\n      ${limpio || JSON.stringify(body).slice(0, 200)}`)
  }
}

const despues = (await consulta(env, FOTO)).body?.[0]
const intacto = JSON.stringify(antes) === JSON.stringify(despues)
console.log(`\n${PRUEBAS.length - fallos}/${PRUEBAS.length} pruebas · base ${intacto ? 'intacta ✔' : 'MODIFICADA ✖'}`)
if (!intacto) {
  console.log(`  antes:   ${JSON.stringify(antes)}`)
  console.log(`  después: ${JSON.stringify(despues)}`)
}
process.exit(fallos || !intacto ? 1 : 0)
