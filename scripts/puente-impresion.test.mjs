import { describe, it, expect } from 'vitest'
import { leerDestinos, impresoraDe, esImpresoraWindows, enviarConReintentos, enColaDe } from './puente-impresion.mjs'

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

// Con las impresoras de verdad delante: una térmica puede estar un segundo
// ocupada y dos comandas a la vez por el mismo socket salen mezcladas.
describe('reintentos', () => {
  it('insiste cuando la impresora no contesta a la primera', async () => {
    let intentos = 0
    const enviarFn = async () => { intentos++; if (intentos < 3) throw new Error('ocupada') }
    await enviarConReintentos('192.168.1.50', Buffer.from('x'), { enviarFn, dormir: async () => {} })
    expect(intentos).toBe(3)
  })

  it('se rinde con el último error, no en silencio', async () => {
    const enviarFn = async () => { throw new Error('sin papel') }
    await expect(enviarConReintentos('x', Buffer.from('x'), { enviarFn, intentos: 2, dormir: async () => {} }))
      .rejects.toThrow('sin papel')
  })

  it('si sale a la primera no reintenta', async () => {
    let intentos = 0
    await enviarConReintentos('x', Buffer.from('x'), { enviarFn: async () => { intentos++ }, dormir: async () => {} })
    expect(intentos).toBe(1)
  })
})

describe('una cosa cada vez por impresora', () => {
  it('dos comandas a la misma impresora no se solapan', async () => {
    const orden = []
    const tarea = (id, ms) => () => new Promise(r => setTimeout(() => { orden.push(id); r(id) }, ms))
    const a = enColaDe('cocina', tarea('primera', 30))
    const b = enColaDe('cocina', tarea('segunda', 1))
    await Promise.all([a, b])
    expect(orden).toEqual(['primera', 'segunda'])   // sin cola saldría al revés
  })

  it('impresoras distintas no se esperan entre sí', async () => {
    const orden = []
    const tarea = (id, ms) => () => new Promise(r => setTimeout(() => { orden.push(id); r() }, ms))
    await Promise.all([enColaDe('cocina', tarea('lenta', 25)), enColaDe('barra', tarea('rapida', 1))])
    expect(orden).toEqual(['rapida', 'lenta'])
  })

  it('un fallo no atasca la cola de esa impresora', async () => {
    await enColaDe('caja', async () => { throw new Error('boom') }).catch(() => {})
    await expect(enColaDe('caja', async () => 'ok')).resolves.toBe('ok')
  })
})
