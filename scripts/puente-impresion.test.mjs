import { describe, it, expect } from 'vitest'
import { leerDestinos, impresoraDe, esImpresoraWindows } from './puente-impresion.mjs'

// ────────────────────────────────────────────────────────────────────────────
// Reparto de comandas entre varias impresoras. Un fallo aquí manda las cañas a
// la plancha y los montaditos a la barra.
// ────────────────────────────────────────────────────────────────────────────

describe('leerDestinos', () => {
  it('con una sola impresora, todo sale por ella', () => {
    const d = leerDestinos({ IMPRESORA: '192.168.1.50' })
    expect(impresoraDe(d, 'cocina')).toBe('192.168.1.50')
    expect(impresoraDe(d, 'barra')).toBe('192.168.1.50')
    expect(impresoraDe(d, 'caja')).toBe('192.168.1.50')
  })

  it('con una por destino, cada cosa a la suya', () => {
    const d = leerDestinos({ IMPRESORA_COCINA: '192.168.1.50', IMPRESORA_BARRA: '192.168.1.51' })
    expect(impresoraDe(d, 'cocina')).toBe('192.168.1.50')
    expect(impresoraDe(d, 'barra')).toBe('192.168.1.51')
  })

  it('un destino sin impresora cae en la de defecto, no se pierde', () => {
    const d = leerDestinos({ IMPRESORA_COCINA: '192.168.1.50', IMPRESORA: '192.168.1.99' })
    expect(impresoraDe(d, 'caja')).toBe('192.168.1.99')
    expect(impresoraDe(d, 'destino-que-no-existe')).toBe('192.168.1.99')
  })

  it('sin `IMPRESORA`, la primera configurada hace de red de seguridad', () => {
    const d = leerDestinos({ IMPRESORA_BARRA: '192.168.1.51' })
    expect(impresoraDe(d, 'cocina')).toBe('192.168.1.51')
  })

  it('sin nada configurado, no revienta', () => {
    expect(impresoraDe(leerDestinos({}), 'cocina')).toBeTruthy()
  })
})

describe('esImpresoraWindows', () => {
  it('reconoce una impresora compartida de Windows', () => {
    expect(esImpresoraWindows('\\\\localhost\\TM-T20')).toBe(true)
    expect(esImpresoraWindows('\\\\PC-BARRA\\Cocina')).toBe(true)
  })

  it('una IP no es una impresora de Windows', () => {
    expect(esImpresoraWindows('192.168.1.50')).toBe(false)
    expect(esImpresoraWindows('192.168.1.50:9100')).toBe(false)
    expect(esImpresoraWindows(undefined)).toBe(false)
  })
})

describe('dos impresoras USB en el mismo PC', () => {
  it('se reparten por nombre compartido de Windows', () => {
    const d = leerDestinos({
      IMPRESORA_COCINA: '\\\\localhost\\Cocina',
      IMPRESORA_BARRA: '\\\\localhost\\Barra',
    })
    expect(impresoraDe(d, 'cocina')).toBe('\\\\localhost\\Cocina')
    expect(impresoraDe(d, 'barra')).toBe('\\\\localhost\\Barra')
    expect(esImpresoraWindows(impresoraDe(d, 'cocina'))).toBe(true)
  })

  it('se puede mezclar una de red y una USB', () => {
    const d = leerDestinos({ IMPRESORA_COCINA: '192.168.1.50', IMPRESORA_BARRA: '\\\\localhost\\Barra' })
    expect(esImpresoraWindows(impresoraDe(d, 'cocina'))).toBe(false)
    expect(esImpresoraWindows(impresoraDe(d, 'barra'))).toBe(true)
  })
})
