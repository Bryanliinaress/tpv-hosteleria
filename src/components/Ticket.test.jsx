/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const local = {
  nombre: 'Bar Manolo', cif: 'B12345678', direccion: 'Calle Mayor 1',
  ivaPct: 10, moneda: '€', pieTicket: '¡Gracias!',
}
vi.mock('../store/useStore', () => ({
  useStore: (sel) => sel({ local }),
  METODO_LABEL: { efectivo: 'Efectivo', tarjeta: 'Tarjeta', online: 'Pago online' },
  METODO_EMOJI: { efectivo: '💵', tarjeta: '💳', online: '📱' },
  metodosDe: (p) => Object.keys(p || {}),
}))
vi.mock('../lib/impresora', () => ({ imprimir: vi.fn(), configImpresora: () => ({ modo: 'dialogo' }) }))

const Ticket = (await import('./Ticket')).default
afterEach(cleanup)

const mesa = (items) => ({
  numero: 4, camarero: 'Ana',
  personas: [{ id: 'p1', nombre: 'Uno', pagado: true, items }],
})

const texto = () => document.body.textContent.replace(/\s+/g, ' ')

// ────────────────────────────────────────────────────────────────────────────
// El ticket es una FACTURA SIMPLIFICADA: lo que sale aquí es lo que se entrega
// al cliente y lo que tiene que cuadrar con lo que consta en Hacienda.
// ────────────────────────────────────────────────────────────────────────────
describe('el ticket de un cobro normal', () => {
  it('lleva los datos fiscales del local', () => {
    render(<Ticket tipo="cuenta" mesa={mesa([{ nombre: 'Café', precio: 1.5, cantidad: 2, ivaPct: 10 }])} onClose={() => {}} />)
    expect(texto()).toContain('Bar Manolo')
    expect(texto()).toContain('B12345678')
  })

  it('base + IVA suman exactamente el total', () => {
    render(<Ticket tipo="cuenta" mesa={mesa([{ nombre: 'Menú', precio: 11, cantidad: 1, ivaPct: 10 }])} onClose={() => {}} />)
    const t = texto()
    expect(t).toMatch(/Base \(10%\): 10\.00/)
    expect(t).toMatch(/IVA \(10%\): 1\.00/)
    expect(t).toMatch(/Total: 11\.00/)
  })

  it('con dos tipos de IVA, DOS líneas de desglose (no una con la media)', () => {
    render(<Ticket tipo="cuenta" onClose={() => {}} mesa={mesa([
      { nombre: 'Consumición', precio: 11, cantidad: 1, ivaPct: 10 },
      { nombre: 'Botella', precio: 12.10, cantidad: 1, ivaPct: 21 },
    ])} />)
    const t = texto()
    expect(t).toMatch(/Base \(10%\): 10\.00/)
    expect(t).toMatch(/IVA \(10%\): 1\.00/)
    expect(t).toMatch(/Base \(21%\): 10\.00/)
    expect(t).toMatch(/IVA \(21%\): 2\.10/)
    expect(t).toMatch(/Total: 23\.10/)
  })

  it('NO se anuncia como rectificativa', () => {
    render(<Ticket tipo="cuenta" mesa={mesa([{ nombre: 'Café', precio: 1.5, cantidad: 1, ivaPct: 10 }])} onClose={() => {}} />)
    expect(texto()).not.toMatch(/RECTIFICATIVA/)
  })
})

describe('el ticket de una devolución', () => {
  const devolucion = mesa([{ nombre: 'Devolución (IVA 10%)', precio: -4, cantidad: 1, ivaPct: 10 }])

  it('dice que es una rectificativa y a qué ticket corrige', () => {
    // Un papel con los importes en negativo y sin explicación es una
    // reclamación esperando a pasar.
    render(<Ticket tipo="cuenta" mesa={devolucion} onClose={() => {}}
      rectifica={{ numero: 6, motivo: 'Cobrado de más' }} />)
    const t = texto()
    expect(t).toMatch(/FACTURA RECTIFICATIVA/)
    expect(t).toMatch(/Rectifica al ticket nº 6/)
    expect(t).toMatch(/Cobrado de más/)
  })

  it('el desglose también cuadra en negativo', () => {
    render(<Ticket tipo="cuenta" mesa={devolucion} onClose={() => {}}
      rectifica={{ numero: 6, motivo: 'x' }} />)
    const t = texto()
    expect(t).toMatch(/Base \(10%\): -3\.64/)
    expect(t).toMatch(/IVA \(10%\): -0\.36/)
    expect(t).toMatch(/Total: -4\.00/)
  })
})

describe('lo que aguanta sin romperse', () => {
  it('una mesa sin líneas no revienta la pantalla', () => {
    // Pasó de verdad: un comensal que se une y no pide nada.
    render(<Ticket tipo="cuenta" mesa={mesa([])} onClose={() => {}} />)
    expect(texto()).toMatch(/Total: 0\.00/)
  })

  it('un local a medio rellenar tampoco', () => {
    // Teléfono, dirección y CIF están vacíos en un bar recién montado.
    vi.doMock('../store/useStore', () => ({ useStore: (sel) => sel({ local: {} }) }))
    render(<Ticket tipo="cuenta" mesa={mesa([{ nombre: 'Café', precio: 1.5, cantidad: 1 }])} onClose={() => {}} />)
    expect(screen.getByText(/Total:/)).toBeTruthy()
  })
})
