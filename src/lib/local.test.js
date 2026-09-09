import { describe, it, expect } from 'vitest'
import { revisarCambiosLocal, loQueFaltaDelLocal } from './local'
import { desgloseIVA } from './dinero'

// ────────────────────────────────────────────────────────────────────────────
// Los datos del local. La regla existía solo en la demo: en la app real se
// guardaba lo que se tecleara, y dos de esos campos salen impresos en una
// factura simplificada.
// ────────────────────────────────────────────────────────────────────────────
describe('el IVA que se teclea', () => {
  it('entiende la coma, que es como se escribe aquí', () => {
    expect(revisarCambiosLocal({ ivaPct: '10,5' })).toEqual({ ok: true, cambios: { ivaPct: 10.5 } })
    expect(revisarCambiosLocal({ ivaPct: '21' })).toEqual({ ok: true, cambios: { ivaPct: 21 } })
  })

  // Este es el fallo entero, en una línea: guardado como texto con coma, todo
  // el que lo lee hace `Number(x) || 0` y el ticket sale con «IVA (0%)» y la
  // base igual al total. No falla nada; sale mal y con buena cara.
  it('guardado como texto con coma, el desglose del ticket se iba a 0%', () => {
    expect(desgloseIVA(10, '10,5')).toEqual({ ivaPct: 0, base: 10, iva: 0, total: 10 })
    // ya saneado, el desglose es el que toca
    const { cambios } = revisarCambiosLocal({ ivaPct: '10,5' })
    expect(desgloseIVA(10, cambios.ivaPct).ivaPct).toBe(10.5)
    expect(desgloseIVA(10, cambios.ivaPct).iva).toBeCloseTo(0.95, 2)
  })

  // Vacío no es «0 %»: es un descuido, y 0 % es una decisión fiscal.
  it('vacío no se guarda como 0', () => {
    const r = revisarCambiosLocal({ ivaPct: '' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/IVA 0%/)
  })

  it('ni letras, ni negativos, ni un 300%', () => {
    for (const v of ['diez', '-3', '300']) {
      expect(revisarCambiosLocal({ ivaPct: v }).ok).toBe(false)
    }
  })

  it('el 0 escrito a propósito sí vale', () => {
    expect(revisarCambiosLocal({ ivaPct: '0' })).toEqual({ ok: true, cambios: { ivaPct: 0 } })
  })
})

describe('la moneda', () => {
  it('borrarla deja el euro, no un hueco', () => {
    expect(revisarCambiosLocal({ moneda: '   ' }).cambios.moneda).toBe('€')
  })
  it('y se recorta', () => {
    expect(revisarCambiosLocal({ moneda: ' $ ' }).cambios.moneda).toBe('$')
  })
})

describe('los textos que salen impresos', () => {
  // Un espacio delante descoloca el encabezado centrado del ticket.
  it('van sin espacios de más', () => {
    const { cambios } = revisarCambiosLocal({ nombre: '  Bar Paco  ', pieTicket: ' ¡Gracias! ' })
    expect(cambios).toEqual({ nombre: 'Bar Paco', pieTicket: '¡Gracias!' })
  })

  it('lo que no viene en el parche no se toca', () => {
    expect(revisarCambiosLocal({ nombre: 'X' }).cambios).toEqual({ nombre: 'X' })
  })
})

describe('qué falta por rellenar', () => {
  const COMPLETO = { direccion: 'Calle 1', telefono: '600', cif: 'B1', ivaPct: 10 }

  it('con todo puesto, no falta nada', () => {
    expect(loQueFaltaDelLocal(COMPLETO)).toEqual([])
  })

  // Los dos que exige una factura simplificada se marcan como fiscales.
  it('el CIF y el IVA se señalan aparte: son de la factura', () => {
    const faltan = loQueFaltaDelLocal({ ...COMPLETO, cif: '', ivaPct: null })
    expect(faltan.map(f => f.campo)).toEqual(['el CIF', 'el IVA'])
    expect(faltan.every(f => f.fiscal)).toBe(true)
  })

  it('dice dónde se nota cada hueco', () => {
    const [tel] = loQueFaltaDelLocal({ ...COMPLETO, telefono: '' })
    expect(tel.donde).toMatch(/Ll[áa]manos/)
  })
})
