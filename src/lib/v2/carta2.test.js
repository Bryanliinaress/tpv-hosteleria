import { describe, it, expect } from 'vitest'
import { preciosDeProducto } from './estado'
import { conFormatos, conOpciones, esMenu, precioMenu } from '../menuDia'

// ────────────────────────────────────────────────────────────────────────────
// Fallo 22: en el backend real TODO producto se guarda con `precios` (la
// columna es un mapa), así que un café salía de la BBDD como
// `precios: { base: 1.30 }`. Las pantallas lo tomaban por un producto CON
// formatos: la hoja de pan salía vacía y la línea se añadía a **0,00 €**.
// Un bar cobrando los cafés a cero es dinero perdido en cada ronda.
// ────────────────────────────────────────────────────────────────────────────

const comoLoGuardaLaBBDD = {
  cafe: { base: 1.3 },                 // producto de precio único
  montadito: { pitufo: 2, viena: 3 },  // producto con formatos
  menu: { base: 12 },                  // menú del día
}

describe('precios que llegan del backend real', () => {
  it('un producto de precio único vuelve como `precio`, no como formatos', () => {
    expect(preciosDeProducto(comoLoGuardaLaBBDD.cafe)).toEqual({ precio: 1.3 })
  })

  it('un producto con formatos conserva su mapa de precios', () => {
    expect(preciosDeProducto(comoLoGuardaLaBBDD.montadito)).toEqual({ precios: { pitufo: 2, viena: 3 } })
  })

  it('un producto sin precios no rompe: 0 €, nunca NaN ni undefined', () => {
    expect(preciosDeProducto(null)).toEqual({ precio: 0 })
    expect(preciosDeProducto({})).toEqual({ precio: 0 })
    expect(preciosDeProducto({ base: 'x' })).toEqual({ precio: 0 })
  })

  it('el café ya no abre la hoja de pan (que salía vacía y a 0 €)', () => {
    const cafe = { nombre: 'Solo', ...preciosDeProducto(comoLoGuardaLaBBDD.cafe) }
    expect(conFormatos(cafe)).toBe(false)
    expect(conOpciones(cafe)).toBe(false)
    expect(cafe.precio).toBe(1.3)
  })

  it('el montadito sigue abriendo la hoja de formatos', () => {
    const mont = { nombre: 'Mixto', ...preciosDeProducto(comoLoGuardaLaBBDD.montadito) }
    expect(conFormatos(mont)).toBe(true)
  })

  it('un menú del día conserva su precio cerrado y sus grupos', () => {
    const menu = {
      nombre: 'Menú del día', ...preciosDeProducto(comoLoGuardaLaBBDD.menu),
      menu: { grupos: [{ titulo: 'Primero', min: 1, max: 1, opciones: [{ nombre: 'Sopa' }] }] },
    }
    expect(esMenu(menu)).toBe(true)
    expect(conFormatos(menu)).toBe(false)
    expect(precioMenu(menu, [])).toBe(12)
    expect(precioMenu(menu, [{ grupo: 'Primero', opcion: 'Sopa', sup: 2 }])).toBe(14)
  })
})
