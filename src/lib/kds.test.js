import { describe, it, expect } from 'vitest'
import { agruparPorMesa, estadoDeGrupo, itemsDelPaso, esUrgente, estadoVisible, ESTADO_DESCONOCIDO } from './kds'

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

// Una pantalla de producción no puede quedarse en blanco por un dato raro: si
// una bebida llega en «espera» y la barra no tenía ese estado declarado, la
// tarjeta se pintaba con undefined y se caía la pantalla entera.
describe('estados que la pantalla no conoce', () => {
  const DE_BARRA = { recibido: { label: 'Recibido', color: '#f59e0b', next: 'preparando' } }

  it('un estado declarado se usa tal cual', () => {
    expect(estadoVisible(DE_BARRA, 'recibido').label).toBe('Recibido')
  })

  it('uno desconocido devuelve una tarjeta neutra, no undefined', () => {
    const e = estadoVisible(DE_BARRA, 'espera')
    expect(e).toBeTruthy()
    expect(e.color).toBeTruthy()
    expect(e.label).toBeTruthy()
  })

  it('y se puede seguir trabajando: tiene siguiente paso', () => {
    expect(estadoVisible(DE_BARRA, 'lo_que_sea').next).toBe('recibido')
  })

  it('aguanta que no haya tabla de estados', () => {
    expect(estadoVisible(null, 'recibido')).toBe(ESTADO_DESCONOCIDO)
    expect(estadoVisible(undefined, undefined)).toBe(ESTADO_DESCONOCIDO)
  })
})

// Las pantallas del cliente construyen comandas «de mentira» sin hora de
// entrada. Si una se cuela en la cola, no puede colarse por delante de todo ni
// pintarse como urgente desde 1970.
describe('comandas sin hora de entrada', () => {
  const conHora = { id: 'a', mesaId: 'm1', mesaNumero: 1, estado: 'recibido', cantidad: 1, horaEntrada: new Date().toISOString() }
  const sinHora = { id: 'b', mesaId: 'm2', mesaNumero: 2, estado: 'recibido', cantidad: 1, horaEntrada: null }

  it('la mesa sin hora va al final, no la primera', () => {
    const g = agruparPorMesa([sinHora, conHora])
    expect(g.map(x => x.mesaNumero)).toEqual([1, 2])
  })

  it('no se marca como urgente', () => {
    const [g] = agruparPorMesa([sinHora])
    expect(esUrgente(g)).toBe(false)
  })

  it('si alguna del grupo sí tiene hora, esa manda', () => {
    const mismaMesa = { ...sinHora, mesaId: 'm1', mesaNumero: 1 }
    const [g] = agruparPorMesa([mismaMesa, conHora])
    expect(g.desde).toBe(conHora.horaEntrada)
  })
})
