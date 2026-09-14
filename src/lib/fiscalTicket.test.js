import { describe, it, expect } from 'vitest'
import { estadoFiscalDeTicket, necesitaAtencion } from './fiscalTicket.js'

// Fechas construidas en HORA LOCAL (año, mes-1, día, hora, minuto): así el
// test dice lo mismo en el PC del bar (Madrid) que en el CI (UTC).
const local = (d, h = 12, m = 0) => new Date(2026, 8, d, h, m).toISOString()
const ahora = new Date(2026, 8, 14, 18, 0)

describe('estadoFiscalDeTicket', () => {
  it('registrado: una marca discreta, nada que hacer', () => {
    expect(estadoFiscalDeTicket({ fiscalEstado: 'enviado', cerradaEn: local(10) }, ahora))
      .toMatchObject({ nivel: 'ok', reintentable: false })
  })

  it('pendiente de hoy: se arregla reintentando, y dice que es HOY', () => {
    const e = estadoFiscalDeTicket({ fiscalEstado: 'pendiente', cerradaEn: local(14, 9) }, ahora)
    expect(e.nivel).toBe('pendiente')
    expect(e.reintentable).toBe(true)
    expect(e.detalle).toMatch(/HOY/)
  })

  it('con error de hoy: enseña el motivo', () => {
    const e = estadoFiscalDeTicket({ fiscalEstado: 'error', fiscalError: 'NIF no censado', cerradaEn: local(14, 9) }, ahora)
    expect(e).toMatchObject({ nivel: 'error', motivo: 'NIF no censado' })
  })

  it('de otro día: avisa de que Verifacti ya no lo acepta por esa vía', () => {
    const e = estadoFiscalDeTicket({ fiscalEstado: 'pendiente', cerradaEn: local(13, 23, 50) }, ahora)
    expect(e.nivel).toBe('caducado')
    expect(e.detalle).toMatch(/día que se emitió/)
  })

  it('«hoy» es el día del local: un cobro a las 00:30 ya es del día nuevo', () => {
    const e = estadoFiscalDeTicket({ fiscalEstado: 'pendiente', cerradaEn: local(14, 0, 30) }, ahora)
    expect(e.nivel).toBe('pendiente')
  })

  it('sin registro fiscal (la demo) o que no aplica: nada', () => {
    expect(estadoFiscalDeTicket({ cerradaEn: local(14) }, ahora)).toBeNull()
    expect(estadoFiscalDeTicket({ fiscalEstado: 'no_aplica', cerradaEn: local(14) }, ahora)).toBeNull()
    expect(estadoFiscalDeTicket(null, ahora)).toBeNull()
  })
})

describe('necesitaAtencion', () => {
  it('solo lo que no ha llegado a Hacienda', () => {
    expect(necesitaAtencion({ fiscalEstado: 'enviado', cerradaEn: local(14) }, ahora)).toBe(false)
    expect(necesitaAtencion({ fiscalEstado: 'error', cerradaEn: local(2) }, ahora)).toBe(true)
    expect(necesitaAtencion({ cerradaEn: local(14) }, ahora)).toBe(false)
  })
})
