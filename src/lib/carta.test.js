import { describe, it, expect } from 'vitest'
import { buscarProductos, productosVisibles, descripcionUtil, lineaSimplePendiente, unidades, normalizar, configDeItem, ultimaRonda, hayLineasSinEnviar } from './carta'

const P = [
  { id: 'a', nombre: 'Café con leche', descripcion: 'Café con leche', categoria: 'cafes', disponible: true },
  { id: 'b', nombre: 'Café solo', descripcion: 'Espresso', categoria: 'cafes', disponible: true },
  { id: 'c', nombre: 'Jamón ibérico', descripcion: 'Montadito', categoria: 'desayunos', disponible: true, ingredientes: ['Jamón ibérico', 'Aceite'] },
  { id: 'd', nombre: 'Coca-Cola', descripcion: '', categoria: 'bebidas', disponible: false },
]
const carta = { productos: P }

describe('buscarProductos', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(buscarProductos(P, 'jamon').map(p => p.id)).toEqual(['c'])
    expect(buscarProductos(P, 'CAFÉ').map(p => p.id)).toEqual(['a', 'b'])
  })

  it('exige todas las palabras, en cualquier orden', () => {
    expect(buscarProductos(P, 'leche cafe').map(p => p.id)).toEqual(['a'])
    expect(buscarProductos(P, 'cafe pan').map(p => p.id)).toEqual([])
  })

  it('también busca por ingredientes', () => {
    expect(buscarProductos(P, 'aceite').map(p => p.id)).toEqual(['c'])
  })

  it('sin texto no devuelve nada (no es «todo»)', () => {
    expect(buscarProductos(P, '  ')).toEqual([])
  })
})

describe('productosVisibles', () => {
  it('sin búsqueda enseña la categoría abierta', () => {
    expect(productosVisibles(carta, { categoria: 'cafes' }).map(p => p.id)).toEqual(['a', 'b'])
  })

  it('buscando cruza categorías', () => {
    expect(productosVisibles(carta, { busqueda: 'cafe', categoria: 'desayunos' }).map(p => p.id)).toEqual(['a', 'b'])
  })

  it('al cliente le esconde lo agotado; al personal no', () => {
    expect(productosVisibles(carta, { categoria: 'bebidas' })).toEqual([])
    expect(productosVisibles(carta, { categoria: 'bebidas', incluirNoDisponibles: true }).map(p => p.id)).toEqual(['d'])
  })
})

describe('descripcionUtil', () => {
  it('calla la descripción que solo repite el nombre', () => {
    expect(descripcionUtil(P[0])).toBe('')
    expect(descripcionUtil({ nombre: 'Tostada', descripcion: ' TOSTADA ' })).toBe('')
  })

  it('mantiene la que aporta algo', () => {
    expect(descripcionUtil(P[1])).toBe('Espresso')
  })
})

describe('lineaSimplePendiente', () => {
  const base = { productoId: 'a', estado: 'pendiente', cantidad: 1, uid: 'u1' }

  it('encuentra la línea sin personalizar', () => {
    expect(lineaSimplePendiente([base], 'a')?.uid).toBe('u1')
  })

  it('no toca lo ya enviado a cocina', () => {
    expect(lineaSimplePendiente([{ ...base, estado: 'enviado' }], 'a')).toBeUndefined()
  })

  it('no toca lo personalizado: cada línea es distinta', () => {
    expect(lineaSimplePendiente([{ ...base, nota: 'sin hielo' }], 'a')).toBeUndefined()
    expect(lineaSimplePendiente([{ ...base, anadidos: ['Queso'] }], 'a')).toBeUndefined()
    expect(lineaSimplePendiente([{ ...base, pan: { formato: 'pitufo' } }], 'a')).toBeUndefined()
  })
})

describe('unidades', () => {
  it('suma cantidades, no líneas', () => {
    expect(unidades([{ cantidad: 3 }, { cantidad: 2 }])).toBe(5)
    expect(unidades([])).toBe(0)
    expect(unidades(undefined)).toBe(0)
  })
})

describe('normalizar', () => {
  it('aguanta null y números', () => {
    expect(normalizar(null)).toBe('')
    expect(normalizar(42)).toBe('42')
  })
})

