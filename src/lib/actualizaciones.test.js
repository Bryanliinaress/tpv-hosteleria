import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useActualizacion, registrarActualizaciones } from './actualizaciones'

// ────────────────────────────────────────────────────────────────────────────
// Un TPV se queda abierto días: si nadie pregunta si hay versión nueva, un
// arreglo desplegado no llega nunca al bar.
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => useActualizacion.setState({ hayNueva: false, aplicar: () => {} }))

describe('aviso de versión nueva', () => {
  it('arranca sin avisar de nada', () => {
    expect(useActualizacion.getState().hayNueva).toBe(false)
  })

  it('al detectar versión nueva, se marca y se guarda cómo aplicarla', () => {
    const aplicar = vi.fn()
    useActualizacion.getState()._marcar(aplicar)

    expect(useActualizacion.getState().hayNueva).toBe(true)
    useActualizacion.getState().aplicar()
    expect(aplicar).toHaveBeenCalledOnce()
  })

  it('sin service worker (dev o tests) no revienta ni avisa', async () => {
    expect(await registrarActualizaciones()).toBeNull()
    expect(useActualizacion.getState().hayNueva).toBe(false)
  })
})
