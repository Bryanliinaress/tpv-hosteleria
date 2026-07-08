import { describe, it, expect, beforeEach } from 'vitest'
import {
  useStore, owedPorPersona, empleadoPorPin, alergenosDe,
  generarSlots, slotDisponible, diaCerrado, aforoTotal,
} from './useStore'

// Mesa de pruebas mínima
const mesa = (over = {}) => ({
  id: 'mesa-t1', numero: 1, capacidad: 4, zona: 'Test', estado: 'ocupada',
  abiertaDesde: new Date().toISOString(), personas: [], unidas: [], unidaA: null,
  camarero: null, reserva: null, ...over,
})
const persona = (id, nombre, items = []) => ({ id, nombre, items, pagado: false })
const item = (over = {}) => ({
  uid: 'it' + Math.random(), productoId: 'p1', nombre: 'Café', precio: 1.5, tipo: 'bebida',
  cantidad: 1, estado: 'pendiente', pan: null, quitados: [], anadidos: [], nota: '', compartidoCon: [], ...over,
})

const S = () => useStore.getState()

beforeEach(() => {
  useStore.setState({ mesas: [], pedidosCocina: [], pedidosBarra: [], avisos: [], historial: [], cierres: [], anulaciones: [] })
})

describe('agregarItem', () => {
  it('fusiona líneas pendientes idénticas subiendo la cantidad', () => {
    useStore.setState({ mesas: [mesa({ personas: [persona('p1', 'Ana')] })] })
    const cfg = { productoId: 'x', nombre: 'Solo', precio: 1.3, tipo: 'bebida' }
    S().agregarItem('mesa-t1', 'p1', cfg)
    S().agregarItem('mesa-t1', 'p1', cfg)
    const its = S().mesas[0].personas[0].items
    expect(its).toHaveLength(1)
    expect(its[0].cantidad).toBe(2)
  })
  it('no fusiona si cambia la personalización', () => {
    useStore.setState({ mesas: [mesa({ personas: [persona('p1', 'Ana')] })] })
    S().agregarItem('mesa-t1', 'p1', { productoId: 'x', nombre: 'Mixto', precio: 2, tipo: 'comida', quitados: [] })
    S().agregarItem('mesa-t1', 'p1', { productoId: 'x', nombre: 'Mixto', precio: 2, tipo: 'comida', quitados: ['Queso'] })
    expect(S().mesas[0].personas[0].items).toHaveLength(2)
  })
})

describe('owedPorPersona', () => {
  it('reparte a partes iguales los platos compartidos', () => {
    const m = mesa({
      personas: [
        persona('a', 'Ana', [item({ precio: 6, compartidoCon: ['b'] })]),
        persona('b', 'Beto', [item({ precio: 2 })]),
      ],
    })
    const owed = owedPorPersona(m)
    expect(owed.a).toBeCloseTo(3)
    expect(owed.b).toBeCloseTo(5)
  })
})

describe('grupos de mesas', () => {
  const dos = () => [mesa(), mesa({ id: 'mesa-t2', numero: 2, estado: 'libre', abiertaDesde: null })]

  it('agruparMesas une la secundaria a la cabeza y bloquea ambas', () => {
    useStore.setState({ mesas: dos() })
    S().agruparMesas('mesa-t1', 'mesa-t2')
    const [m1, m2] = S().mesas
    expect(m1.unidas).toEqual(['mesa-t2'])
    expect(m2.unidaA).toBe('mesa-t1')
    expect(m2.estado).toBe('ocupada')
  })

  it('separarMesas libera las secundarias y conserva la cuenta en la cabeza', () => {
    useStore.setState({ mesas: dos() })
    S().agruparMesas('mesa-t1', 'mesa-t2')
    S().separarMesas('mesa-t1')
    const [m1, m2] = S().mesas
    expect(m1.unidas).toEqual([])
    expect(m2.estado).toBe('libre')
    expect(m2.unidaA).toBeNull()
  })

  it('cobrarMesa libera TODO el grupo y guarda un único ticket', () => {
    useStore.setState({ mesas: [mesa({ personas: [persona('a', 'Ana', [item({ precio: 4 })])] }), mesa({ id: 'mesa-t2', numero: 2, estado: 'libre', abiertaDesde: null })] })
    S().agruparMesas('mesa-t1', 'mesa-t2')
    S().cobrarMesa('mesa-t1', { metodo: 'tarjeta', cobradoPor: 'Test' })
    const [m1, m2] = S().mesas
    expect(m1.estado).toBe('libre')
    expect(m2.estado).toBe('libre')
    expect(m2.unidaA).toBeNull()
    expect(S().historial).toHaveLength(1)
    expect(S().historial[0].pagos.tarjeta).toBeCloseTo(4)
  })
})

