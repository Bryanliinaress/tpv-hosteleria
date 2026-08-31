/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ────────────────────────────────────────────────────────────────────────────
// La reserva online. La abre gente de fuera del local, desde su móvil, y es la
// única pantalla del producto que ve alguien que todavía no es cliente.
//
// Lo que más importa aquí no es el aspecto: es NO decirle «confirmada» a una
// reserva que el servidor ha rechazado. El aforo lo valida el servidor, y si la
// pantalla se adelanta, el sábado aparecen ocho personas con una mesa que no
// existe.
// ────────────────────────────────────────────────────────────────────────────

let busqueda = ''
vi.mock('react-router-dom', () => ({ useLocation: () => ({ search: busqueda }) }))

const enviarEmail = vi.fn(() => Promise.resolve())
vi.mock('../../lib/email', () => ({
  enviarEmailReserva: (...a) => enviarEmail(...a),
  emailConfigurado: true,
}))
vi.mock('../../lib/sync', () => ({ syncListo: Promise.resolve() }))

// El calendario tiene lo suyo y se prueba aparte: aquí solo hace falta poder
// elegir un día.
vi.mock('../../components/MiniCalendario', () => ({
  default: ({ onChange }) => <button onClick={() => onChange('2026-09-15')}>elegir dia del calendario</button>,
}))

const confirmarMock = vi.fn()
vi.mock('../../store/useUI', () => ({ confirmar: (...a) => confirmarMock(...a) }))

vi.mock('../../lib/i18n', () => ({
  useIdioma: () => ({ idioma: 'es', setIdioma: vi.fn() }),
  // el original traduce; aquí basta con sustituir las variables para poder
  // afirmar sobre el texto que se ve
  tr: (_idioma, s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? '')),
  diasSemana: () => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
}))

let estado
const useStore = (sel) => (sel ? sel(estado) : estado)
useStore.getState = () => estado
let slotsLibres
vi.mock('../../store/useStore', () => ({
  useStore,
  generarSlots: () => slotsLibres,
  slotDisponible: () => true,
  diaCerrado: (_cfg, f) => f === '2026-09-14',   // un lunes de cierre
}))

const Reservar = (await import('./Reservar')).default

const estadoBase = () => ({
  local: { nombre: 'Bar Paco', telefono: null },
  mesas: [{ id: 'm1', zona: 'Terraza' }, { id: 'm2', zona: 'Interior' }],
  reservas: [],
  reservasConfig: { maxPersonasOnline: 10, duracionMin: 90, retencionDias: 30 },
  crearReserva: vi.fn(async () => 'r-nueva'),
  actualizarReserva: vi.fn(async () => {}),
  cambiarEstadoReserva: vi.fn(),
})

const texto = () => document.body.textContent.replace(/\s+/g, ' ')
const boton = (re) => screen.getByRole('button', { name: re })

beforeEach(() => {
  busqueda = ''
  enviarEmail.mockClear()
  confirmarMock.mockReset().mockResolvedValue(true)
  slotsLibres = [
    { hora: '13:00', turnoNombre: 'Comida' },
    { hora: '13:30', turnoNombre: 'Comida' },
    { hora: '21:00', turnoNombre: 'Cena' },
  ]
  estado = estadoBase()
  localStorage.clear()
})
afterEach(cleanup)

// Recorre el asistente hasta el paso de los datos.
const hastaDatos = async (u) => {
  await u.click(boton('2'))                                   // personas
  await u.click(boton(/Me da igual/))                         // zona
  await u.click(boton('elegir dia del calendario'))           // día
  await u.click(boton('13:00'))                               // hora
}

