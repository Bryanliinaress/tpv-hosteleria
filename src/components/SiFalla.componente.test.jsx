/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const registrar = vi.fn()
vi.mock('../lib/incidencias', () => ({ registrar }))

const SiFalla = (await import('./SiFalla')).default

// Un componente que se rompe al pintarse, como el que dejó la tablet en blanco.
function Explota({ error }) { throw error }

const texto = () => document.body.textContent.replace(/\s+/g, ' ')

beforeEach(() => {
  registrar.mockReset()
  // React escupe el error por consola aunque lo atrape el boundary: se calla
  // para que la salida de los tests sea legible.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

// ────────────────────────────────────────────────────────────────────────────
// La red de seguridad de la pantalla.
//
// Antes no había ninguna: un fallo de render dejaba la tablet EN BLANCO en
// mitad del servicio, sin nada que tocar. Esto prueba el componente de verdad,
// no solo el detector de «trozo que no llega».
// ────────────────────────────────────────────────────────────────────────────
describe('cuando algo se rompe', () => {
  it('lo de dentro se ve mientras NO falle nada', () => {
    render(<SiFalla><p>La carta</p></SiFalla>)
    expect(screen.getByText('La carta')).toBeTruthy()
  })

  it('un fallo de render NO deja la pantalla en blanco', () => {
    render(<SiFalla><Explota error={new TypeError('x.map is not a function')} /></SiFalla>)
    expect(texto()).toMatch(/se ha quedado atascada/i)
    expect(texto().length).toBeGreaterThan(50)
  })

  it('ofrece recargar y salir al inicio: no se queda uno encerrado', () => {
    render(<SiFalla><Explota error={new TypeError('roto')} /></SiFalla>)
    expect(screen.getByRole('button', { name: /Recargar/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Volver al inicio/ })).toBeTruthy()
  })

  it('tranquiliza sobre lo ya enviado, que es lo que preocupa en barra', () => {
    render(<SiFalla><Explota error={new TypeError('roto')} /></SiFalla>)
    expect(texto()).toMatch(/No se ha perdido nada de lo que ya estaba enviado/i)
  })

  it('deja constancia para que no dependa de que alguien llame', () => {
    render(<SiFalla><Explota error={new TypeError('roto')} /></SiFalla>)
    expect(registrar).toHaveBeenCalledWith('render', expect.any(TypeError))
  })
})

describe('cuando lo que pasa es que hay versión nueva', () => {
  const chunk = Object.assign(new Error('Failed to fetch dynamically imported module: /assets/x.js'), { name: 'ChunkLoadError' })

  it('no lo llama avería: dice que hay versión nueva', () => {
    // Recargar una pestaña vieja tras un despliegue pide ficheros que ya no
    // existen. Eso no es que se haya roto nada.
    render(<SiFalla><Explota error={chunk} /></SiFalla>)
    expect(texto()).toMatch(/versión nueva/i)
    expect(texto()).not.toMatch(/se ha quedado atascada/i)
  })

  it('y NO lo apunta como incidencia: no hay nada que arreglar', () => {
    render(<SiFalla><Explota error={chunk} /></SiFalla>)
    expect(registrar).not.toHaveBeenCalled()
  })

  it('en ese caso solo ofrece recargar, que es lo único que hace falta', () => {
    render(<SiFalla><Explota error={chunk} /></SiFalla>)
    expect(screen.getByRole('button', { name: /Recargar/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Volver al inicio/ })).toBeNull()
  })
})

describe('el detalle técnico', () => {
  it('está, pero plegado: el camarero no necesita verlo', async () => {
    const u = userEvent.setup()
    render(<SiFalla><Explota error={new TypeError('x.map is not a function')} /></SiFalla>)
    const resumen = screen.getByText(/Detalle técnico/)
    expect(resumen.closest('details').open).toBe(false)
    await u.click(resumen)
    expect(texto()).toMatch(/x\.map is not a function/)
  })
})
