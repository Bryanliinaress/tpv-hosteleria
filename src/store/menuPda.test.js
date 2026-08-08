import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { conFormatos, conOpciones, lineaDeMenu, alternarOpcion } from '../lib/menuDia'

// ────────────────────────────────────────────────────────────────────────────
// El menú del día pedido DESDE LA PDA (fallo 21).
//
// La hoja de personalización decidía qué enseñar con `!!producto.precios`, y un
// menú también los tiene (`{ base: 12 }`): el camarero veía pan y formatos, y
// la comanda llegaba a cocina SIN saber qué primero y qué segundo preparar.
// En un bar con menú al mediodía, eso es el grueso del servicio.
// ────────────────────────────────────────────────────────────────────────────

const st = () => useStore.getState()

const MENU = {
  id: 'menu1', nombre: 'Menú del día', tipo: 'comida', precios: { base: 12 },
  menu: {
    grupos: [
      { titulo: 'Primero', min: 1, max: 1, opciones: [{ nombre: 'Ensalada' }, { nombre: 'Sopa' }] },
      { titulo: 'Segundo', min: 1, max: 1, opciones: [{ nombre: 'Pollo' }, { nombre: 'Solomillo', sup: 2 }] },
    ],
  },
}
const MONTADITO = { id: 'cl1', nombre: 'Mixto', tipo: 'comida', precios: { pitufo: 2, viena: 3 } }
const CAFE = { id: 'cf1', nombre: 'Solo', tipo: 'bebida', precio: 1.3 }

beforeEach(() => {
  useStore.setState(s => ({
    mesas: s.mesas.map(m => ({ ...m, estado: 'libre', personas: [], unidaA: null, unidas: [] })),
    pedidosCocina: [], pedidosBarra: [], historial: [],
  }))
})

describe('qué hoja abre cada producto', () => {
  it('un menú NO es un producto de formatos, aunque tenga precios', () => {
    expect(conFormatos(MENU)).toBe(false)
    expect(conFormatos(MONTADITO)).toBe(true)
    expect(conFormatos(CAFE)).toBe(false)
  })

  it('menú y montadito abren opciones; un café se añade directo', () => {
    expect(conOpciones(MENU)).toBe(true)
    expect(conOpciones(MONTADITO)).toBe(true)
    expect(conOpciones(CAFE)).toBe(false)
  })
})

describe('un menú pedido desde la PDA llega a cocina con sus elecciones', () => {
  const pedirMenu = (elecciones, nota = '') => {
    const mesa = st().mesas[0]
    const personaId = st().unirseAMesa(mesa.id, 'Mesa 1')
    st().agregarItem(mesa.id, personaId, lineaDeMenu(MENU, elecciones, nota))
    st().confirmarPedido(mesa.id)
    return st().pedidosCocina.filter(p => p.mesaId === mesa.id)
  }

  it('la comanda dice el primero y el segundo', () => {
    const cola = pedirMenu([
      { grupo: 'Primero', opcion: 'Sopa', sup: 0 },
      { grupo: 'Segundo', opcion: 'Pollo', sup: 0 },
    ])
    expect(cola).toHaveLength(1)
    expect(cola[0].nombre).toBe('Menú del día')
    expect(cola[0].nota).toBe('Primero: Sopa · Segundo: Pollo')
  })

  it('la indicación del camarero se suma a las elecciones, no las pisa', () => {
    const cola = pedirMenu([{ grupo: 'Primero', opcion: 'Sopa', sup: 0 }], '  sin sal  ')
    expect(cola[0].nota).toBe('Primero: Sopa · sin sal')
  })

  it('el suplemento del solomillo va en el precio de la línea', () => {
    const elecciones = alternarOpcion(MENU.menu.grupos[1], { nombre: 'Solomillo', sup: 2 }, [])
    expect(lineaDeMenu(MENU, elecciones).precio).toBe(14)
    expect(lineaDeMenu(MENU, []).precio).toBe(12)
  })

  it('la línea lleva las elecciones aparte de la nota: el backend real las necesita para cobrar el suplemento', () => {
    const elecciones = [{ grupo: 'Segundo', opcion: 'Solomillo', sup: 2 }]
    expect(lineaDeMenu(MENU, elecciones).elecciones).toEqual(elecciones)
  })

  it('dos menús con elecciones distintas NO se funden en una línea', () => {
    const mesa = st().mesas[1]
    const personaId = st().unirseAMesa(mesa.id, 'Mesa 2')
    st().agregarItem(mesa.id, personaId, lineaDeMenu(MENU, [{ grupo: 'Primero', opcion: 'Sopa', sup: 0 }]))
    st().agregarItem(mesa.id, personaId, lineaDeMenu(MENU, [{ grupo: 'Primero', opcion: 'Ensalada', sup: 0 }]))
    st().confirmarPedido(mesa.id)
    const notas = st().pedidosCocina.filter(p => p.mesaId === mesa.id).map(p => p.nota).sort()
    expect(notas).toEqual(['Primero: Ensalada', 'Primero: Sopa'])
  })

  it('dos menús idénticos sí se agrupan en una línea de 2', () => {
    const mesa = st().mesas[2]
    const personaId = st().unirseAMesa(mesa.id, 'Mesa 3')
    const linea = lineaDeMenu(MENU, [{ grupo: 'Primero', opcion: 'Sopa', sup: 0 }])
    st().agregarItem(mesa.id, personaId, linea)
    st().agregarItem(mesa.id, personaId, linea)
    st().confirmarPedido(mesa.id)
    const cola = st().pedidosCocina.filter(p => p.mesaId === mesa.id)
    expect(cola).toHaveLength(1)
    expect(cola[0].cantidad).toBe(2)
  })

  it('un menú de bebidas iría a barra: el destino lo manda el tipo del producto', () => {
    const mesa = st().mesas[3]
    const personaId = st().unirseAMesa(mesa.id, 'Mesa 4')
    st().agregarItem(mesa.id, personaId, lineaDeMenu({ ...MENU, tipo: 'bebida' }, [{ grupo: 'Primero', opcion: 'Sopa', sup: 0 }]))
    st().confirmarPedido(mesa.id)
    expect(st().pedidosBarra.filter(p => p.mesaId === mesa.id)).toHaveLength(1)
    expect(st().pedidosCocina.filter(p => p.mesaId === mesa.id)).toHaveLength(0)
  })
})