describe('el asistente paso a paso', () => {
  it('empieza preguntando cuántas personas', () => {
    render(<Reservar />)
    expect(texto()).toContain('¿Cuántas personas?')
  })

  it('no ofrece más personas de las que admite el local', () => {
    estado.reservasConfig.maxPersonasOnline = 4
    render(<Reservar />)
    expect(screen.queryByRole('button', { name: '4' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: '5' })).toBeNull()
  })

  it('pregunta por la zona solo si el local tiene zonas', async () => {
    const u = userEvent.setup()
    render(<Reservar />)
    await u.click(boton('2'))
    expect(texto()).toContain('¿Dónde prefieres sentarte?')
  })

  it('sin zonas, ese paso se salta', async () => {
    estado.mesas = [{ id: 'm1', zona: null }]
    const u = userEvent.setup()
    render(<Reservar />)
    await u.click(boton('2'))
    expect(texto()).not.toContain('¿Dónde prefieres sentarte?')
    expect(texto()).toContain('¿Qué día?')
  })

  it('lo elegido queda a la vista y se puede volver a tocar', async () => {
    const u = userEvent.setup()
    render(<Reservar />)
    await u.click(boton('2'))
    await u.click(boton(/Terraza/))
    expect(texto()).toContain('👥 2')
    expect(texto()).toContain('📍 Terraza')
  })
})

describe('las horas libres', () => {
  it('se agrupan por turno, como las lee un cliente', async () => {
    const u = userEvent.setup()
    render(<Reservar />)
    await u.click(boton('2'))
    await u.click(boton(/Me da igual/))
    await u.click(boton('elegir dia del calendario'))
    expect(texto()).toContain('Comida')
    expect(texto()).toContain('Cena')
  })

  it('sin horas libres no se deja al cliente en blanco: propone otro día', async () => {
    slotsLibres = []
    const u = userEvent.setup()
    render(<Reservar />)
    await u.click(boton('2'))
    await u.click(boton(/Me da igual/))
    await u.click(boton('elegir dia del calendario'))
    expect(texto()).toMatch(/No quedan horas libres/)
    expect(texto()).toMatch(/Prueba otro día/)
  })
})

