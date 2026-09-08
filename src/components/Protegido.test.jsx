/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// Todo lo que hay alrededor del guardián se sustituye: aquí se prueba QUIÉN
// pasa y qué ve quien no pasa, sin backend ni teclado de PIN de verdad.
let empleado = null
vi.mock('../lib/sesion', () => ({
  useEmpleadoActual: () => empleado,
  clearSesion: vi.fn(),
}))
vi.mock('../lib/repo', () => ({ backendV2: false }))
vi.mock('../lib/v2', () => ({ haySesionLocal: async () => true }))
// Anotar en qué pantalla está el aparato habla con Supabase: aquí no toca.
vi.mock('../lib/v2/dispositivo', () => ({ anotarPantalla: vi.fn() }))
vi.mock('../lib/perfil', () => ({ esLocalMontado: () => true }))
vi.mock('./PinLogin', () => ({ default: () => <div>TECLADO DEL PIN</div> }))
vi.mock('../pages/login/LoginLocal', () => ({ default: () => <div>login</div> }))
vi.mock('../pages/login/PedirAcceso', () => ({ default: () => <div>pedir acceso</div> }))

const Protegido = (await import('./Protegido')).default

const abrir = (pantalla, emp) => {
  empleado = emp
  return render(<Protegido pantalla={pantalla}><div>LA PANTALLA</div></Protegido>)
}
const COCINERO = { id: 'c', nombre: 'Rafa', rol: 'cocina' }
const CAMARERO = { id: 'w', nombre: 'Luis', rol: 'camarero' }
const JEFA = { id: 'a', nombre: 'Ana', rol: 'admin' }

beforeEach(() => { empleado = null })
afterEach(cleanup)

// ────────────────────────────────────────────────────────────────────────────
// El guardián de las pantallas de personal. Un fallo aquí no da error: deja
// entrar a quien no debe, y no se ve hasta que alguien anula un ticket.
// ────────────────────────────────────────────────────────────────────────────
describe('quién pasa', () => {
  it('el cocinero entra en su KDS', () => {
    abrir('cocina', COCINERO)
    expect(screen.getByText('LA PANTALLA')).toBeTruthy()
  })

  it('el cocinero NO entra en el Mostrador, donde se cobra', () => {
    abrir('camarero', COCINERO)
    expect(screen.queryByText('LA PANTALLA')).toBeNull()
  })

  it('el camarero no entra en Administración', () => {
    abrir('admin', CAMARERO)
    expect(screen.queryByText('LA PANTALLA')).toBeNull()
  })

  it('la administradora entra en Administración', () => {
    abrir('admin', JEFA)
    expect(screen.getByText('LA PANTALLA')).toBeTruthy()
  })

  it('sin nadie identificado, el teclado del PIN', () => {
    abrir('cocina', null)
    expect(screen.getByText('TECLADO DEL PIN')).toBeTruthy()
  })
})

// Volver a enseñar el teclado a quien ya ha escrito bien su PIN es decirle
// «vuelve a intentarlo»: lo teclearía tres veces antes de entenderlo.
describe('lo que ve quien no tiene permiso', () => {
  it('no es el teclado del PIN otra vez', () => {
    abrir('camarero', COCINERO)
    expect(screen.queryByText('TECLADO DEL PIN')).toBeNull()
  })

  it('le dice quién es, con qué rol, y a dónde puede ir', () => {
    abrir('camarero', COCINERO)
    const texto = document.body.textContent
    expect(texto).toMatch(/Rafa/)
    expect(texto).toMatch(/Cocina/)
    expect(screen.getByText(/Ir a Cocina/)).toBeTruthy()
    expect(screen.getByText(/Entrar con otro PIN/)).toBeTruthy()
  })
})