describe('anularItem con auditoría', () => {
  it('registra qué, cuánto, quién y por qué al anular', () => {
    useStore.setState({
      mesas: [mesa({ personas: [persona('a', 'Ana', [item({ uid: 'u1', precio: 3, cantidad: 2, estado: 'enviado' })])] })],
      pedidosCocina: [{ id: 'mesa-t1-a-u1', mesaId: 'mesa-t1', estado: 'recibido', cantidad: 2 }],
    })
    S().anularItem('mesa-t1', 'a', 'u1', { motivo: 'cliente cambió', por: 'María' })
    expect(S().mesas[0].personas[0].items).toHaveLength(0)
    expect(S().pedidosCocina).toHaveLength(0)
    const a = S().anulaciones.at(-1)
    expect(a.importe).toBeCloseTo(6)
    expect(a.motivo).toBe('cliente cambió')
    expect(a.por).toBe('María')
    expect(a.enviado).toBe(true)
  })
})

describe('cobrarMesa con desglose y descuento', () => {
  it('registra el pago mixto y el descuento real en el ticket', () => {
    useStore.setState({
      mesas: [mesa({
        personas: [
          persona('a', 'Ana', [item({ precio: 10 })]),                 // sin pagar
          { ...persona('b', 'Beto', [item({ precio: 5 })]), pagado: true, metodoPago: 'bizum' }, // ya pagado
        ],
      })],
    })
    // pendiente bruto = 10; descuento 1 → neto 9; mixto: 4 efectivo + 5 tarjeta
    S().cobrarMesa('mesa-t1', { desglose: { efectivo: 4, tarjeta: 5 }, descuento: 1, cobradoPor: 'Test' })
    const t = S().historial.at(-1)
    expect(t.total).toBeCloseTo(14)        // 5 previos + 9 netos
    expect(t.descuento).toBeCloseTo(1)
    expect(t.pagos.bizum).toBeCloseTo(5)   // lo ya pagado conserva su método
    expect(t.pagos.efectivo).toBeCloseTo(4)
    expect(t.pagos.tarjeta).toBeCloseTo(5)
    expect(S().mesas[0].estado).toBe('libre')
  })
})

describe('pagarTodo', () => {
  it('marca a todos como pagados, registra la propina una vez y cierra con un ticket', () => {
    useStore.setState({
      mesas: [mesa({
        personas: [
          persona('a', 'Ana', [item({ precio: 2 })]),
          persona('b', 'Beto', [item({ precio: 3 })]),
        ],
      })],
    })
    S().pagarTodo('mesa-t1', { propina: 0.5, metodo: 'tarjeta', cobradoPor: 'Cliente' })
    expect(S().mesas[0].estado).toBe('libre')
    const t = S().historial.at(-1)
    expect(t.total).toBeCloseTo(5)
    expect(t.propina).toBeCloseTo(0.5)
    expect(t.pagos.tarjeta).toBeCloseTo(5)
    expect(t.personas).toHaveLength(2)
  })
})

describe('cerrarCaja', () => {
  it('agrega ventas desde el último cierre y calcula descuadre', () => {
    const ahora = new Date().toISOString()
    useStore.setState({
      historial: [
        { id: 't1', cerradaEn: ahora, total: 5, propina: 1, pagos: { efectivo: 5 }, personas: [] },
        { id: 't2', cerradaEn: ahora, total: 3, propina: 0, pagos: { tarjeta: 3 }, personas: [] },
      ],
      cierres: [],
    })
    S().cerrarCaja('4')
    const z = S().cierres.at(-1)
    expect(z.total).toBeCloseTo(8)
    expect(z.propinas).toBeCloseTo(1)
    expect(z.pagos.efectivo).toBeCloseTo(5)
    expect(z.nTickets).toBe(2)
    expect(z.descuadre).toBeCloseTo(-1) // contado 4 vs efectivo 5
  })
})

