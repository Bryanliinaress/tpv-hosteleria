import { describe, it, expect } from 'vitest'
import { minutosDeRetraso, comoVa, avisosDeAgenda, comoSeDice } from './agenda'

// ────────────────────────────────────────────────────────────────────────────
// La agenda pintaba igual la reserva de las 22:00 y la que entra por la puerta
// en diez minutos sin mesa asignada. A las 14:10 de un sábado eso es justo lo
// que hay que distinguir.
// ────────────────────────────────────────────────────────────────────────────
const AHORA = new Date(2026, 8, 12, 14, 10)          // sábado 12/09, 14:10
const rv = (o) => ({ id: Math.random().toString(36), fecha: '2026-09-12', estado: 'confirmada', mesaId: 'm1', ...o })

describe('cuánto se retrasa', () => {
  it('cuenta en minutos, negativo si aún no ha llegado', () => {
    expect(minutosDeRetraso(rv({ hora: '14:00' }), AHORA)).toBe(10)
    expect(minutosDeRetraso(rv({ hora: '14:30' }), AHORA)).toBe(-20)
    expect(minutosDeRetraso(rv({ hora: '14:10' }), AHORA)).toBe(0)
  })

  it('sin hora o sin fecha no se inventa un número', () => {
    expect(minutosDeRetraso(rv({ hora: '' }), AHORA)).toBeNull()
    expect(minutosDeRetraso({ hora: '14:00' }, AHORA)).toBeNull()
    expect(minutosDeRetraso(null, AHORA)).toBeNull()
  })
})

describe('cómo va una reserva', () => {
  it('la que entra dentro de poco, «pronto»', () => {
    expect(comoVa(rv({ hora: '14:30' }), AHORA)).toBe('pronto')
    expect(comoVa(rv({ hora: '14:10' }), AHORA)).toBe('pronto')
  })

  it('la que lleva un cuarto de hora sin aparecer, «tarde»', () => {
    expect(comoVa(rv({ hora: '13:55' }), AHORA)).toBe('tarde')
  })

  it('la de dentro de tres horas no molesta todavía', () => {
    expect(comoVa(rv({ hora: '22:00' }), AHORA)).toBeNull()
  })

  // Una sentada ya llegó y una cancelada no viene: ninguna de las dos reclama
  // nada, y sacarlas en el aviso sería ruido justo cuando hay lío.
  it('las sentadas y las canceladas no reclaman nada', () => {
    expect(comoVa(rv({ hora: '13:00', estado: 'sentada' }), AHORA)).toBeNull()
    expect(comoVa(rv({ hora: '13:00', estado: 'cancelada' }), AHORA)).toBeNull()
  })
})

describe('lo que reclama atención', () => {
  const AGENDA = [
    rv({ hora: '13:40', nombre: 'Retrasada' }),                 // 30 min tarde
    rv({ hora: '14:20', nombre: 'Enseguida' }),                 // en 10 min
    rv({ hora: '14:30', nombre: 'Sin mesa', mesaId: null }),    // en 20, sin mesa
    rv({ hora: '21:00', nombre: 'De noche' }),                  // aún no
    rv({ hora: '13:00', nombre: 'Ya sentada', estado: 'sentada' }),
  ]

  it('separa las que llegan de las que se retrasan', () => {
    const a = avisosDeAgenda(AGENDA, AHORA)
    expect(a.pronto.map(r => r.nombre)).toEqual(['Enseguida', 'Sin mesa'])
    expect(a.tarde.map(r => r.nombre)).toEqual(['Retrasada'])
  })

  // Que la reserva de las 22:00 no tenga mesa a las 14:10 no es un problema:
  // es que aún no toca. Avisarlo sería un aviso que se aprende a ignorar.
  it('la falta de mesa solo importa en las que están al caer', () => {
    expect(avisosDeAgenda(AGENDA, AHORA).sinMesa.map(r => r.nombre)).toEqual(['Sin mesa'])
  })

  it('salen por hora, que es el orden en que entran por la puerta', () => {
    const a = avisosDeAgenda([rv({ hora: '14:35', nombre: 'B' }), rv({ hora: '14:15', nombre: 'A' })], AHORA)
    expect(a.pronto.map(r => r.nombre)).toEqual(['A', 'B'])
  })

  it('sin reservas no hay avisos', () => {
    expect(avisosDeAgenda([], AHORA)).toEqual({ pronto: [], tarde: [], sinMesa: [] })
  })
})

describe('cómo se dice', () => {
  it('en minutos, hacia delante y hacia atrás', () => {
    expect(comoSeDice(rv({ hora: '14:25' }), AHORA)).toBe('en 15 min')
    expect(comoSeDice(rv({ hora: '13:50' }), AHORA)).toBe('20 min tarde')
    expect(comoSeDice(rv({ hora: '14:10' }), AHORA)).toBe('ahora')
  })
})
