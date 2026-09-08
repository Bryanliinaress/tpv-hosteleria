import { describe, it, expect } from 'vitest'
import { urlStripe, refCorta } from './stripe'

// ────────────────────────────────────────────────────────────────────────────
// El enlace al cobro en Stripe. Es lo que abre el encargado para DEVOLVER
// dinero: si lleva al modo equivocado, busca un cobro que allí no existe y
// acaba pensando que el aviso miente.
// ────────────────────────────────────────────────────────────────────────────
const PRUEBAS = 'cs_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'
const REAL = 'cs_live_b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6'

describe('enlace al Dashboard de Stripe', () => {
  it('una referencia de pruebas abre el modo de pruebas', () => {
    expect(urlStripe(PRUEBAS)).toContain('dashboard.stripe.com/test/')
    expect(urlStripe(PRUEBAS)).toContain(PRUEBAS)
  })

  it('una referencia real abre el modo real', () => {
    expect(urlStripe(REAL)).toContain('dashboard.stripe.com/search')
    expect(urlStripe(REAL)).not.toContain('/test/')
  })

  // El día que el bar pase a producción cambia el secreto de Stripe, no esto:
  // el modo sale del propio id, así que no hay nada que acordarse de tocar.
  it('sin referencia no hay enlace que ofrecer', () => {
    expect(urlStripe('')).toBeNull()
    expect(urlStripe(null)).toBeNull()
  })
})

describe('referencia acortada', () => {
  it('deja ver el principio y el final, que es lo que se compara', () => {
    const corta = refCorta(PRUEBAS)
    expect(corta.startsWith('cs_test_a1')).toBe(true)
    expect(corta.endsWith(PRUEBAS.slice(-6))).toBe(true)
    expect(corta.length).toBeLessThan(PRUEBAS.length)
  })

  it('una referencia corta se enseña entera', () => {
    expect(refCorta('cs_123')).toBe('cs_123')
  })
})