describe('reservas: slots y aforo', () => {
  const cfg = { turnos: [{ id: 'c', nombre: 'Comida', inicio: '13:00', fin: '14:00' }], intervaloMin: 30, duracionMin: 90, aforo: null, maxPersonasOnline: 10, diasCerrados: [1] }
  const mesas2 = [mesa({ capacidad: 4 }), mesa({ id: 'm2', numero: 2, capacidad: 2 })]

  it('generarSlots respeta turno e intervalo', () => {
    expect(generarSlots(cfg).map(s => s.hora)).toEqual(['13:00', '13:30'])
  })
  it('aforoTotal suma plazas si no hay aforo fijado', () => {
    expect(aforoTotal(cfg, mesas2)).toBe(6)
  })
  it('slotDisponible bloquea al superar el aforo con solapes', () => {
    const reservas = [{ id: 'r1', fecha: '2026-07-01', hora: '13:00', personas: 5, estado: 'confirmada', zona: '' }]
    expect(slotDisponible(cfg, mesas2, reservas, '2026-07-01', '13:30', 2)).toBe(false)
    expect(slotDisponible(cfg, mesas2, reservas, '2026-07-01', '13:30', 1)).toBe(true)
  })
  it('diaCerrado detecta el día de la semana cerrado', () => {
    expect(diaCerrado(cfg, '2026-06-29')).toBe(true)  // lunes
    expect(diaCerrado(cfg, '2026-06-30')).toBe(false) // martes
  })
})

describe('fichajes', () => {
  beforeEach(() => useStore.setState({ fichajes: [], empleados: [{ id: 'e1', nombre: 'María', pin: '1111', rol: 'camarero', activo: true }] }))

  it('ficharEmpleado abre un turno y luego lo cierra', () => {
    const r1 = S().ficharEmpleado('e1')
    expect(r1.accion).toBe('entrada')
    expect(S().fichajes).toHaveLength(1)
    expect(S().fichajes[0].salida).toBeNull()
    const r2 = S().ficharEmpleado('e1')
    expect(r2.accion).toBe('salida')
    expect(S().fichajes).toHaveLength(1)
    expect(S().fichajes[0].salida).not.toBeNull()
  })

  it('editarFichaje valida que la salida no sea anterior a la entrada', () => {
    S().ficharEmpleado('e1')
    const id = S().fichajes[0].id
    const bad = S().editarFichaje(id, { entrada: '2026-07-04T10:00:00.000Z', salida: '2026-07-04T09:00:00.000Z' })
    expect(bad.ok).toBe(false)
    const ok = S().editarFichaje(id, { entrada: '2026-07-04T10:00:00.000Z', salida: '2026-07-04T18:00:00.000Z' })
    expect(ok.ok).toBe(true)
    expect(S().fichajes[0].salida).toBe('2026-07-04T18:00:00.000Z')
  })
})

describe('onboarding: configurarSala y vaciarCarta', () => {
  it('configurarSala reconstruye la sala por zonas con numeración correlativa', () => {
    useStore.setState({ mesas: [mesa({ estado: 'libre' })] })
    const r = S().configurarSala([{ nombre: 'Terraza', mesas: 2, capacidad: 2 }, { nombre: 'Interior', mesas: 3, capacidad: 4 }])
    expect(r.ok).toBe(true)
    const ms = S().mesas
    expect(ms).toHaveLength(5)
    expect(ms.map(m => m.numero)).toEqual([1, 2, 3, 4, 5])
    expect(ms[0].zona).toBe('Terraza')
    expect(ms[4].zona).toBe('Interior')
    expect(ms[4].id).toBe('mesa-5') // mismo patrón que los QR
  })
  it('configurarSala se niega si hay mesas ocupadas o queda vacía', () => {
    useStore.setState({ mesas: [mesa({ estado: 'ocupada' })] })
    expect(S().configurarSala([{ nombre: 'Sala', mesas: 4, capacidad: 4 }]).ok).toBe(false)
    useStore.setState({ mesas: [mesa({ estado: 'libre' })] })
    expect(S().configurarSala([{ nombre: 'Sala', mesas: 0, capacidad: 4 }]).ok).toBe(false)
  })
  it('vaciarCarta quita productos y conserva la configuración', () => {
    const antes = S().carta
    S().vaciarCarta()
    expect(S().carta.productos).toHaveLength(0)
    expect(S().carta.categorias.length).toBe(antes.categorias.length)
    expect(S().carta.formatos.length).toBe(antes.formatos.length)
  })
})

