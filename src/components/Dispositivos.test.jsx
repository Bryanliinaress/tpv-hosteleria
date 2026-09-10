/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

// El servidor y los diálogos se sustituyen: aquí se prueba QUÉ ve el encargado
// en la lista y QUÉ se le manda al servidor al renombrar.
const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a) } }))
vi.mock('../lib/repo', () => ({ backendV2: true }))
let respuestas = []
vi.mock('../store/useUI', () => ({
  toast: vi.fn(),
  confirmar: vi.fn(async () => true),
  pedirTexto: vi.fn(async () => respuestas.shift()),
}))

const { useStore } = await import('../store/useStore')
const Dispositivos = (await import('./Dispositivos')).default

const APARATOS = [
  { id: 'd1', nombre: 'Tablet', estado: 'aprobado', aprobado_en: '2026-09-01T10:00:00Z', ultimo_uso: '2026-09-08T09:00:00Z', ultima_pantalla: 'cocina' },
  { id: 'd2', nombre: 'Tablet', estado: 'aprobado', aprobado_en: '2026-09-01T10:00:00Z', ultimo_uso: null, ultima_pantalla: null },
]

beforeEach(() => {
  respuestas = []
  useStore.setState({ empleados: [
    { id: 'e1', nombre: 'María', rol: 'camarero', activo: true },
    { id: 'e2', nombre: 'Rafa', rol: 'cocina', activo: false },
  ] })
  rpc.mockReset()
  rpc.mockImplementation((fn) => fn === 'dispositivos_del_local'
    ? Promise.resolve({ data: APARATOS, error: null })
    : Promise.resolve({ error: null }))
})
afterEach(cleanup)

// ────────────────────────────────────────────────────────────────────────────
// Con cuatro tablets iguales llamadas «Tablet», el encargado que va a quitarle
// el acceso a una no sabe cuál es. Y quitárselo a la de cocina en mitad de un
// servicio se nota.
// ────────────────────────────────────────────────────────────────────────────
describe('para qué se usa cada aparato', () => {
  it('dice en qué pantalla se usa', async () => {
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByText('Tablet')).toHaveLength(2))
    expect(document.body.textContent).toMatch(/Se usa en\s*Cocina/)
  })

  it('y no se inventa una pantalla para el que no ha entrado nunca', async () => {
    render(<Dispositivos />)
    await waitFor(() => expect(document.body.textContent).toMatch(/Sin usar todavía/))
  })
})

describe('renombrar un aparato', () => {
  it('manda el nombre nuevo y el PIN al servidor', async () => {
    respuestas = ['Tablet de cocina', '1234']   // nombre, y luego el PIN
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByTitle('Cambiar el nombre').length).toBe(2))
    screen.getAllByTitle('Cambiar el nombre')[0].click()

    await waitFor(() => expect(rpc.mock.calls.some(c => c[0] === 'renombrar_dispositivo')).toBe(true))
    const [, args] = rpc.mock.calls.find(c => c[0] === 'renombrar_dispositivo')
    expect(args).toEqual({ p_id: 'd1', p_nombre: 'Tablet de cocina', p_pin: '1234' })
  })

  // El PIN lo comprueba el SERVIDOR; renombrar sin él no debe ni salir.
  it('sin PIN no se manda nada', async () => {
    respuestas = ['Tablet de cocina', '']
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByTitle('Cambiar el nombre').length).toBe(2))
    screen.getAllByTitle('Cambiar el nombre')[0].click()

    await new Promise(r => setTimeout(r, 20))
    expect(rpc.mock.calls.some(c => c[0] === 'renombrar_dispositivo')).toBe(false)
  })

  it('dejarle el mismo nombre no molesta al servidor', async () => {
    respuestas = ['Tablet']
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByTitle('Cambiar el nombre').length).toBe(2))
    screen.getAllByTitle('Cambiar el nombre')[0].click()

    await new Promise(r => setTimeout(r, 20))
    expect(rpc.mock.calls.some(c => c[0] === 'renombrar_dispositivo')).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// De quién es cada aparato. Con cuatro tablets iguales, saber a quién le
// quitas el acceso al revocar una es la diferencia entre hacerlo tranquilo y
// dejar a alguien tirado en mitad de un servicio.
// ────────────────────────────────────────────────────────────────────────────
describe('vincular un aparato a una persona', () => {
  const selectorDe = (i) => screen.getAllByRole('combobox')[i]

  it('ofrece la plantilla, incluidos los que no están de turno', async () => {
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(2))
    const opciones = [...selectorDe(0).options].map(o => o.textContent)
    expect(opciones).toEqual(['nadie en concreto', 'María', 'Rafa (sin turno)'])
  })

  it('manda al servidor el aparato, la persona y el PIN', async () => {
    respuestas = ['1234']
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(2))
    fireEvent.change(selectorDe(0), { target: { value: 'e1' } })

    await waitFor(() => expect(rpc.mock.calls.some(c => c[0] === 'asignar_dispositivo')).toBe(true))
    const [, args] = rpc.mock.calls.find(c => c[0] === 'asignar_dispositivo')
    expect(args).toEqual({ p_id: 'd1', p_empleado: 'e1', p_pin: '1234' })
  })

  // Un aparato fijo de la barra no es de nadie en particular: «sin asignar» es
  // una respuesta válida, no un hueco por rellenar.
  it('se puede dejar sin asignar', async () => {
    respuestas = ['1234']
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(2))
    fireEvent.change(selectorDe(0), { target: { value: '' } })

    await waitFor(() => expect(rpc.mock.calls.some(c => c[0] === 'asignar_dispositivo')).toBe(true))
    const [, args] = rpc.mock.calls.find(c => c[0] === 'asignar_dispositivo')
    expect(args.p_empleado).toBeNull()
  })

  it('sin PIN no se manda nada: lo comprueba el servidor', async () => {
    respuestas = ['']
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(2))
    fireEvent.change(selectorDe(0), { target: { value: 'e1' } })

    await new Promise(r => setTimeout(r, 20))
    expect(rpc.mock.calls.some(c => c[0] === 'asignar_dispositivo')).toBe(false)
  })

  // Que el aparato sea de María no le da los permisos de María: quien entra
  // sigue siendo quien teclea el PIN.
  it('la pantalla dice que esto no da permisos', async () => {
    render(<Dispositivos />)
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(2))
    expect(document.body.textContent).toMatch(/no le da los permisos de esa persona/i)
  })
})
