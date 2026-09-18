import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ────────────────────────────────────────────────────────────────────────────
// La paleta se mide, no se opina.
//
// El tema claro es el que va a usar un bar de día, con luz de ventana y
// tablets baratas que se miran de lado. Estaba así de medido (WCAG 2.1):
//
//     borde de una tarjeta contra la tarjeta ......... 1,37   (1.4.11 pide 3)
//     tarjeta blanca contra el fondo ................. 1,12
//     texto tenue sobre el fondo ..................... 4,23   (1.4.3 pide 4,5)
//     «Libre» en verde sobre blanco .................. 3,77
//
// El texto se leía; lo que no existía era la SEPARACIÓN. Todo era una sábana
// pálida donde no se distinguía una tarjeta de la de al lado ni una pastilla
// de estado de otra.
//
// Aclarar un token es de las cosas más fáciles de hacer sin querer —se toca
// para que «quede más limpio»— y de las más difíciles de notar leyendo un
// diff. Así que los mínimos viven aquí.
// ────────────────────────────────────────────────────────────────────────────

const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.css'), 'utf8')

/** Los tokens de un bloque (`:root`, `:root[data-theme="light"]`, `.force-dark`). */
function tokens(selector) {
  const i = CSS.indexOf(selector)
  if (i < 0) throw new Error(`no encuentro el bloque ${selector}`)
  const bloque = CSS.slice(i, CSS.indexOf('\n}', i))
  const salida = {}
  for (const [, k, v] of bloque.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) salida[k] = v
  return salida
}

const luminancia = (hex) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

describe('tema claro', () => {
  const t = tokens(':root[data-theme="light"]')
  const BLANCO = '#ffffff'

  it('una tarjeta se distingue del fondo', () => {
    expect(contraste(BLANCO, t['--color-bg'])).toBeGreaterThanOrEqual(1.2)
  })

  it('los bordes existen, y los de lo que se pulsa cumplen el 3:1 de la norma', () => {
    expect(contraste(t['--color-border'], BLANCO)).toBeGreaterThanOrEqual(2)
    expect(contraste(t['--color-border-strong'], BLANCO)).toBeGreaterThanOrEqual(3)
  })

  it('todos los grises de texto se leen sobre el fondo y sobre una tarjeta', () => {
    for (const k of ['--color-text', '--color-text-2', '--color-muted', '--color-faint']) {
      expect(contraste(t[k], t['--color-bg']), `${k} sobre el fondo`).toBeGreaterThanOrEqual(4.5)
      expect(contraste(t[k], BLANCO), `${k} sobre una tarjeta`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('los colores de estado valen como texto Y como fondo de botón', () => {
    // «Libre» en verde sobre blanco, y blanco sobre un botón verde.
    for (const k of ['--color-success', '--color-danger', '--color-warning', '--color-info', '--color-accent']) {
      expect(contraste(t[k], BLANCO), `${k} como texto`).toBeGreaterThanOrEqual(4.5)
      expect(contraste(BLANCO, t[k]), `blanco sobre ${k}`).toBeGreaterThanOrEqual(4.5)
      expect(contraste(t[k], t['--color-bg']), `${k} sobre el fondo`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('cada pastilla de estado se distingue: su texto se lee y su borde se ve', () => {
    for (const k of ['success', 'danger', 'warning', 'info']) {
      expect(contraste(t[`--tint-${k}-fg`], t[`--tint-${k}-bg`]), `texto de ${k}`).toBeGreaterThanOrEqual(4.5)
      expect(contraste(t[`--tint-${k}-bd`], t[`--tint-${k}-bg`]), `borde de ${k}`).toBeGreaterThanOrEqual(2.8)
    }
  })
})

describe('tema oscuro', () => {
  const t = tokens(':root {')

  it('los grises de texto se leen sobre el fondo y sobre una tarjeta', () => {
    for (const k of ['--color-text', '--color-text-2', '--color-muted', '--color-faint']) {
      expect(contraste(t[k], t['--color-bg']), `${k} sobre el fondo`).toBeGreaterThanOrEqual(4.5)
      expect(contraste(t[k], t['--color-surface']), `${k} sobre una tarjeta`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('las pantallas de pase (cocina y barra)', () => {
  const t = tokens('.force-dark')

  it('traen sus propios colores de estado', () => {
    // Sin esto heredaban los del tema claro y el pase salía apagado, que es
    // justo lo contrario de lo que necesita una cocina: se lee a distancia.
    for (const k of ['--color-success', '--color-danger', '--color-warning', '--color-info']) {
      expect(t[k], `${k} en .force-dark`).toBeTruthy()
      expect(contraste(t[k], t['--color-bg']), k).toBeGreaterThanOrEqual(4.5)
    }
  })
})
