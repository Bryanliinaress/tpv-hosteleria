import { describe, it, expect } from 'vitest'
import { sinEnviar, unidadesDe, candidatoDeEnter } from './tomaPedido.js'

const it_ = (over = {}) => ({ uid: Math.random(), productoId: 'p1', nombre: 'Caña', precio: 2, cantidad: 1, estado: 'pendiente', ...over })

describe('sinEnviar', () => {
  const mesa = {
    personas: [
      { id: 'a', nombre: 'Ana', items: [it_({ cantidad: 2 }), it_({ estado: 'enviado', cantidad: 4 })] },
      { id: 'b', nombre: 'Luis', items: [it_({ productoId: 'p2', nombre: 'Tostada', precio: 3.2, cantidad: 3 })] },
    ],
  }

  it('cuenta lo de TODA la mesa: es lo que sale a cocina al enviar', () => {
    const r = sinEnviar(mesa)
    expect(r.unidades).toBe(5)
    expect(r.total).toBe(13.6)
  })

  it('lo ya enviado no cuenta: no sale otra vez', () => {
    expect(sinEnviar(mesa).porPersona[0].unidades).toBe(2)
  })

  it('reparte por comensal para poder pintarlo', () => {
    const [ana, luis] = sinEnviar(mesa).porPersona
    expect(ana.persona.nombre).toBe('Ana')
    expect(ana.total).toBe(4)
    expect(luis.total).toBe(9.6)
  })

  it('una mesa sin nada no rompe', () => {
    expect(sinEnviar(null)).toEqual({ porPersona: [], unidades: 0, total: 0 })
    expect(sinEnviar({ personas: [{ id: 'a', items: [] }] }).unidades).toBe(0)
  })
})

describe('unidadesDe', () => {
  it('suma también las personalizadas: dos mixtos, uno sin queso, son 2', () => {
    const items = [it_({ productoId: 'mixto' }), it_({ productoId: 'mixto', quitados: ['Queso'] }), it_({ productoId: 'otro' })]
    expect(unidadesDe(items, 'mixto')).toBe(2)
  })

  it('lo enviado no cuenta', () => {
    expect(unidadesDe([it_({ estado: 'enviado', cantidad: 3 })], 'p1')).toBe(0)
  })
})

describe('candidatoDeEnter', () => {
  const cafes = [{ id: 1, nombre: 'Café solo' }, { id: 2, nombre: 'Café con leche' }, { id: 3, nombre: 'Cortado' }]

  it('con un solo resultado, Enter lo añade', () => {
    expect(candidatoDeEnter([cafes[2]], 'cort')).toBe(cafes[2])
  })

  it('con varios, solo si uno se llama EXACTAMENTE así (sin mirar tildes)', () => {
    expect(candidatoDeEnter(cafes, 'cafe solo')).toBe(cafes[0])
  })

  it('con varios y ninguno exacto, Enter no añade nada a ciegas', () => {
    expect(candidatoDeEnter(cafes, 'caf')).toBeNull()
  })

  it('sin búsqueda no hay candidato', () => {
    expect(candidatoDeEnter(cafes, '  ')).toBeNull()
    expect(candidatoDeEnter([], 'caña')).toBeNull()
  })
})
