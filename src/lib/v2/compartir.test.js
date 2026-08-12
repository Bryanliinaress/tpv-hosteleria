import { describe, it, expect, vi, beforeEach } from 'vitest'

// ────────────────────────────────────────────────────────────────────────────
// Fallo 27 y la retención de reservas: dos acciones que la demo tenía y el
// backend real no, así que hacían `setState` y la rehidratación las deshacía.
//
//  - compartir plato: el botón estaba pintado y muerto en la app real, y la
//    cuenta se repartía como si el plato fuera de uno solo.
//  - purgar reservas: borrado por retención (RGPD). Sin implementar, los
//    nombres y teléfonos de las reservas se quedaban para siempre.
// ────────────────────────────────────────────────────────────────────────────

const escrituras = []
const rpcs = []

const filtrable = (tabla, op) => {
  const reg = { tabla, op, filtro: {} }
  escrituras.push(reg)
  const api = {
    eq: (c, v) => { reg.filtro[c] = v; return api },
    lt: (c, v) => { reg.filtro[`${c}<`] = v; return api },
    then: (r) => r({ error: null }),
  }
  return api
}

vi.mock('../supabase', () => ({
  supabase: { from: (n) => ({ delete: () => filtrable(n, 'delete') }) },
}))
vi.mock('./estado', () => ({
  getLocalId: () => 'local-1',
  cargarTodo: async () => {},
  cargarSala: async () => {}, cargarComandas: async () => {}, cargarReservas: async () => {},
  cargarCarta: async () => {}, cargarLocal: async () => {}, cargarHistorial: async () => {},
  cargarFichajes: async () => {}, cargarCierres: async () => {},
  cargarAvisos: async () => {}, refrescarServicio: () => {},
}))
vi.mock('../repo', () => ({
  reservas: {},
  personal: {},
  qr: {
    compartirLinea: (linea, comensal, con) => {
      rpcs.push(['compartirLinea', linea, comensal, con])
      return Promise.resolve()
    },
  },
}))
vi.mock('./plantillaCarta', () => ({ sembrarCartaEjemplo: async () => 0, vaciarCartaV2: async () => {} }))
vi.mock('../../store/useUI', () => ({ toast: () => {} }))
vi.mock('../fiscal', () => ({ registrarTicket: async () => {} }))

let estado = { reservasConfig: { retencionDias: 30 }, mesas: [], empleados: [], fichajes: [], historial: [] }
vi.mock('../../store/useStore', () => ({
  useStore: { getState: () => estado },
  propinasPorMetodoDe: () => ({}),
}))

const { accionesV2 } = await import('./acciones')
const { accionesV2b } = await import('./acciones2')
const acciones = { ...accionesV2(), ...accionesV2b() }

beforeEach(() => { escrituras.length = 0; rpcs.length = 0 })

describe('compartir un plato en la app real', () => {
  it('llama al RPC en vez de tocar solo la pantalla', () => {
    acciones.toggleCompartir('m1', 'ana', 'linea-1', 'luis')
    expect(rpcs).toEqual([['compartirLinea', 'linea-1', 'ana', 'luis']])
  })

  it('el RPC recibe la línea y el dueño, no la mesa', () => {
    // El servidor comprueba que la línea es del comensal que la comparte; si le
    // llegara la mesa en vez de la línea, cualquiera podría compartir la de otro.
    acciones.toggleCompartir('m1', 'ana', 'linea-9', 'sole')
    const [, linea, comensal] = rpcs[0]
    expect(linea).toBe('linea-9')
    expect(comensal).toBe('ana')
  })
})

describe('retención de reservas (RGPD)', () => {
  it('borra en el SERVIDOR las anteriores al límite, de su local', async () => {
    await acciones.purgarReservasAntiguas()
    const [borrado] = escrituras.filter(e => e.tabla === 'reservas')
    expect(borrado.op).toBe('delete')
    expect(borrado.filtro.local_id).toBe('local-1')
    const limite = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    expect(borrado.filtro['fecha<']).toBe(limite)
  })

  it('con retención desactivada no borra nada', async () => {
    // `0` significa «guardar indefinidamente»: borrar ahí sería perder datos
    // que el local ha decidido conservar a propósito.
    estado = { ...estado, reservasConfig: { retencionDias: 0 } }
    await acciones.purgarReservasAntiguas()
    expect(escrituras).toEqual([])
    estado = { ...estado, reservasConfig: { retencionDias: 30 } }
  })
})
