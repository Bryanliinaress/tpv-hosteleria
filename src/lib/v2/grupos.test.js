import { describe, it, expect } from 'vitest'
import { cabezaDe, miembrosDe, grupoDe } from './grupos'

// Dos mesas de cuatro juntas para un grupo de ocho: lo que las une es
// `unida_a`. Liberar o separar pensando solo en «la mesa» dejaba a las otras
// con gente sentada y su consumo sin cobrar.
const SALA = [
  { id: 'm1', numero: 1, unidaA: null },
  { id: 'm2', numero: 2, unidaA: 'm1' },
  { id: 'm3', numero: 3, unidaA: 'm1' },
  { id: 'm4', numero: 4, unidaA: null },
]

describe('quién manda en el grupo', () => {
  it('una mesa suelta es su propia cabeza', () => {
    expect(cabezaDe(SALA[3], SALA).id).toBe('m4')
  })

  it('una mesa unida remite a su cabeza', () => {
    expect(cabezaDe(SALA[1], SALA).id).toBe('m1')
  })

  it('si la cabeza ya no está, la mesa se vale por sí misma', () => {
    const huerfana = { id: 'x', unidaA: 'borrada' }
    expect(cabezaDe(huerfana, SALA).id).toBe('x')
  })
})

describe('el grupo entero', () => {
  it('sale igual pidiéndolo por la cabeza o por una unida', () => {
    expect(grupoDe('m1', SALA).sort()).toEqual(['m1', 'm2', 'm3'])
    expect(grupoDe('m3', SALA).sort()).toEqual(['m1', 'm2', 'm3'])
  })

  it('una mesa sin grupo es ella sola', () => {
    expect(grupoDe('m4', SALA)).toEqual(['m4'])
  })

  it('una mesa que no existe no rompe nada', () => {
    expect(grupoDe('fantasma', SALA)).toEqual(['fantasma'])
    expect(grupoDe(null, SALA)).toEqual([])
    expect(miembrosDe(null, SALA)).toEqual([])
  })
})
