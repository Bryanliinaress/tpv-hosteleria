import { describe, it, expect } from 'vitest'
import { mergeLog, tsRegistro, CLAVES_SYNC, hayCambioQueEmpujar } from './sync'

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

describe('mergeLog con los ids nuevos (con sufijo aleatorio)', () => {
  it('conserva un fichaje recién creado aunque su id no sea un número', () => {
    const ahora = Date.now()
    // id nuevo: prefijo + base36 + aleatorio. La hora va en `_ts`.
    const local = [{ id: 'fjmfq3k8x9abc', _ts: ahora, nombre: 'María' }]
    const remoto = [{ id: 'fj1000', nombre: 'Juan' }]
    expect(mergeLog(local, remoto).map(x => x.nombre)).toEqual(['Juan', 'María'])
  })

  it('un ticket recién cobrado no se pierde al llegar el estado de otro dispositivo', () => {
    const local = [{ id: 't3-mfq3k8x9abc', _ts: Date.now(), total: 42 }]
    expect(mergeLog(local, []).map(t => t.total)).toEqual([42])
  })

  it('sigue sin resucitar lo viejo', () => {
    const local = [{ id: 'fjmfq3k8x9abc', _ts: Date.now() - 10 * 60000 }]
    expect(mergeLog(local, [])).toEqual([])
  })
})

describe('el fallo que esto evita', () => {
  it('sin `_ts`, un id con sufijo aleatorio se daba por antiguo y se perdía', () => {
    // Así quedaban los registros al cambiar los ids a base36: `tsRegistro`
    // buscaba dígitos en el id y encontraba basura (o nada).
    const sinSello = { id: 'fjmfq3k8x9abc', nombre: 'María' }
    expect(tsRegistro(sinSello)).toBeLessThan(Date.now() - 90000)
    expect(mergeLog([sinSello], [])).toEqual([])
  })
})

// La lista de lo que se envía y la de lo que se vigila estaban duplicadas y se
// habían desincronizado: `reservasConfig` se enviaba pero no se vigilaba, así
// que cambiar los turnos o los días de cierre no llegaba a los demás
// dispositivos hasta que se tocara cualquier otra cosa.
describe('qué dispara una sincronización', () => {
  const base = Object.fromEntries(CLAVES_SYNC.map(k => [k, { valor: k }]))

  it('cambiar cualquier dato compartido la dispara', () => {
    for (const k of CLAVES_SYNC) {
      const nuevo = { ...base, [k]: { valor: 'otro' } }
      expect(hayCambioQueEmpujar(nuevo, base), `no se vigila «${k}»`).toBe(true)
    }
  })

  it('la configuración de reservas cuenta como cambio', () => {
    const nuevo = { ...base, reservasConfig: { diasCerrados: [1] } }
    expect(hayCambioQueEmpujar(nuevo, base)).toBe(true)
  })

  it('sin cambios no se escribe nada', () => {
    expect(hayCambioQueEmpujar(base, base)).toBe(false)
    expect(hayCambioQueEmpujar({ ...base, algoQueNoSeComparte: 1 }, base)).toBe(false)
  })
})
