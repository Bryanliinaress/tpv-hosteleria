import { describe, it, expect } from 'vitest'
import { efectivoEsperado, saldoMovimientos, descuadreDe, movimientosDesde, revisarMovimiento } from './caja'

// ────────────────────────────────────────────────────────────────────────────
// El arqueo de caja. Antes esperaba «ventas en efectivo + propinas en metálico»
// y nada más: con un fondo de 150 € el cierre cantaba «sobran 150 €» TODOS los
// días. Un descuadre que siempre dice lo mismo se deja de mirar a la semana, y
// entonces el día que de verdad falta dinero tampoco se ve.
// ────────────────────────────────────────────────────────────────────────────

const mov = (tipo, importe, motivo = 'x') => ({ tipo, importe, motivo })

describe('lo que suman los movimientos', () => {
  it('las entradas suman y las salidas restan', () => {
    expect(saldoMovimientos([mov('entrada', 50), mov('salida', 20)])).toBe(30)
  })

  it('sin movimientos, cero', () => {
    expect(saldoMovimientos([])).toBe(0)
    expect(saldoMovimientos()).toBe(0)
  })

  it('puede quedar en negativo: se sacó más de lo que entró', () => {
    expect(saldoMovimientos([mov('salida', 80), mov('entrada', 30)])).toBe(-50)
  })

  it('no se atraganta con un importe raro', () => {
    expect(saldoMovimientos([mov('entrada', 'ochenta'), mov('salida', 10)])).toBe(-10)
  })
})

describe('el efectivo que debería haber en el cajón', () => {
  it('cuenta el fondo de cambio: está ahí cuando se cuenta', () => {
    expect(efectivoEsperado({ fondo: 150, ventasEfectivo: 80 })).toBe(230)
  })

  it('las propinas en metálico también están en el cajón', () => {
    expect(efectivoEsperado({ fondo: 150, ventasEfectivo: 80, propinasEfectivo: 12.5 })).toBe(242.5)
  })

  it('resta lo que se sacó para pagar al proveedor', () => {
    expect(efectivoEsperado({
      fondo: 150, ventasEfectivo: 80,
      movimientos: [mov('salida', 45, 'pan')],
    })).toBe(185)
  })

  it('y suma el cambio que se metió a media tarde', () => {
    expect(efectivoEsperado({
      fondo: 150, ventasEfectivo: 80,
      movimientos: [mov('entrada', 20, 'cambio'), mov('salida', 45, 'pan')],
    })).toBe(205)
  })

  it('sin fondo configurado se comporta como antes', () => {
    expect(efectivoEsperado({ ventasEfectivo: 80, propinasEfectivo: 5 })).toBe(85)
  })

  it('no arrastra decimales de coma flotante', () => {
    expect(efectivoEsperado({ fondo: 0.1, ventasEfectivo: 0.2 })).toBe(0.3)
  })
})

describe('el descuadre', () => {
  it('sin contar el cajón no hay descuadre que enseñar', () => {
    expect(descuadreDe(null, 230)).toBeNull()
  })

  it('cuadrado es cero, no «sobran 150»', () => {
    const esperado = efectivoEsperado({ fondo: 150, ventasEfectivo: 80 })
    expect(descuadreDe(230, esperado)).toBe(0)
  })

  it('si falta dinero sale en negativo', () => {
    expect(descuadreDe(220, 230)).toBe(-10)
  })
})

describe('qué movimientos son de la caja abierta', () => {
  const movs = [
    { tipo: 'salida', importe: 10, creadoEn: '2026-08-30T10:00:00.000Z' },
    { tipo: 'entrada', importe: 20, creadoEn: '2026-08-31T10:00:00.000Z' },
  ]

  it('solo los posteriores al último cierre', () => {
    expect(movimientosDesde(movs, '2026-08-30T23:00:00.000Z')).toHaveLength(1)
  })

  it('sin cierres previos, todos', () => {
    expect(movimientosDesde(movs, null)).toHaveLength(2)
  })
})

describe('apuntar un movimiento', () => {
  it('exige decir si entra o sale', () => {
    expect(revisarMovimiento({ importe: 10, motivo: 'x' }).ok).toBe(false)
  })

  it('exige un importe mayor que cero', () => {
    expect(revisarMovimiento({ tipo: 'salida', importe: 0, motivo: 'x' }).ok).toBe(false)
    expect(revisarMovimiento({ tipo: 'salida', importe: -5, motivo: 'x' }).ok).toBe(false)
  })

  // Un movimiento sin motivo es dinero que desapareció sin explicación: dentro
  // de un mes nadie se acuerda de por qué faltaban 40 €.
  it('exige un motivo', () => {
    expect(revisarMovimiento({ tipo: 'salida', importe: 40, motivo: '   ' }).ok).toBe(false)
  })

  it('acepta el importe con coma, que es como se teclea aquí', () => {
    expect(revisarMovimiento({ tipo: 'salida', importe: '12,50', motivo: 'pan' }))
      .toEqual({ ok: true, tipo: 'salida', importe: 12.5, motivo: 'pan' })
  })

  it('recorta el motivo', () => {
    expect(revisarMovimiento({ tipo: 'entrada', importe: 20, motivo: '  cambio  ' }).motivo).toBe('cambio')
  })
})
