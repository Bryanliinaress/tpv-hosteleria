import { describe, it, expect, vi } from 'vitest'

// `estado.js` importa supabase y el store; para probar la ventana basta con la
// función pura, así que se aísla la importación del módulo.
vi.mock('../supabase', () => ({ supabase: null }))

const { inicioVentanaHistorial } = await import('./estado')

// ────────────────────────────────────────────────────────────────────────────
// Cuánto historial se baja.
//
// Antes se bajaban TODOS los tickets del local, con su detalle, en cada
// arranque y cada vez que la tablet volvía del segundo plano. La ventana lo
// acota — pero acortarla de más descuadra la caja: el arqueo suma «desde el
// último cierre», así que si el bar lleva meses sin cerrar caja, la ventana
// tiene que llegar hasta ahí.
// ────────────────────────────────────────────────────────────────────────────
describe('ventana del historial', () => {
  it('cubre el mes en curso entero, desde el día 1', () => {
    const desde = new Date(inicioVentanaHistorial(new Date('2026-08-19T12:00:00')))
    expect(desde.getTime()).toBeLessThanOrEqual(new Date('2026-08-01T00:00:00').getTime())
  })

  it('llega al mes anterior, para poder comparar', () => {
    const desde = new Date(inicioVentanaHistorial(new Date('2026-08-19T12:00:00')))
    expect(desde.getMonth()).toBe(6) // julio
    expect(desde.getFullYear()).toBe(2026)
  })

  it('cruza bien el cambio de año', () => {
    const desde = new Date(inicioVentanaHistorial(new Date('2026-01-15T12:00:00')))
    expect(desde.getFullYear()).toBe(2025)
    expect(desde.getMonth()).toBe(11) // diciembre
  })

  it('se estira hasta el último cierre si el bar lleva sin arquear más que la ventana', () => {
    // Un bar que no cierra caja desde abril: los tickets de mayo en adelante
    // tienen que entrar, o el arqueo cobra de menos.
    const desde = new Date(inicioVentanaHistorial(new Date('2026-08-19T12:00:00'), '2026-04-02T23:30:00Z'))
    expect(desde.toISOString()).toBe('2026-04-02T23:30:00.000Z')
  })

  it('un cierre reciente NO acorta la ventana', () => {
    // Cerrar caja ayer no puede dejar a Informes sin el mes.
    const desde = new Date(inicioVentanaHistorial(new Date('2026-08-19T12:00:00'), '2026-08-18T23:30:00Z'))
    expect(desde.getMonth()).toBe(6)
  })

  it('aguanta una fecha de cierre corrupta sin dejar la ventana en nada', () => {
    const desde = new Date(inicioVentanaHistorial(new Date('2026-08-19T12:00:00'), 'no-es-una-fecha'))
    expect(Number.isNaN(desde.getTime())).toBe(false)
    expect(desde.getMonth()).toBe(6)
  })
})
