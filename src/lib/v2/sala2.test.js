import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// ────────────────────────────────────────────────────────────────────────────
// Fallo 24: acciones de sala que en la app REAL solo tocaban la pantalla.
//
// El backend v2 sustituye las acciones del store una por una; las que no están
// en la lista se quedan con la versión del blob, que hace `setState` y nada
// más. Como la sala se rehidrata del servidor en cada evento, el cambio duraba
// segundos y luego «se deshacía solo»: juntar dos mesas desde el Mostrador,
// mover un cliente de mesa, o cambiar la zona/capacidad desde Admin.
// ────────────────────────────────────────────────────────────────────────────

const escrituras = []      // [{tabla, op, valores, filtro}]
const rpcs = []
let config = { carta: { etiquetas: { formatos: 'Pan' }, tiposPan: [] } }

const filtrable = (tabla, op, valores) => {
  const reg = { tabla, op, valores, filtro: {} }
  escrituras.push(reg)
  const api = {
    eq: (c, v) => { reg.filtro[c] = v; return api },
    in: (c, v) => { reg.filtro[c] = v; return api },
    then: (r) => r({ error: null }),
  }
  return api
}

const tabla = (nombre) => ({
  update: (valores) => filtrable(nombre, 'update', valores),
  insert: (valores) => filtrable(nombre, 'insert', valores),
  delete: () => filtrable(nombre, 'delete', null),
  select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'local-1', config }, error: null }) }) }),
})

vi.mock('../supabase', () => ({ supabase: { from: (n) => tabla(n) } }))
vi.mock('./estado', () => ({
  getLocalId: () => 'local-1',
  cargarSala: async () => {}, cargarComandas: async () => {}, cargarReservas: async () => {},
  cargarCarta: async () => {}, cargarLocal: async () => {}, cargarHistorial: async () => {},
  cargarFichajes: async () => {}, cargarCierres: async () => {},
}))
vi.mock('../repo', () => ({
  reservas: {},
  personal: { agruparMesas: (a, b) => { rpcs.push(['agruparMesas', a, b]); return Promise.resolve() } },
}))
vi.mock('./plantillaCarta', () => ({ sembrarCartaEjemplo: async () => 0, vaciarCartaV2: async () => {} }))
vi.mock('../../store/useUI', () => ({ toast: () => {} }))

const MESA_1 = {
  id: 'm1', numero: 1, estado: 'ocupada', zona: 'Sala', capacidad: 4,
  personas: [
    { id: 'c1', nombre: 'Ana', items: [{ uid: 'l1' }, { uid: 'l2' }] },
    { id: 'c2', nombre: 'Luis', items: [] },
  ],
}
const MESA_2 = { id: 'm2', numero: 2, estado: 'libre', zona: 'Terraza', capacidad: 2, personas: [] }
// mesa con un solo cliente: al moverlo, la mesa se queda vacía
const MESA_3 = { id: 'm3', numero: 3, estado: 'ocupada', zona: 'Sala', capacidad: 2, personas: [{ id: 'c3', nombre: 'Sole', items: [{ uid: 'l9' }] }] }

// la sala del mock es mutable: hay pruebas con el bar en servicio y otras con
// el local recién dado de alta, todavía sin mesas
let salaMock = [MESA_1, MESA_2, MESA_3]
vi.mock('../../store/useStore', () => ({
  useStore: { getState: () => ({ mesas: salaMock, carta: config.carta }) },
}))

const { accionesV2b } = await import('./acciones2')
const acciones = accionesV2b()
const escrituraEn = (t) => escrituras.filter(e => e.tabla === t)

beforeEach(() => { escrituras.length = 0; rpcs.length = 0 })

describe('juntar mesas desde el Mostrador', () => {
  it('llama al mismo RPC que la PDA, no solo a la pantalla', () => {
    acciones.agruparMesas('m1', 'm2')
    expect(rpcs).toEqual([['agruparMesas', 'm1', 'm2']])
  })
})

describe('zona y capacidad de una mesa', () => {
  it('se guardan en la mesa, no en el estado local', async () => {
    await acciones.updateMesa('m1', { zona: ' Terraza ', capacidad: '6' })
    expect(escrituraEn('mesas')[0]).toMatchObject({
      op: 'update', valores: { zona: 'Terraza', capacidad: 6 }, filtro: { id: 'm1' },
    })
  })

  it('una capacidad absurda no llega a la BBDD', async () => {
    await acciones.updateMesa('m1', { capacidad: '0' })
    expect(escrituraEn('mesas')[0].valores).toEqual({ capacidad: 1 })
    escrituras.length = 0
    await acciones.updateMesa('m1', { zona: '   ' })
    expect(escrituraEn('mesas')[0].valores).toEqual({ zona: 'Sala' })
  })

  it('sin cambios no se escribe nada', async () => {
    await acciones.updateMesa('m1', {})
    expect(escrituras).toHaveLength(0)
  })
})

