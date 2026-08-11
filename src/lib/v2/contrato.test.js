import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ────────────────────────────────────────────────────────────────────────────
// El contrato entre las acciones del store y las pantallas.
//
// Las pantallas leen el resultado EN EL ACTO: `const r = addEmpleado(...); if
// (!r.ok) toast(r.error)`. Si la versión del backend real se declara `async`,
// devuelve una promesa: `r.ok` es undefined y el usuario ve un error falso
// aunque la operación haya funcionado. Pasó con el alta de empleados, el
// cambio de PIN, el borrado y las correcciones de fichaje.
//
// Este test lee el código y no deja que vuelva a colarse.
// ────────────────────────────────────────────────────────────────────────────

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')

// Acciones de la demo que responden { ok, error } al momento
const accionesConRespuesta = () => {
  const src = leer('src/store/useStore.js')
  const nombres = new Set()
  const re = /^ {2}([a-zA-Z]+): \([^)]*\) => \{([\s\S]*?)\n {2}\},/gm
  let m
  while ((m = re.exec(src))) if (/return \{ ok/.test(m[2])) nombres.add(m[1])
  return [...nombres]
}

const fuenteV2 = () => leer('src/lib/v2/acciones.js') + '\n' + leer('src/lib/v2/acciones2.js')

describe('acciones que responden al momento', () => {
  it('la demo tiene varias (si no, el test no está mirando nada)', () => {
    expect(accionesConRespuesta().length).toBeGreaterThan(3)
  })

  it('ninguna es `async` en el backend real', () => {
    const v2 = fuenteV2()
    const rotas = []
    for (const nombre of accionesConRespuesta()) {
      // `nombre: async (` → devuelve una promesa y la pantalla lee r.ok
      if (new RegExp(`^ {4}${nombre}: async \\(`, 'm').test(v2)) rotas.push(nombre)
    }
    expect(rotas, 'devuelven una promesa donde la pantalla espera { ok }').toEqual([])
  })
})
