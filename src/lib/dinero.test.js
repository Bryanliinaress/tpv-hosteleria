import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cent, importeLinea, totalDe, totalDeMesa, pendienteDeMesa, desgloseIVA, desglosePorTipo, lineasDe, preciosNumericos, metodosDeDevolucion, pendienteDeDevolver } from './dinero'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('totales', () => {
  const ana = { nombre: 'Ana', items: [{ precio: 1.5, cantidad: 2 }, { precio: 2.2, cantidad: 1 }] }
  const luis = { nombre: 'Luis', pagado: true, items: [{ precio: 3.1, cantidad: 1 }] }

  it('suma lo de un comensal', () => expect(totalDe(ana)).toBe(5.2))
  it('suma la mesa entera, pagados incluidos', () => expect(totalDeMesa({ personas: [ana, luis] })).toBe(8.3))
  it('lo pendiente deja fuera a quien ya pagó', () => expect(pendienteDeMesa({ personas: [ana, luis] })).toBe(5.2))

  it('aguanta lo que llega a medias sin devolver NaN', () => {
    expect(totalDe(null)).toBe(0)
    expect(totalDe({ items: null })).toBe(0)
    expect(totalDeMesa(undefined)).toBe(0)
    expect(importeLinea({ precio: undefined, cantidad: 2 })).toBe(0)
  })

  it('redondea a céntimos: 0.1 + 0.2 no puede acabar en 0.30000000000000004', () => {
    expect(totalDe({ items: [{ precio: 0.1, cantidad: 1 }, { precio: 0.2, cantidad: 1 }] })).toBe(0.3)
    expect(cent(1.005)).toBeCloseTo(1, 2)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// El desglose de IVA de una factura simplificada.
//
// La cuota sale de RESTAR de la base ya redondeada. Redondeando las dos por
// separado —que es lo que hacía el papel— «base + IVA» se imprime un céntimo
// por encima del total, y el cliente lo compara con lo que ha pagado.
// ────────────────────────────────────────────────────────────────────────────
describe('desglose de IVA', () => {
  it('base + cuota = total, SIEMPRE, en los tres tipos', () => {
    for (const pct of [4, 10, 21]) {
      for (let c = 50; c <= 50000; c++) {
        const total = c / 100
        const { base, iva } = desgloseIVA(total, pct)
        expect(cent(base + iva), `${total} € al ${pct}%`).toBe(total)
      }
    }
  })

  it('el caso que el papel imprimía mal: 3,25 € al 4 %', () => {
    // el método viejo daba base 3.13 + IVA 0.13 = 3.26 € en un ticket de 3.25 €
    expect(desgloseIVA(3.25, 4)).toEqual({ ivaPct: 4, base: 3.13, iva: 0.12, total: 3.25 })
  })

  it('sin IVA configurado no revienta ni inventa', () => {
    expect(desgloseIVA(10, 0)).toEqual({ ivaPct: 0, base: 10, iva: 0, total: 10 })
    expect(desgloseIVA(0, 10)).toEqual({ ivaPct: 10, base: 0, iva: 0, total: 0 })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// La Edge Function que registra en la AEAT corre en Deno y no puede importar
// este módulo, así que su copia del desglose se queda fuera del alcance de los
// tests… salvo leyéndola. Si alguien la cambia por su cuenta, el papel y lo
// que consta en Hacienda dejarían de decir lo mismo.
// ────────────────────────────────────────────────────────────────────────────
describe('lo que se manda a la AEAT usa el mismo redondeo', () => {
  it('la Edge Function saca la cuota de la base ya redondeada', () => {
    const src = readFileSync(join(RAIZ, 'supabase/functions/registrar-fiscal/index.ts'), 'utf8')
    expect(src).toMatch(/const base = Math\.round\(\(total \/ \(1 \+ ivaPct \/ 100\)\) \* 100\) \/ 100/)
    expect(src).toMatch(/const cuota = Math\.round\(\(total - base\) \* 100\) \/ 100/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Desglose por tipo de IVA.
//
// Un bar de hostelería pura va todo al 10 % y esto no cambia nada. Pero si
// vende una botella para llevar (21 %) o pan (4 %), la factura simplificada
// lleva una línea POR TIPO. Antes salía una sola con el tipo del local, lo que
// es sencillamente falso en el papel y en lo que consta en Hacienda.
// ────────────────────────────────────────────────────────────────────────────
describe('desglose por tipo de IVA', () => {
  it('con un solo tipo da exactamente lo mismo que antes', () => {
    const d = desglosePorTipo([{ precio: 5, cantidad: 2, ivaPct: 10 }], 10)
    expect(d).toHaveLength(1)
    expect(d[0]).toEqual(desgloseIVA(10, 10))
  })

  it('separa los tipos y cada uno cuadra por su cuenta', () => {
    const d = desglosePorTipo([
      { precio: 10, cantidad: 1, ivaPct: 10 },   // consumición
      { precio: 12.10, cantidad: 1, ivaPct: 21 }, // botella para llevar
      { precio: 1.04, cantidad: 1, ivaPct: 4 },   // pan
    ], 10)
    expect(d.map(x => x.ivaPct)).toEqual([4, 10, 21]) // ordenados
    for (const x of d) expect(cent(x.base + x.iva)).toBe(x.total)
  })

  it('la suma de los totales por tipo es el total del ticket', () => {
    const lineas = [
      { precio: 3.30, cantidad: 2, ivaPct: 10 },
      { precio: 12.10, cantidad: 1, ivaPct: 21 },
      { precio: 0.95, cantidad: 3, ivaPct: 4 },
    ]
    const total = lineas.reduce((s, l) => s + importeLinea(l), 0)
    expect(cent(desglosePorTipo(lineas).reduce((s, d) => s + d.total, 0))).toBe(cent(total))
  })

  it('las líneas sin tipo usan el del local (tickets de antes de esto)', () => {
    const d = desglosePorTipo([{ precio: 10, cantidad: 1 }], 21)
    expect(d[0].ivaPct).toBe(21)
  })

  it('junta líneas del mismo tipo en una sola entrada', () => {
    const d = desglosePorTipo([
      { precio: 1, cantidad: 1, ivaPct: 10 },
      { precio: 2, cantidad: 1, ivaPct: 10 },
    ], 10)
    expect(d).toHaveLength(1)
    expect(d[0].total).toBe(3)
  })

  it('sin líneas no inventa un desglose vacío con NaN', () => {
    expect(desglosePorTipo([], 10)).toEqual([])
    expect(desglosePorTipo(null, 10)).toEqual([])
  })

  it('lineasDe aplana los comensales de un ticket', () => {
    const personas = [{ items: [{ precio: 1, cantidad: 1 }] }, { items: [{ precio: 2, cantidad: 1 }] }, { }]
    expect(lineasDe(personas)).toHaveLength(2)
    expect(lineasDe(null)).toEqual([])
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Precios de la carta, siempre números.
//
// El formulario de Admin guarda lo que se teclea, que es TEXTO. Editar un
// producto con tamaños dejaba `{"viena": "2.5"}` en la base, y la carta del
// cliente se rompía entera al llamar a `.toFixed()` sobre una cadena: pantalla
// en blanco en el móvil de quien iba a pedir. Lo encontró la monitorización.
// ────────────────────────────────────────────────────────────────────────────
describe('precios de la carta', () => {
  it('convierte lo que teclea el formulario', () => {
    expect(preciosNumericos({ viena: '2.5', pitufo: '1.5' })).toEqual({ viena: 2.5, pitufo: 1.5 })
  })

  it('deja los números como están', () => {
    expect(preciosNumericos({ base: 3 })).toEqual({ base: 3 })
  })

  it('quita los huecos vacíos en vez de guardarlos como 0 €', () => {
    // Un tamaño que el bar no usa no puede acabar valiendo cero euros.
    expect(preciosNumericos({ viena: '2.5', pitufo: '', mini: null })).toEqual({ viena: 2.5 })
  })

  it('descarta lo que no es un número', () => {
    expect(preciosNumericos({ viena: 'dos cincuenta' })).toEqual({})
  })

  it('redondea a céntimos', () => {
    expect(preciosNumericos({ base: '1.005' }).base).toBeCloseTo(1, 2)
  })

  it('aguanta que no venga nada', () => {
    expect(preciosNumericos(null)).toEqual({})
    expect(preciosNumericos('2.5')).toEqual({})
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Por dónde se devuelve el dinero.
//
// El fallo que esto impide: emitir la devolución de un ticket pagado por Stripe
// y apuntarla como efectivo. El cliente se quedaba sin su dinero (nadie tocaba
// su tarjeta) y el arqueo de esa noche cantaba un faltante de caja que no
// existía, porque de ese cajón no había salido nada.
// ────────────────────────────────────────────────────────────────────────────
describe('métodos de devolución', () => {
  it('un ticket pagado con tarjeta se devuelve a la tarjeta, y va primero', () => {
    expect(metodosDeDevolucion({ online: 11.9 })).toEqual(['online'])
  })

  it('uno pagado en efectivo NO ofrece devolver a ninguna tarjeta', () => {
    expect(metodosDeDevolucion({ efectivo: 10 })).toEqual(['efectivo'])
  })

  it('con cuenta mixta se puede elegir, pero la tarjeta manda por defecto', () => {
    expect(metodosDeDevolucion({ efectivo: 5, online: 5 })[0]).toBe('online')
    expect(metodosDeDevolucion({ efectivo: 5, online: 5 })).toContain('efectivo')
  })

  it('un método a cero no cuenta: por ahí no entró nada', () => {
    expect(metodosDeDevolucion({ efectivo: 10, online: 0 })).toEqual(['efectivo'])
  })

  it('sin datos de cobro, efectivo (que es lo que un bar sabe hacer siempre)', () => {
    expect(metodosDeDevolucion({})).toEqual(['efectivo'])
    expect(metodosDeDevolucion(null)).toEqual(['efectivo'])
  })
})

describe('lo que queda por devolver de un ticket', () => {
  const ticket = { id: 't6', total: 11.90 }

  it('sin devoluciones, queda todo', () => {
    expect(pendienteDeDevolver(ticket, [])).toBe(11.90)
  })

  it('con una devolución parcial, queda el resto', () => {
    // El fallo que esto impide: las rectificativas son NEGATIVAS, así que hay
    // que sumarlas. Restándolas salía «quedan 15,90 €» de un ticket de 11,90 —
    // la pantalla ofrecía devolver más de lo que se había cobrado.
    expect(pendienteDeDevolver(ticket, [{ total: -4 }])).toBe(7.90)
  })

  it('devuelto entero, no queda nada', () => {
    expect(pendienteDeDevolver(ticket, [{ total: -11.90 }])).toBe(0)
  })

  it('en varias veces, se suman todas', () => {
    expect(pendienteDeDevolver(ticket, [{ total: -4 }, { total: -3 }])).toBe(4.90)
  })

  it('nunca sale negativo', () => {
    expect(pendienteDeDevolver(ticket, [{ total: -50 }])).toBe(0)
  })
})
