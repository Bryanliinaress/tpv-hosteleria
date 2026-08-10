import { describe, it, expect } from 'vitest'
import { traducirCarta, nombreProducto, descripcionProducto, textoBuscable } from './cartaI18n'
import { buscarProductos } from './carta'

// Cambiar a inglés traducía la interfaz pero dejaba los platos y sus
// ingredientes en español: el cliente leía «Add» encima de «Jamón york,
// Mantequilla». La carta la escribe el local, así que aquí se traduce lo
// conocido y NUNCA se inventa lo que no se sabe.

describe('términos de la carta', () => {
  it('en español no toca nada', () => {
    expect(traducirCarta('es', 'Jamón york, Mantequilla')).toBe('Jamón york, Mantequilla')
  })

  it('traduce una lista de ingredientes entera', () => {
    expect(traducirCarta('en', 'Jamón serrano, Tomate, Aceite')).toBe('Serrano ham, Tomato, Olive oil')
  })

  it('le da igual cómo esté escrito (mayúsculas, tildes)', () => {
    expect(traducirCarta('en', 'JAMÓN YORK')).toBe('Cooked ham')
    expect(traducirCarta('en', 'jamon york')).toBe('cooked ham')
    expect(traducirCarta('en', ' Queso Manchego ')).toBe('Manchego cheese')
  })

  it('lo que no conoce lo deja tal cual, sin inventar', () => {
    expect(traducirCarta('en', 'Croquetas de la abuela')).toBe('Croquetas de la abuela')
    expect(traducirCarta('en', 'Salmorejo, picatostes')).toBe('Salmorejo, picatostes')
  })

  it('traduce lo que conoce aunque la lista lleve algo desconocido', () => {
    expect(traducirCarta('en', 'Tomate, salmorejo')).toBe('Tomato, salmorejo')
  })

  it('los panes y formatos también son carta', () => {
    expect(traducirCarta('en', 'Sin gluten')).toBe('Gluten free')
    expect(traducirCarta('en', 'Mollete')).toBe('Mollete (soft bun)')
  })

  it('no se rompe con vacíos', () => {
    expect(traducirCarta('en', '')).toBe('')
    expect(traducirCarta('en', null)).toBe(null)
    expect(traducirCarta('en', undefined)).toBe(undefined)
  })
})

describe('traducción propia del local', () => {
  const plato = {
    nombre: 'Croquetas de la abuela', nombreEn: "Grandma's croquettes",
    descripcion: 'Receta de la casa', descripcionEn: 'House recipe',
  }

  it('si el dueño la ha escrito, manda la suya', () => {
    expect(nombreProducto('en', plato)).toBe("Grandma's croquettes")
    expect(descripcionProducto('en', plato)).toBe('House recipe')
  })

  it('en español se ve la del local, no la inglesa', () => {
    expect(nombreProducto('es', plato)).toBe('Croquetas de la abuela')
    expect(descripcionProducto('es', plato)).toBe('Receta de la casa')
  })

  it('sin traducción propia, se recurre al diccionario', () => {
    const simple = { nombre: 'Tomate', descripcion: 'Aceite, Tomate' }
    expect(nombreProducto('en', simple)).toBe('Tomato')
    expect(descripcionProducto('en', simple)).toBe('Olive oil, Tomato')
  })

  it('una traducción vacía o en blanco no cuenta', () => {
    expect(nombreProducto('en', { nombre: 'Queso', nombreEn: '   ' })).toBe('Cheese')
  })

  it('respeta el texto ya recortado por la pantalla', () => {
    const prod = { nombre: 'Mixto', descripcion: 'Jamón york, Queso, Mantequilla' }
    expect(descripcionProducto('en', prod, 'Jamón york, Queso')).toBe('Cooked ham, Cheese')
  })
})

// Los nombres de bocadillo español son listas: «Jamón york y mantequilla».
describe('nombres compuestos', () => {
  it('traduce las dos partes y el «y»', () => {
    expect(traducirCarta('en', 'Jamón york y mantequilla')).toBe('Cooked ham and butter')
    expect(traducirCarta('en', 'Aceite y tomate')).toBe('Olive oil and tomato')
  })

  it('no toca un nombre propio del bar', () => {
    expect(traducirCarta('en', 'Pulpo a la gallega')).toBe('Pulpo a la gallega')
    expect(traducirCarta('en', 'Especial de la casa')).toBe('House special')
  })

  it('un término con coma propia sigue entero', () => {
    expect(traducirCarta('en', 'Mitad café, mitad leche')).toBe('Half coffee, half milk')
  })
})

// Con la carta en inglés, buscar «cheese» no encontraba nada: se buscaba solo
// en el texto español. Ahora la traducción también es buscable.
describe('buscar en el idioma del cliente', () => {
  const mixto = { nombre: 'Mixto', descripcion: 'Jamón york, Queso', ingredientes: ['Jamón york', 'Queso'] }

  it('el texto buscable incluye la traducción', () => {
    const texto = textoBuscable('en', mixto).toLowerCase()
    expect(texto).toContain('cheese')
    expect(texto).toContain('ham')
  })

  it('en español no añade nada (se busca en el original)', () => {
    expect(textoBuscable('es', mixto)).toBe('')
  })

  it('buscarProductos encuentra por la traducción sin perder el español', () => {
    const extra = (p) => textoBuscable('en', p)
    expect(buscarProductos([mixto], 'cheese', extra)).toHaveLength(1)
    expect(buscarProductos([mixto], 'queso', extra)).toHaveLength(1)
    expect(buscarProductos([mixto], 'salmon', extra)).toHaveLength(0)
  })

  it('sin traducción, la búsqueda sigue como antes', () => {
    expect(buscarProductos([mixto], 'queso')).toHaveLength(1)
  })
})
