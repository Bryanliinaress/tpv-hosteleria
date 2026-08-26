/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ────────────────────────────────────────────────────────────────────────────
// La pantalla de PAGAR del cliente: donde está el dinero y donde ya se
// encontraron a mano cuatro cosas mal. Esto las deja clavadas.
//
// Se monta la carta entera con la mesa ya abierta y el cliente identificado,
// que es el único estado en el que esta vista existe.
// ────────────────────────────────────────────────────────────────────────────

const MESA = 'mesa-1'
let estado

vi.mock('react-router-dom', () => ({ useParams: () => ({ mesaId: MESA }) }))
vi.mock('../../lib/pagos', () => ({
  pagoOnlineDisponible: true,
  iniciarPagoOnline: vi.fn(),
  // fiel a la real: siempre devuelve objeto, con `estado: null` si no se
  // viene de la pasarela
  leerResultadoPago: () => ({ estado: null }),
  limpiarUrlPago: () => {},
}))
vi.mock('../../lib/sync', () => ({ syncListo: Promise.resolve(), mergeLog: (a) => a }))
vi.mock('../../store/useUI', () => ({ toast: vi.fn(), useUI: () => ({}) }))
vi.mock('../../lib/recibo', () => ({
  construirRecibo: () => ({}), lineasDeConsumo: () => [], guardarRecibo: () => {},
  leerRecibo: () => null, olvidarRecibo: () => {}, descargarRecibo: () => {}, reciboReciente: () => null,
}))

const real = await vi.importActual('../../store/useStore')
vi.mock('../../store/useStore', async () => {
  const actual = await vi.importActual('../../store/useStore')
  return { ...actual, useStore: () => estado }
})

const CartaCliente = (await import('./CartaCliente')).default

const persona = (id, nombre, items) => ({ id, nombre, items, pagado: false, propina: 0 })
const linea = (uid, nombre, precio) => ({ uid, nombre, precio, cantidad: 1, estado: 'enviado', tipo: 'comida' })

function montar(personas) {
  estado = {
    hidratado: true,
    local: { nombre: 'Bar', moneda: '€' },
    carta: { categorias: [], productos: [], formatos: [], extras: [], tiposPan: [] },
    mesas: [{ id: MESA, numero: 1, estado: 'ocupada', personas, unidas: [] }],
    pedidosCocina: [], pedidosBarra: [], avisos: [],
    unirseAMesa: vi.fn(), agregarItem: vi.fn(), cambiarCantidad: vi.fn(),
    confirmarPedido: vi.fn(), pedirCuenta: vi.fn(), pagarParte: vi.fn(), pagarTodo: vi.fn(),
    toggleCompartir: vi.fn(), llamarCamarero: vi.fn(), atenderAviso: vi.fn(),
  }
  localStorage.setItem(`tpv-yo-${MESA}`, personas[0].id)
  render(<CartaCliente />)
}

const texto = () => document.body.textContent.replace(/\s+/g, ' ')
const irAPagar = async (u) => u.click(screen.getByText('Pagar'))

beforeEach(() => { localStorage.clear() })
afterEach(cleanup)

describe('tu parte va primero', () => {
  it('llegando el segundo, TU tarjeta se pinta antes que la del otro', async () => {
    // Antes, el primer botón grande de la pantalla del dinero era «pagar lo de
    // otro»: el orden era el de llegada a la mesa.
    const u = userEvent.setup()
    montar([
      persona('yo', 'Ana', [linea('l1', 'Café', 1.50)]),
      persona('otro', 'Prueba', [linea('l2', 'Tostada', 3.50)]),
    ])
    await irAPagar(u)
    const t = texto()
    expect(t.indexOf('Ana')).toBeLessThan(t.indexOf('Prueba'))
  })
})

describe('cada botón dice cuánto cobra', () => {
  it('el tuyo lleva tu importe', async () => {
    const u = userEvent.setup()
    montar([persona('yo', 'Ana', [linea('l1', 'Café', 1.50)])])
    await irAPagar(u)
    expect(texto()).toMatch(/Pagar mi parte · 1\.50 €/)
  })

  it('el de otro comensal, el suyo y con su nombre', async () => {
    const u = userEvent.setup()
    montar([
      persona('yo', 'Ana', [linea('l1', 'Café', 1.50)]),
      persona('otro', 'Prueba', [linea('l2', 'Tostada', 3.50)]),
    ])
    await irAPagar(u)
    expect(texto()).toMatch(/Pagar lo de Prueba · 3\.50 €/)
  })
})

