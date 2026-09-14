// ────────────────────────────────────────────────────────────────────────────
// Lo que se empieza y no se termina, no desaparece.
//
// · Una mesa cerrada SIN COBRAR queda como cuenta anulada: lo que se pidió, el
//   importe, el motivo y quién la cerró. La ley antifraude (11/2021) prohíbe
//   que un TPV permita hacer desaparecer ventas, y además es la pregunta que
//   se hace un encargado el lunes: «¿qué pasó con la mesa 7?».
// · Una factura que se empieza y se cancela antes de emitir deja sus datos
//   como borrador, para retomarla sin volver a teclear.
// ────────────────────────────────────────────────────────────────────────────

import { totalDeMesa, pendienteDeMesa } from './dinero.js'

export const MAX_MOTIVO = 300

/** ¿Se pidió algo en esta mesa? Sin nada pedido, cerrarla no oculta nada. */
export const hayConsumo = (mesa) => (mesa?.personas || []).some(p => (p?.items || []).length > 0)

/**
 * Revisa el cierre sin cobrar de una mesa. Con consumo, el motivo es
 * obligatorio: la cuenta queda guardada y alguien tiene que poder explicarla.
 */
export function revisarCierreSinCobrar(mesa, motivo) {
  const consumo = hayConsumo(mesa)
  const m = String(motivo ?? '').trim().replace(/\s+/g, ' ')
  if (consumo && !m) return { ok: false, error: 'Escribe el motivo: la cuenta queda guardada en Borradores y hay que poder explicarla' }
  if (m.length > MAX_MOTIVO) return { ok: false, error: `El motivo no puede pasar de ${MAX_MOTIVO} caracteres` }
  return { ok: true, hayConsumo: consumo, motivo: m || null, total: totalDeMesa(mesa), sinCobrar: pendienteDeMesa(mesa) }
}

/** ¿Hay algo tecleado en el formulario de factura que merezca guardarse? */
export const hayDatosDeFactura = (datos) => ['nombre', 'nif', 'direccion', 'email'].some(k => String(datos?.[k] ?? '').trim())

/** El borrador de factura de un ticket, si lo hay. */
export const borradorDeTicket = (borradores = [], ticketId) => (ticketId ? borradores.find(b => b.ticketId === ticketId) || null : null)

/**
 * Los borradores de factura que siguen pendientes: los de tickets que aún no
 * tienen factura (si ya se emitió, el borrador ya no pinta nada).
 */
export const borradoresPendientes = (borradores = [], facturas = []) =>
  borradores.filter(b => !facturas.some(f => f.ticketId === b.ticketId))
