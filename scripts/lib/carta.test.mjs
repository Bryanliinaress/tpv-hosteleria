import { describe, it, expect } from 'vitest'
import { revisarCarta, filasCategorias, filasProductos, resumen } from './carta.mjs'

// ────────────────────────────────────────────────────────────────────────────
// La carta de un bar real se revisa ANTES de escribirla.
//
// Esto corre contra la base de un cliente, así que el fallo caro no es que
// pete: es que entre una carta con un precio mal y el bar cobre de menos
// durante una semana sin enterarse. Se revisa entera y se avisa de todo de
// golpe, y solo se escribe si no hay nada que decir.
// ────────────────────────────────────────────────────────────────────────────

const base = () => ({
  categorias: [
    { id: 'des', nombre: 'Desayunos', tipo: 'comida', emoji: '🥪' },
    { id: 'beb', nombre: 'Bebidas', tipo: 'bebida' },
  ],
  productos: [
    { categoria: 'des', nombre: 'Mixto', precios: { pitufo: 2, viena: 3 }, alergenos: ['lacteos'] },
    { categoria: 'des', nombre: 'Tortilla', precios: { pitufo: 2.5 }, alergenos: ['huevos'] },
    { categoria: 'beb', nombre: 'Café', precios: { base: 1.3 } },
  ],
})

describe('revisar la carta antes de tocar nada', () => {
  it('una carta buena no tiene nada que decir', () => {
    expect(revisarCarta(base())).toEqual([])
  })

  it('caza un alérgeno que no es de los 14', () => {
    const c = base()
    c.productos[0].alergenos = ['lacteos', 'cacahuete']   // el bueno es «cacahuetes»
    expect(revisarCarta(c)).toEqual([expect.stringContaining('cacahuete')])
  })

  it('caza un precio que no es un número', () => {
    const c = base()
    c.productos[0].precios.pitufo = '2,50'   // coma decimal: el clásico
    expect(revisarCarta(c)[0]).toMatch(/no es un número/)
  })

  it('caza un producto sin precio y uno con precio negativo', () => {
    const c = base()
    c.productos[1].precios = {}
    c.productos[2].precios.base = -1
    const fallos = revisarCarta(c)
    expect(fallos).toHaveLength(2)
    expect(fallos.join(' ')).toMatch(/no tiene ningún precio/)
    expect(fallos.join(' ')).toMatch(/negativo/)
  })

  it('caza un producto que apunta a una categoría que no existe', () => {
    const c = base()
    c.productos[0].categoria = 'postres'
    expect(revisarCarta(c)[0]).toMatch(/«postres».*no existe/)
  })

  it('caza el mismo plato dos veces en la misma categoría', () => {
    const c = base()
    c.productos.push({ categoria: 'des', nombre: 'MIXTO', precios: { base: 9 } })
    expect(revisarCarta(c)[0]).toMatch(/dos veces/)
  })

  it('los dice TODOS de una vez, no el primero', () => {
    const c = base()
    c.productos[0].precios.pitufo = 'x'
    c.productos[1].alergenos = ['inventado']
    c.productos[2].precios = {}
    expect(revisarCarta(c)).toHaveLength(3)
  })

  it('caza un suplemento de menú que no es un número', () => {
    const c = base()
    c.productos[0].menu = { grupos: [{ nombre: 'Postre', opciones: [{ nombre: 'Tarta', suplemento: '2' }] }] }
    expect(revisarCarta(c)[0]).toMatch(/suplemento/)
  })

  it('una carta vacía o rota se rechaza sin reventar', () => {
    expect(revisarCarta(null)[0]).toMatch(/JSON/)
    expect(revisarCarta({ categorias: [], productos: [] })).toHaveLength(2)
  })
})

describe('las filas que se escriben', () => {
  it('las categorías llevan su orden y su tipo', () => {
    const filas = filasCategorias(base(), 'loc-1')
    expect(filas[0]).toMatchObject({ local_id: 'loc-1', nombre: 'Desayunos', tipo: 'comida', orden: 0 })
    expect(filas[1]).toMatchObject({ nombre: 'Bebidas', tipo: 'bebida', orden: 1 })
  })

  it('los productos cuelgan del uuid que la base acaba de dar', () => {
    const filas = filasProductos(base(), 'loc-1', { des: 'uuid-des', beb: 'uuid-beb' })
    expect(filas.map(f => f.categoria_id)).toEqual(['uuid-des', 'uuid-des', 'uuid-beb'])
  })

  it('el orden va POR categoría, no en una cuenta global', () => {
    // Si fuera global, «Café» saldría con orden 2 y al reordenar Desayunos
    // habría que tocar también Bebidas.
    const filas = filasProductos(base(), 'loc-1', { des: 'd', beb: 'b' })
    expect(filas.map(f => f.orden)).toEqual([0, 1, 0])
  })

  it('sigue numerando donde lo dejó si ya había productos', () => {
    const filas = filasProductos(base(), 'loc-1', { des: 'd', beb: 'b' }, { des: 4 })
    expect(filas.map(f => f.orden)).toEqual([4, 5, 0])
  })

  it('el menú del día viaja dentro de modificadores, como espera la app', () => {
    const c = base()
    c.productos[0].menu = { grupos: [{ nombre: 'Primero', opciones: [] }] }
    c.productos[0].nombreEn = 'Mixed'
    const fila = filasProductos(c, 'loc-1', { des: 'd', beb: 'b' })[0]
    expect(fila.modificadores.menu.grupos).toHaveLength(1)
    expect(fila.modificadores.nombreEn).toBe('Mixed')
  })

  it('un producto sin menú no lleva la clave vacía', () => {
    const fila = filasProductos(base(), 'loc-1', { des: 'd', beb: 'b' })[2]
    expect(fila.modificadores).not.toHaveProperty('menu')
  })

  it('todo está disponible salvo que diga lo contrario', () => {
    const c = base()
    c.productos[1].disponible = false
    const filas = filasProductos(c, 'loc-1', { des: 'd', beb: 'b' })
    expect(filas.map(f => f.disponible)).toEqual([true, false, true])
  })
})

describe('el resumen que se enseña antes de escribir', () => {
  it('cuenta por categoría, los menús y los que no declaran alérgenos', () => {
    const c = base()
    c.productos[0].menu = { grupos: [{ nombre: 'P', opciones: [] }] }
    expect(resumen(c)).toEqual({
      porCategoria: [{ nombre: 'Desayunos', cuantos: 2 }, { nombre: 'Bebidas', cuantos: 1 }],
      productos: 3,
      conMenu: 1,
      sinAlergenos: 1,   // el café
    })
  })
})
