// Aplica las migraciones de supabase/migrations/ en orden, dentro de una
// transacción cada una. Uso:
//
//   SUPABASE_DB_URL="postgresql://postgres:CONTRASEÑA@db.<ref>.supabase.co:5432/postgres" \
//     node scripts/aplicar-migraciones.mjs
//
// (o el connection string del "Session pooler" del panel Connect si tu red no
// tiene IPv6). Idempotente: las migraciones usan create ... if not exists /
// create or replace, así que re-ejecutar es seguro.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('Falta SUPABASE_DB_URL (connection string de la BBDD).')
  process.exit(1)
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')
const ficheros = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
console.log(`Conectado. Migraciones a aplicar (en orden): ${ficheros.join(', ')}`)

for (const f of ficheros) {
  const sql = readFileSync(join(dir, f), 'utf8')
  process.stdout.write(`→ ${f} … `)
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    console.log('OK')
  } catch (e) {
    await client.query('rollback')
    console.error(`FALLO\n   ${e.message}${e.position ? ` (posición ${e.position})` : ''}`)
    await client.end()
    process.exit(1)
  }
}

// Verificación: tablas y funciones esperadas
const { rows: tablas } = await client.query(
  `select count(*)::int as n from information_schema.tables
   where table_schema = 'public' and table_name in
   ('locales','empleados','mesas','categorias','productos','comensales',
    'lineas_pedido','comandas','avisos','reservas','tickets','cierres_caja','anulaciones')`)
const { rows: funcs } = await client.query(
  `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like any (array['qr\\_%','crear_reserva','cobrar_mesa','pagar_parte','verificar_pin'])`)
console.log(`✔ ${tablas[0].n}/13 tablas · ${funcs[0].n} funciones RPC de servicio`)
await client.end()
