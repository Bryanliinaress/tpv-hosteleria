/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ────────────────────────────────────────────────────────────────────────────
// La PDA del camarero: la pantalla que más se toca en todo el producto, con
// una mano y andando. Aquí un toque de más son diez pasos de más.
//
// Se prueban las decisiones que ya costaron una corrección: con qué pestaña
// abre, en qué orden se apilan los avisos y que no ponga «1 comensales».
// ────────────────────────────────────────────────────────────────────────────

vi.mock('../../components/Ticket', () => ({ default: () => <div>ticket</div> }))
vi.mock('../../components/MetodoPago', () => ({ default: () => <div>metodo</div> }))
vi.mock('./PedirPda', () => ({ default: () => <div>pedir</div> }))
vi.mock('./CobroMesa', () => ({ default: () => <div>cobro</div> }))

const avisosUI = []
vi.mock('../../store/useUI', () => ({
  toast: (m, t) => avisosUI.push({ m, t }),
  pedirTexto: vi.fn(async () => 'Ana'),
}))

let empleado
vi.mock('../../lib/sesion', () => ({
  useEmpleadoActual: () => empleado,
  clearSesion: vi.fn(),
}))

let estado
const useStore = (sel) => (sel ? sel(estado) : estado)
useStore.getState = () => estado
vi.mock('../../store/useStore', () => ({
  useStore,
  owedPorPersona: (mesa) => Object.fromEntries((mesa.personas || []).map(p => [p.id, 0])),
  TIEMPOS: [{ n: 1, label: '1er' }, { n: 2, label: '2º' }],
}))

const Pda = (await import('./PdaCamarero')).default

const hoy = () => new Date().toISOString()
const item = (nombre, precio, cantidad = 1) => ({ uid: nombre + cantidad, nombre, precio, cantidad })

const estadoBase = () => ({
  carta: {
    categorias: [{ id: 'c1', nombre: 'Bebidas', emoji: '🥤' }],
    productos: [
      { id: 'p1', categoria: 'c1', nombre: 'Caña', precio: 2, disponible: true },
      { id: 'p2', categoria: 'c1', nombre: 'Vino', precio: 3, disponible: false },
    ],
  },
  mesas: [
    { id: 'm1', numero: 1, zona: 'Terraza', capacidad: 4, estado: 'libre', personas: [] },
    { id: 'm2', numero: 2, zona: 'Terraza', capacidad: 2, estado: 'ocupada', abiertaDesde: hoy(), camarero: 'Ana', personas: [{ id: 'p1', nombre: 'Uno', items: [item('Caña', 2)] }] },
    { id: 'm3', numero: 3, zona: 'Interior', capacidad: 4, estado: 'ocupada', abiertaDesde: hoy(), camarero: 'Ana', personas: [{ id: 'p1', nombre: 'Uno', items: [] }, { id: 'p2', nombre: 'Dos', items: [] }] },
  ],
  pedidosCocina: [], pedidosBarra: [], avisos: [], historial: [], fichajes: [],
  atenderAviso: vi.fn(), agregarItem: vi.fn(), pagarParte: vi.fn(), cobrarMesa: vi.fn(),
  liberarMesa: vi.fn(), unirseAMesa: vi.fn(), servirMesa: vi.fn(), anularItem: vi.fn(),
  toggleDisponible: vi.fn(), fusionarMesa: vi.fn(), transferirComensal: vi.fn(),
  asignarCamarero: vi.fn(), reservarMesa: vi.fn(), cancelarReserva: vi.fn(),
  sentarReserva: vi.fn(), marcharSiguiente: vi.fn(), cambiarCantidad: vi.fn(),
  moverItem: vi.fn(), ficharEmpleado: vi.fn(() => ({ accion: 'entrada' })),
})

const texto = () => document.body.textContent.replace(/\s+/g, ' ')
const pestana = (re) => screen.getByRole('button', { name: re })

beforeEach(() => {
  avisosUI.length = 0
  empleado = { id: 'e1', nombre: 'Ana' }
  estado = estadoBase()
})
afterEach(cleanup)

