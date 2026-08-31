/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ────────────────────────────────────────────────────────────────────────────
// El asistente que deja un bar operativo. Se usa DOS veces en la vida de una
// instalación: al montarla, y el día que alguien reordena la sala.
//
// Lo que se prueba aquí es lo segundo, que es lo que puede hacer daño:
// reconfigurar la sala RENUMERA las mesas, y los QR pegados en ellas dejan de
// apuntar a donde deben. Un cliente escanea la 4 y pide a la cuenta de la 7.
// ────────────────────────────────────────────────────────────────────────────

const navegar = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navegar }))

const avisos = []
const confirmarMock = vi.fn()
vi.mock('../../store/useUI', () => ({
  toast: (mensaje, tipo) => avisos.push({ mensaje, tipo }),
  confirmar: (...a) => confirmarMock(...a),
}))

// El componente usa `useStore()` entero (destructurado) y también
// `useStore.getState()`: el doble tiene que servir para las dos cosas.
let estado
const useStore = (sel) => (sel ? sel(estado) : estado)
useStore.getState = () => estado
vi.mock('../../store/useStore', () => ({ useStore }))

const Onboarding = (await import('./Onboarding')).default

const estadoBase = () => ({
  local: { nombre: 'Mi Local', ivaPct: 10, moneda: '€', onboarded: false },
  mesas: [],
  empleados: [{ id: 'e1', nombre: 'Ana', pin: '1234', rol: 'admin', activo: true }],
  carta: { productos: [] },
  updateLocal: vi.fn((cambios) => Object.assign(estado.local, cambios)),
  configurarSala: vi.fn(() => ({ ok: true, total: 8 })),
  vaciarCarta: vi.fn(),
  sembrarCarta: vi.fn(),
  addEmpleado: vi.fn(() => ({ ok: true })),
  updateEmpleado: vi.fn(),
  removeEmpleado: vi.fn(() => ({ ok: true })),
})

const texto = () => document.body.textContent.replace(/\s+/g, ' ')
const boton = (re) => screen.getByRole('button', { name: re })

beforeEach(() => {
  avisos.length = 0
  navegar.mockReset()
  confirmarMock.mockReset().mockResolvedValue(true)
  estado = estadoBase()
})
afterEach(cleanup)

// Llega hasta el paso de la sala rellenando el nombre, que es obligatorio.
const irASala = async (u) => {
  await u.type(screen.getByPlaceholderText('Bar Manolo'), 'Bar Paco')
  await u.click(boton(/Continuar/))
}

describe('paso 1 · el local', () => {
  it('sin nombre no deja pasar: un local sin nombre sale en blanco en el ticket', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await u.click(boton(/Continuar/))
    expect(avisos).toContainEqual({ mensaje: 'Ponle nombre a tu local', tipo: 'error' })
    expect(texto()).toContain('Paso 1 de 5')
  })

  it('un nombre de solo espacios tampoco cuela', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await u.type(screen.getByPlaceholderText('Bar Manolo'), '   ')
    await u.click(boton(/Continuar/))
    expect(avisos.at(-1)?.tipo).toBe('error')
    expect(texto()).toContain('Paso 1 de 5')
  })

  it('guarda el nombre sin los espacios de los lados', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await u.type(screen.getByPlaceholderText('Bar Manolo'), '  Bar Paco  ')
    await u.click(boton(/Continuar/))
    expect(estado.updateLocal).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Bar Paco' }))
  })

  it('«Mi Local» no se da por nombre puesto: el campo arranca vacío', () => {
    render(<Onboarding />)
    expect(screen.getByPlaceholderText('Bar Manolo').value).toBe('')
  })
})

