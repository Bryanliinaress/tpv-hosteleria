import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// El botón de pago online SOLO debe ofrecerse cuando la pasarela está
// realmente desplegada. Tener claves de Supabase no basta: en el proyecto
// multi-tenant no existe la Edge Function de checkout y el cliente veía un
// botón que fallaba con "Failed to fetch".
describe('pagoOnlineDisponible', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proyecto.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('está desactivado si no se activa explícitamente', async () => {
    vi.stubEnv('VITE_PAGOS_ONLINE', '')
    const { pagoOnlineDisponible } = await import('./pagos')
    expect(pagoOnlineDisponible).toBe(false)
  })

  it('se activa con VITE_PAGOS_ONLINE=1', async () => {
    vi.stubEnv('VITE_PAGOS_ONLINE', '1')
    const { pagoOnlineDisponible } = await import('./pagos')
    expect(pagoOnlineDisponible).toBe(true)
  })

  it('sigue desactivado sin claves de Supabase aunque esté el flag', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_PAGOS_ONLINE', '1')
    const { pagoOnlineDisponible } = await import('./pagos')
    expect(pagoOnlineDisponible).toBe(false)
  })

  it('iniciarPagoOnline se niega a intentarlo si no está disponible', async () => {
    vi.stubEnv('VITE_PAGOS_ONLINE', '')
    const { iniciarPagoOnline } = await import('./pagos')
    await expect(iniciarPagoOnline({ mesaId: 'm', personaId: 'p', importe: 3 }))
      .rejects.toThrow(/no configurado/i)
  })
})