describe('mover un cliente a otra mesa', () => {
  it('se lleva sus líneas y sus comandas, y abre la mesa de destino', async () => {
    await acciones.transferirComensal('m1', 'c1', 'm2')
    expect(escrituraEn('comensales')[0]).toMatchObject({ valores: { mesa_id: 'm2' }, filtro: { id: 'c1' } })
    // sin esto, cocina seguiría cantando la mesa vieja
    expect(escrituraEn('comandas')[0]).toMatchObject({ valores: { mesa_id: 'm2' }, filtro: { linea_id: ['l1', 'l2'] } })
    expect(escrituraEn('mesas')[0]).toMatchObject({ filtro: { id: 'm2' } })
    expect(escrituraEn('mesas')[0].valores.estado).toBe('ocupada')
  })

  it('la mesa de origen NO se libera si queda alguien sentado', async () => {
    await acciones.transferirComensal('m1', 'c1', 'm2')
    expect(escrituraEn('mesas').some(e => e.filtro.id === 'm1')).toBe(false)
  })

  it('la mesa de origen se libera cuando se va el último', async () => {
    await acciones.transferirComensal('m3', 'c3', 'm1')
    const origen = escrituraEn('mesas').find(e => e.filtro.id === 'm3')
    expect(origen.valores).toMatchObject({ estado: 'libre', abierta_desde: null, camarero_id: null })
  })

  it('mover a la misma mesa no toca nada', async () => {
    await acciones.transferirComensal('m1', 'c1', 'm1')
    expect(escrituras).toHaveLength(0)
  })
})

describe('config de la carta', () => {
  it('los rótulos (Pan/Extras) se guardan en el local', async () => {
    await acciones.updateEtiquetas({ formatos: 'Tamaño' })
    const upd = escrituraEn('locales').find(e => e.op === 'update')
    expect(upd.valores.config.carta.etiquetas).toEqual({ formatos: 'Tamaño' })
  })

  it('un tipo de pan guarda su suplemento como `sup`, que es lo que se cobra', async () => {
    await acciones.addTipoPan('Sin gluten', 1.2)
    const upd = escrituraEn('locales').find(e => e.op === 'update')
    expect(upd.valores.config.carta.tiposPan).toEqual([{ id: 'sin-gluten', nombre: 'Sin gluten', sup: 1.2 }])
  })
})

// El asistente de alta manda las zonas como {nombre, mesas, capacidad}; la
// capa v2 leía `z.n`, que no existe. Resultado: al dar de alta un bar se
// borraban las mesas, no se creaba ninguna y el aviso decía «Sala configurada:
// undefined mesas». Es el primer contacto de un cliente con el producto.
describe('configurar la sala en el alta de un bar', () => {
  beforeEach(() => { salaMock = [] })          // local nuevo: aún no hay sala
  const zonasDelAsistente = [
    { nombre: 'Sala', mesas: 8, capacidad: 4 },
    { nombre: ' Terraza ', mesas: 2, capacidad: 6 },
  ]

  it('crea las mesas que se han pedido, numeradas y con su zona', async () => {
    const r = acciones.configurarSala(zonasDelAsistente)
    expect(r).toEqual({ ok: true, total: 10 })
    await new Promise(res => setTimeout(res, 0))
    const insert = escrituraEn('mesas').find(e => e.op === 'insert')
    expect(insert.valores).toHaveLength(10)
    expect(insert.valores[0]).toMatchObject({ numero: 1, zona: 'Sala', capacidad: 4 })
    expect(insert.valores[9]).toMatchObject({ numero: 10, zona: 'Terraza', capacidad: 6 })
  })

  it('sin mesas que crear NO se borra la sala', async () => {
    const r = acciones.configurarSala([{ nombre: 'Sala', mesas: 0, capacidad: 4 }])
    expect(r.ok).toBe(false)
    await new Promise(res => setTimeout(res, 0))
    expect(escrituraEn('mesas')).toHaveLength(0)
  })

  it('también entiende la forma antigua (`n`) por si queda algún llamante', () => {
    expect(acciones.configurarSala([{ nombre: 'Sala', n: 3, capacidad: 2 }])).toEqual({ ok: true, total: 3 })
  })
})

afterAll(() => { salaMock = [MESA_1, MESA_2, MESA_3] })