describe('paso 2 · la sala', () => {
  it('en un local nuevo NO avisa de los QR, que aún no hay ninguno pegado', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await irASala(u)
    expect(texto()).not.toMatch(/dejarán de servir/)
  })

  it('⚠️ si ya había sala, avisa de que los QR impresos dejan de servir', async () => {
    estado.local.onboarded = true
    const u = userEvent.setup()
    render(<Onboarding />)
    await irASala(u)
    expect(texto()).toMatch(/las mesas se renumeran/i)
    expect(texto()).toMatch(/QR que ya hayas impreso dejarán de servir/i)
  })

  it('cuenta las mesas y las plazas de todas las zonas', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await irASala(u)
    // por defecto: una zona de 8 mesas × 4 plazas
    expect(texto()).toContain('8 mesas · 32 plazas')
  })

  it('si la sala no se puede rehacer (mesas ocupadas) no avanza y lo dice', async () => {
    estado.configurarSala = vi.fn(() => ({ ok: false, error: 'Hay mesas ocupadas' }))
    const u = userEvent.setup()
    render(<Onboarding />)
    await irASala(u)
    await u.click(boton(/Continuar/))
    expect(avisos).toContainEqual({ mensaje: 'Hay mesas ocupadas', tipo: 'error' })
    expect(texto()).toContain('Paso 2 de 5')
  })

  it('no se puede quedar sin ninguna zona', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await irASala(u)
    expect(boton('🗑️').disabled).toBe(true)
  })
})

describe('paso 4 · la carta', () => {
  const irACarta = async (u) => {
    await irASala(u)
    await u.click(boton(/Continuar/))   // sala → personal
    await u.click(boton(/Continuar/))   // personal → carta
  }

  it('sin productos ofrece sembrar la de ejemplo', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await irACarta(u)
    expect(texto()).toMatch(/Empezar con una carta de ejemplo/)
    await u.click(boton(/carta de ejemplo/))
    expect(estado.sembrarCarta).toHaveBeenCalled()
  })

  it('con productos ofrece mantenerla o vaciarla, no sembrar otra encima', async () => {
    estado.carta = { productos: [{ id: 'p1' }, { id: 'p2' }] }
    const u = userEvent.setup()
    render(<Onboarding />)
    await irACarta(u)
    expect(texto()).toMatch(/Mantener la carta actual/)
    expect(texto()).not.toMatch(/Empezar con una carta de ejemplo/)
  })

  it('vaciar la carta se pregunta antes: es destructivo', async () => {
    estado.carta = { productos: [{ id: 'p1' }, { id: 'p2' }] }
    const u = userEvent.setup()
    render(<Onboarding />)
    await irACarta(u)
    await u.click(boton(/carta vacía/i))
    expect(confirmarMock).toHaveBeenCalledWith(expect.objectContaining({ peligro: true }))
    expect(estado.vaciarCarta).toHaveBeenCalled()
  })

  it('si se dice que no, la carta no se toca', async () => {
    estado.carta = { productos: [{ id: 'p1' }] }
    confirmarMock.mockResolvedValue(false)
    const u = userEvent.setup()
    render(<Onboarding />)
    await irACarta(u)
    await u.click(boton(/carta vacía/i))
    expect(estado.vaciarCarta).not.toHaveBeenCalled()
  })
})

describe('paso 5 · terminar', () => {
  const irAlFinal = async (u) => {
    await irASala(u)
    await u.click(boton(/Continuar/))   // sala → personal
    await u.click(boton(/Continuar/))   // personal → carta
    await u.click(boton(/Continuar/))   // carta → listo
  }

  it('marca el local como configurado y abre el panel', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await irAlFinal(u)
    await u.click(boton(/Abrir mi TPV/))
    expect(estado.updateLocal).toHaveBeenCalledWith({ onboarded: true })
    expect(navegar).toHaveBeenCalledWith('/admin')
  })

  it('el resumen cuenta solo el personal activo', async () => {
    estado.empleados = [
      { id: 'e1', nombre: 'Ana', pin: '1234', rol: 'admin', activo: true },
      { id: 'e2', nombre: 'Luis', pin: '1111', rol: 'camarero', activo: true },
      { id: 'e3', nombre: 'Se fue', pin: '2222', rol: 'camarero', activo: false },
    ]
    const u = userEvent.setup()
    render(<Onboarding />)
    await irAlFinal(u)
    expect(texto()).toContain('2 empleados')
  })

  it('recuerda que hay que imprimir los QR y completar el CIF', async () => {
    const u = userEvent.setup()
    render(<Onboarding />)
    await irAlFinal(u)
    expect(texto()).toMatch(/QR de mesa/)
    expect(texto()).toMatch(/CIF/)
  })
})
