import { describe, it, expect } from 'vitest'
import { revisarCorreccionFichaje } from './fichajes'

// Las correcciones de fichaje van directas a la nómina. La validación estaba
// solo en la demo: en la app real se podía guardar una salida anterior a la
// entrada (horas negativas) y la pantalla cantaba un error falso.
const FICHAJE = { id: 'f1', nombre: 'Ana', entrada: '2026-08-10T09:00:00.000Z', salida: '2026-08-10T17:00:00.000Z' }

describe('corregir un fichaje', () => {
  it('acepta una corrección normal', () => {
    const r = revisarCorreccionFichaje(FICHAJE, { salida: '2026-08-10T18:00:00.000Z' })
    expect(r).toMatchObject({ ok: true, entrada: FICHAJE.entrada, salida: '2026-08-10T18:00:00.000Z' })
  })

  it('no deja salir antes de entrar', () => {
    const r = revisarCorreccionFichaje(FICHAJE, { salida: '2026-08-10T08:00:00.000Z' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/anterior a la entrada/i)
  })

  it('la entrada es obligatoria', () => {
    expect(revisarCorreccionFichaje(FICHAJE, { entrada: '' }).ok).toBe(false)
    expect(revisarCorreccionFichaje(FICHAJE, { entrada: null }).ok).toBe(false)
  })

  it('rechaza fechas imposibles en vez de guardarlas', () => {
    expect(revisarCorreccionFichaje(FICHAJE, { entrada: 'el martes' }).ok).toBe(false)
    expect(revisarCorreccionFichaje(FICHAJE, { salida: 'a las tantas' }).ok).toBe(false)
  })

  it('reabrir un turno (salida null) es válido', () => {
    const r = revisarCorreccionFichaje(FICHAJE, { salida: null })
    expect(r).toMatchObject({ ok: true, salida: null })
  })

  it('un fichaje que no existe se rechaza sin romper', () => {
    expect(revisarCorreccionFichaje(null, {}).ok).toBe(false)
    expect(revisarCorreccionFichaje(undefined, { salida: 'x' }).error).toBeTruthy()
  })

  it('sin cambios, deja el fichaje como estaba', () => {
    expect(revisarCorreccionFichaje(FICHAJE)).toMatchObject({ ok: true, entrada: FICHAJE.entrada, salida: FICHAJE.salida })
  })
})