describe('lo que NO debe salir', () => {
  it('quien se une y no ha pedido nada no ve un botón de pagar 0,00 €', async () => {
    // Abría la pasarela por cero euros.
    const u = userEvent.setup()
    montar([persona('yo', 'Ana', [])])
    await irAPagar(u)
    // Que tu total ponga 0,00 € está bien y es informativo. Lo que no puede
    // haber es un BOTÓN de cobro por cero euros: abría la pasarela.
    expect(texto()).toMatch(/Sin pedidos/)
    expect(texto()).not.toMatch(/Pagar mi parte/)
    expect(screen.queryByText(/con tarjeta\/Bizum/)).toBeNull()
  })

  it('con un solo comensal no se ofrece «pagar toda la cuenta»', async () => {
    // Era un segundo botón, del mismo color y por el mismo importe, que hacía
    // exactamente lo que el de arriba.
    const u = userEvent.setup()
    montar([persona('yo', 'Ana', [linea('l1', 'Café', 1.50)])])
    await irAPagar(u)
    expect(texto()).not.toMatch(/Pagar toda la cuenta/)
  })

  it('con dos, sí: ahí ya significa algo', async () => {
    const u = userEvent.setup()
    montar([
      persona('yo', 'Ana', [linea('l1', 'Café', 1.50)]),
      persona('otro', 'Prueba', [linea('l2', 'Tostada', 3.50)]),
    ])
    await irAPagar(u)
    expect(texto()).toMatch(/Pagar toda la cuenta · 5\.00 €/)
  })

  it('«Total mesa» solo si dice algo distinto de «Pendiente de pago»', async () => {
    const u = userEvent.setup()
    montar([persona('yo', 'Ana', [linea('l1', 'Café', 1.50)])])
    await irAPagar(u)
    expect(texto()).toMatch(/Pendiente de pago/)
    expect(texto()).not.toMatch(/Total mesa/)
  })
})

describe('la propina', () => {
  it('va en euros además de en porcentaje: nadie calcula el 10 % en el móvil', async () => {
    const u = userEvent.setup()
    montar([persona('yo', 'Ana', [linea('l1', 'Menú', 10.00)])])
    await irAPagar(u)
    await u.click(screen.getByText(/Pagar mi parte/))
    const t = texto()
    expect(t).toMatch(/5% · \+0\.50 €/)
    expect(t).toMatch(/10% · \+1\.00 €/)
    expect(t).toMatch(/15% · \+1\.50 €/)
  })

  it('«Sin propina» sigue siendo lo primero y lo elegido', async () => {
    const u = userEvent.setup()
    montar([persona('yo', 'Ana', [linea('l1', 'Menú', 10.00)])])
    await irAPagar(u)
    await u.click(screen.getByText(/Pagar mi parte/))
    expect(screen.getByText('Sin propina')).toBeTruthy()
  })

  it('mientras pagas tu parte, no se ofrece a la vez pagar toda la cuenta', async () => {
    // Dos cobros abiertos al mismo tiempo por el mismo dinero.
    const u = userEvent.setup()
    montar([
      persona('yo', 'Ana', [linea('l1', 'Café', 1.50)]),
      persona('otro', 'Prueba', [linea('l2', 'Tostada', 3.50)]),
    ])
    await irAPagar(u)
    expect(texto()).toMatch(/Pagar toda la cuenta/)
    await u.click(screen.getByText(/Pagar mi parte/))
    expect(texto()).not.toMatch(/Pagar toda la cuenta/)
  })
})

describe('el reparto de lo compartido', () => {
  it('lo que se paga es la parte repartida, no la línea entera', async () => {
    const u = userEvent.setup()
    const compartida = { ...linea('l1', 'Paella', 20), compartidoCon: ['otro'] }
    montar([
      persona('yo', 'Ana', [compartida]),
      persona('otro', 'Prueba', []),
    ])
    await irAPagar(u)
    // 20 € entre dos: 10 y 10, y la suma cuadra
    expect(texto()).toMatch(/Pagar mi parte · 10\.00 €/)
    expect(texto()).toMatch(/Pagar lo de Prueba · 10\.00 €/)
    expect(real.owedPorPersona).toBeTypeOf('function')
  })
})
