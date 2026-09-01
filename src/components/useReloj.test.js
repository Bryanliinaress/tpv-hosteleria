/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReloj } from './useReloj'

// ────────────────────────────────────────────────────────────────────────────
// El KDS cuelga de una pared. Si no llega nada ni nadie lo toca, no hay nada
// que provoque un repintado: el reloj y los «hace 4 min» de cada comanda se
// quedan congelados en la hora del último cambio.
//
// Medido el 31/08 con el KDS abierto y sin actividad: la pantalla marcaba 11:48
// cuando el reloj real iba por las 11:50:36. Un cocinero usa ese número para
// decidir a qué mesa atiende primero.
// ────────────────────────────────────────────────────────────────────────────
afterEach(() => vi.useRealTimers())

describe('el reloj de las pantallas que nadie toca', () => {
  it('se actualiza solo aunque no pase nada', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useReloj(10000))
    const antes = result.current
    act(() => { vi.advanceTimersByTime(10001) })
    expect(result.current).toBeGreaterThan(antes)
  })

  it('sigue latiendo, no solo la primera vez', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useReloj(1000))
    const t0 = result.current
    act(() => { vi.advanceTimersByTime(1001) })
    const t1 = result.current
    act(() => { vi.advanceTimersByTime(1001) })
    expect(t1).toBeGreaterThan(t0)
    expect(result.current).toBeGreaterThan(t1)
  })

  // Un intervalo que sobrevive al desmontaje sigue repintando una pantalla que
  // ya no existe.
  it('se apaga al salir de la pantalla', () => {
    vi.useFakeTimers()
    const limpiar = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderHook(() => useReloj(1000))
    unmount()
    expect(limpiar).toHaveBeenCalled()
    limpiar.mockRestore()
  })
})