// ────────────────────────────────────────────────────────────────────────────
// Un camarero saca la PDA para atender una mesa. Los avisos son la excepción y
// ya tienen su globo rojo. Abriendo en «Avisos», lo normal era encontrarse una
// pantalla vacía y gastar un toque en llegar a lo que venía a hacer.
// ────────────────────────────────────────────────────────────────────────────
describe('con qué abre', () => {
  it('abre en Mesas, no en Avisos', () => {
    render(<Pda />)
    expect(texto()).toContain('Terraza')
    expect(texto()).not.toMatch(/Sin avisos|Todo tranquilo/)
  })

  it('abre en Mesas aunque haya avisos esperando', () => {
    estado.avisos = [{ id: 'a1', mesaId: 'm2', mesaNumero: 2, personaNombre: 'Luis', hora: hoy() }]
    render(<Pda />)
    expect(texto()).toContain('Terraza')
  })
})

describe('la lista de mesas', () => {
  it('agrupa por zona', () => {
    render(<Pda />)
    expect(texto()).toContain('Terraza')
    expect(texto()).toContain('Interior')
  })

  it('una mesa libre invita a abrirla', () => {
    render(<Pda />)
    expect(texto()).toContain('Toca para abrir')
  })

  // «1 comensales» delataba que el producto está a medio hacer, y es lo primero
  // que lee un hostelero al que se lo enseñas.
  it('dice «1 comensal», no «1 comensales»', () => {
    render(<Pda />)
    expect(texto()).toContain('1 comensal ·')
    expect(texto()).not.toContain('1 comensales')
  })

  it('y «2 comensales» cuando son dos', () => {
    render(<Pda />)
    expect(texto()).toContain('2 comensales')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// El orden del feed no es capricho: quien te llama lleva esperando y te está
// mirando; lo que está listo se enfría; la cuenta puede esperar treinta
// segundos más.
// ────────────────────────────────────────────────────────────────────────────
describe('el orden de los avisos', () => {
  beforeEach(() => {
    estado.avisos = [{ id: 'a1', mesaId: 'm2', mesaNumero: 2, personaNombre: 'Luis', hora: hoy() }]
    estado.pedidosCocina = [{ id: 'k1', mesaId: 'm3', mesaNumero: 3, estado: 'listo', cantidad: 2, horaEntrada: hoy() }]
    estado.mesas[0].estado = 'esperando_cobro'
  })

  it('primero quien llama, luego lo que está listo, y al final la cuenta', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Avisos/))
    const t = texto()
    expect(t.indexOf('te llama')).toBeGreaterThanOrEqual(0)
    expect(t.indexOf('te llama')).toBeLessThan(t.indexOf('listo(s) para servir'))
    expect(t.indexOf('listo(s) para servir')).toBeLessThan(t.indexOf('Pide la cuenta'))
  })

  it('suma las unidades listas de la misma mesa en un solo aviso', async () => {
    estado.pedidosBarra = [{ id: 'b1', mesaId: 'm3', mesaNumero: 3, estado: 'listo', cantidad: 3, horaEntrada: hoy() }]
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Avisos/))
    expect(texto()).toContain('5 listo(s) para servir')
  })
})

describe('los globos de la barra de abajo', () => {
  it('el de avisos cuenta los eventos, no solo las llamadas', () => {
    estado.avisos = [{ id: 'a1', mesaId: 'm2', mesaNumero: 2, personaNombre: 'Luis', hora: hoy() }]
    estado.mesas[0].estado = 'esperando_cobro'
    render(<Pda />)
    expect(pestana(/Avisos/).textContent).toContain('2')
  })

  // Una reservada no necesita nada todavía: no tiene que abultar el globo de
  // «Mesas» ni contarse como ocupada. Ver src/lib/sala.js.
  it('el de mesas cuenta las que tienen gente, no las reservadas', () => {
    estado.mesas.push({ id: 'm4', numero: 4, zona: 'Interior', capacidad: 2, estado: 'reservada', personas: [], reserva: { nombre: 'Pérez' } })
    render(<Pda />)
    expect(pestana(/Mesas/).textContent).toContain('2')
  })

  it('el de carta cuenta lo que está agotado, que es lo que hay que revisar', () => {
    render(<Pda />)
    expect(pestana(/Carta/).textContent).toContain('1')
  })
})

