import { describe, it, expect, vi } from 'vitest'
import { diaLocal, clasificar, mensajePerdidos, pasada } from './vigilante.mjs'

// ────────────────────────────────────────────────────────────────────────────
// Con Verifacti, un ticket solo se registra el día que se emitió. El reintento
// existía pero solo corría «al abrir Admin»: dependía de que alguien se
// acordara justo el día que hay que acordarse. En la demo se acumularon cinco
// sin que nadie lo provocara.
// ────────────────────────────────────────────────────────────────────────────

const t = (numero, estado, cerrado, intentos = 0) => ({ id: 'id-' + numero, numero, fiscal_estado: estado, fiscal_intentos: intentos, cerrado_en: cerrado })
const HOY = '2026-08-31'
const hoyISO = (h = 14) => `2026-08-31T${String(h).padStart(2, '0')}:30:00`
const ayer = '2026-08-30T20:00:00'

describe('el día del bar', () => {
  it('es el LOCAL, no el de UTC', () => {
    // Un cierre a la 01:00 en España es el 31 aunque en UTC sea el 30
    expect(diaLocal(new Date(2026, 7, 31, 1, 0))).toBe('2026-08-31')
  })
})

describe('qué se puede salvar y qué no', () => {
  it('lo de hoy se reintenta', () => {
    const { deHoy, perdidos } = clasificar([t(1, 'error', hoyISO())], HOY)
    expect(deHoy).toHaveLength(1)
    expect(perdidos).toHaveLength(0)
  })

  it('lo de ayer ya no entra, por mucho que se insista', () => {
    const { deHoy, perdidos } = clasificar([t(2, 'error', ayer)], HOY)
    expect(deHoy).toHaveLength(0)
    expect(perdidos).toHaveLength(1)
  })

  it('lo ya enviado no se toca', () => {
    const { sinRegistrar } = clasificar([t(3, 'enviado', hoyISO())], HOY)
    expect(sinRegistrar).toHaveLength(0)
  })

  it('«pendiente» y «error» cuentan los dos', () => {
    const { sinRegistrar } = clasificar([t(1, 'pendiente', hoyISO()), t(2, 'error', hoyISO())], HOY)
    expect(sinRegistrar).toHaveLength(2)
  })

  it('un ticket que ya se intentó diez veces se deja en paz', () => {
    const { sinRegistrar } = clasificar([t(9, 'error', hoyISO(), 10)], HOY)
    expect(sinRegistrar).toHaveLength(0)
  })

  it('no se atraganta con una lista vacía o con basura', () => {
    expect(clasificar([], HOY).sinRegistrar).toHaveLength(0)
    expect(clasificar([null, undefined], HOY).sinRegistrar).toHaveLength(0)
    expect(clasificar(undefined, HOY).sinRegistrar).toHaveLength(0)
  })
})

describe('el aviso de lo que ya no tiene arreglo', () => {
  it('dice cuántos son y cuáles', () => {
    const m = mensajePerdidos([t(2, 'error', ayer), t(4, 'error', ayer)])
    expect(m).toContain('2 ticket(s)')
    expect(m).toContain('nº 2')
    expect(m).toContain('nº 4')
  })

  it('con muchos, no escupe una lista infinita', () => {
    const muchos = Array.from({ length: 9 }, (_, i) => t(i + 1, 'error', ayer))
    expect(mensajePerdidos(muchos)).toContain('y 4 más')
  })
})

describe('una pasada del vigilante', () => {
  const deps = (tickets) => ({
    listar: vi.fn(async () => tickets),
    reintentar: vi.fn(async () => {}),
    avisar: vi.fn(async () => {}),
    hoy: HOY,
  })

  it('reintenta lo de hoy y no avisa de nada', async () => {
    const d = deps([t(1, 'error', hoyISO())])
    expect(await pasada(d)).toEqual({ reintentados: 1, perdidos: 0 })
    expect(d.reintentar).toHaveBeenCalledWith([expect.objectContaining({ numero: 1 })])
    expect(d.avisar).not.toHaveBeenCalled()
  })

  it('avisa de lo de ayer y NO lo reintenta: sería insistir en vano', async () => {
    const d = deps([t(2, 'error', ayer)])
    expect(await pasada(d)).toEqual({ reintentados: 0, perdidos: 1 })
    expect(d.reintentar).not.toHaveBeenCalled()
    expect(d.avisar).toHaveBeenCalledWith(expect.stringContaining('nº 2'))
  })

  it('con las dos cosas, hace las dos', async () => {
    const d = deps([t(1, 'error', hoyISO()), t(2, 'error', ayer)])
    expect(await pasada(d)).toEqual({ reintentados: 1, perdidos: 1 })
    expect(d.reintentar).toHaveBeenCalled()
    expect(d.avisar).toHaveBeenCalled()
  })

  it('si está todo bien, no molesta a nadie', async () => {
    const d = deps([t(3, 'enviado', hoyISO())])
    expect(await pasada(d)).toEqual({ reintentados: 0, perdidos: 0 })
    expect(d.reintentar).not.toHaveBeenCalled()
    expect(d.avisar).not.toHaveBeenCalled()
  })
})
