import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'

// ────────────────────────────────────────────────────────────────────────────
// Tiempos de cocina: el 2º plato y el postre no salen hasta que sala los
// «marcha». Si esto falla, la comida sale toda de golpe.
// ────────────────────────────────────────────────────────────────────────────

const st = () => useStore.getState()

beforeEach(() => {
  useStore.setState(s => ({
    mesas: s.mesas.map(m => ({ ...m, estado: 'libre', personas: [], unidaA: null, unidas: [] })),
    pedidosCocina: [], pedidosBarra: [], historial: [],
  }))
})

function mesaConTiempos(idx = 0) {
  const mesa = st().mesas[idx]
  const p = st().unirseAMesa(mesa.id, 'Ana')
  st().agregarItem(mesa.id, p, { productoId: 'a', nombre: 'Ensalada', precio: 6, tipo: 'comida' })
  st().agregarItem(mesa.id, p, { productoId: 'b', nombre: 'Solomillo', precio: 18, tipo: 'comida', tiempo: 2 })
  st().agregarItem(mesa.id, p, { productoId: 'c', nombre: 'Flan', precio: 4, tipo: 'comida', tiempo: 3 })
  st().confirmarPedido(mesa.id)
  return { mesaId: mesa.id, personaId: p }
}

describe('marchar por tiempos', () => {
  it('solo el primer tiempo entra en cocina; el resto espera', () => {
    const { mesaId } = mesaConTiempos(0)
    const cola = st().pedidosCocina.filter(p => p.mesaId === mesaId)
    expect(cola.filter(p => p.estado === 'recibido').map(p => p.nombre)).toEqual(['Ensalada'])
    expect(cola.filter(p => p.estado === 'espera').map(p => p.nombre).sort()).toEqual(['Flan', 'Solomillo'])
  })

  it('marchar lanza el siguiente tiempo, no todos', () => {
    const { mesaId } = mesaConTiempos(1)
    st().marcharSiguiente(mesaId)
    const cola = st().pedidosCocina.filter(p => p.mesaId === mesaId)
    expect(cola.find(p => p.nombre === 'Solomillo').estado).toBe('recibido')
    expect(cola.find(p => p.nombre === 'Flan').estado).toBe('espera')
  })

  it('marchar dos veces saca el postre', () => {
    const { mesaId } = mesaConTiempos(2)
    st().marcharSiguiente(mesaId)
    st().marcharSiguiente(mesaId)
    expect(st().pedidosCocina.filter(p => p.mesaId === mesaId).every(p => p.estado !== 'espera')).toBe(true)
  })

  it('marchar sin nada en espera no rompe nada', () => {
    const { mesaId } = mesaConTiempos(3)
    st().marcharSiguiente(mesaId); st().marcharSiguiente(mesaId); st().marcharSiguiente(mesaId)
    expect(st().pedidosCocina.filter(p => p.mesaId === mesaId)).toHaveLength(3)
  })

  it('marchar una mesa no toca las otras', () => {
    const a = mesaConTiempos(4)
    const b = mesaConTiempos(5)
    st().marcharSiguiente(a.mesaId)
    expect(st().pedidosCocina.filter(p => p.mesaId === b.mesaId && p.estado === 'espera')).toHaveLength(2)
  })

  it('la bebida no espera nunca: sale ya', () => {
    const mesa = st().mesas[6]
    const p = st().unirseAMesa(mesa.id, 'Ana')
    st().agregarItem(mesa.id, p, { productoId: 'd', nombre: 'Caña', precio: 2, tipo: 'bebida' })
    st().confirmarPedido(mesa.id)
    expect(st().pedidosBarra.find(x => x.mesaId === mesa.id).estado).toBe('recibido')
  })
})

describe('la comanda llega completa a cocina', () => {
  it('lleva mesa, comensal, cantidad y la personalización en la nota', () => {
    const mesa = st().mesas[7]
    const p = st().unirseAMesa(mesa.id, 'Rosa')
    st().agregarItem(mesa.id, p, {
      productoId: 'e', nombre: 'Mixto', precio: 2.5, tipo: 'comida',
      pan: { formato: 'pitufo', tipo: 'normal', nombreFormato: 'Pitufo', nombreTipo: 'Normal' },
      quitados: ['Mantequilla'], anadidos: ['Queso'], nota: 'muy hecho',
    })
    st().confirmarPedido(mesa.id)
    const c = st().pedidosCocina.find(x => x.mesaId === mesa.id)
    expect(c.mesaNumero).toBe(mesa.numero)
    expect(c.personaNombre).toBe('Rosa')
    expect(c.cantidad).toBe(1)
    expect(c.nota).toContain('SIN Mantequilla')
    expect(c.nota).toContain('CON Queso')
    expect(c.nota).toContain('muy hecho')
    expect(c.nota).toContain('Pitufo')
  })

  it('lo ya enviado no se vuelve a mandar al confirmar otra vez', () => {
    const mesa = st().mesas[8]
    const p = st().unirseAMesa(mesa.id, 'Ana')
    st().agregarItem(mesa.id, p, { productoId: 'f', nombre: 'Tortilla', precio: 2, tipo: 'comida' })
    st().confirmarPedido(mesa.id)
    st().confirmarPedido(mesa.id)
    expect(st().pedidosCocina.filter(x => x.mesaId === mesa.id)).toHaveLength(1)
  })
})
