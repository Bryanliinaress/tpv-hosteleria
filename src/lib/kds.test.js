import { describe, it, expect } from 'vitest'
import { agruparPorMesa, estadoDeGrupo, itemsDelPaso, esUrgente } from './kds'

const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const p = (o) => ({ cantidad: 1, estado: 'recibido', horaEntrada: hace(1), ...o })

describe('agruparPorMesa', () => {
  const pedidos = [
    p({ id: '1', mesaId: 'm4', mesaNumero: 4, nombre: 'Mixto', cantidad: 2, personaNombre: 'Ana', horaEntrada: hace(6) }),
    p({ id: '2', mesaId: 'm1', mesaNumero: 1, nombre: 'Tortilla', personaNombre: 'Luis', horaEntrada: hace(12) }),
    p({ id: '3', mesaId: 'm4', mesaNumero: 4, nombre: 'Tostada', personaNombre: 'Ana', horaEntrada: hace(3) }),
    p({ id: '4', mesaId: 'm4', mesaNumero: 4, nombre: 'Café', personaNombre: 'Bea', horaEntrada: hace(3) }),
  ]

  it('junta los platos de la misma mesa', () => {
    const g = agruparPorMesa(pedidos)
    expect(g).toHaveLength(2)
    expect(g.find(x => x.mesaNumero === 4).items).toHaveLength(3)
  })

  it('pone primero la mesa que lleva más esperando', () => {
    expect(agruparPorMesa(pedidos).map(g => g.mesaNumero)).toEqual([1, 4])
  })

  it('cuenta unidades y comensales sin repetir', () => {
    const m4 = agruparPorMesa(pedidos).find(g => g.mesaNumero === 4)
    expect(m4.uds).toBe(4)                       // 2 mixtos + tostada + café
    expect(m4.comensales).toEqual(['Ana', 'Bea'])
  })

  it('sin pedidos no revienta', () => {
    expect(agruparPorMesa([])).toEqual([])
    expect(agruparPorMesa(undefined)).toEqual([])
  })
})

describe('estadoDeGrupo', () => {
  it('manda el plato más atrasado', () => {
    expect(estadoDeGrupo([p({ estado: 'preparando' }), p({ estado: 'recibido' })])).toBe('recibido')
    expect(estadoDeGrupo([p({ estado: 'listo' }), p({ estado: 'preparando' })])).toBe('preparando')
    expect(estadoDeGrupo([p({ estado: 'espera' }), p({ estado: 'listo' })])).toBe('espera')
  })

  it('todo listo, mesa lista', () => {
    expect(estadoDeGrupo([p({ estado: 'listo' }), p({ estado: 'listo' })])).toBe('listo')
  })
})

describe('itemsDelPaso', () => {
  it('el botón de la mesa solo mueve lo más atrasado', () => {
    const grupo = { estado: 'recibido', items: [p({ id: 'a', estado: 'recibido' }), p({ id: 'b', estado: 'preparando' })] }
    expect(itemsDelPaso(grupo).map(i => i.id)).toEqual(['a'])
  })
})

describe('esUrgente', () => {
  it('avisa de la mesa que lleva mucho en cola', () => {
    expect(esUrgente({ estado: 'recibido', desde: hace(12) })).toBe(true)
    expect(esUrgente({ estado: 'recibido', desde: hace(4) })).toBe(false)
  })

  it('no mete prisa a lo que ya está listo ni a lo que no ha marchado', () => {
    expect(esUrgente({ estado: 'listo', desde: hace(30) })).toBe(false)
    expect(esUrgente({ estado: 'espera', desde: hace(30) })).toBe(false)
  })
})
