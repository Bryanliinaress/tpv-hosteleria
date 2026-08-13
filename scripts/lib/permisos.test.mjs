import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ────────────────────────────────────────────────────────────────────────────
// Quién puede llamar a qué, revisado en cada `npm test`.
//
// Esto NO sustituye a `npm run permisos`, que le pregunta a la base de verdad
// y es el único que ve los permisos que nadie escribió: Supabase concede
// EXECUTE a `anon` y `authenticated` en cuanto se crea una función. Así se
// colaron dos, y una dejaba cerrar la cuenta sin pagar.
//
// Lo que vigila esto es lo otro: que los GRANT del repo y la lista revisada a
// mano no se contradigan, y que nadie abra al cliente algo que mueve dinero.
// Corre en CI, sin secretos.
// ────────────────────────────────────────────────────────────────────────────

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(RAIZ, 'supabase', 'migrations')
const esperado = JSON.parse(readFileSync(join(RAIZ, 'supabase', 'permisos-esperados.json'), 'utf8'))

const migraciones = () => readdirSync(DIR).filter(x => x.endsWith('.sql')).sort()

// Las migraciones se explican a sí mismas, y a veces citan el SQL que estaba
// mal para contar por qué. Sin quitar los comentarios, el análisis se cree esas
// citas: la 21 explica el revoke defectuoso de la 11 y se denunciaba sola.
const leerSql = (f) => readFileSync(join(DIR, f), 'utf8').replace(/--[^\n]*/g, '')
const RE_GRANT = /grant\s+execute\s+on\s+function\s+([a-z_0-9]+)\s*\([^)]*\)\s*to\s+([^;]+);/gi
const RE_REVOKE = /revoke\s+all\s+on\s+function\s+([a-z_0-9]+)\s*\([^)]*\)\s*from\s+([^;]+);/gi

// Recorre las migraciones en orden y se queda con el último grant/revoke de
// cada función: ese es el estado que el repo declara.
function intencion() {
  const anon = new Set()
  const auth = new Set()
  for (const f of migraciones()) {
    const sql = leerSql(f)
    for (const m of sql.matchAll(RE_GRANT)) {
      const roles = m[2].toLowerCase()
      if (roles.includes('anon')) anon.add(m[1])
      if (roles.includes('authenticated')) auth.add(m[1])
    }
    for (const m of sql.matchAll(RE_REVOKE)) {
      const roles = m[2].toLowerCase()
      if (roles.includes('anon')) anon.delete(m[1])
      if (roles.includes('authenticated')) auth.delete(m[1])
    }
  }
  return { anon, auth }
}

describe('permisos declarados en las migraciones', () => {
  const { anon, auth } = intencion()
  const permitidas = new Set(esperado.anon.funciones)
  const servidor = new Set(esperado.solo_servidor.funciones)

  it('el parser ve grants de verdad (si no, no está mirando nada)', () => {
    expect(anon.size).toBeGreaterThan(5)
    expect(auth.size).toBeGreaterThan(5)
  })

  it('nada se abre al cliente sin estar en la lista revisada', () => {
    const sinRevisar = [...anon].filter(f => !permitidas.has(f))
    expect(
      sinRevisar,
      'añádelas a supabase/permisos-esperados.json explicando por qué, o quita el grant',
    ).toEqual([])
  })

  it('las funciones de dinero NUNCA se abren al cliente', () => {
    // `registrar_pago_online` marca pagado y cierra la mesa. Si esto falla, se
    // puede saldar una cuenta sin pagarla. Ya ocurrió una vez.
    const abiertas = [...servidor].filter(f => anon.has(f) || auth.has(f))
    expect(abiertas, 'esto deja cerrar cuentas sin cobrar').toEqual([])
  })

  it('todo revoke sobre una función nombra a PUBLIC', () => {
    // `revoke … from anon, authenticated` NO quita nada si el permiso se
    // hereda de PUBLIC, que es justo como lo concede Supabase al crear la
    // función. Pasó con los tres `sup_*`: llevaban su revoke desde la
    // migración 11, parecía hecho, y seguían abiertos al cliente.
    const malEscritos = []
    for (const f of migraciones()) {
      const sql = leerSql(f)
      // el `from …` puede ir en la línea siguiente
      for (const m of sql.matchAll(/revoke\s+(?:all|execute)\s+on\s+function\s+([a-z_0-9]+)\s*\([^)]*\)\s*from\s+([^;]+);/gi)) {
        if (!/\bpublic\b/i.test(m[2])) malEscritos.push(`${f}: ${m[1]}`)
      }
    }
    expect(malEscritos, 'sin `public` el revoke no quita nada').toEqual([])
  })

  it('toda función de servidor lleva su revoke escrito', () => {
    // El grant es opcional; el revoke NO, porque el permiso llega solo.
    const sql = migraciones().map(leerSql).join('\n')
    const sinRevoke = [...servidor].filter(f =>
      new RegExp(`create or replace function\\s+${f}\\s*\\(`, 'i').test(sql) &&
      !new RegExp(`revoke\\s+all\\s+on\\s+function\\s+${f}\\s*\\(`, 'i').test(sql)
    )
    expect(sinRevoke, 'sin revoke, Supabase se las concede a anon al crearlas').toEqual([])
  })
})
