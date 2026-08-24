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
  // Flecha corta: `nombre: (…) => ({ ok … })`. Se escapaba del detector, y es
  // exactamente la misma trampa: la pantalla lee `r.ok` y en v2 le llega una
  // promesa, así que enseña un error falso habiendo funcionado.
  const flechaCorta = /^ {2}([a-zA-Z]+): (?:async )?\([^)]*\) => \(\{ ok/gm
  while ((m = flechaCorta.exec(src))) nombres.add(m[1])
  return [...nombres]
}

// Las que la DEMO ya declara `async` devuelven una promesa a los dos lados: la
// pantalla tiene que esperarlas, y olvidarse del `await` se rompe también en la
// demo, que es donde se ve enseguida. Esas no son el problema que vigila el
// test de más abajo.
const asyncEnLaDemo = () => {
  const src = leer('src/store/useStore.js')
  return new Set([...src.matchAll(/^ {2}([a-zA-Z]+): async \(/gm)].map(m => m[1]))
}

const fuenteV2 = () => leer('src/lib/v2/acciones.js') + '\n' + leer('src/lib/v2/acciones2.js')

// ────────────────────────────────────────────────────────────────────────────
// Toda acción de la demo tiene que existir también en el backend real.
//
// Una acción sin parchear no da error: hace `setState` sobre el estado local,
// la pantalla parece responder, y la siguiente rehidratación desde el servidor
// lo deshace. Así estuvo `toggleCompartir` — el botón de compartir plato
// pintado y muerto — y así se quedó `purgarReservasAntiguas`, que es borrado
// por retención de RGPD: nombres y teléfonos guardados para siempre.
//
// Si añades una acción al store y no la implementas en v2, este test falla.
// Para dejarla fuera a propósito, ponla aquí abajo y explica por qué.
const SOLO_DEMO = {
  // El estado de la demo vive en localStorage y hay que migrarlo entre
  // versiones; v2 lo baja del servidor en cada arranque. No son acciones.
  migrate: 'configuración de zustand persist, no una acción',
  partialize: 'configuración de zustand persist, no una acción',
}

describe('cobertura de v2', () => {
  it('no queda ninguna acción de la demo sin implementar en el backend real', () => {
    const src = leer('src/store/useStore.js')
    const v2 = fuenteV2()
    const sinParchear = []
    const re = /^ {2}([a-zA-Z][a-zA-Z0-9_]*): (async )?\(/gm
    let m
    while ((m = re.exec(src))) {
      const nombre = m[1]
      if (nombre in SOLO_DEMO) continue
      if (!new RegExp(`^ {4}${nombre}: `, 'm').test(v2)) sinParchear.push(nombre)
    }
    expect(sinParchear, 'hacen setState y la rehidratación las deshace').toEqual([])
  })

  it('la lista de excepciones no tapa acciones de verdad', () => {
    // Si alguien mete una acción real en SOLO_DEMO para callar el test, que al
    // menos tenga que escribir el motivo aquí.
    for (const [nombre, motivo] of Object.entries(SOLO_DEMO)) {
      expect(motivo, `${nombre} sin motivo`).toMatch(/\w{10,}/)
    }
  })
})

describe('acciones que responden al momento', () => {
  it('la demo tiene varias (si no, el test no está mirando nada)', () => {
    expect(accionesConRespuesta().length).toBeGreaterThan(3)
  })

  it('ninguna es `async` en el backend real (salvo si la demo también lo es)', () => {
    const v2 = fuenteV2()
    const rotas = []
    const yaEsperadas = asyncEnLaDemo()
    for (const nombre of accionesConRespuesta()) {
      if (yaEsperadas.has(nombre)) continue
      // `nombre: async (` → devuelve una promesa y la pantalla lee r.ok
      if (new RegExp(`^ {4}${nombre}: async \\(`, 'm').test(v2)) rotas.push(nombre)
    }
    expect(rotas, 'devuelven una promesa donde la pantalla espera { ok }').toEqual([])
  })
})
