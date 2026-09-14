import { describe, it, expect } from 'vitest'
import { hayConsumo, revisarCierreSinCobrar, hayDatosDeFactura, borradorDeTicket, borradoresPendientes, MAX_MOTIVO } from './borradores.js'

const mesaCon = (items = [], pagado = false) => ({ numero: 7, personas: [{ id: 'a', nombre: 'Ana', pagado, items }] })
const cana = { nombre: 'Caña', precio: 2.5, cantidad: 2 }

describe('revisarCierreSinCobrar', () => {
  it('con consumo, el motivo es obligatorio', () => {
    const r = revisarCierreSinCobrar(mesaCon([cana]), '   ')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/motivo/)
  })

  it('con motivo, devuelve lo que se va a guardar', () => {
    expect(revisarCierreSinCobrar(mesaCon([cana]), '  se fue   sin pagar ')).toEqual({
      ok: true, hayConsumo: true, motivo: 'se fue sin pagar', total: 5, sinCobrar: 5,
    })
  })

  it('una mesa sin nada pedido se cierra sin motivo: no oculta nada', () => {
    expect(revisarCierreSinCobrar(mesaCon([]), '')).toMatchObject({ ok: true, hayConsumo: false, motivo: null })
  })

  it('lo ya pagado cuenta en el total, no en lo que queda sin cobrar', () => {
    const mesa = { personas: [{ id: 'a', pagado: true, items: [cana] }, { id: 'b', pagado: false, items: [{ nombre: 'Café', precio: 1.3, cantidad: 1 }] }] }
    expect(revisarCierreSinCobrar(mesa, 'error')).toMatchObject({ total: 6.3, sinCobrar: 1.3 })
  })

  it('el motivo tiene un tope', () => {
    expect(revisarCierreSinCobrar(mesaCon([cana]), 'x'.repeat(MAX_MOTIVO + 1)).ok).toBe(false)
  })
})

describe('hayConsumo', () => {
  it('mira todos los comensales', () => {
    expect(hayConsumo({ personas: [{ items: [] }, { items: [cana] }] })).toBe(true)
    expect(hayConsumo({ personas: [] })).toBe(false)
    expect(hayConsumo(null)).toBe(false)
  })
})

describe('borradores de factura', () => {
  it('solo se guarda si hay algo tecleado', () => {
    expect(hayDatosDeFactura({ nombre: ' ', nif: '', direccion: '', email: '' })).toBe(false)
    expect(hayDatosDeFactura({ nombre: '', nif: 'B1', direccion: '', email: '' })).toBe(true)
  })

  it('se busca por ticket', () => {
    const bs = [{ ticketId: 't1', datos: { nombre: 'A' } }]
    expect(borradorDeTicket(bs, 't1')?.datos.nombre).toBe('A')
    expect(borradorDeTicket(bs, 't2')).toBeNull()
    expect(borradorDeTicket(bs, undefined)).toBeNull()
  })

  it('el de un ticket que ya tiene factura ya no está pendiente', () => {
    const bs = [{ ticketId: 't1' }, { ticketId: 't2' }]
    expect(borradoresPendientes(bs, [{ ticketId: 't1' }]).map(b => b.ticketId)).toEqual(['t2'])
  })
})
