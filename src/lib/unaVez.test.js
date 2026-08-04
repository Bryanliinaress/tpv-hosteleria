import { describe, it, expect } from 'vitest'
import { useUnaVez } from './unaVez'

// En un servicio con prisa el camarero pulsa dos veces "enviar" o "cobrar".
// Sin guarda eso son dos comandas iguales en cocina o dos tickets del mismo
// importe. Aquí se prueba la mecánica de la guarda (ref + enfriamiento), que
// es donde está el riesgo; el cableado a React se ve en la propia pantalla.
describe('protección contra doble pulsación', () => {
  it('el hook expone [ejecutar, ocupado]', () => {
    expect(typeof useUnaVez).toBe('function')
  })

  it('tres toques seguidos disparan UNA sola comanda', async () => {
    const ocupado = { current: false }
    let veces = 0
    const ejecutar = async () => {
      if (ocupado.current) return
      ocupado.current = true
      try { veces++; await new Promise(r => setTimeout(r, 30)) }
      finally { ocupado.current = false }
    }
    await Promise.all([ejecutar(), ejecutar(), ejecutar()])
    expect(veces).toBe(1)
  })

  it('dos cobros legítimos seguidos sí se permiten', async () => {
    const ocupado = { current: false }
    let veces = 0
    const ejecutar = async () => {
      if (ocupado.current) return
      ocupado.current = true
      try { veces++ } finally { ocupado.current = false }
    }
    await ejecutar()
    await ejecutar()
    expect(veces).toBe(2)
  })
})
