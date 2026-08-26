/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// El diálogo habla con el store y con la sesión; las dos se sustituyen para
// poder probar LO QUE SE VE y lo que se manda, sin backend.
const emitir = vi.fn()
vi.mock('../store/useStore', async () => ({
  useStore: (sel) => sel({ emitirRectificativa: emitir }),
  METODO_LABEL: { efectivo: 'Efectivo', tarjeta: 'Tarjeta', online: 'Pago online' },
}))
vi.mock('../store/useUI', () => ({ toast: vi.fn() }))
vi.mock('../lib/sesion', () => ({ useEmpleadoActual: () => ({ nombre: 'Encargado' }) }))

const Devolver = (await import('./Devolver')).default

const ticketTarjeta = { id: 't6', numero: 6, mesaNumero: 1, total: 11.90, pagos: { online: 11.90 } }
const ticketEfectivo = { id: 't1', numero: 1, mesaNumero: 2, total: 20.00, pagos: { efectivo: 20 } }

const abrir = (ticket, pendiente) =>
  render(<Devolver ticket={ticket} pendiente={pendiente} onCerrar={() => {}} />)

beforeEach(() => { emitir.mockReset(); emitir.mockResolvedValue({ ok: true, numero: 9, reembolso: 'hecho' }) })
afterEach(cleanup)

// ────────────────────────────────────────────────────────────────────────────
// Devolver dinero: la pantalla donde más caro sale equivocarse.
//
// El fallo que costó una sesión entera: se emitía la devolución de un ticket
// pagado con tarjeta y se apuntaba como efectivo. El cliente se iba sin su
// dinero y el arqueo de esa noche cantaba un faltante que no existía.
// ────────────────────────────────────────────────────────────────────────────
describe('por dónde se devuelve', () => {
  it('un ticket pagado con TARJETA solo ofrece devolver a la tarjeta', () => {
    abrir(ticketTarjeta, 11.90)
    expect(screen.getByRole('button', { name: /Pago online/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Efectivo$/ })).toBeNull()
  })

  it('y avisa de que vuelve a la misma tarjeta', () => {
    abrir(ticketTarjeta, 11.90)
    // El texto va partido por un <strong>, así que se busca sobre el conjunto.
    expect(document.body.textContent).toMatch(/misma tarjeta con la que se pagó/i)
  })

  it('un ticket pagado en EFECTIVO no ofrece devolver a ninguna tarjeta', () => {
    abrir(ticketEfectivo, 20)
    expect(screen.getByRole('button', { name: /Efectivo/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Pago online/ })).toBeNull()
  })

  it('en efectivo avisa de que sale del cajón, que es lo que cuadra el arqueo', () => {
    abrir(ticketEfectivo, 20)
    expect(screen.getByText(/Sale del cajón/i)).toBeTruthy()
  })
})

describe('cuánto se devuelve', () => {
  it('enseña lo que queda por devolver, no el total del ticket', () => {
    // Un ticket de 11,90 € del que ya se devolvieron 4 tiene 7,90 pendientes.
    abrir(ticketTarjeta, 7.90)
    expect(screen.getByText(/quedan 7\.90 €/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Todo · 7\.90 €/ })).toBeTruthy()
  })

  it('no deja devolver sin motivo: va al registro fiscal', async () => {
    abrir(ticketTarjeta, 11.90)
    const boton = screen.getByRole('button', { name: /^Devolver$/ })
    expect(boton.disabled).toBe(true)
  })

  it('con motivo, ya deja', async () => {
    const u = userEvent.setup()
    abrir(ticketTarjeta, 11.90)
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Se equivocó el camarero')
    expect(screen.getByRole('button', { name: /^Devolver$/ }).disabled).toBe(false)
  })

  it('NO deja devolver más de lo que queda pendiente', async () => {
    const u = userEvent.setup()
    abrir(ticketTarjeta, 7.90)
    await u.click(screen.getByRole('button', { name: /Una parte/ }))
    await u.type(screen.getByPlaceholderText(/máx\. 7\.90/), '8')
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Motivo')
    expect(screen.getByRole('button', { name: /^Devolver$/ }).disabled).toBe(true)
  })

  it('ni cero euros', async () => {
    const u = userEvent.setup()
    abrir(ticketTarjeta, 7.90)
    await u.click(screen.getByRole('button', { name: /Una parte/ }))
    await u.type(screen.getByPlaceholderText(/máx\. 7\.90/), '0')
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Motivo')
    expect(screen.getByRole('button', { name: /^Devolver$/ }).disabled).toBe(true)
  })
})

