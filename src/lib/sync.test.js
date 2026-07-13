import { describe, it, expect } from 'vitest'
import { mergeLog, tsRegistro } from './sync'

describe('mergeLog (fusión de logs solo-añadir al sincronizar)', () => {
  it('conserva los registros locales recientes que el remoto no tiene', () => {
    const ahora = Date.now()
    const local = [{ id: `fj${ahora}`, nombre: 'María' }]      // recién creado aquí
    const remoto = [{ id: 'fj1000', nombre: 'Juan' }]           // estado de otro dispositivo
    const res = mergeLog(local, remoto)
    expect(res.map(x => x.id)).toEqual(['fj1000', `fj${ahora}`])
  })

  it('el remoto gana en los ids compartidos (p. ej. una corrección del admin)', () => {
    const ahora = Date.now()
    const local = [{ id: `fj${ahora}`, salida: null }]
    const remoto = [{ id: `fj${ahora}`, salida: '2026-07-09T18:00:00Z' }]
    const res = mergeLog(local, remoto)
    expect(res).toHaveLength(1)
    expect(res[0].salida).toBe('2026-07-09T18:00:00Z')
  })

  it('no resucita registros locales antiguos (p. ej. borrados en otro dispositivo)', () => {
    const viejo = Date.now() - 10 * 60000 // hace 10 min: si el remoto no lo tiene, es que se borró
    const local = [{ id: `fj${viejo}`, nombre: 'Viejo' }]
    expect(mergeLog(local, [])).toEqual([])
  })

  it('tsRegistro saca la marca de tiempo del id', () => {
    expect(tsRegistro({ id: 'fj1751980000000' })).toBe(1751980000000)
    expect(tsRegistro({ id: 'sin-numero' })).toBe(0)
  })
})
