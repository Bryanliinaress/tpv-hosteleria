import { describe, it, expect } from 'vitest'
import { mesLocal, diaLocal, esDelMes, horasEntre, esDelDia } from './fechas'

// El desfase UTC↔local solo se nota de madrugada, que es justo cuando cierra
// un bar. Construimos las fechas en hora local para que la prueba valga en
// cualquier huso.
const local = (a, m, d, h, min = 0) => new Date(a, m - 1, d, h, min)

describe('mesLocal', () => {
  it('un turno de madrugada del día 1 cuenta en SU mes', () => {
    // 01:30 del 1 de agosto: en UTC+2 esto es el 31 de julio a las 23:30
    expect(mesLocal(local(2026, 8, 1, 1, 30))).toBe('2026-08')
  })

  it('el último minuto del mes sigue en su mes', () => {
    expect(mesLocal(local(2026, 7, 31, 23, 59))).toBe('2026-07')
  })

  it('con basura devuelve vacío en vez de romper', () => {
    expect(mesLocal('no-es-fecha')).toBe('')
    expect(mesLocal(null)).toBe('')
  })
})

describe('diaLocal', () => {
  it('da el día del calendario del local', () => {
    expect(diaLocal(local(2026, 8, 1, 0, 15))).toBe('2026-08-01')
  })
})

describe('esDelMes', () => {
  it('mete el cierre de madrugada en el mes correcto', () => {
    expect(esDelMes(local(2026, 8, 1, 2, 0).toISOString(), '2026-08')).toBe(true)
    expect(esDelMes(local(2026, 8, 1, 2, 0).toISOString(), '2026-07')).toBe(false)
  })

  it('sin fecha, fuera', () => {
    expect(esDelMes(null, '2026-08')).toBe(false)
    expect(esDelMes('', '2026-08')).toBe(false)
  })
})

describe('horasEntre', () => {
  it('cuenta el turno que cruza la medianoche', () => {
    const entrada = local(2026, 8, 1, 20, 0)
    const salida = local(2026, 8, 2, 2, 30)
    expect(horasEntre(entrada, salida)).toBeCloseTo(6.5, 2)
  })

  it('un turno abierto no suma horas', () => {
    expect(horasEntre(local(2026, 8, 1, 20, 0), null)).toBe(0)
  })

  it('nunca devuelve horas negativas', () => {
    expect(horasEntre(local(2026, 8, 2, 2, 0), local(2026, 8, 1, 20, 0))).toBe(0)
  })
})

// El panel enseña «Facturado hoy» arriba del todo, y ese corte tiene que ser
// el del bar: un ticket cobrado a la 01:30 pertenece a ese día para quien
// cierra la caja, aunque en UTC ya sea el siguiente. Es el mismo error que
// mandó horas de la nómina al mes anterior.
describe('esDelDia', () => {
  it('compara en la hora del local, no cortando el texto ISO', () => {
    const madrugada = new Date(2026, 8, 8, 1, 30)   // 8 de septiembre, 01:30 local
    expect(esDelDia(madrugada.toISOString(), '2026-09-08')).toBe(true)
    expect(esDelDia(madrugada.toISOString(), '2026-09-07')).toBe(false)
  })

  it('sin fecha no cuenta como de ningún día', () => {
    expect(esDelDia(null, '2026-09-08')).toBe(false)
    expect(esDelDia(undefined, '2026-09-08')).toBe(false)
  })
})
