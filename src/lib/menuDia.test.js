import { describe, it, expect } from 'vitest'
import { esMenu, menuCompleto, siguientePendiente, precioMenu, resumenElecciones, alternarOpcion } from './menuDia'

const MENU = {
  nombre: 'Menú del día', precios: { base: 12 },
  menu: {
    grupos: [
      { titulo: 'Primero', min: 1, max: 1, opciones: [{ nombre: 'Ensalada' }, { nombre: 'Sopa' }] },
      { titulo: 'Segundo', min: 1, max: 1, opciones: [{ nombre: 'Pollo' }, { nombre: 'Solomillo', sup: 2 }] },
      { titulo: 'Postre', min: 1, max: 2, opciones: [{ nombre: 'Flan' }, { nombre: 'Café' }] },
    ],
  },
}
const SUELTO = { nombre: 'Café solo', precios: { base: 1.3 } }

describe('menú del día', () => {
  it('distingue un menú de un producto normal', () => {
    expect(esMenu(MENU)).toBe(true)
    expect(esMenu(SUELTO)).toBe(false)
    expect(esMenu({ menu: { grupos: [] } })).toBe(false)
  })

  it('no se puede enviar hasta elegir de cada grupo obligatorio', () => {
    expect(menuCompleto(MENU, [])).toBe(false)
    expect(menuCompleto(MENU, [{ grupo: 'Primero', opcion: 'Sopa' }])).toBe(false)
    const completo = [
      { grupo: 'Primero', opcion: 'Sopa' },
      { grupo: 'Segundo', opcion: 'Pollo' },
      { grupo: 'Postre', opcion: 'Flan' },
    ]
    expect(menuCompleto(MENU, completo)).toBe(true)
  })

  it('un producto normal siempre está completo', () => {
    expect(menuCompleto(SUELTO, [])).toBe(true)
  })

  it('guía al cliente indicando qué le falta', () => {
    expect(siguientePendiente(MENU, []).titulo).toBe('Primero')
    expect(siguientePendiente(MENU, [{ grupo: 'Primero', opcion: 'Sopa' }]).titulo).toBe('Segundo')
  })

  it('el precio es cerrado salvo suplementos', () => {
    expect(precioMenu(MENU, [{ grupo: 'Primero', opcion: 'Sopa', sup: 0 }])).toBe(12)
    expect(precioMenu(MENU, [{ grupo: 'Segundo', opcion: 'Solomillo', sup: 2 }])).toBe(14)
  })

  it('la comanda de cocina detalla lo elegido', () => {
    const t = resumenElecciones([
      { grupo: 'Primero', opcion: 'Sopa' }, { grupo: 'Segundo', opcion: 'Pollo' },
    ])
    expect(t).toBe('Primero: Sopa · Segundo: Pollo')
  })

  describe('selección', () => {
    const g1 = MENU.menu.grupos[0]
    const gPostre = MENU.menu.grupos[2]

    it('en un grupo de una sola elección, la nueva sustituye a la anterior', () => {
      let sel = alternarOpcion(g1, { nombre: 'Ensalada' }, [])
      sel = alternarOpcion(g1, { nombre: 'Sopa' }, sel)
      expect(sel.filter(e => e.grupo === 'Primero')).toHaveLength(1)
      expect(sel[0].opcion).toBe('Sopa')
    })

    it('volver a tocar lo elegido lo quita', () => {
      const sel = alternarOpcion(g1, { nombre: 'Sopa' }, [{ grupo: 'Primero', opcion: 'Sopa', sup: 0 }])
      expect(sel).toHaveLength(0)
    })

    it('un grupo con max 2 admite dos opciones', () => {
      let sel = alternarOpcion(gPostre, { nombre: 'Flan' }, [])
      sel = alternarOpcion(gPostre, { nombre: 'Café' }, sel)
      expect(sel).toHaveLength(2)
    })

    it('guarda el suplemento junto a la elección', () => {
      const sel = alternarOpcion(MENU.menu.grupos[1], { nombre: 'Solomillo', sup: 2 }, [])
      expect(sel[0]).toMatchObject({ grupo: 'Segundo', opcion: 'Solomillo', sup: 2 })
    })
  })
})
