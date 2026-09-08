/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// El correo y los avisos se sustituyen: aquí se prueba QUÉ se guarda y a quién
// se le escribe, no EmailJS. El store es el de verdad — la regla de aforo es
// justo lo que hay que ver funcionar desde la pantalla.
const enviarEmailReserva = vi.fn(async () => ({ via: 'emailjs' }))
vi.mock('../lib/email', () => ({ enviarEmailReserva: (...a) => enviarEmailReserva(...a) }))
vi.mock('../store/useUI', () => ({ toast: vi.fn(), confirmar: vi.fn(async () => true) }))

const { useStore } = await import('../store/useStore')
const ReservasManager = (await import('./ReservasManager')).default

// Sala de 8 plazas: así el aforo se llena con una sola reserva y se ve el aviso.
const MESAS = [
  { id: 'm1', numero: 1, capacidad: 4, zona: 'Terraza', estado: 'libre', personas: [], reserva: null },
  { id: 'm2', numero: 2, capacidad: 4, zona: 'Interior', estado: 'libre', personas: [], reserva: null },
]
const manana = () => {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  enviarEmailReserva.mockClear()
  useStore.setState(s => ({
    reservas: [],
    mesas: MESAS.map(m => ({ ...m })),
    reservasConfig: { ...s.reservasConfig, diasCerrados: [], aforo: null },
  }))
})
afterEach(cleanup)

const abrirFormulario = async () => {
  const user = userEvent.setup()
  render(<ReservasManager />)
  await user.click(screen.getByRole('button', { name: /Nueva reserva/ }))
  return user
}

// Rellena el formulario. La hora va por el desplegable de turnos.
const rellenar = async (user, { nombre, hora = '13:00', personas, email, fecha = manana() }) => {
  const campo = (etiqueta) => screen.getByLabelText(etiqueta)
  // date y number: `fireEvent` va directo al valor; teclear en ellos depende
  // del formato del navegador y aquí no es lo que se está probando.
  fireEvent.change(campo('Día'), { target: { value: fecha } })
  if (personas != null) fireEvent.change(campo('Personas'), { target: { value: String(personas) } })
  await user.selectOptions(campo('Hora'), hora)
  await user.type(screen.getByPlaceholderText('Nombre *'), nombre)
  if (email) await user.type(screen.getByPlaceholderText(/Email/), email)
}

// ────────────────────────────────────────────────────────────────────────────
// Coger una reserva por teléfono. Es como entra la mayoría en un bar, y hasta
// ahora la agenda solo sabía gestionar las que llegaban por la web.
// ────────────────────────────────────────────────────────────────────────────
describe('nueva reserva desde la agenda', () => {
  it('guarda la reserva con sus datos y su localizador', async () => {
    const user = await abrirFormulario()
    await rellenar(user, { nombre: 'Ana Pérez', personas: 4, email: 'ana@ejemplo.com' })
    await user.click(screen.getByRole('button', { name: /Guardar reserva/ }))

    await waitFor(() => expect(useStore.getState().reservas).toHaveLength(1))
    const r = useStore.getState().reservas[0]
    expect(r.nombre).toBe('Ana Pérez')
    expect(r.personas).toBe(4)
    expect(r.hora).toBe('13:00')
    expect(r.estado).toBe('confirmada')
    expect(r.token).toBeTruthy()   // sin él, el correo va sin enlace de gestión
  })

  // Lo que la reserva desde Mostrador no hacía, y por lo que había que crearla
  // aquí: el cliente que reserva por teléfono también recibe su confirmación.
  it('le manda la confirmación si dejó email', async () => {
    const user = await abrirFormulario()
    await rellenar(user, { nombre: 'Ana', email: 'ana@ejemplo.com' })
    await user.click(screen.getByRole('button', { name: /Guardar reserva/ }))

    await waitFor(() => expect(enviarEmailReserva).toHaveBeenCalled())
    const [tipo, reserva] = enviarEmailReserva.mock.calls[0]
    expect(tipo).toBe('confirmacion')
    expect(reserva.email).toBe('ana@ejemplo.com')
    expect(reserva.token).toBeTruthy()
  })

  it('sin email no intenta escribir a nadie', async () => {
    const user = await abrirFormulario()
    await rellenar(user, { nombre: 'Quien sea' })
    await user.click(screen.getByRole('button', { name: /Guardar reserva/ }))

    await waitFor(() => expect(useStore.getState().reservas).toHaveLength(1))
    expect(enviarEmailReserva).not.toHaveBeenCalled()
  })

  it('no deja guardar sin nombre', async () => {
    const user = await abrirFormulario()
    await user.selectOptions(screen.getByLabelText('Hora'), '13:00')
    expect(screen.getByRole('button', { name: /Guardar reserva/ }).disabled).toBe(true)
  })

  it('un email mal escrito no pasa: la confirmación no llegaría', async () => {
    const user = await abrirFormulario()
    await rellenar(user, { nombre: 'Ana', email: 'ana@' })
    expect(screen.getByRole('button', { name: /Guardar reserva/ }).disabled).toBe(true)
    expect(document.body.textContent).toMatch(/email no es válido/i)
  })

  // El bar coge por teléfono justo lo que la web rechaza. Avisar, sí; impedirlo,
  // no: quien está al teléfono decide si mete una mesa más.
  it('avisa de que no queda aforo pero la guarda igual', async () => {
    useStore.setState({ reservas: [{ id: 'r0', fecha: manana(), hora: '13:00', personas: 8, estado: 'confirmada', zona: '' }] })
    const user = await abrirFormulario()
    await rellenar(user, { nombre: 'Grupo tarde', personas: 4 })

    expect(document.body.textContent).toMatch(/no queda sitio/i)
    await user.click(screen.getByRole('button', { name: /Guardar reserva/ }))
    await waitFor(() => expect(useStore.getState().reservas).toHaveLength(2))
  })

  it('avisa de que ese día está cerrado y la guarda igual', async () => {
    const f = manana()
    const dia = new Date(f + 'T12:00:00').getDay()
    useStore.setState(s => ({ reservasConfig: { ...s.reservasConfig, diasCerrados: [dia] } }))
    const user = await abrirFormulario()
    await rellenar(user, { nombre: 'Ana', fecha: f })

    expect(document.body.textContent).toMatch(/está cerrado/i)
    await user.click(screen.getByRole('button', { name: /Guardar reserva/ }))
    await waitFor(() => expect(useStore.getState().reservas).toHaveLength(1))
  })
})
