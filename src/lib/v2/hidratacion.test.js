import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDeItem } from '../carta'

// ────────────────────────────────────────────────────────────────────────────
// Lo que se guarda en el servidor tiene que volver ENTERO.
//
// `desempaquetar` traduce una fila de `lineas_pedido` al shape que esperan las
// pantallas. Cada campo que se le olvida es un fallo silencioso: no da error,
// simplemente ese dato deja de existir en la app real y no en la demo, donde
// el item nunca sale de la base de datos.
//
// Ya ha pasado dos veces:
//   - `compartido_con`: el reparto de la cuenta trataba el plato como de uno.
//   - `elecciones` del menú del día: «otra ronda» repetía el menú SIN el
//     suplemento del solomillo (el bar regalaba 2 €) y cocina no sabía qué
//     segundo era.
// ────────────────────────────────────────────────────────────────────────────

vi.mock('../supabase', () => ({ supabase: { from: () => ({}), auth: {} } }))
vi.mock('../../store/useStore', () => ({ useStore: { setState: () => {}, getState: () => ({}) } }))
vi.mock('../repo', () => ({ suscribirLocal: () => {} }))

const { desempaquetar } = await import('./estado')

// una fila como la devuelve Postgres
const fila = {
  id: 'linea-1', producto_id: 'prod-1', nombre: 'Menú del día',
  precio: '14.00', cantidad: 2, tipo: 'comida', estado: 'enviado', tiempo: 2,
  creado_en: '2026-08-12T10:00:00Z',
  compartido_con: ['comensal-2'],
  personalizacion: {
    pan: { nombreFormato: 'Mollete', nombreTipo: 'Integral' },
    quitados: ['Cebolla'], anadidos: ['Queso'], nota: 'poco hecho',
    elecciones: [{ grupo: 'Segundo', opcion: 'Solomillo', sup: 2 }],
  },
}

describe('desempaquetar una línea del servidor', () => {
  it('trae la personalización entera', () => {
    const i = desempaquetar(fila)
    expect(i.uid).toBe('linea-1')
    expect(i.precio).toBe(14)
    expect(i.pan.nombreTipo).toBe('Integral')
    expect(i.quitados).toEqual(['Cebolla'])
    expect(i.anadidos).toEqual(['Queso'])
    expect(i.nota).toBe('poco hecho')
    expect(i.compartidoCon).toEqual(['comensal-2'])
    expect(i.elecciones).toEqual([{ grupo: 'Segundo', opcion: 'Solomillo', sup: 2 }])
  })

  it('una línea sin personalizar no rompe ni inventa', () => {
    const i = desempaquetar({ ...fila, personalizacion: {}, compartido_con: [] })
    expect(i.compartidoCon).toEqual([])
    expect(i.elecciones).toEqual([])
    expect(i.pan).toBeNull()
  })

  it('«otra ronda» reconstruye el menú CON su suplemento', () => {
    // configDeItem es la receta para volver a pedir lo mismo. Si las elecciones
    // no sobreviven, el servidor recalcula el precio sin el suplemento.
    const config = configDeItem(desempaquetar(fila))
    expect(config.elecciones, 'sin esto el solomillo sale gratis').toEqual(
      [{ grupo: 'Segundo', opcion: 'Solomillo', sup: 2 }])
    expect(config.pan).toBeTruthy()
    expect(config.nota).toBe('poco hecho')
    expect(config.tiempo).toBe(2)
  })

  it('el cliente del QR recibe lo mismo que el personal', () => {
    // El móvil del cliente no lee las tablas (RLS): todo le llega por el RPC
    // `estado_mesa`. Si ese RPC se deja una columna, esa pantalla —la del
    // botón de «Dividir este plato»— se queda sin ella, y solo ahí.
    const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
    const dir = join(raiz, 'supabase', 'migrations')
    // la última migración que redefine estado_mesa es la que manda
    const fuente = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
      .map(f => readFileSync(join(dir, f), 'utf8'))
      .filter(s => s.includes('function estado_mesa')).pop()
    const items = fuente.match(/'items',[\s\S]*?from lineas_pedido/)[0]

    // columnas de lineas_pedido que consume `desempaquetar`
    const necesarias = ['id', 'producto_id', 'nombre', 'precio', 'cantidad',
      'tipo', 'estado', 'tiempo', 'personalizacion', 'compartido_con', 'creado_en']
    const faltan = necesarias.filter(c => !new RegExp(`'${c}'`).test(items))
    expect(faltan, 'estado_mesa no las devuelve: el cliente QR se queda sin ellas').toEqual([])
  })

  it('todo lo que configDeItem sabe leer sobrevive al viaje', () => {
    // Guardarraíl general: si mañana se añade un campo a la personalización y
    // se olvida aquí, esto lo caza sin tener que acordarse de escribir el test.
    const config = configDeItem(desempaquetar(fila))
    const esperados = ['productoId', 'nombre', 'precio', 'tipo', 'pan', 'quitados', 'anadidos', 'elecciones', 'nota', 'tiempo']
    for (const campo of esperados) {
      expect(config[campo], `configDeItem perdió «${campo}» al hidratar`).toBeDefined()
    }
  })
})
