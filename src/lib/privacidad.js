// ────────────────────────────────────────────────────────────────────────────
// Cuánto se guardan los datos de una reserva, en un solo sitio.
//
// El plazo estaba escrito dos veces —`retencionDias ?? 30` en la purga y otro
// `?? 30` en la pantalla de ajustes— y ahora lo necesitaba una tercera, la
// página de privacidad. En este repo eso siempre acaba igual: una de las
// copias deja de coincidir, y aquí la que miente sería **la que le enseñas al
// cliente**, que es la que dice cuánto guardas sus datos.
//
// ⚠️ El `0` NO es un campo vacío: significa «guardar indefinidamente», y es una
// decisión que el local toma a propósito desde Ajustes. Purgar ahí borraría
// datos que ha decidido conservar. Lo que cae al valor por defecto es lo que
// falta o no es un número: un campo sin tocar, no un cero escrito a mano.
// ────────────────────────────────────────────────────────────────────────────

/** Días que se conserva una reserva antes de purgarla. `0` = para siempre. */
export const RETENCION_POR_DEFECTO = 30

export function retencionDias(reservasConfig) {
  const bruto = reservasConfig?.retencionDias
  if (bruto === undefined || bruto === null || bruto === '') return RETENCION_POR_DEFECTO
  const n = Number(bruto)
  if (!Number.isFinite(n) || n < 0) return RETENCION_POR_DEFECTO
  return Math.floor(n)
}

/** ¿Se purga, o el local guarda las reservas indefinidamente? */
export const purgaActiva = (reservasConfig) => retencionDias(reservasConfig) > 0
