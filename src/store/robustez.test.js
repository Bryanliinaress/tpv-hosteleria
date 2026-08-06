import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'

// ────────────────────────────────────────────────────────────────────────────
// Casos raros y datos malos. Un bar no teclea siempre bien, y el TPV no puede
// acabar con precios negativos, mesas fantasma ni horas de nadie.
// ────────────────────────────────────────────────────────────────────────────

const st = () => useStore.getState()

beforeEach(() => {
  useStore.setState(s => ({
    mesas: s.mesas.map(m => ({ ...m, estado: 'libre', personas: [], unidaA: null, unidas: [], reserva: null })),
    historial: [], cierres: [], anulaciones: [], pedidosCocina: [], pedidosBarra: [], avisos: [], fichajes: [],
  }))
})

describe('precios y cantidades imposibles', () => {
  it('un producto no puede costar menos de 0', () => {
    st().addProducto({ nombre: 'Truco', categoria: st().carta.categorias[0].id, precio: '-5' })
    const p = st().carta.productos.find(x => x.nombre === 'Truco')
    expect(p.precio).toBeGreaterThanOrEqual(0)
  })

  it('un precio con letras no envenena la carta con NaN', () => {
    st().addProducto({ nombre: 'Raro', categoria: st().carta.categorias[0].id, precio: 'dos euros' })
    const p = st().carta.productos.find(x => x.nombre === 'Raro')
    expect(Number.isFinite(p.precio)).toBe(true)
  })

  it('bajar la cantidad a cero quita la línea', () => {
    const mesa = st().mesas[0]
    const p = st().unirseAMesa(mesa.id, 'Ana')
    st().agregarItem(mesa.id, p, { productoId: 'x', nombre: 'Café', precio: 1.3, tipo: 'bebida' })
    const uid = st().mesas.find(m => m.id === mesa.id).personas[0].items[0].uid
    st().cambiarCantidad(mesa.id, p, uid, -1)
    expect(st().mesas.find(m => m.id === mesa.id).personas[0].items).toHaveLength(0)
  })

  it('la cantidad nunca se queda en negativo', () => {
    const mesa = st().mesas[1]
    const p = st().unirseAMesa(mesa.id, 'Ana')
    st().agregarItem(mesa.id, p, { productoId: 'x', nombre: 'Café', precio: 1.3, tipo: 'bebida' })
    const uid = st().mesas.find(m => m.id === mesa.id).personas[0].items[0].uid
    st().cambiarCantidad(mesa.id, p, uid, -5)
    const items = st().mesas.find(m => m.id === mesa.id).personas[0].items
    expect(items.every(i => i.cantidad > 0)).toBe(true)
  })
})

describe('borrados con consecuencias', () => {
  it('no se puede borrar una mesa ocupada', () => {
    const mesa = st().mesas[2]
    st().unirseAMesa(mesa.id, 'Ana')
    const antes = st().mesas.length
    st().removeMesa(mesa.id)
    expect(st().mesas).toHaveLength(antes)
  })

  it('borrar una categoría se lleva sus productos (y hay que saberlo)', () => {
    const cat = st().carta.categorias[0]
    const cuantos = st().carta.productos.filter(p => p.categoria === cat.id).length
    expect(cuantos).toBeGreaterThan(0)
    st().removeCategoria(cat.id)
    expect(st().carta.productos.filter(p => p.categoria === cat.id)).toHaveLength(0)
  })

  it('siempre queda un administrador', () => {
    const admins = st().empleados.filter(e => e.rol === 'admin' && e.activo)
    expect(admins.length).toBeGreaterThan(0)
    // borrar todos menos uno, y el último debe resistirse
    admins.slice(0, -1).forEach(a => st().removeEmpleado(a.id))
    const ultimo = st().empleados.find(e => e.rol === 'admin' && e.activo)
    expect(st().removeEmpleado(ultimo.id).ok).toBe(false)
  })

  it('no se reconfigura la sala con gente sentada', () => {
    st().unirseAMesa(st().mesas[0].id, 'Ana')
    expect(st().configurarSala([{ nombre: 'Sala', mesas: 4, capacidad: 4 }]).ok).toBe(false)
  })
})

describe('nombres y textos', () => {
  it('un comensal sin nombre no rompe la mesa', () => {
    const mesa = st().mesas[3]
    const id = st().unirseAMesa(mesa.id, '')
    expect(id).toBeTruthy()
    expect(st().mesas.find(m => m.id === mesa.id).personas[0].nombre).toBeTruthy()
  })

  it('los PIN duplicados se rechazan', () => {
    const pin = st().empleados[0].pin
    expect(st().addEmpleado({ nombre: 'Copión', pin, rol: 'camarero' }).ok).toBe(false)
  })

  it('el PIN debe ser de 4 dígitos', () => {
    expect(st().addEmpleado({ nombre: 'X', pin: '12', rol: 'camarero' }).ok).toBe(false)
    expect(st().addEmpleado({ nombre: 'X', pin: 'abcd', rol: 'camarero' }).ok).toBe(false)
  })
})

describe('precios saneados al editar', () => {
  it('editar a un precio negativo tampoco cuela', () => {
    const prod = st().carta.productos.find(p => p.precio != null)
    st().updateProducto(prod.id, { precio: '-3' })
    expect(st().carta.productos.find(p => p.id === prod.id).precio).toBe(0)
  })

  it('el precio se guarda a céntimos, sin colas decimales', () => {
    st().addProducto({ nombre: 'Redondeo', categoria: st().carta.categorias[0].id, precio: '1.239' })
    const precio = st().carta.productos.find(p => p.nombre === 'Redondeo').precio
    expect(precio).toBe(1.24)
    expect(String(precio).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
})
