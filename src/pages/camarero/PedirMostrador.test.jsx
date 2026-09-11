/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ────────────────────────────────────────────────────────────────────────────
// Tomar pedido en el Mostrador. Se prueba lo que ya dio un disgusto o lo que
// cuesta dinero si falla: que el botón de enviar diga lo que de verdad sale a
// cocina (la mesa ENTERA, no un comensal), que Enter no añada a ciegas y que un
// producto con opciones no se añada sin elegirlas.
// ────────────────────────────────────────────────────────────────────────────

vi.mock('../../components/FueraDeCarta', () => ({ default: () => <div>fuera de carta</div> }))
const avisos = []
vi.mock('../../store/useUI', () => ({ toast: (m) => avisos.push(m), pedirTexto: vi.fn(async () => 'Luis') }))

let estado
const useStore = (sel) => (sel ? sel(estado) : estado)
useStore.getState = () => estado
vi.mock('../../store/useStore', () => ({
  useStore,
  TIEMPOS: { 1: { label: '1º', largo: 'Marcha ya' }, 2: { label: '2º', largo: 'Segundo' }, 3: { label: '🍰', largo: 'Postre' } },
  normalizarExtra: (e) => e,
  etiquetasDe: () => ({ formatos: 'Pan', tiposPan: 'Tipo de pan', extras: 'Extras' }),
}))

const PedirMostrador = (await import('./PedirMostrador')).default

const linea = (over) => ({ uid: Math.random().toString(), productoId: 'x', nombre: 'Caña', precio: 2, cantidad: 1, estado: 'pendiente', tipo: 'bebida', ...over })

beforeEach(() => {
  avisos.length = 0
  estado = {
    carta: {
      categorias: [{ id: 'beb', nombre: 'Bebidas', emoji: '🥤' }, { id: 'des', nombre: 'Desayunos', emoji: '🥪' }],
      formatos: [{ id: 'pitufo', nombre: 'Pitufo' }], tiposPan: [{ id: 'normal', nombre: 'Normal', sup: 0 }], extras: [],
      productos: [
        { id: 'cs', categoria: 'beb', nombre: 'Café solo', precio: 1.3, tipo: 'bebida', disponible: true },
        { id: 'cl', categoria: 'beb', nombre: 'Café con leche', precio: 1.5, tipo: 'bebida', disponible: true },
        { id: 'mx', categoria: 'des', nombre: 'Mixto', precios: { pitufo: 2 }, tipo: 'comida', disponible: true },
      ],
    },
    mesas: [{
      id: 'm1', numero: 5, zona: 'Interior', personas: [
        { id: 'ana', nombre: 'Ana', items: [linea({ productoId: 'cs', nombre: 'Café solo', precio: 1.3, cantidad: 2 })] },
        { id: 'luis', nombre: 'Luis', items: [linea({ cantidad: 3 }), linea({ estado: 'enviado', cantidad: 9 })] },
      ],
    }],
    agregarItem: vi.fn(), cambiarCantidad: vi.fn(), confirmarPedido: vi.fn(), unirseAMesa: vi.fn(), setTiempoItem: vi.fn(),
  }
})
afterEach(cleanup)

const abrir = () => render(<PedirMostrador mesaId="m1" onClose={vi.fn()} />)

describe('PedirMostrador', () => {
  it('el botón de enviar cuenta la mesa ENTERA, que es lo que sale a cocina', () => {
    abrir()
    // Ana 2 + Luis 3 = 5 (lo ya enviado no cuenta); 2×1,30 + 3×2 = 8,60
    const boton = screen.getByRole('button', { name: /Enviar 5 a cocina\/barra/ })
    expect(boton.textContent).toContain('8.60 €')
  })

  it('tocar la tarjeta añade el producto al comensal elegido', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Añadir Café con leche' }))
    expect(estado.agregarItem).toHaveBeenCalledWith('m1', 'ana', expect.objectContaining({ productoId: 'cl', precio: 1.5 }))
  })

  it('la tarjeta dice cuántos lleva ya pedidos ese comensal', () => {
    abrir()
    expect(screen.getByRole('button', { name: 'Añadir Café solo' }).textContent).toMatch(/^2/)
  })

  it('Enter añade si el nombre es exacto, y deja el buscador listo para el siguiente', async () => {
    abrir()
    const buscador = screen.getByPlaceholderText(/Buscar en toda la carta/)
    await userEvent.type(buscador, 'cafe solo{Enter}')
    expect(estado.agregarItem).toHaveBeenCalledWith('m1', 'ana', expect.objectContaining({ productoId: 'cs' }))
    expect(buscador.value).toBe('')
  })

  it('Enter con varios candidatos no añade nada a ciegas', async () => {
    abrir()
    await userEvent.type(screen.getByPlaceholderText(/Buscar en toda la carta/), 'cafe{Enter}')
    expect(estado.agregarItem).not.toHaveBeenCalled()
    expect(avisos[0]).toMatch(/2 que coinciden/)
  })

  it('un producto con opciones abre la hoja en vez de añadirse sin elegir', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /Desayunos/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Añadir Mixto' }))
    expect(estado.agregarItem).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Añadir · 2\.00 €/ }))
    expect(estado.agregarItem).toHaveBeenCalledWith('m1', 'ana', expect.objectContaining({ productoId: 'mx', precio: 2 }))
  })

  it('enviar manda la mesa y cierra', async () => {
    const onClose = vi.fn()
    render(<PedirMostrador mesaId="m1" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /Enviar 5/ }))
    expect(estado.confirmarPedido).toHaveBeenCalledWith('m1')
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape borra la búsqueda antes de cerrar la pantalla', () => {
    const onClose = vi.fn()
    render(<PedirMostrador mesaId="m1" onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText(/Buscar en toda la carta/), { target: { value: 'caf' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
