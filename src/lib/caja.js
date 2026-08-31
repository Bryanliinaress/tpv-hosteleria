import { cent } from './dinero.js'

// ────────────────────────────────────────────────────────────────────────────
// Cuánto dinero DEBERÍA haber en el cajón.
//
// Se calculaba como «ventas en efectivo + propinas en metálico», y por un cajón
// pasa mucho más que eso en un día normal:
//
//   · el FONDO de cambio con el que se abre —150 € en suelto que están ahí
//     desde antes de la primera venta y siguen ahí al cerrar—,
//   · lo que se SACA para pagar al del pan o para llevar al banco,
//   · lo que se METE cuando se acaba el cambio.
//
// Sin eso, lo que la pantalla llamaba «descuadre» era la diferencia entre lo
// contado y una cuenta incompleta: salía «sobran 150 €» cada día. Un control de
// caja que siempre canta lo mismo se deja de mirar a la semana — y es peor que
// no tenerlo, porque parece que lo tienes.
//
// Vive aquí y no en cada pantalla porque lo usan tres: el arqueo que se ve en
// Admin, el cierre de la demo y el cierre contra el servidor. Escrito tres
// veces, dos acabarían diciendo otra cosa.
// ────────────────────────────────────────────────────────────────────────────

/** Lo que suman los movimientos: las salidas restan. */
export const saldoMovimientos = (movimientos = []) =>
  cent((movimientos || []).reduce(
    (s, m) => s + (m?.tipo === 'salida' ? -1 : 1) * (Number(m?.importe) || 0), 0))

/**
 * El efectivo que tiene que aparecer al contar el cajón.
 *
 * `fondo` es el cambio con el que se abre y que no se retira al cerrar: entra
 * en la cuenta porque está físicamente ahí cuando el encargado cuenta.
 */
export function efectivoEsperado({ fondo = 0, ventasEfectivo = 0, propinasEfectivo = 0, movimientos = [] } = {}) {
  return cent(
    (Number(fondo) || 0) +
    (Number(ventasEfectivo) || 0) +
    (Number(propinasEfectivo) || 0) +
    saldoMovimientos(movimientos))
}

/** Lo contado menos lo esperado. `null` si no se contó (contar es opcional). */
export const descuadreDe = (contado, esperado) =>
  contado == null ? null : cent(Number(contado) - Number(esperado))

/** Los movimientos de la caja abierta: los posteriores al último cierre. */
export const movimientosDesde = (movimientos = [], desde = null) =>
  (movimientos || []).filter(m => !desde || new Date(m.creadoEn ?? m.creado_en) > new Date(desde))

/** Comprueba un movimiento antes de apuntarlo. Devuelve { ok, error } o { ok, ... }. */
export function revisarMovimiento({ tipo, importe, motivo } = {}) {
  if (tipo !== 'entrada' && tipo !== 'salida') return { ok: false, error: 'Di si el dinero entra o sale' }
  const n = Number(String(importe ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'El importe tiene que ser mayor que cero' }
  // Un movimiento sin motivo es dinero que desapareció del cajón sin explicación:
  // dentro de un mes nadie se acuerda de por qué faltaban 40 €.
  const m = String(motivo ?? '').trim()
  if (!m) return { ok: false, error: 'Escribe para qué es' }
  return { ok: true, tipo, importe: cent(n), motivo: m }
}
