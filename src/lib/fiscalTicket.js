// ────────────────────────────────────────────────────────────────────────────
// En qué punto está un ticket con Hacienda, dicho para quien lo tiene que
// arreglar.
//
// El aviso de Admin decía «3 tickets sin registrar», pero la lista de tickets
// no marcaba cuáles: había que ir comparando números. Y aquí el tiempo cuenta:
// Verifacti solo acepta un ticket **el día que se emitió** («el campo
// fecha_expedicion debe ser la fecha actual»). Uno de hoy sin registrar se
// arregla reintentando; uno de ayer ya no entra por esa vía.
//
// «Hoy» es el día del LOCAL, no el de UTC: un cobro a las 00:30 de Madrid es
// del día nuevo, aunque en UTC aún sea el anterior.
// ────────────────────────────────────────────────────────────────────────────

import { diaLocal } from './fechas.js'

/**
 * @returns {null | { nivel: 'ok'|'pendiente'|'error'|'caducado', texto: string, detalle: string|null, motivo: string|null, reintentable: boolean }}
 *   `null` cuando no aplica: sin registro fiscal (la demo) o un ticket que no
 *   lo necesita.
 */
export function estadoFiscalDeTicket(ticket, ahora = new Date()) {
  const estado = ticket?.fiscalEstado
  if (!estado || estado === 'no_aplica') return null
  if (estado === 'enviado') return { nivel: 'ok', texto: '✓ Hacienda', detalle: null, motivo: null, reintentable: false }

  const motivo = ticket.fiscalError || null
  const deHoy = !!ticket.cerradaEn && diaLocal(ticket.cerradaEn) === diaLocal(ahora)

  if (!deHoy) {
    return {
      nivel: 'caducado',
      texto: '⛔ Sin registrar · de otro día',
      detalle: 'Verifacti solo lo acepta el día que se emitió. Consulta con Verifacti o con la gestoría cómo registrarlo.',
      motivo,
      reintentable: true,
    }
  }
  return {
    nivel: estado === 'error' ? 'error' : 'pendiente',
    texto: estado === 'error' ? '⚠ No se ha registrado' : '⏳ Pendiente de registrar',
    detalle: 'Hay que registrarlo HOY: mañana Verifacti ya no lo acepta.',
    motivo,
    reintentable: true,
  }
}

/** ¿Hay que hacer algo con este ticket? */
export const necesitaAtencion = (ticket, ahora = new Date()) => {
  const e = estadoFiscalDeTicket(ticket, ahora)
  return !!e && e.nivel !== 'ok'
}
