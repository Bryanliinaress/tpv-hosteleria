import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../store/useStore', () => ({
  useStore: { getState: () => ({ local: { nombre: 'Casa Loli' } }) },
}))

// el enlace de gestión se construye con window.location (aquí no hay navegador)
globalThis.window = { location: { origin: 'https://local.test' } }

const reserva = { nombre: 'Ana', fecha: '2026-08-04', hora: '13:00', personas: 2, email: 'ana@ejemplo.com', token: 'tok123', id: 'r1' }

describe('correos de reserva', () => {
  beforeEach(() => vi.resetModules())

  it('la fecha va en texto, sin barras (EmailJS las escapaba a &#x2F;)', async () => {
    const { __contenido } = await import('./email')
    const { asunto, mensaje } = __contenido('cancelacion', reserva)
    expect(asunto).toContain('4 de agosto de 2026')
    expect(asunto).not.toMatch(/\//)
    expect(mensaje).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('los correos se firman con el nombre del local', async () => {
    const { __contenido } = await import('./email')
    expect(__contenido('cancelacion', reserva).mensaje).toContain('Casa Loli')
    expect(__contenido('confirmacion', reserva).mensaje).toContain('Casa Loli')
  })

  it('la confirmación incluye los datos y el enlace de gestión', async () => {
    const { __contenido } = await import('./email')
    const { asunto, mensaje } = __contenido('confirmacion', reserva)
    expect(asunto).toContain('Reserva confirmada')
    expect(mensaje).toContain('13:00')
    expect(mensaje).toContain('2')
    expect(mensaje).toMatch(/#\/reservar\?r=r1&t=tok123/)
  })

  it('el recordatorio se distingue de la confirmación', async () => {
    const { __contenido } = await import('./email')
    expect(__contenido('recordatorio', reserva).asunto).toContain('Recordatorio')
  })
})
