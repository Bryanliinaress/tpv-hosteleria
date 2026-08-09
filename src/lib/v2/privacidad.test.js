import { describe, it, expect, vi, beforeEach } from 'vitest'

// ────────────────────────────────────────────────────────────────────────────
// Fallo 31: el móvil del cliente se bajaba los datos de las reservas.
//
// `mesas` es de lectura pública (el QR y la página de reservas necesitan
// número, zona y estado), pero la tabla tiene una columna `reserva` con el
// NOMBRE y el TELÉFONO de quien reservó. La hidratación pedía todas las
// columnas también sin sesión, así que esos datos acababan en el estado —y en
// el localStorage— de cualquiera que abriera la carta.
// ────────────────────────────────────────────────────────────────────────────

const selects = []            // [{tabla, columnas}]
let haySesion = false
let estado = {}

const consulta = (tabla) => ({
  select: (columnas) => {
    selects.push({ tabla, columnas })
    const todas = {
      mesas: [{ id: 'm1', numero: 1, zona: 'Sala', capacidad: 4, estado: 'reservada', unida_a: null, abierta_desde: '2026-08-08T20:00:00Z', camarero_id: 'e1', reserva: { nombre: 'Marta', telefono: '600000000' } }],
      comensales: [], lineas_pedido: [], empleados: [], comandas: [],
    }[tabla] || []
    // como la BBDD: solo vuelven las columnas pedidas
    const pedidas = columnas.split(',').map(c => c.trim())
    const filas = todas.map(f => Object.fromEntries(Object.entries(f).filter(([k]) => pedidas.includes(k))))
    const api = { eq: () => api, then: (r) => r({ data: filas, error: null }) }
    return api
  },
})

vi.mock('../supabase', () => ({
  supabase: {
    from: (t) => consulta(t),
    auth: { getSession: async () => ({ data: { session: haySesion ? { user: 'dueño' } : null } }) },
  },
}))
vi.mock('../repo', () => ({ suscribirLocal: () => {} }))
vi.mock('../../store/useStore', () => ({
  useStore: {
    setState: (v) => { estado = { ...estado, ...(typeof v === 'function' ? v(estado) : v) } },
    getState: () => estado,
  },
}))

const { cargarSala } = await import('./estado')
const columnasDe = (tabla) => selects.filter(s => s.tabla === tabla).map(s => s.columnas).join(' ')

beforeEach(() => { selects.length = 0; estado = {} })

describe('qué columnas de `mesas` se piden', () => {
  it('sin sesión (cliente del QR) no se piden datos de terceros', async () => {
    haySesion = false
    await cargarSala()
    const cols = columnasDe('mesas')
    expect(cols).not.toMatch(/reserva/)
    expect(cols).not.toMatch(/camarero_id/)
    expect(cols).not.toMatch(/abierta_desde/)
    // lo que sí necesita para pintar la sala y elegir zona al reservar
    expect(cols).toMatch(/numero/)
    expect(cols).toMatch(/zona/)
    expect(cols).toMatch(/estado/)
  })

  it('con sesión (el personal del bar) se piden todas', async () => {
    haySesion = true
    await cargarSala()
    const cols = columnasDe('mesas')
    expect(cols).toMatch(/reserva/)
    expect(cols).toMatch(/camarero_id/)
  })

  it('sin las columnas, la mesa se proyecta igual y sin `undefined`', async () => {
    haySesion = false
    await cargarSala()
    expect(estado.mesas[0]).toMatchObject({ numero: 1, zona: 'Sala', reserva: null, abiertaDesde: null, camarero: null })
  })
})
