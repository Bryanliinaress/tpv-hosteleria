/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { copiar } from './portapapeles'

// ────────────────────────────────────────────────────────────────────────────
// Copiar tiene la misma trampa que el papel y que el envío a Hacienda: pedirlo
// no es que haya pasado. Aquí se comprueba que se devuelve `false` cuando NO se
// copió — que es lo que deja al encargado pegando otra cosa en Stripe.
// ────────────────────────────────────────────────────────────────────────────
const sinPortapapeles = () => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }) }
const conPortapapeles = (writeText) => { Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true }) }

afterEach(() => { sinPortapapeles(); delete document.execCommand })

describe('copiar al portapapeles', () => {
  it('con portapapeles moderno, copia y lo dice', async () => {
    const writeText = vi.fn(async () => {})
    conPortapapeles(writeText)
    expect(await copiar('cs_test_1')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('cs_test_1')
  })

  // El TPV abierto por http en la red del bar no es contexto seguro y ahí
  // `navigator.clipboard` no existe.
  it('sin portapapeles cae a la vía de siempre', async () => {
    sinPortapapeles()
    document.execCommand = vi.fn(() => true)
    expect(await copiar('cs_test_2')).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('si el navegador rechaza, se entera y devuelve false', async () => {
    conPortapapeles(vi.fn(async () => { throw new Error('NotAllowedError') }))
    document.execCommand = vi.fn(() => false)
    expect(await copiar('cs_test_3')).toBe(false)
  })

  it('no deja el textarea de emergencia colgando en la página', async () => {
    sinPortapapeles()
    document.execCommand = vi.fn(() => true)
    await copiar('cs_test_4')
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('copiar la nada no dice que sí', async () => {
    expect(await copiar('')).toBe(false)
  })
})