describe('configDeItem', () => {
  it('se queda con lo que define el plato y tira lo de aquella vez', () => {
    const c = configDeItem({
      uid: 'u1', estado: 'enviado', cantidad: 3, enviadoEn: '2026-08-05T10:00:00Z', compartidoCon: ['p2'],
      productoId: 'a', nombre: 'Mixto', precio: 2.5, tipo: 'comida',
      pan: { formato: 'pitufo' }, anadidos: ['Queso'], nota: 'sin sal',
    })
    expect(c).toEqual({
      productoId: 'a', nombre: 'Mixto', precio: 2.5, tipo: 'comida',
      pan: { formato: 'pitufo' }, anadidos: ['Queso'], nota: 'sin sal',
    })
  })

  it('no arrastra listas vacías (romperían la fusión de líneas iguales)', () => {
    const c = configDeItem({ productoId: 'a', nombre: 'Café', precio: 1.3, tipo: 'bebida', quitados: [], anadidos: [], nota: '' })
    expect(Object.keys(c).sort()).toEqual(['nombre', 'precio', 'productoId', 'tipo'])
  })
})

describe('ultimaRonda', () => {
  const it1 = { estado: 'enviado', nombre: 'Café', enviadoEn: '2026-08-05T10:00:05Z' }
  const it2 = { estado: 'enviado', nombre: 'Tostada', enviadoEn: '2026-08-05T10:00:41Z' }
  const it3 = { estado: 'enviado', nombre: 'Caña', enviadoEn: '2026-08-05T11:30:00Z' }

  it('agrupa la comanda del mismo minuto', () => {
    expect(ultimaRonda([it1, it2, it3]).map(i => i.nombre)).toEqual(['Caña'])
    expect(ultimaRonda([it1, it2]).map(i => i.nombre)).toEqual(['Café', 'Tostada'])
  })

  it('deja fuera lo pendiente de enviar', () => {
    expect(ultimaRonda([it1, { estado: 'pendiente', nombre: 'Agua' }]).map(i => i.nombre)).toEqual(['Café'])
  })

  it('en el backend real agrupa por la fecha de creación de la línea', () => {
    const v2 = [
      { estado: 'enviado', nombre: 'Café', creadoEn: '2026-08-05T10:00:05Z' },
      { estado: 'enviado', nombre: 'Caña', creadoEn: '2026-08-05T11:30:00Z' },
      { estado: 'enviado', nombre: 'Tinto', creadoEn: '2026-08-05T11:30:20Z' },
    ]
    expect(ultimaRonda(v2).map(i => i.nombre)).toEqual(['Caña', 'Tinto'])
  })

  it('sin ninguna fecha repite solo lo último, no el servicio entero', () => {
    const sinSello = [
      { estado: 'enviado', nombre: 'Primero' },
      { estado: 'enviado', nombre: 'Último' },
    ]
    expect(ultimaRonda(sinSello).map(i => i.nombre)).toEqual(['Último'])
  })

  it('sin nada enviado, nada que repetir', () => {
    expect(ultimaRonda([{ estado: 'pendiente' }])).toEqual([])
    expect(ultimaRonda([])).toEqual([])
  })
})

// ────────────────────────────────────────────────────────────────────────────
// La cuenta incluye las líneas SIN ENVIAR (`_debe_por_comensal` no mira el
// estado). Sin esto, un cliente podía añadir un plato, ir directo a Pagar,
// pagarlo por Stripe y marcharse: el dinero entra y la comida no existe para
// nadie, porque la cocina nunca vio la comanda.
// ────────────────────────────────────────────────────────────────────────────
describe('¿queda algo que la cocina no haya visto?', () => {
  const mesa = (...items) => ({ personas: [{ id: 'p1', items }] })

  it('sí, si alguna línea sigue pendiente', () => {
    expect(hayLineasSinEnviar(mesa({ estado: 'pendiente' }))).toBe(true)
  })

  it('no, si todo está enviado', () => {
    expect(hayLineasSinEnviar(mesa({ estado: 'enviado' }, { estado: 'enviado' }))).toBe(false)
  })

  it('basta con que UNO de los comensales tenga algo sin enviar', () => {
    const m = { personas: [
      { id: 'p1', items: [{ estado: 'enviado' }] },
      { id: 'p2', items: [{ estado: 'pendiente' }] },
    ] }
    expect(hayLineasSinEnviar(m)).toBe(true)
  })

  it('una mesa vacía o a medias no revienta', () => {
    expect(hayLineasSinEnviar(null)).toBe(false)
    expect(hayLineasSinEnviar({})).toBe(false)
    expect(hayLineasSinEnviar({ personas: [{ id: 'p1' }] })).toBe(false)
  })
})
