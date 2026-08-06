import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase simulado: se controla si la red "va" o no
let redCaida = false
let rechazarFn = null            // nombre de RPC que el servidor rechaza
let redComoError = false         // supabase-js devuelve el fallo de red en error, sin lanzar
const llamadas = []
const rpcMock = vi.fn(async (fn, args) => {
  llamadas.push({ fn, args })
  if (redCaida) throw new TypeError('Failed to fetch')
  if (fn === rechazarFn) return { data: null, error: { message: 'mesa_cerrada' } }
  if (redComoError) return { data: null, error: { message: 'TypeError: Failed to fetch' } }
  return { data: null, error: null }
})
vi.mock('../supabase', () => ({ supabase: { rpc: (...a) => rpcMock(...a) } }))

const store = new Map()
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}
// navigator es de solo lectura en Node: se define la propiedad a mano
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })

const { encolar, procesar, pendientes, esFalloDeRed } = await import('./cola')

beforeEach(() => { store.clear(); llamadas.length = 0; rpcMock.mockClear(); redCaida = false; rechazarFn = null; redComoError = false })

describe('cola offline', () => {
  it('distingue un fallo de red de un rechazo del servidor', () => {
    expect(esFalloDeRed(new TypeError('Failed to fetch'))).toBe(true)
    expect(esFalloDeRed(new Error('NetworkError when attempting to fetch'))).toBe(true)
    expect(esFalloDeRed(new Error('sin_aforo'))).toBe(false)
  })

  it('guarda las operaciones y las cuenta', () => {
    encolar('qr_confirmar_pedido', { p_mesa: 'm1' })
    encolar('qr_llamar_camarero', { p_mesa: 'm1' })
    expect(pendientes()).toBe(2)
  })

  it('al volver la red las reenvía EN ORDEN y vacía la cola', async () => {
    encolar('qr_agregar_linea', { p_comensal: 'c1' })
    encolar('qr_confirmar_pedido', { p_mesa: 'm1' })
    await procesar()
    expect(llamadas.map(l => l.fn)).toEqual(['qr_agregar_linea', 'qr_confirmar_pedido'])
    expect(pendientes()).toBe(0)
  })

  it('si sigue sin haber red, conserva lo pendiente', async () => {
    encolar('qr_confirmar_pedido', { p_mesa: 'm1' })
    redCaida = true
    await procesar()
    expect(pendientes()).toBe(1)   // no se pierde el pedido
  })

  it('NO pierde el pedido si el fallo de red llega como error (supabase-js no lanza)', async () => {
    encolar('qr_agregar_linea', { p_comensal: 'c1' })
    redComoError = true
    await procesar()
    expect(pendientes()).toBe(1)   // se conserva para el siguiente intento
  })

  it('descarta una operación que el servidor rechaza (no bloquea la cola)', async () => {
    rechazarFn = 'qr_confirmar_pedido'
    encolar('qr_confirmar_pedido', { p_mesa: 'vieja' })
    encolar('qr_llamar_camarero', { p_mesa: 'm2' })
    await procesar()
    expect(pendientes()).toBe(0)
    expect(llamadas.map(l => l.fn)).toEqual(['qr_confirmar_pedido', 'qr_llamar_camarero'])
  })
})

// Lo más importante: el dinero no se reenvía a ciegas
describe('qué operaciones se encolan', () => {
  it('los cobros y cierres NUNCA se encolan (evita duplicar tickets)', async () => {
    const repo = await import('../repo')
    redCaida = true
    await expect(repo.personal.cobrarMesa('m1', {})).rejects.toThrow()
    expect(pendientes()).toBe(0)
  })

  it('encola cuando supabase-js devuelve el fallo de red en error (no lanza)', async () => {
    const repo = await import('../repo')
    redComoError = true
    await expect(repo.qr.confirmarPedido('m9')).rejects.toMatchObject({ codigo: 'guardado_sin_conexion' })
    expect(pendientes()).toBe(1)
  })

  it('el pedido del cliente sí se guarda para reenviarlo', async () => {
    const repo = await import('../repo')
    redCaida = true
    await expect(repo.qr.confirmarPedido('m1')).rejects.toMatchObject({ codigo: 'guardado_sin_conexion' })
    expect(pendientes()).toBe(1)
  })
})

describe('avisos al camarero', () => {
  it('avisa si el pedido no se puede ni guardar (almacenamiento lleno)', async () => {
    const { useUI } = await import('../../store/useUI')
    useUI.setState({ toasts: [] })
    const original = globalThis.localStorage.setItem
    globalThis.localStorage.setItem = () => { throw new Error('QuotaExceeded') }
    const ok = encolar('agregar_linea', { x: 1 })
    globalThis.localStorage.setItem = original

    expect(ok).toBe(false)
    expect(useUI.getState().toasts.some(t => /no se pudo guardar/i.test(t.mensaje))).toBe(true)
  })

  it('avisa cuando el servidor rechaza una operación encolada', async () => {
    const { useUI } = await import('../../store/useUI')
    useUI.setState({ toasts: [] })
    redCaida = true
    encolar('agregar_linea', { producto: 'x' })
    redCaida = false
    rechazarFn = 'agregar_linea'
    await procesar()

    expect(pendientes()).toBe(0)                       // no bloquea la cola
    const avisos = useUI.getState().toasts.map(t => t.mensaje).join(' | ')
    expect(avisos).toMatch(/un producto del pedido/)   // dice QUÉ se ha perdido
    expect(avisos).toMatch(/mesa_cerrada/)             // y por qué
  })

  it('lo que se envía bien no genera avisos', async () => {
    const { useUI } = await import('../../store/useUI')
    useUI.setState({ toasts: [] })
    redCaida = true
    encolar('confirmar_pedido', { mesa: 1 })
    redCaida = false
    await procesar()

    expect(pendientes()).toBe(0)
    expect(useUI.getState().toasts).toEqual([])
  })
})
