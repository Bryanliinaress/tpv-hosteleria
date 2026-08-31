import { describe, it, expect } from 'vitest'
import { revisarCorreccionFichaje, revisarNuevoFichaje, nombreDeFichaje, conNombre } from './fichajes'

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

// ────────────────────────────────────────────────────────────────────────────
// De quién es cada jornada.
//
// En v1 el fichaje guarda el nombre dentro; en v2 solo viaja `empleadoId`. Sin
// resolverlo, la app real enseñaba «👤 undefined» en cada línea y —lo grave—
// sumaba las horas de TODOS bajo esa clave: el resumen por empleado, que es el
// número que va a la nómina, salía mezclado en un solo total.
// ────────────────────────────────────────────────────────────────────────────
const PLANTILLA = [
  { id: 'e1', nombre: 'María' },
  { id: 'e2', nombre: 'Juan' },
]

describe('de quién es un fichaje', () => {
  it('lo resuelve por empleadoId cuando no trae nombre (v2)', () => {
    expect(nombreDeFichaje({ empleadoId: 'e2' }, PLANTILLA)).toBe('Juan')
  })

  it('respeta el nombre que ya venga dentro (v1)', () => {
    expect(nombreDeFichaje({ empleadoId: 'e2', nombre: 'Juanito' }, PLANTILLA)).toBe('Juanito')
  })

  it('de un empleado que ya no está, no dice «undefined»', () => {
    expect(nombreDeFichaje({ empleadoId: 'se-fue' }, PLANTILLA)).toBe('Sin asignar')
    expect(nombreDeFichaje({}, PLANTILLA)).toBe('Sin asignar')
  })

  it('las horas NO se mezclan entre empleados', () => {
    const fichajes = [
      { id: 'a', empleadoId: 'e1', entrada: '2026-08-10T09:00:00.000Z', salida: '2026-08-10T14:00:00.000Z' },
      { id: 'b', empleadoId: 'e2', entrada: '2026-08-10T13:00:00.000Z', salida: '2026-08-10T17:00:00.000Z' },
    ]
    const nombres = conNombre(fichajes, PLANTILLA).map(f => f.nombre)
    expect(nombres).toEqual(['María', 'Juan'])
    expect(new Set(nombres).size).toBe(2)   // antes las dos caían en `undefined`
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Añadir una jornada que nadie fichó. Se podían corregir fichajes pero no
// crearlos: si alguien olvidaba fichar la entrada del todo, esa jornada no
// existía para el registro y no había manera de meterla.
// ────────────────────────────────────────────────────────────────────────────
describe('añadir una jornada a mano', () => {
  const ok = { empleadoId: 'e1', entrada: '2026-08-10T09:00:00.000Z', salida: '2026-08-10T17:00:00.000Z' }

  it('acepta una jornada completa', () => {
    expect(revisarNuevoFichaje(ok, PLANTILLA)).toEqual({
      ok: true, entrada: ok.entrada, salida: ok.salida,
    })
  })

  it('deja dejar el turno abierto', () => {
    const r = revisarNuevoFichaje({ ...ok, salida: null }, PLANTILLA)
    expect(r.ok).toBe(true)
    expect(r.salida).toBeNull()
  })

  it('exige decir de quién es', () => {
    expect(revisarNuevoFichaje({ ...ok, empleadoId: '' }, PLANTILLA).ok).toBe(false)
  })

  it('no acepta a alguien que no está en la plantilla', () => {
    const r = revisarNuevoFichaje({ ...ok, empleadoId: 'fantasma' }, PLANTILLA)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/plantilla/)
  })

  it('la entrada es obligatoria', () => {
    expect(revisarNuevoFichaje({ ...ok, entrada: null }, PLANTILLA).ok).toBe(false)
  })

  it('la salida no puede ir antes que la entrada', () => {
    const r = revisarNuevoFichaje({ ...ok, salida: '2026-08-10T08:00:00.000Z' }, PLANTILLA)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/anterior/)
  })

  it('ni una fecha inventada', () => {
    expect(revisarNuevoFichaje({ ...ok, entrada: 'el martes' }, PLANTILLA).ok).toBe(false)
  })
})
