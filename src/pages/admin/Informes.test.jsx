/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const informe = vi.fn()
vi.mock('../../store/useStore', () => ({
  useStore: (sel) => sel({ informeVentas: informe }),
  METODO_LABEL: { efectivo: 'Efectivo', tarjeta: 'Tarjeta', online: 'Pago online' },
  METODO_EMOJI: { efectivo: '💵', tarjeta: '💳', online: '📱' },
}))

const Informes = (await import('./Informes')).default

const DATOS = {
  zona: 'Europe/Madrid',
  resumen: {
    tickets: 25, bruto: 253.10, devuelto: 14.40, devoluciones: 2,
    neto: 238.70, propinas: 2, comensales: 25, medio: 10.12,
  },
  por_producto: [
    { nombre: 'Menú del día', uds: 3, importe: 36 },
    { nombre: 'Caña', uds: 12, importe: 24 },
  ],
  por_camarero: [{ nombre: 'Juan', tickets: 14, importe: 195.60, propinas: 2 }],
  por_cobrador: [{ nombre: 'María', tickets: 11, importe: 57.50 }],
  por_hora: [{ hora: 13, tickets: 4, importe: 40 }, { hora: 21, tickets: 6, importe: 80 }],
  por_dia: [{ dia: '2026-08-24', tickets: 25, importe: 238.70 }],
  por_metodo: [{ metodo: 'tarjeta', importe: 170.10 }, { metodo: 'efectivo', importe: 68.60 }],
}
const VACIO = { ...DATOS, resumen: { ...DATOS.resumen, tickets: 0, devoluciones: 0 }, por_producto: [], por_hora: [], por_dia: [], por_camarero: [], por_cobrador: [], por_metodo: [] }

const texto = () => document.body.textContent.replace(/\s+/g, ' ')

beforeEach(() => { informe.mockReset(); informe.mockResolvedValue(DATOS) })
afterEach(cleanup)

// ────────────────────────────────────────────────────────────────────────────
// Informes. Lo importante no es que salgan números: es que las devoluciones
// RESTEN y no aparezcan como ventas, y que el dueño entienda de un vistazo
// cuánto se queda el bar.
// ────────────────────────────────────────────────────────────────────────────
describe('lo que se ve', () => {
  it('la cifra grande es lo NETO, no lo vendido', async () => {
    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toContain('238.70'))
  })

  it('las devoluciones se enseñan aparte, sin esconderlas', async () => {
    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toMatch(/2 devolución\(es\)/))
    expect(texto()).toMatch(/vendido 253\.10 € antes de devolver/)
  })

  it('sin devoluciones no se enseña esa línea, que sería ruido', async () => {
    informe.mockResolvedValue({ ...DATOS, resumen: { ...DATOS.resumen, devuelto: 0, devoluciones: 0 } })
    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toContain('238.70'))
    expect(texto()).not.toMatch(/antes de devolver/)
  })

  it('quien atendió y quien cobró salen por separado', async () => {
    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toContain('Juan'))
    expect(texto()).toMatch(/Quien atendió la mesa/)
    expect(texto()).toMatch(/Quien estaba en la caja al cerrar/)
    expect(texto()).toContain('María')
  })

  it('los productos salen con sus unidades', async () => {
    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toMatch(/Menú del día · 3 uds/))
  })

  it('dice en qué zona horaria están las horas', async () => {
    // Un informe de horas punta desplazado dos horas hace contratar personal
    // para la hora equivocada: que se vea de dónde sale.
    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toContain('Europe/Madrid'))
  })
})

describe('periodos', () => {
  it('arranca en «Hoy», que es lo que se mira a media tarde', async () => {
    render(<Informes moneda="€" />)
    await waitFor(() => expect(informe).toHaveBeenCalled())
    const { desde, hasta } = informe.mock.calls[0][0]
    expect(new Date(hasta) - new Date(desde)).toBe(24 * 3600 * 1000)
  })

  it('cambiar de periodo vuelve a pedir el informe', async () => {
    const u = userEvent.setup()
    render(<Informes moneda="€" />)
    await waitFor(() => expect(informe).toHaveBeenCalledTimes(1))
    await u.click(screen.getByRole('button', { name: 'Mes pasado' }))
    await waitFor(() => expect(informe).toHaveBeenCalledTimes(2))
  })

  it('un periodo sin ventas lo dice, y no enseña gráficas vacías', async () => {
    informe.mockResolvedValue(VACIO)
    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toMatch(/Sin ventas en/))
    expect(texto()).not.toMatch(/Top productos/)
  })

  it('sin backend (la demo) lo dice en vez de enseñar ceros', async () => {
    informe.mockResolvedValue(null)
    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toMatch(/necesitan el backend real/))
  })
})

describe('exportar', () => {
  it('el CSV usa «;», que es lo que abre bien Excel en español', async () => {
    const u = userEvent.setup()
    let capturado = null
    globalThis.URL.createObjectURL = (b) => { capturado = b; return 'blob:x' }
    globalThis.URL.revokeObjectURL = () => {}
    HTMLAnchorElement.prototype.click = function () {}

    render(<Informes moneda="€" />)
    await waitFor(() => expect(texto()).toContain('238.70'))
    await u.click(screen.getByRole('button', { name: /CSV/ }))
    expect(capturado).not.toBeNull()
    const csv = await capturado.text()
    expect(csv).toContain('"Neto";"238.7"')
    expect(csv).toContain('"Menú del día"')
    // con comas, Excel en español mete todo en una columna
    expect(csv.split('\n')[0]).toContain(';')
  })
})
