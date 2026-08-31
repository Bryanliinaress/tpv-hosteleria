/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ────────────────────────────────────────────────────────────────────────────
// Mostrador: el terminal fijo de la barra. Es el mapa de la sala, y de un
// vistazo tiene que decir quién pide cuenta, quién está servido y qué mesa está
// libre. Si engaña, se cobra a la mesa equivocada.
// ────────────────────────────────────────────────────────────────────────────

vi.mock('../../components/Ticket', () => ({ default: () => <div>ticket</div> }))
vi.mock('../../components/MetodoPago', () => ({ default: () => <div>metodo</div> }))
vi.mock('../../components/ReservasManager', () => ({ default: () => <div>reservas</div> }))
vi.mock('../../components/BotonSalir', () => ({ default: () => <button>salir</button> }))
vi.mock('../pda/PedirPda', () => ({ default: () => <div>pedir</div> }))
vi.mock('../pda/CobroMesa', () => ({ default: () => <div>cobro</div> }))

const avisosUI = []
const confirmarMock = vi.fn()
vi.mock('../../store/useUI', () => ({
  toast: (m, t) => avisosUI.push({ m, t }),
  pedirTexto: vi.fn(async () => 'Ana'),
  confirmar: (...a) => confirmarMock(...a),
}))

vi.mock('../../lib/sesion', () => ({ useEmpleadoActual: () => ({ id: 'e1', nombre: 'Ana' }) }))

let estado
const useStore = (sel) => (sel ? sel(estado) : estado)
useStore.getState = () => estado
vi.mock('../../store/useStore', () => ({
  useStore,
  owedPorPersona: (mesa) => Object.fromEntries((mesa.personas || []).map(p => [p.id, 0])),
  TIEMPOS: [{ n: 1, label: '1er' }, { n: 2, label: '2º' }],
}))

const Mostrador = (await import('./PanelCamarero')).default

const hoy = () => new Date().toISOString()
const mesa = (n, extra = {}) => ({
  id: 'm' + n, numero: n, zona: 'Terraza', capacidad: 4, estado: 'libre',
  personas: [], abiertaDesde: null, unidaA: null, unidas: [], ...extra,
})

const estadoBase = () => ({
  mesas: [
    mesa(1, { zona: 'Terraza' }),
    mesa(2, { zona: 'Terraza', estado: 'ocupada', abiertaDesde: hoy(), personas: [{ id: 'c1', nombre: 'Uno', items: [{ uid: 'i1', nombre: 'Caña', precio: 2, cantidad: 1 }] }] }),
    mesa(3, { zona: 'Terraza', estado: 'esperando_cobro', abiertaDesde: hoy(), personas: [{ id: 'c2', nombre: 'Dos', items: [] }] }),
    mesa(4, { zona: 'Interior', estado: 'reservada', reserva: { nombre: 'Pérez', hora: '21:00' } }),
  ],
  pedidosCocina: [], pedidosBarra: [], avisos: [], historial: [], reservas: [],
  liberarMesa: vi.fn(), atenderAviso: vi.fn(), pagarParte: vi.fn(), cobrarMesa: vi.fn(),
  reservarMesa: vi.fn(), cancelarReserva: vi.fn(), sentarReserva: vi.fn(),
  unirseAMesa: vi.fn(), asignarCamarero: vi.fn(), agruparMesas: vi.fn(), separarMesas: vi.fn(),
  marcharSiguiente: vi.fn(), cambiarCantidad: vi.fn(), moverItem: vi.fn(), anularItem: vi.fn(),
})

const texto = () => document.body.textContent.replace(/\s+/g, ' ')
const boton = (re) => screen.getByRole('button', { name: re })

beforeEach(() => {
  avisosUI.length = 0
  confirmarMock.mockReset().mockResolvedValue(true)
  estado = estadoBase()
  // jsdom no trae matchMedia: sin él, `hayTactil` queda en falso (ratón)
  delete window.matchMedia
})
afterEach(cleanup)