describe('los datos del cliente', () => {
  it('sin nombre no se puede confirmar', async () => {
    const u = userEvent.setup()
    render(<Reservar />)
    await hastaDatos(u)
    expect(boton(/Confirmar reserva/).disabled).toBe(true)
    expect(texto()).toContain('Escribe tu nombre')
  })

  it('un email mal escrito tampoco vale: es por donde se avisa de todo', async () => {
    const u = userEvent.setup()
    render(<Reservar />)
    await hastaDatos(u)
    await u.type(screen.getByPlaceholderText(/Nombre y apellidos/), 'Ana')
    await u.type(screen.getByPlaceholderText(/Email/), 'ana@sinpunto')
    expect(boton(/Confirmar reserva/).disabled).toBe(true)
    expect(texto()).toContain('Escribe un email válido')
  })

  it('con nombre y email válido ya se puede', async () => {
    const u = userEvent.setup()
    render(<Reservar />)
    await hastaDatos(u)
    await u.type(screen.getByPlaceholderText(/Nombre y apellidos/), 'Ana')
    await u.type(screen.getByPlaceholderText(/Email/), 'ana@ejemplo.com')
    expect(boton(/Confirmar reserva/).disabled).toBe(false)
  })

  it('dice cuántos días se guardan los datos (RGPD)', async () => {
    estado.reservasConfig.retencionDias = 45
    const u = userEvent.setup()
    render(<Reservar />)
    await hastaDatos(u)
    expect(texto()).toContain('45 días después')
    expect(texto()).toContain('solo para gestionar tu reserva')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// El aforo lo valida el SERVIDOR. `crearReserva` devuelve null cuando lo
// rechaza (día cerrado, sin mesa para ese grupo, otro que se adelantó). Si la
// pantalla enseñara «confirmada» igualmente, el cliente se planta en la puerta
// un sábado con una reserva que no existe.
// ────────────────────────────────────────────────────────────────────────────
describe('cuando el servidor rechaza la reserva', () => {
  const rellenar = async (u) => {
    await hastaDatos(u)
    await u.type(screen.getByPlaceholderText(/Nombre y apellidos/), 'Ana')
    await u.type(screen.getByPlaceholderText(/Email/), 'ana@ejemplo.com')
    await u.click(boton(/Confirmar reserva/))
  }

  it('NO enseña la confirmación', async () => {
    estado.crearReserva = vi.fn(async () => null)
    const u = userEvent.setup()
    render(<Reservar />)
    await rellenar(u)
    expect(texto()).not.toMatch(/¡Reserva confirmada!/)
  })

  it('no manda el email de confirmación de algo que no existe', async () => {
    estado.crearReserva = vi.fn(async () => null)
    const u = userEvent.setup()
    render(<Reservar />)
    await rellenar(u)
    expect(enviarEmail).not.toHaveBeenCalled()
  })

  it('no se la apunta como «mis reservas» en el móvil', async () => {
    estado.crearReserva = vi.fn(async () => null)
    const u = userEvent.setup()
    render(<Reservar />)
    await rellenar(u)
    expect(localStorage.getItem('tpv-mis-reservas')).toBeNull()
  })

  it('si la acepta, sí confirma y avisa por email', async () => {
    const u = userEvent.setup()
    render(<Reservar />)
    await rellenar(u)
    await waitFor(() => expect(texto()).toMatch(/¡Reserva confirmada!/))
    expect(enviarEmail).toHaveBeenCalledWith('confirmacion', expect.anything(), expect.anything())
    expect(JSON.parse(localStorage.getItem('tpv-mis-reservas'))).toContain('r-nueva')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// «¿Sois más de N? Llámanos» sin número, en un móvil, es pedirle al cliente que
// busque el teléfono del bar por su cuenta. Ahí se pierde la reserva de grupo,
// que es la que más factura.
// ────────────────────────────────────────────────────────────────────────────
describe('el teléfono para los grupos grandes', () => {
  it('si el local tiene teléfono, se llama de un toque', () => {
    estado.local.telefono = '600 11 22 33'
    render(<Reservar />)
    const tel = document.querySelector('a[href^="tel:"]')
    expect(tel).not.toBeNull()
    expect(tel.getAttribute('href')).toBe('tel:600112233')
  })

  it('sin teléfono puesto no se inventa un enlace vacío', () => {
    render(<Reservar />)
    expect(document.querySelector('a[href^="tel:"]')).toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// El enlace del email de confirmación (?r=…&t=…). El token es lo único que
// protege la reserva de otro: sin él no se enseña nada.
// ────────────────────────────────────────────────────────────────────────────
describe('entrando por el enlace del email', () => {
  const RESERVA = { id: 'r1', token: 'tok', nombre: 'Ana', fecha: '2026-09-20', hora: '14:00', personas: 2, zona: 'Terraza', estado: 'confirmada', email: 'ana@ejemplo.com' }

  it('con el token bueno enseña la reserva', async () => {
    estado.reservas = [RESERVA]
    busqueda = '?r=r1&t=tok'
    render(<Reservar />)
    await waitFor(() => expect(texto()).toContain('Tu reserva'))
    expect(texto()).toContain('Ana')
    expect(texto()).toContain('20/09/2026')
  })

  it('con un token que no es, no enseña los datos de nadie', async () => {
    estado.reservas = [RESERVA]
    busqueda = '?r=r1&t=elquesea'
    render(<Reservar />)
    await waitFor(() => expect(texto()).toContain('No encontramos esa reserva'))
    expect(texto()).not.toContain('Ana')
  })

  it('cancelar se pregunta antes, y es destructivo', async () => {
    estado.reservas = [RESERVA]
    busqueda = '?r=r1&t=tok'
    const u = userEvent.setup()
    render(<Reservar />)
    await waitFor(() => expect(texto()).toContain('Tu reserva'))
    await u.click(boton(/Cancelar reserva/))
    expect(confirmarMock).toHaveBeenCalledWith(expect.objectContaining({ peligro: true }))
    expect(estado.cambiarEstadoReserva).toHaveBeenCalledWith('r1', 'cancelada')
  })

  it('si se dice que no, la reserva sigue en pie', async () => {
    estado.reservas = [RESERVA]
    busqueda = '?r=r1&t=tok'
    confirmarMock.mockResolvedValue(false)
    const u = userEvent.setup()
    render(<Reservar />)
    await waitFor(() => expect(texto()).toContain('Tu reserva'))
    await u.click(boton(/Cancelar reserva/))
    expect(estado.cambiarEstadoReserva).not.toHaveBeenCalled()
  })
})
