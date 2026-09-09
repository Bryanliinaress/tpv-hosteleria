import { describe, it, expect } from 'vitest'
import { buscarProductos, productosVisibles, descripcionUtil, lineaSimplePendiente, unidades, normalizar, configDeItem, ultimaRonda, hayLineasSinEnviar, revisarNombreApartado, moverEnLista, emojiPorTipo, TIPOS_APARTADO } from './carta'

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

// ────────────────────────────────────────────────────────────────────────────
// Los apartados de la carta. Antes solo se podían crear y borrar — y borrar se
// lleva sus productos por delante, así que una errata al escribir «Bocadilos»
// costaba volver a teclear doce bocadillos.
// ────────────────────────────────────────────────────────────────────────────
const APARTADOS = [
  { id: 'a', nombre: 'Desayunos', tipo: 'comida' },
  { id: 'b', nombre: 'Cafés', tipo: 'bebida' },
  { id: 'c', nombre: 'Postres', tipo: 'comida' },
]

describe('nombre de un apartado', () => {
  it('uno nuevo vale, y se recorta', () => {
    expect(revisarNombreApartado(APARTADOS, null, '  Bocadillos ')).toEqual({ ok: true, nombre: 'Bocadillos' })
  })

  it('sin nombre no se guarda', () => {
    expect(revisarNombreApartado(APARTADOS, null, '   ').ok).toBe(false)
  })

  // Dos apartados iguales en la carta del cliente son dos secciones con el
  // mismo título y productos distintos: no hay forma de saber cuál es cuál.
  it('no deja repetir uno que ya existe, ni cambiando mayúsculas', () => {
    expect(revisarNombreApartado(APARTADOS, null, 'postres').ok).toBe(false)
    expect(revisarNombreApartado(APARTADOS, null, 'Postres').ok).toBe(false)
  })

  it('un apartado puede quedarse con su propio nombre', () => {
    expect(revisarNombreApartado(APARTADOS, 'c', 'Postres').ok).toBe(true)
  })
})

describe('mover un apartado', () => {
  it('sube y baja intercambiando con el vecino', () => {
    expect(moverEnLista(APARTADOS, 'c', -1).map(x => x.id)).toEqual(['a', 'c', 'b'])
    expect(moverEnLista(APARTADOS, 'a', 1).map(x => x.id)).toEqual(['b', 'a', 'c'])
  })

  // Subir el primero no es un error: es que no hay a dónde. La lista tiene que
  // volver entera, o la carta se quedaría a medias.
  it('en el extremo devuelve la lista tal cual', () => {
    expect(moverEnLista(APARTADOS, 'a', -1).map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(moverEnLista(APARTADOS, 'c', 1).map(x => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('un id que no está no descoloca nada', () => {
    expect(moverEnLista(APARTADOS, 'zzz', -1).map(x => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('a dónde van las comandas', () => {
  // No es cosmético: decide por qué impresora sale la comanda.
  it('cada tipo dice su destino con nombre de bar', () => {
    expect(TIPOS_APARTADO.comida.label).toBe('Cocina')
    expect(TIPOS_APARTADO.bebida.label).toBe('Barra')
  })

  it('el icono por defecto distingue comida de bebida', () => {
    expect(emojiPorTipo('bebida')).not.toBe(emojiPorTipo('comida'))
    expect(emojiPorTipo(undefined)).toBe(emojiPorTipo('comida'))
  })
})
