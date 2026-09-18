import { describe, it, expect, vi, beforeEach } from 'vitest'

// ────────────────────────────────────────────────────────────────────────────
// Un local con `backend: v2` pero SIN proyecto de Supabase todavía.
//
// Es el caso de un bar recién firmado: el perfil se da de alta antes que la
// base. Pasó con Casa Loli y la pantalla se quedaba EN BLANCO, con un
// `Cannot read properties of null (reading 'auth')` en la consola — donde no
// mira nadie. `supabase.js` ya prometía que sin credenciales «la app funciona
// en modo local»; la capa v2 no cumplía su parte.
//
// Sin base no hay sesión de local. Eso se responde, no se revienta.
// ────────────────────────────────────────────────────────────────────────────

vi.mock('../supabase', () => ({ supabase: null, supabaseActivo: false }))
vi.mock('../repo', () => ({
  backendV2: true,
  personal: {}, cuenta: {},
}))
vi.mock('../../store/useStore', () => ({ useStore: { setState: vi.fn(), getState: () => ({}) } }))
vi.mock('./estado', () => ({ cargarTodo: vi.fn(), iniciarRealtime: vi.fn(), iniciarModoAnon: vi.fn() }))
vi.mock('./acciones', () => ({ accionesV2: () => ({}) }))
vi.mock('./acciones2', () => ({ accionesV2b: () => ({}) }))
vi.mock('./cola', () => ({ iniciarCola: vi.fn(), procesar: vi.fn() }))

let v2
beforeEach(async () => { v2 = await import('./index.js') })

describe('un local sin base de datos', () => {
  it('no revienta al preguntar por la sesión: dice que no hay', async () => {
    await expect(v2.haySesionLocal()).resolves.toBe(false)
  })

  it('initV2 no arranca', () => {
    expect(v2.initV2()).toBe(null)
  })

  it('al intentar entrar, explica el motivo en vez de un TypeError', async () => {
    await expect(v2.loginLocal('a@b.es', 'x')).rejects.toThrow(/base de datos/i)
    await expect(v2.registrarCuenta('a@b.es', 'x')).rejects.toThrow(/base de datos/i)
    await expect(v2.crearLocal('Bar')).rejects.toThrow(/base de datos/i)
  })

  it('ninguno de esos errores es el de desreferenciar null', async () => {
    // El fallo original decía «Cannot read properties of null (reading 'auth')»
    // y dejaba la pantalla en blanco. Si vuelve, este test lo caza.
    await expect(v2.loginLocal('a@b.es', 'x')).rejects.not.toThrow(/reading 'auth'/)
  })
})
