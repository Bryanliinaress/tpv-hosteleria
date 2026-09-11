import { describe, it, expect } from 'vitest'
import { interpretarEnvio } from './envioFactura.js'

describe('interpretarEnvio', () => {
  it('enviado de verdad', () => {
    expect(interpretarEnvio({ ok: true, id: 're_1' }, 200)).toEqual({ enviado: true, alternativa: false, error: null })
  })

  it('sin configurar NO es un error: se ofrece compartir', () => {
    expect(interpretarEnvio({ ok: false, motivo: 'sin_configurar' }, 200)).toEqual({ enviado: false, alternativa: true, error: null })
  })

  it('una factura rechazada no se manda, y lo dice', () => {
    const r = interpretarEnvio({ ok: false, motivo: 'factura_rechazada' }, 409)
    expect(r.alternativa).toBe(false)
    expect(r.error).toMatch(/corrígela/)
  })

  it('un fallo del proveedor es un error, no una alternativa', () => {
    const r = interpretarEnvio({ ok: false, motivo: 'proveedor', error: 'domain not verified' }, 502)
    expect(r).toEqual({ enviado: false, alternativa: false, error: 'No se pudo enviar el correo: domain not verified' })
  })

  it('sin sesión, dice por qué', () => {
    expect(interpretarEnvio({}, 401).error).toMatch(/sesión/)
  })

  it('un 200 sin ok no se da por enviado', () => {
    expect(interpretarEnvio({}, 200).enviado).toBe(false)
  })
})
