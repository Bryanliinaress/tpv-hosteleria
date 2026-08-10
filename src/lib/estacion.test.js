import { describe, it, expect } from 'vitest'
import { comandasDeEstacion, ticketsDeComandas } from './estacion'

const COMIDA = { id: 'c1', mesaId: 'm1', mesaNumero: 1, nombre: 'Tortilla', cantidad: 1 }
const BEBIDA = { id: 'b1', mesaId: 'm1', mesaNumero: 1, nombre: 'Caña', cantidad: 2 }
const COMIDA_2 = { id: 'c2', mesaId: 'm2', mesaNumero: 2, nombre: 'Bravas', cantidad: 1 }

describe('qué atiende cada estación', () => {
  it('la de cocina solo ve comida', () => {
    const r = comandasDeEstacion('cocina', [COMIDA], [BEBIDA])
    expect(r.map(p => p.nombre)).toEqual(['Tortilla'])
    expect(r[0].destino).toBe('cocina')
  })

  it('la de barra solo ve bebida', () => {
    const r = comandasDeEstacion('barra', [COMIDA], [BEBIDA])
    expect(r.map(p => p.nombre)).toEqual(['Caña'])
    expect(r[0].destino).toBe('barra')
  })

  it('en «ambas» cada comanda conserva su destino', () => {
    const r = comandasDeEstacion('ambas', [COMIDA], [BEBIDA])
    expect(r.map(p => `${p.nombre}:${p.destino}`)).toEqual(['Tortilla:cocina', 'Caña:barra'])
  })
})

describe('agrupar en comandas para imprimir', () => {
  it('la comida y la bebida de una misma mesa son DOS comandas', () => {
    const tickets = ticketsDeComandas(comandasDeEstacion('ambas', [COMIDA], [BEBIDA]))
    expect(tickets).toHaveLength(2)
    expect(tickets.map(t => t.destino).sort()).toEqual(['barra', 'cocina'])
    // …y ninguna se lleva platos de la otra
    expect(tickets.find(t => t.destino === 'cocina').items.map(i => i.nombre)).toEqual(['Tortilla'])
    expect(tickets.find(t => t.destino === 'barra').items.map(i => i.nombre)).toEqual(['Caña'])
  })

  it('lo de una misma mesa y destino va junto en un papel', () => {
    const otra = { ...COMIDA, id: 'c9', nombre: 'Croquetas' }
    const tickets = ticketsDeComandas(comandasDeEstacion('cocina', [COMIDA, otra], []))
    expect(tickets).toHaveLength(1)
    expect(tickets[0].items).toHaveLength(2)
  })

  it('mesas distintas nunca se mezclan', () => {
    const tickets = ticketsDeComandas(comandasDeEstacion('cocina', [COMIDA, COMIDA_2], []))
    expect(tickets).toHaveLength(2)
    expect(new Set(tickets.map(t => t.id)).size).toBe(2)   // ids distintos aunque sea el mismo ms
  })

  it('una comanda sin destino sale por cocina, no se pierde', () => {
    const tickets = ticketsDeComandas([{ mesaId: 'm3', mesaNumero: 3, nombre: 'Algo' }])
    expect(tickets[0].destino).toBe('cocina')
  })

  it('sin comandas no se imprime nada', () => {
    expect(ticketsDeComandas([])).toEqual([])
  })
})
