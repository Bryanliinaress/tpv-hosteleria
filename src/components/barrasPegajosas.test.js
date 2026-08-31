import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// ────────────────────────────────────────────────────────────────────────────
// Nadie más se pega a `top: 0`.
//
// Tres elementos con `position: sticky; top: 0` en el mismo contenedor NO se
// apilan: se superponen, y gana el que tenga más z-index. Con la banda de
// demostración arriba (z 9999) eso significa que cualquier cabecera con
// `top: 0` queda cortada por la mitad.
//
// Pasó en Admin y en Mostrador (v0.99.1) y se arregló ahí… pero quedaron cuatro
// pantallas más igual, que solo se vieron al mirar el KDS con comandas dentro:
// Cocina, Barra, la carta del cliente y el detalle de mesa de la PDA. Y el
// aviso de «Nueva versión», que es `fixed` y tapaba el reloj de la cocina.
//
// La regla: quien se pegue arriba lo hace a `var(--alto-aviso, 0px)`, que
// publica AvisoDemo midiéndose (ver useAltoCSS.js). La única excepción es la
// propia banda, que es la de arriba del todo.
// ────────────────────────────────────────────────────────────────────────────

const AQUI = dirname(fileURLToPath(import.meta.url))
const SRC = join(AQUI, '..')
const EXCEPCION = 'components/AvisoDemo.jsx'   // la banda ES la de arriba

function ficheros(dir) {
  return readdirSync(dir).flatMap(f => {
    const ruta = join(dir, f)
    if (statSync(ruta).isDirectory()) return ficheros(ruta)
    return /\.jsx?$/.test(f) && !/\.test\./.test(f) ? [ruta] : []
  })
}

const todos = ficheros(SRC).map(r => ({ ruta: relative(SRC, r).replace(/\\/g, '/'), src: readFileSync(r, 'utf8') }))

describe('barras que se pegan arriba', () => {
  it('ninguna se pega a `top: 0` salvo la banda de demostración', () => {
    const culpables = todos
      .filter(f => f.ruta !== EXCEPCION)
      .filter(f => /position:\s*['"]sticky['"][^}]*top:\s*0\s*[,}]/.test(f.src))
      .map(f => f.ruta)
    expect(culpables).toEqual([])
  })

  // El aviso de «Nueva versión» era `fixed` arriba del centro y tapaba el reloj
  // de la cocina. Vive abajo justamente por eso: arriba no cabe nada más.
  it('el aviso de version nueva no vuelve a subirse', () => {
    const host = todos.find(f => f.ruta === 'components/UIHost.jsx')
    const bloque = host.src.slice(host.src.indexOf('Nueva versión') - 900, host.src.indexOf('Nueva versión'))
    expect(bloque).toMatch(/bottom:/)
    expect(bloque).not.toMatch(/top:\s*['"]?[\d.]/)
  })

  // Si alguien renombra la variable en un sitio y no en el otro, esto lo caza.
  it('la variable que se usa es la que publica AvisoDemo', () => {
    const hook = todos.find(f => f.ruta === 'components/useAltoCSS.js')
    const aviso = todos.find(f => f.ruta === EXCEPCION)
    expect(hook).toBeTruthy()
    expect(aviso.src).toContain("useAltoCSS('--alto-aviso')")

    const usan = todos.filter(f => f.src.includes('--alto-aviso')).map(f => f.ruta)
    // las seis cabeceras + el aviso de version + el propio AvisoDemo
    expect(usan.length).toBeGreaterThanOrEqual(7)
  })
})
