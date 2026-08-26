import { describe, it, expect } from 'vitest'
import { rangoDe, nombreDe, PERIODOS, mayusculaInicial } from './periodos'

// ────────────────────────────────────────────────────────────────────────────
// Los periodos de Informes.
//
// El detalle que importa: se calculan en HORA LOCAL. Un «hoy» que empiece a
// medianoche UTC mete en el informe de hoy los cobros de la madrugada de ayer
// — y en un bar la madrugada del sábado es media caja.
//
// Y el fin es exclusivo, como consulta el servidor: si fuera inclusivo, un
// cobro a las 00:00:00 clavadas contaría en dos periodos a la vez.
// ────────────────────────────────────────────────────────────────────────────

// Un martes por la tarde, que es cuando alguien mira esto de verdad.
const MARTES = new Date(2026, 7, 18, 17, 30, 0)   // 18 de agosto de 2026

const horasEntre = (r) => (new Date(r.hasta) - new Date(r.desde)) / 3600000

describe('rangos', () => {
  it('«hoy» empieza a medianoche LOCAL, no UTC', () => {
    const r = rangoDe('hoy', MARTES)
    const d = new Date(r.desde)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getDate()).toBe(18)
  })

  it('«hoy» dura exactamente un día', () => {
    expect(horasEntre(rangoDe('hoy', MARTES))).toBe(24)
  })

  it('«ayer» es el día anterior entero y no toca hoy', () => {
    const ayer = rangoDe('ayer', MARTES)
    const hoy = rangoDe('hoy', MARTES)
    expect(horasEntre(ayer)).toBe(24)
    // el fin de ayer es el principio de hoy: ni hueco ni solape
    expect(ayer.hasta).toBe(hoy.desde)
  })

  it('«7 días» incluye hoy: son siete, no ocho', () => {
    expect(horasEntre(rangoDe('semana', MARTES))).toBe(7 * 24)
  })

  it('«este mes» empieza el día 1 y llega hasta el final de hoy', () => {
    const r = rangoDe('mes', MARTES)
    expect(new Date(r.desde).getDate()).toBe(1)
    expect(new Date(r.desde).getMonth()).toBe(7)
    expect(new Date(r.hasta).getDate()).toBe(19)   // exclusivo: mañana a las 00:00
  })

  it('«mes pasado» es julio entero, sin morder agosto', () => {
    const r = rangoDe('mesPasado', MARTES)
    expect(new Date(r.desde).getMonth()).toBe(6)   // julio
    expect(new Date(r.desde).getDate()).toBe(1)
    expect(new Date(r.hasta).getMonth()).toBe(7)   // 1 de agosto, exclusivo
    expect(new Date(r.hasta).getDate()).toBe(1)
  })

  it('en enero, «mes pasado» es diciembre del año anterior', () => {
    const r = rangoDe('mesPasado', new Date(2026, 0, 9, 12))
    expect(new Date(r.desde).getFullYear()).toBe(2025)
    expect(new Date(r.desde).getMonth()).toBe(11)
  })

  it('el día 1, «este mes» sigue siendo un rango válido y no vacío', () => {
    // Es el caso que dejaba Informes en blanco: un mes recién empezado.
    const r = rangoDe('mes', new Date(2026, 7, 1, 9, 0))
    expect(new Date(r.hasta).getTime()).toBeGreaterThan(new Date(r.desde).getTime())
  })

  it('un id desconocido no rompe: cae en «este mes»', () => {
    expect(rangoDe('loquesea', MARTES)).toEqual(rangoDe('mes', MARTES))
  })

  it('todos los periodos de la lista producen un rango válido', () => {
    for (const p of PERIODOS) {
      const r = rangoDe(p.id, MARTES)
      expect(new Date(r.hasta).getTime(), p.id).toBeGreaterThan(new Date(r.desde).getTime())
    }
  })
})

describe('nombres', () => {
  it('cada periodo se llama de una manera distinta', () => {
    const nombres = PERIODOS.map(p => nombreDe(p.id, MARTES))
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('«mes pasado» dice el mes, no «mes pasado»', () => {
    expect(nombreDe('mesPasado', MARTES)).toMatch(/julio/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// El título de Informes lleva mayúscula inicial. Se hacía con el
// `text-transform: capitalize` de CSS, que en español la pone en CADA palabra:
// salía «Miércoles, 26 De Agosto» y «Últimos 7 Días».
// ────────────────────────────────────────────────────────────────────────────
describe('mayusculaInicial', () => {
  it('sube solo la primera letra y deja el resto', () => {
    expect(mayusculaInicial('miércoles, 26 de agosto')).toBe('Miércoles, 26 de agosto')
    expect(mayusculaInicial('últimos 7 días')).toBe('Últimos 7 días')
    expect(mayusculaInicial('agosto de 2026')).toBe('Agosto de 2026')
  })

  it('no se rompe con vacío ni con nada', () => {
    expect(mayusculaInicial('')).toBe('')
    expect(mayusculaInicial(null)).toBe('')
    expect(mayusculaInicial(undefined)).toBe('')
  })

  it('deja en paz lo que ya venía en mayúscula', () => {
    expect(mayusculaInicial('Tickets de agosto')).toBe('Tickets de agosto')
  })
})
