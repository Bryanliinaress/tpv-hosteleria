import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, propinasPorMetodoDe } from './useStore'
import { agruparPorMesa } from '../lib/kds'

// ────────────────────────────────────────────────────────────────────────────
// UN SERVICIO ENTERO, de abrir la mesa al arqueo.
//
// Los demás tests miran una pieza cada uno. Este recorre el camino completo tal
// y como pasa en un bar —dos comensales, comida y bebida, un plato compartido,
// una ronda más, cobro por separado y cierre de caja— para que una regresión en
// cualquier eslabón salte aunque la pieza suelta siga «funcionando».
// ────────────────────────────────────────────────────────────────────────────

const st = () => useStore.getState()

beforeEach(() => {
  useStore.setState(s => ({
    mesas: s.mesas.map(m => ({ ...m, estado: 'libre', personas: [], unidaA: null, unidas: [], camarero: null, abiertaDesde: null })),
    pedidosCocina: [], pedidosBarra: [], historial: [], cierres: [], anulaciones: [],
  }))
})

describe('servicio completo de una mesa', () => {
  it('de abrir la mesa a cuadrar el cajón', () => {
    const mesa = st().mesas.find(m => m.capacidad >= 2)

    // 1) Llegan dos clientes y se sientan
    const ana = st().unirseAMesa(mesa.id, 'Ana')
    const luis = st().unirseAMesa(mesa.id, 'Luis')
    expect(st().mesas.find(m => m.id === mesa.id).estado).toBe('ocupada')
    expect(ana).not.toBe(luis)                       // ids distintos aunque entren a la vez

    // 2) Piden: comida para Ana, bebida para Luis
    st().agregarItem(mesa.id, ana, { productoId: 'p1', nombre: 'Tortilla', precio: 6, tipo: 'comida' })
    st().agregarItem(mesa.id, luis, { productoId: 'p2', nombre: 'Caña', precio: 2.5, tipo: 'bebida' })
    st().confirmarPedido(mesa.id)

    // 3) Cada cosa va a su sitio: la tortilla a cocina, la caña a barra
    const cocina = st().pedidosCocina.filter(p => p.mesaId === mesa.id)
    const barra = st().pedidosBarra.filter(p => p.mesaId === mesa.id)
    expect(cocina.map(p => p.nombre)).toEqual(['Tortilla'])
    expect(barra.map(p => p.nombre)).toEqual(['Caña'])
    // y cocina las ve agrupadas por mesa, no sueltas
    expect(agruparPorMesa(cocina)).toHaveLength(1)

    // 4) Otra ronda: dos cañas más para Luis
    st().agregarItem(mesa.id, luis, { productoId: 'p2', nombre: 'Caña', precio: 2.5, tipo: 'bebida' })
    st().agregarItem(mesa.id, luis, { productoId: 'p2', nombre: 'Caña', precio: 2.5, tipo: 'bebida' })
    st().confirmarPedido(mesa.id)
    const cañas = st().mesas.find(m => m.id === mesa.id).personas.find(p => p.id === luis).items
    expect(cañas.reduce((s, i) => s + i.cantidad, 0)).toBe(3)

    // 5) Comparten unas bravas: la cuenta se parte entre los dos
    st().agregarItem(mesa.id, ana, { productoId: 'p3', nombre: 'Bravas', precio: 5, tipo: 'comida' })
    const bravas = st().mesas.find(m => m.id === mesa.id).personas.find(p => p.id === ana).items.find(i => i.nombre === 'Bravas')
    st().toggleCompartir(mesa.id, ana, bravas.uid, luis)
    st().confirmarPedido(mesa.id)

    // 6) Ana paga lo suyo en efectivo, con propina
    st().pagarParte(mesa.id, ana, { propina: 1, metodo: 'efectivo', cobradoPor: 'Sole' })
    expect(st().historial).toHaveLength(0)           // la mesa sigue abierta: falta Luis

    // 7) Luis paga con tarjeta y se cierra la mesa
    st().pagarParte(mesa.id, luis, { propina: 0, metodo: 'tarjeta', cobradoPor: 'Sole' })
    const ticket = st().historial.at(-1)
    expect(ticket).toBeTruthy()
    expect(st().mesas.find(m => m.id === mesa.id).estado).toBe('libre')
    expect(st().mesas.find(m => m.id === mesa.id).personas).toHaveLength(0)

    // 8) Las cuentas cuadran: 6 + 2,5×3 + 5 = 18,50
    expect(ticket.total).toBe(18.5)
    const sumaPagos = Object.values(ticket.pagos).reduce((s, v) => s + v, 0)
    expect(Math.round(sumaPagos * 100)).toBe(1850)
    // el plato compartido se reparte: Ana no paga las bravas enteras
    expect(ticket.pagos.efectivo).toBeLessThan(ticket.total)
    expect(ticket.pagos.tarjeta).toBeGreaterThan(0)

    // 9) La propina en efectivo se espera EN EL CAJÓN
    expect(propinasPorMetodoDe(ticket).efectivo).toBe(1)

    // 10) Arqueo: ventas en efectivo + propina en efectivo
    st().cerrarCaja(null)
    const z = st().cierres.at(-1)
    expect(z.nTickets).toBe(1)
    expect(z.total).toBe(18.5)
    expect(z.efectivoEsperado).toBe(Math.round(((ticket.pagos.efectivo || 0) + 1) * 100) / 100)

    // 11) Contando el cajón con ese dinero exacto, no hay descuadre
    useStore.setState({ cierres: [] })
    st().cerrarCaja(z.efectivoEsperado)
    expect(st().cierres.at(-1).descuadre).toBe(0)
  })

  it('la mesa queda lista para el siguiente cliente', () => {
    const mesa = st().mesas[0]
    const p = st().unirseAMesa(mesa.id, 'Cliente')
    st().agregarItem(mesa.id, p, { productoId: 'p1', nombre: 'Café', precio: 1.3, tipo: 'bebida' })
    st().confirmarPedido(mesa.id)
    st().cobrarMesa(mesa.id, { metodo: 'efectivo', cobradoPor: 'Sole' })

    const despues = st().mesas.find(m => m.id === mesa.id)
    expect(despues.estado).toBe('libre')
    expect(despues.personas).toEqual([])
    expect(despues.camarero).toBeNull()
    // y no quedan comandas suyas colgando en las pantallas de cocina/barra
    expect(st().pedidosBarra.filter(x => x.mesaId === mesa.id)).toHaveLength(0)
  })
})