describe('empleadoPorPin', () => {
  const emps = [
    { id: 'e1', nombre: 'Admin', pin: '1234', rol: 'admin', activo: true },
    { id: 'e2', nombre: 'Cam', pin: '1111', rol: 'camarero', activo: true },
    { id: 'e3', nombre: 'Baja', pin: '2222', rol: 'camarero', activo: false },
  ]
  it('valida PIN de empleado activo', () => {
    expect(empleadoPorPin(emps, '1111')?.nombre).toBe('Cam')
  })
  it('rechaza inactivos y PIN erróneo', () => {
    expect(empleadoPorPin(emps, '2222')).toBeNull()
    expect(empleadoPorPin(emps, '9999')).toBeNull()
  })
  it('soloAdmin exige rol admin', () => {
    expect(empleadoPorPin(emps, '1111', true)).toBeNull()
    expect(empleadoPorPin(emps, '1234', true)?.rol).toBe('admin')
  })
})

describe('editar pedidos enviados', () => {
  const conEnviado = () => {
    useStore.setState({
      mesas: [mesa({
        personas: [
          persona('a', 'Ana', [item({ uid: 'u1', estado: 'enviado', cantidad: 2, tipo: 'comida' })]),
          persona('b', 'Beto', []),
        ],
      })],
      pedidosCocina: [{ id: 'mesa-t1-a-u1', mesaId: 'mesa-t1', mesaNumero: 1, personaId: 'a', personaNombre: 'Ana', nombre: 'Café', cantidad: 2, estado: 'recibido', tiempo: 1, horaEntrada: new Date().toISOString() }],
      pedidosBarra: [],
    })
  }

  it('cambiarCantidad sobre línea enviada sincroniza la comanda', () => {
    conEnviado()
    S().cambiarCantidad('mesa-t1', 'a', 'u1', -1)
    expect(S().mesas[0].personas[0].items[0].cantidad).toBe(1)
    expect(S().pedidosCocina[0].cantidad).toBe(1)
  })

  it('cambiarCantidad a 0 elimina línea y comanda', () => {
    conEnviado()
    S().cambiarCantidad('mesa-t1', 'a', 'u1', -1)
    S().cambiarCantidad('mesa-t1', 'a', 'u1', -1)
    expect(S().mesas[0].personas[0].items).toHaveLength(0)
    expect(S().pedidosCocina).toHaveLength(0)
  })

  it('moverItem pasa la línea a otro comensal y reetiqueta la comanda', () => {
    conEnviado()
    S().moverItem('mesa-t1', 'a', 'u1', 'b')
    const [ana, beto] = S().mesas[0].personas
    expect(ana.items).toHaveLength(0)
    expect(beto.items).toHaveLength(1)
    expect(S().pedidosCocina[0].id).toBe('mesa-t1-b-u1')
    expect(S().pedidosCocina[0].personaNombre).toBe('Beto')
  })
})

describe('marchar por tiempos', () => {
  it('los tiempos 2+ entran en espera y marcharSiguiente los lanza por orden', () => {
    useStore.setState({
      mesas: [mesa({
        personas: [persona('a', 'Ana', [
          item({ uid: 'u1', tipo: 'comida', tiempo: 1 }),
          item({ uid: 'u2', tipo: 'comida', tiempo: 2 }),
          item({ uid: 'u3', tipo: 'comida', tiempo: 3 }),
        ])],
      })],
    })
    S().confirmarPedido('mesa-t1')
    const estados = () => Object.fromEntries(S().pedidosCocina.map(p => [p.id.split('-').pop(), p.estado]))
    expect(estados()).toEqual({ u1: 'recibido', u2: 'espera', u3: 'espera' })
    S().marcharSiguiente('mesa-t1') // marcha el 2º
    expect(estados()).toEqual({ u1: 'recibido', u2: 'recibido', u3: 'espera' })
    S().marcharSiguiente('mesa-t1') // marcha el postre
    expect(estados()).toEqual({ u1: 'recibido', u2: 'recibido', u3: 'recibido' })
  })

  it('setTiempoItem solo cambia líneas pendientes', () => {
    useStore.setState({ mesas: [mesa({ personas: [persona('a', 'Ana', [item({ uid: 'u1', estado: 'enviado', tiempo: 1 })])] })] })
    S().setTiempoItem('mesa-t1', 'a', 'u1', 2)
    expect(S().mesas[0].personas[0].items[0].tiempo).toBe(1)
  })
})

describe('alergenosDe', () => {
  it('deduce alérgenos por palabras clave', () => {
    expect(alergenosDe('Jamón york, Queso, Mantequilla')).toContain('lacteos')
    expect(alergenosDe('Tortilla francesa')).toContain('huevos')
    expect(alergenosDe('Atún')).toContain('pescado')
    expect(alergenosDe('Copa de vino tinto')).toContain('sulfitos')
    expect(alergenosDe('Agua mineral')).toEqual([])
  })
})
