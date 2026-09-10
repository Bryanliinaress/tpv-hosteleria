import { describe, it, expect } from 'vitest'
import { revisarPlatoLibre, MAX_NOMBRE, MAX_PRECIO, MAX_CANTIDAD } from './fueraDeCarta.js'

const ok = (extra = {}) => revisarPlatoLibre({ nombre: 'Tarta de la abuela', precio: '4,50', cantidad: 2, tipo: 'comida', ...extra })

describe('revisarPlatoLibre', () => {
  it('acepta lo normal y devuelve números, no texto', () => {
    const r = ok()
    expect(r.ok).toBe(true)
    expect(r.valor).toEqual({ nombre: 'Tarta de la abuela', precio: 4.5, cantidad: 2, tipo: 'comida' })
  })

  it('lee la coma decimal: «3,50» son 3,50 € y no 350', () => {
    expect(ok({ precio: '3,50' }).valor.precio).toBe(3.5)
    expect(ok({ precio: '3.50' }).valor.precio).toBe(3.5)
  })

  it('limpia el nombre (espacios de sobra) porque va impreso', () => {
    expect(ok({ nombre: '  Sugerencia   del  día ' }).valor.nombre).toBe('Sugerencia del día')
  })

  it('sin nombre no hay línea: es lo que lee el cliente en el ticket', () => {
    expect(revisarPlatoLibre({ nombre: '   ', precio: '3' }).ok).toBe(false)
    expect(revisarPlatoLibre({ precio: '3' }).ok).toBe(false)
  })

  it('el nombre no puede pasar del ancho del papel', () => {
    expect(ok({ nombre: 'x'.repeat(MAX_NOMBRE) }).ok).toBe(true)
    expect(ok({ nombre: 'x'.repeat(MAX_NOMBRE + 1) }).ok).toBe(false)
  })

  it('sin precio no se cobra a ciegas', () => {
    expect(revisarPlatoLibre({ nombre: 'Descorche', precio: '' }).ok).toBe(false)
    expect(revisarPlatoLibre({ nombre: 'Descorche' }).ok).toBe(false)
    expect(revisarPlatoLibre({ nombre: 'Descorche', precio: 'dos euros' }).ok).toBe(false)
  })

  it('a 0 € sí: la invitación de la casa es una línea, no un olvido', () => {
    const r = revisarPlatoLibre({ nombre: 'Invitación', precio: '0' })
    expect(r.ok).toBe(true)
    expect(r.valor.precio).toBe(0)
  })

  it('nada de precios negativos ni de dedos gordos', () => {
    expect(ok({ precio: '-1' }).ok).toBe(false)
    expect(ok({ precio: String(MAX_PRECIO) }).ok).toBe(true)
    expect(ok({ precio: '350' }).ok).toBe(true)          // caro, pero puede ser
    expect(ok({ precio: '1000' }).ok).toBe(false)        // «350» tecleado sin coma
  })

  it('la cantidad es entera y de 1 para arriba', () => {
    expect(ok({ cantidad: 0 }).ok).toBe(false)
    expect(ok({ cantidad: 1.5 }).ok).toBe(false)
    expect(ok({ cantidad: MAX_CANTIDAD }).ok).toBe(true)
    expect(ok({ cantidad: MAX_CANTIDAD + 1 }).ok).toBe(false)
  })

  it('sin tipo válido no se sabe si lo hace la cocina o la barra', () => {
    expect(ok({ tipo: 'bebida' }).valor.tipo).toBe('bebida')
    expect(ok({ tipo: 'postre' }).ok).toBe(false)
    expect(revisarPlatoLibre({ nombre: 'Café', precio: '1' }).valor.tipo).toBe('comida')
  })

  it('el error es una frase que se le puede enseñar a quien está en la barra', () => {
    const r = revisarPlatoLibre({ nombre: '', precio: '3' })
    expect(r.error).toMatch(/nombre/i)
    expect(r.error).not.toMatch(/_/)   // nada de códigos internos en pantalla
  })
})