describe('el mapa de la sala', () => {
  it('agrupa las mesas por zona', () => {
    render(<Mostrador />)
    // el nombre va en mayúsculas por CSS: el texto sigue siendo «Terraza»
    expect(texto()).toContain('Terraza')
    expect(texto()).toContain('Interior')
  })

  it('cada zona dice cuántas tiene ocupadas', () => {
    render(<Mostrador />)
    // Terraza: la 2 (ocupada) y la 3 (pide cuenta) de 3 mesas
    expect(texto()).toContain('2/3 ocupadas')
  })

  // Una reservada no está ocupada: no hay nadie sentado. Contarlas juntas hacía
  // parecer el bar más lleno de lo que estaba y escondía cuántas reservas había.
  it('las reservadas se cuentan APARTE, no como ocupadas', () => {
    render(<Mostrador />)
    expect(texto()).toContain('0/1 ocupadas · 1 reservada')   // Interior
  })

  it('la cabecera cuenta las ocupadas del local, con las reservas aparte', () => {
    render(<Mostrador />)
    expect(texto()).toContain('2 ocupadas de 4 · 1 reservada')
  })

  it('sin reservas no se enseña un «0 reservadas» que es ruido', () => {
    estado.mesas = estado.mesas.filter(m => m.estado !== 'reservada')
    render(<Mostrador />)
    expect(texto()).toContain('2 ocupadas de 3')
    expect(texto()).not.toContain('reservada')
  })

  it('una mesa libre invita a abrirla', () => {
    render(<Mostrador />)
    expect(texto()).toContain('Toca para abrir')
  })

  it('una mesa reservada enseña a nombre de quién y a qué hora', () => {
    render(<Mostrador />)
    expect(texto()).toContain('Pérez')
    expect(texto()).toContain('21:00')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// La rejilla la ENCOGE el panel de mesa (340px fijos, hermano flex). Con el
// mínimo en 155px se pasaba de 5 columnas a 3 al abrirlo y cada zona de 4
// mesas dejaba una suelta en su propia fila. Ver v0.99.1.
// ────────────────────────────────────────────────────────────────────────────
describe('el ancho de las tarjetas de mesa', () => {
  it('el mínimo aguanta 4 columnas con el panel abierto', () => {
    const { container } = render(<Mostrador />)
    const rejilla = [...container.querySelectorAll('div')]
      .find(d => (d.getAttribute('style') || '').includes('repeat(auto-fill'))
    expect(rejilla).toBeTruthy()
    expect(rejilla.getAttribute('style')).toContain('minmax(132px, 1fr)')
  })
})

describe('la leyenda de estados', () => {
  it('cuenta cada estado por separado', () => {
    render(<Mostrador />)
    const t = texto()
    expect(t).toMatch(/Pide cuenta\s*1/)
    expect(t).toMatch(/Ocupada\s*1/)
    expect(t).toMatch(/Reservada\s*1/)
    expect(t).toMatch(/Libre\s*1/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// En una tablet no se arrastra: se mantiene pulsado y se toca el destino. La
// pista tiene que decir lo que de verdad funciona en ESE aparato, o el camarero
// se pelea con la pantalla en hora punta.
// ────────────────────────────────────────────────────────────────────────────
describe('cómo se dice que se juntan las mesas', () => {
  it('con ratón, habla de arrastrar', () => {
    render(<Mostrador />)
    expect(texto()).toContain('Arrastra una mesa sobre otra')
  })

  it('en pantalla táctil, habla de mantener pulsado', () => {
    window.matchMedia = () => ({ matches: true })
    render(<Mostrador />)
    expect(texto()).toContain('Mantén pulsada una mesa')
    expect(texto()).not.toContain('Arrastra una mesa')
  })
})

describe('seleccionar una mesa', () => {
  it('abre su panel al tocarla', async () => {
    const u = userEvent.setup()
    render(<Mostrador />)
    await u.click(boton(/M2/))
    expect(texto()).toContain('Mesa 2')
  })

  it('volver a tocarla lo cierra', async () => {
    const u = userEvent.setup()
    render(<Mostrador />)
    await u.click(boton(/M2/))
    await u.click(boton(/M2/))
    expect(texto()).not.toMatch(/Mesa 2\b.*Comensales/)
  })

  // Una mesa unida no tiene cuenta propia: la lleva su principal. Tocarla y que
  // no pasara nada —o peor, abrir una cuenta vacía— es cobrar mal.
  it('tocar una mesa unida abre la cuenta de la principal', async () => {
    estado.mesas = [
      mesa(1, { estado: 'ocupada', abiertaDesde: hoy(), unidas: ['m2'], personas: [{ id: 'c1', nombre: 'Uno', items: [] }] }),
      mesa(2, { estado: 'ocupada', abiertaDesde: hoy(), unidaA: 'm1' }),
    ]
    const u = userEvent.setup()
    render(<Mostrador />)
    await u.click(boton(/M2/))
    expect(texto()).toContain('Mesa 1')
  })
})

describe('las llamadas de los clientes', () => {
  it('salen arriba con su número de mesa', () => {
    estado.avisos = [{ id: 'a1', mesaId: 'm2', mesaNumero: 2, personaNombre: 'Luis' }]
    render(<Mostrador />)
    expect(texto()).toContain('Te llaman')
    expect(texto()).toContain('Mesa 2')
    expect(texto()).toContain('Luis')
  })

  it('se pueden marcar como atendidas', async () => {
    estado.avisos = [{ id: 'a1', mesaId: 'm2', mesaNumero: 2, personaNombre: 'Luis' }]
    const u = userEvent.setup()
    render(<Mostrador />)
    await u.click(boton('✓'))
    expect(estado.atenderAviso).toHaveBeenCalledWith('a1')
  })

  it('sin llamadas, la barra no ocupa sitio', () => {
    render(<Mostrador />)
    expect(texto()).not.toContain('Te llaman')
  })
})

describe('las cerradas de hoy', () => {
  it('solo cuenta las de hoy, no las de ayer', () => {
    estado.historial = [
      { id: 't1', mesaNumero: 1, cerradaEn: hoy(), total: 10, personas: [] },
      { id: 't2', mesaNumero: 2, cerradaEn: hoy(), total: 20, personas: [] },
      { id: 't3', mesaNumero: 3, cerradaEn: '2020-01-01T10:00:00.000Z', total: 30, personas: [] },
    ]
    render(<Mostrador />)
    expect(texto()).toContain('Cerradas hoy (2)')
  })

  it('sin ninguna, no enseña un (0) que no dice nada', () => {
    render(<Mostrador />)
    expect(texto()).toContain('Cerradas hoy')
    expect(texto()).not.toContain('Cerradas hoy (0)')
  })
})

describe('juntar mesas desde el panel', () => {
  const abrirUnir = async (u) => {
    await u.click(boton(/M2/))
    await u.click(boton(/Unir con otra mesa/))
  }

  it('dice con qué mesa se va a unir y que compartirán una sola cuenta', async () => {
    const u = userEvent.setup()
    render(<Mostrador />)
    await abrirUnir(u)
    expect(texto()).toContain('Unir Mesa 2 con…')
    expect(texto()).toContain('Compartirán una sola cuenta')
  })

  it('no se ofrece a sí misma ni a una mesa reservada', async () => {
    const u = userEvent.setup()
    render(<Mostrador />)
    await abrirUnir(u)
    const dialogo = document.querySelector('div[style*="z-index: 120"], div[style*="zIndex: 120"]')
      || [...document.querySelectorAll('div')].find(d => /Unir Mesa 2 con/.test(d.textContent) && d.textContent.length < 400)
    const ofrecidas = [...dialogo.querySelectorAll('button')].map(b => b.textContent)
    expect(ofrecidas.some(t => t.startsWith('M1'))).toBe(true)   // libre: sí
    expect(ofrecidas.some(t => t.startsWith('M3'))).toBe(true)   // ocupada: sí
    expect(ofrecidas.some(t => t.startsWith('M2'))).toBe(false)  // ella misma: no
    expect(ofrecidas.some(t => t.startsWith('M4'))).toBe(false)  // reservada: no
  })

  it('al elegir, une y lo dice', async () => {
    const u = userEvent.setup()
    render(<Mostrador />)
    await abrirUnir(u)
    const dialogo = [...document.querySelectorAll('div')].find(d => /Unir Mesa 2 con/.test(d.textContent) && d.textContent.length < 400)
    await u.click([...dialogo.querySelectorAll('button')].find(b => b.textContent.startsWith('M1')))
    expect(estado.agruparMesas).toHaveBeenCalledWith('m2', 'm1')
    expect(avisosUI.at(-1).m).toContain('unida')
  })
})