describe('el recuento de la sala', () => {
  it('las reservadas van aparte de las ocupadas', () => {
    estado.mesas.push({ id: 'm4', numero: 4, zona: 'Interior', capacidad: 2, estado: 'reservada', personas: [], reserva: { nombre: 'Pérez' } })
    render(<Pda />)
    expect(texto()).toContain('2/4 ocupadas · 1 reservada')
  })

  it('sin reservas, solo las ocupadas', () => {
    render(<Pda />)
    expect(texto()).toContain('2/3 ocupadas')
    expect(texto()).not.toContain('reservada')
  })
})

describe('marcar agotado', () => {
  it('se puede quitar un producto de la carta del cliente al instante', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Carta/))
    await u.click(screen.getByRole('button', { name: 'Disponible' }))
    expect(estado.toggleDisponible).toHaveBeenCalledWith('p1')
  })

  it('lo agotado se ve marcado', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Carta/))
    expect(texto()).toContain('⛔ Agotado')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// El turno es lo que mira un camarero al acabar. Si le cuenta las mesas de otro
// —o las de ayer— deja de fiarse de la pantalla.
// ────────────────────────────────────────────────────────────────────────────
describe('el resumen del turno', () => {
  beforeEach(() => {
    estado.historial = [
      { id: 't1', camarero: 'Ana', cerradaEn: hoy(), total: 20, propina: 2 },
      { id: 't2', camarero: 'Ana', cerradaEn: hoy(), total: 10, propina: 1 },
      { id: 't3', camarero: 'Luis', cerradaEn: hoy(), total: 99, propina: 9 },
      { id: 't4', camarero: 'Ana', cerradaEn: '2020-01-01T10:00:00.000Z', total: 50, propina: 5 },
    ]
  })

  it('cuenta solo lo de este camarero y solo lo de hoy', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Turno/))
    expect(texto()).toContain('30.00 €')     // 20 + 10, ni los 99 de Luis ni los 50 de ayer
    // los divs van pegados: «2mesas cobradas»
    expect(texto()).toMatch(/2\s*mesas cobradas/)
    expect(texto()).not.toContain('99.00')   // el ticket de Luis no es suyo
  })

  it('las propinas también son solo suyas', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Turno/))
    expect(texto()).toContain('3.00 €')      // 2 + 1
  })
})

describe('el fichaje de jornada', () => {
  it('sin turno abierto, ofrece fichar la entrada', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Turno/))
    expect(texto()).toContain('No has fichado tu entrada')
    await u.click(screen.getByRole('button', { name: /Fichar entrada/ }))
    expect(estado.ficharEmpleado).toHaveBeenCalledWith('e1')
  })

  it('con turno abierto, ofrece fichar la salida y dice desde cuándo', async () => {
    estado.fichajes = [{ id: 'f1', empleadoId: 'e1', entrada: hoy(), salida: null }]
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Turno/))
    expect(texto()).toMatch(/Fichado desde/)
    expect(screen.getByRole('button', { name: /Fichar salida/ })).toBeTruthy()
  })

  it('el turno de otro empleado no cuenta como el mío', async () => {
    estado.fichajes = [{ id: 'f1', empleadoId: 'OTRO', entrada: hoy(), salida: null }]
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(pestana(/Turno/))
    expect(texto()).toContain('No has fichado tu entrada')
  })
})

describe('el detalle de una mesa', () => {
  it('se abre tocándola y enseña su total', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(screen.getByRole('button', { name: /M2/ }))
    expect(texto()).toContain('Mesa 2')
    expect(texto()).toContain('2.00 €')
  })

  it('una mesa libre ofrece abrirla o reservarla, no cobrarla', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(screen.getByRole('button', { name: /M1/ }))
    expect(texto()).toContain('Mesa libre')
    expect(screen.getByRole('button', { name: /Abrir mesa/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Reservar/ })).toBeTruthy()
  })

  it('reservar pide un nombre antes de dejar guardar', async () => {
    const u = userEvent.setup()
    render(<Pda />)
    await u.click(screen.getByRole('button', { name: /M1/ }))
    await u.click(screen.getByRole('button', { name: /📅 Reservar/ }))
    expect(screen.getByRole('button', { name: 'Guardar' }).disabled).toBe(true)
    await u.type(screen.getByPlaceholderText('Nombre'), 'Familia Pérez')
    expect(screen.getByRole('button', { name: 'Guardar' }).disabled).toBe(false)
  })
})
