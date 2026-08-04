import { describe, it, expect, vi, beforeEach } from 'vitest'

// Un local recién registrado no tiene carta. Estas pruebas fijan que la
// siembra crea categorías y productos coherentes (y que "vaciar" solo borra
// los productos del local, no los de otros).
const inserts = {}
const updates = {}
let deleteFiltro = null

const tabla = (nombre) => ({
  insert: (filas) => {
    inserts[nombre] = filas
    return {
      select: () => Promise.resolve({
        data: (Array.isArray(filas) ? filas : [filas]).map((f, i) => ({ id: `${nombre}-${i}`, nombre: f.nombre })),
        error: null,
      }),
      then: (r) => r({ data: null, error: null }),
    }
  },
  select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { config: { moneda: '€' } }, error: null }) }) }),
  update: (v) => ({ eq: (col, val) => { updates[nombre] = { v, col, val }; return Promise.resolve({ error: null }) } }),
  delete: () => ({ eq: (col, val) => { deleteFiltro = { tabla: nombre, col, val }; return Promise.resolve({ error: null }) } }),
})

vi.mock('../supabase', () => ({ supabase: { from: (n) => tabla(n) } }))
vi.mock('./estado', () => ({
  getLocalId: () => 'local-1',
  cargarCarta: async () => {},
  cargarLocal: async () => {},
}))
vi.mock('../../store/useStore', () => ({
  useStore: {
    getState: () => ({
      carta: {
        categorias: [
          { id: 'desayunos', nombre: 'Desayunos', tipo: 'comida', emoji: '🥪' },
          { id: 'cafes', nombre: 'Cafés', tipo: 'bebida', emoji: '☕' },
        ],
        productos: [
          { nombre: 'Mixto', categoria: 'desayunos', precios: { pitufo: 1.5, viena: 2.5 }, alergenos: ['gluten'], ingredientes: ['Jamón'] },
          { nombre: 'Café solo', categoria: 'cafes', precio: 1.3 },
          { nombre: 'Huérfano', categoria: 'inexistente', precio: 1 },
        ],
        formatos: [{ id: 'pitufo', nombre: 'Pitufo' }],
        tiposPan: [{ id: 'normal', nombre: 'Normal', sup: 0 }],
        extras: ['Tomate'],
      },
    }),
  },
}))

const { sembrarCartaEjemplo, vaciarCartaV2 } = await import('./plantillaCarta')

beforeEach(() => { Object.keys(inserts).forEach(k => delete inserts[k]); deleteFiltro = null })

describe('carta de arranque de un local nuevo', () => {
  it('crea las categorías conservando orden y tipo', async () => {
    await sembrarCartaEjemplo()
    expect(inserts.categorias).toHaveLength(2)
    expect(inserts.categorias[0]).toMatchObject({ local_id: 'local-1', nombre: 'Desayunos', tipo: 'comida', orden: 0 })
    expect(inserts.categorias[1]).toMatchObject({ nombre: 'Cafés', tipo: 'bebida', orden: 1 })
  })

  it('enlaza cada producto con su categoría nueva y respeta precios y alérgenos', async () => {
    await sembrarCartaEjemplo()
    const mixto = inserts.productos.find(p => p.nombre === 'Mixto')
    expect(mixto.categoria_id).toBe('categorias-0')
    expect(mixto.precios).toEqual({ pitufo: 1.5, viena: 2.5 })
    expect(mixto.alergenos).toEqual(['gluten'])
    expect(mixto.modificadores.ingredientes).toEqual(['Jamón'])
  })

  it('un producto con precio simple se guarda como precio base', async () => {
    await sembrarCartaEjemplo()
    expect(inserts.productos.find(p => p.nombre === 'Café solo').precios).toEqual({ base: 1.3 })
  })

  it('descarta productos cuya categoría no existe (no rompe la siembra)', async () => {
    const n = await sembrarCartaEjemplo()
    expect(inserts.productos.some(p => p.nombre === 'Huérfano')).toBe(false)
    expect(n).toBe(2)
  })

  it('guarda formatos, panes y extras en la configuración del local', async () => {
    await sembrarCartaEjemplo()
    expect(updates.locales.v.config.carta).toMatchObject({
      formatos: [{ id: 'pitufo', nombre: 'Pitufo' }],
      extras: ['Tomate'],
    })
  })

  it('vaciar la carta solo borra los productos de ESE local', async () => {
    await vaciarCartaV2()
    expect(deleteFiltro).toEqual({ tabla: 'productos', col: 'local_id', val: 'local-1' })
  })
})
