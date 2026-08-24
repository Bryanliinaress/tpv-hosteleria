import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ticketESCPOS } from './escpos'
import { desglosePorTipo, cent } from './dinero'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ────────────────────────────────────────────────────────────────────────────
// Devoluciones: la parte que ve el cliente y lo que llega a Hacienda.
//
// Un ticket ya registrado en la AEAT no se borra ni se edita: se corrige con
// una factura rectificativa. Y como el original es una factura simplificada
// (F2), la rectificativa es siempre **R5**.
// ────────────────────────────────────────────────────────────────────────────

describe('el papel de una devolución', () => {
  const papel = (extra = {}) => {
    const bytes = ticketESCPOS({
      local: { nombre: 'Bar', ivaPct: 10 },
      mesa: { numero: 4 },
      lineas: [{ nombre: 'Devolución', cantidad: 1, precio: -12.00, ivaPct: 10 }],
      total: -12.00,
      ...extra,
    })
    return new TextDecoder('latin1').decode(new Uint8Array(bytes))
  }

  it('dice que es una rectificativa y a qué ticket corrige', () => {
    // Un papel con los importes en negativo y sin explicación es una
    // reclamación esperando a pasar.
    const t = papel({ rectifica: { numero: 41, motivo: 'Cobrado de mas' } })
    expect(t).toMatch(/FACTURA RECTIFICATIVA/)
    expect(t).toMatch(/Rectifica al ticket n\. 41/)
    expect(t).toMatch(/Cobrado de mas/)
  })

  it('un ticket normal NO lleva ese encabezado', () => {
    expect(papel()).not.toMatch(/RECTIFICATIVA/)
  })

  it('el desglose de la devolución también cuadra, en negativo', () => {
    const d = desglosePorTipo([{ precio: -12.00, cantidad: 1, ivaPct: 10 }], 10)
    expect(d).toHaveLength(1)
    expect(cent(d[0].base + d[0].iva)).toBe(-12)
    expect(d[0].base).toBeLessThan(0)
  })

  it('reparte una devolución entre dos tipos sin perder céntimos', () => {
    const d = desglosePorTipo([
      { precio: -4.76, cantidad: 1, ivaPct: 10 },
      { precio: -5.24, cantidad: 1, ivaPct: 21 },
    ], 10)
    expect(cent(d.reduce((s, x) => s + x.total, 0))).toBe(-10)
    for (const x of d) expect(cent(x.base + x.iva)).toBe(x.total)
  })
})

// La Edge Function corre en Deno y no puede importarse aquí, así que se lee.
// Es la misma técnica que ya usa `dinero.test.js` con el redondeo fiscal: si
// alguien cambia el tipo de factura o el método de rectificación por su cuenta,
// esto salta antes de que la AEAT rechace facturas de un bar.
describe('lo que se manda a Hacienda', () => {
  const fuente = readFileSync(join(RAIZ, 'supabase/functions/registrar-fiscal/index.ts'), 'utf8')

  it('una rectificativa va como R5 (el original es una factura simplificada)', () => {
    expect(fuente).toMatch(/tipo_factura = 'R5'/)
  })

  it('se rectifica por diferencias, que es lo que casa con el cajón', () => {
    expect(fuente).toMatch(/tipo_rectificativa = 'I'/)
  })

  it('identifica la factura corregida con serie, número y fecha', () => {
    expect(fuente).toMatch(/facturas_rectificadas = \[\{/)
    expect(fuente).toMatch(/fecha_expedicion: fechaES\(String\(rect\.fecha\)\)/)
  })

  it('un ticket normal sigue yendo como F2', () => {
    expect(fuente).toMatch(/tipo_factura: 'F2'/)
  })

  it('solo se convierte en rectificativa si hay factura que corregir', () => {
    // Sin esta guarda, un ticket normal con `rectifica: null` se mandaría como
    // R5 sin identificar nada y la AEAT lo rechazaría.
    expect(fuente).toMatch(/if \(rect && rect\.numero != null\)/)
  })
})
