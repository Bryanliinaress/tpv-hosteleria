import { describe, it, expect, vi } from 'vitest'
import { pitar, vibrar, avisar, hayNuevos, claveDe } from './aviso'

// ────────────────────────────────────────────────────────────────────────────
// El aviso de que ha entrado algo nuevo.
//
// El KDS cuelga de una pared con el cocinero de espaldas, en la plancha: una
// comanda que solo «aparece» puede estar minutos sin que nadie la vea. Hasta la
// v0.108.0 solo avisaba la PDA — la pantalla que ya lleva encima quien puede
// mirarla.
// ────────────────────────────────────────────────────────────────────────────

// Un AudioContext de mentira que apunta lo que se le pide.
function ctxFalso() {
  const notas = []
  class Ctx {
    constructor() { this.currentTime = 0; this.destination = {} }
    createOscillator() { const o = { frequency: {}, connect() {}, start(t) { notas.push(t ?? 0) }, stop() {} }; return o }
    createGain() { return { gain: {}, connect() {} } }
  }
  return { Ctx, notas }
}

describe('el pitido', () => {
  it('suena una vez por defecto', () => {
    const { Ctx, notas } = ctxFalso()
    expect(pitar({ ctxFn: Ctx })).toBe(true)
    expect(notas).toHaveLength(1)
  })

  it('puede insistir: en una cocina un solo pip se pierde', () => {
    const { Ctx, notas } = ctxFalso()
    pitar({ veces: 3, ctxFn: Ctx })
    expect(notas).toHaveLength(3)
    expect(notas[1]).toBeGreaterThan(notas[0])   // separados en el tiempo
  })

  // El navegador bloquea el audio hasta que alguien toca la pantalla, y una
  // tablet colgada lleva horas sin que nadie la roce. No puede reventar: el
  // aviso visual va aparte y no depende de esto.
  it('si el navegador no deja sonar, no revienta', () => {
    const Ctx = function () { throw new Error('bloqueado por el navegador') }
    expect(pitar({ ctxFn: Ctx })).toBe(false)
  })

  it('sin AudioContext tampoco', () => {
    expect(pitar({ ctxFn: null })).toBe(false)
  })
})

describe('la vibración', () => {
  it('vibra si el aparato puede', () => {
    const antes = navigator.vibrate
    navigator.vibrate = vi.fn(() => true)
    expect(vibrar()).toBe(true)
    navigator.vibrate = antes
  })

  it('una tablet colgada no vibra, y da igual', () => {
    const antes = navigator.vibrate
    delete navigator.vibrate
    expect(vibrar()).toBe(false)
    navigator.vibrate = antes
  })
})

describe('avisar', () => {
  it('dice si llegó a sonar', () => {
    const { Ctx } = ctxFalso()
    expect(avisar({ ctxFn: Ctx })).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Se compara por id y NO por cuántos hay: si entra una comanda y se sirve otra
// a la vez, el total no cambia y el aviso no sonaría.
// ────────────────────────────────────────────────────────────────────────────
describe('¿ha entrado algo nuevo?', () => {
  it('sí, si aparece un id que no estaba', () => {
    expect(hayNuevos('a|b', 'a|b|c')).toBe(true)
  })

  it('no, si es lo mismo', () => {
    expect(hayNuevos('a|b', 'a|b')).toBe(false)
  })

  it('no, si solo se ha ido uno', () => {
    expect(hayNuevos('a|b|c', 'a|b')).toBe(false)
  })

  it('SÍ cuando entra uno y sale otro a la vez (el total no cambia)', () => {
    expect(hayNuevos('a|b', 'b|c')).toBe(true)
  })

  it('la primera vez no avisa de lo que ya estaba en pantalla', () => {
    expect(hayNuevos(null, 'a|b|c')).toBe(false)
  })

  it('de vacío a algo, sí avisa', () => {
    expect(hayNuevos('', 'a')).toBe(true)
  })
})

describe('la clave de una lista de pedidos', () => {
  it('no depende del orden en que lleguen', () => {
    expect(claveDe([{ id: 'b' }, { id: 'a' }])).toBe(claveDe([{ id: 'a' }, { id: 'b' }]))
  })

  it('aguanta una lista vacía o a medias', () => {
    expect(claveDe([])).toBe('')
    expect(claveDe()).toBe('')
    expect(claveDe([{ id: 'a' }, {}, null])).toBe('a')
  })
})
