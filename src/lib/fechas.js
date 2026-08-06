// ────────────────────────────────────────────────────────────────────────────
// Fechas del negocio, siempre en la hora del LOCAL.
//
// Las marcas de tiempo se guardan en ISO/UTC, pero un bar razona en su hora:
// un turno que empieza a la 01:30 del día 1 en España es `…-07-31T23:30:00Z`
// en UTC. Cortando el texto ISO, ese turno se contaba en el mes anterior y la
// nómina salía mal. Estas funciones comparan siempre en local.
// ────────────────────────────────────────────────────────────────────────────

const dosDigitos = (n) => String(n).padStart(2, '0')

/** 'YYYY-MM' del momento, en hora local. */
export function mesLocal(momento) {
  if (!momento) return ''
  const d = momento instanceof Date ? momento : new Date(momento)
  if (isNaN(d)) return ''
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}`
}

/** 'YYYY-MM-DD' del momento, en hora local. */
export function diaLocal(momento) {
  if (!momento) return ''
  const d = momento instanceof Date ? momento : new Date(momento)
  if (isNaN(d)) return ''
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

/** ¿Cae ese momento dentro del mes 'YYYY-MM' (hora local)? */
export const esDelMes = (momento, mes) => !!momento && mesLocal(momento) === mes

/** Horas entre dos marcas; 0 si falta alguna o el orden es imposible. */
export const horasEntre = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 3600000) : 0)