describe('lo que se manda al servidor', () => {
  it('la devolución entera manda importe null (que el servidor calcule)', async () => {
    const u = userEvent.setup()
    abrir(ticketTarjeta, 7.90)
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Cobrado de mas')
    await u.click(screen.getByRole('button', { name: /^Devolver$/ }))
    await waitFor(() => expect(emitir).toHaveBeenCalled())
    expect(emitir.mock.calls[0][0]).toMatchObject({
      ticketId: 't6', importe: null, metodo: 'online', motivo: 'Cobrado de mas', por: 'Encargado',
    })
  })

  it('la parcial manda el importe, y el método de cómo se cobró', async () => {
    const u = userEvent.setup()
    abrir(ticketTarjeta, 7.90)
    await u.click(screen.getByRole('button', { name: /Una parte/ }))
    await u.type(screen.getByPlaceholderText(/máx\. 7\.90/), '3')
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Una cana de mas')
    await u.click(screen.getByRole('button', { name: /^Devolver$/ }))
    await waitFor(() => expect(emitir).toHaveBeenCalled())
    expect(emitir.mock.calls[0][0]).toMatchObject({ importe: 3, metodo: 'online' })
  })

  it('«2,50» son dos euros con cincuenta, NO doscientos cincuenta', async () => {
    // En un `<input type="number">` el navegador se come la coma y «2,50»
    // llega como «250». En un ticket de 300 € eso es devolver 250 en vez de
    // 2,50 — y el tope de «no más de lo pendiente» ni se entera.
    const u = userEvent.setup()
    abrir({ ...ticketEfectivo, total: 300 }, 300)
    await u.click(screen.getByRole('button', { name: /Una parte/ }))
    await u.type(screen.getByPlaceholderText(/máx\. 300\.00/), '2,50')
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Motivo')
    await u.click(screen.getByRole('button', { name: /^Devolver$/ }))
    await waitFor(() => expect(emitir).toHaveBeenCalled())
    expect(emitir.mock.calls[0][0].importe).toBe(2.5)
  })

  it('y el punto decimal también, que es lo que teclea un teclado numérico', async () => {
    const u = userEvent.setup()
    abrir(ticketEfectivo, 20)
    await u.click(screen.getByRole('button', { name: /Una parte/ }))
    await u.type(screen.getByPlaceholderText(/máx\. 20\.00/), '2.50')
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Motivo')
    await u.click(screen.getByRole('button', { name: /^Devolver$/ }))
    await waitFor(() => expect(emitir).toHaveBeenCalled())
    expect(emitir.mock.calls[0][0].importe).toBe(2.5)
  })

  it('lo que no es un número no habilita el botón', async () => {
    const u = userEvent.setup()
    abrir(ticketEfectivo, 20)
    await u.click(screen.getByRole('button', { name: /Una parte/ }))
    await u.type(screen.getByPlaceholderText(/máx\. 20\.00/), 'dos euros')
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Motivo')
    expect(screen.getByRole('button', { name: /^Devolver$/ }).disabled).toBe(true)
  })

  it('mientras se emite, el botón no se puede pulsar dos veces', async () => {
    const u = userEvent.setup()
    let resolver
    emitir.mockReturnValue(new Promise(r => { resolver = r }))
    abrir(ticketTarjeta, 7.90)
    await u.type(screen.getByPlaceholderText(/Cobrado de más/i), 'Motivo')
    await u.click(screen.getByRole('button', { name: /^Devolver$/ }))
    // Doble clic = doble devolución. El servidor lo impide, pero la pantalla
    // no debería ni ofrecerlo.
    expect(screen.getByRole('button', { name: /Emitiendo/ }).disabled).toBe(true)
    resolver({ ok: true, numero: 9 })
  })
})
