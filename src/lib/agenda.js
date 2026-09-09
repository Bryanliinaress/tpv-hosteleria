// ────────────────────────────────────────────────────────────────────────────
// Qué reclama atención en la agenda AHORA MISMO.
//
// La agenda listaba las reservas del día ordenadas por hora, todas iguales: la
// de las 22:00 pintada igual que la que entra por la puerta en diez minutos y
// no tiene mesa asignada. A las 14:10 de un sábado, lo que el encargado
// necesita saber es exactamente dos cosas:
//
//   · **quién llega enseguida** —y si tiene mesa, porque asignarla con el
//     cliente delante es la diferencia entre sentarlo y tenerlo de pie—, y
//   · **quién se ha retrasado**, para decidir si esperar o soltar la mesa.
//
// Se calcula aquí y no en la pantalla porque depende de la hora, y la hora se
// mueve sola: la pantalla lo repinta con `useReloj` (la misma lección que el
// reloj congelado del KDS, v0.108.0).
// ────────────────────────────────────────────────────────────────────────────

/** Minutos entre la hora de la reserva y `ahora` (negativo = aún no ha llegado). */
export function minutosDeRetraso(reserva, ahora = new Date()) {
  if (!reserva?.fecha || !reserva?.hora) return null
  const [h, m] = String(reserva.hora).split(':').map(Number)
  const [y, mes, d] = String(reserva.fecha).split('-').map(Number)
  if ([h, m, y, mes, d].some(n => !Number.isFinite(n))) return null
  const cuando = new Date(y, mes - 1, d, h, m)
  return Math.round((ahora - cuando) / 60000)
}

/**
 * Cómo va una reserva respecto al reloj:
 *   'pronto' → entra dentro de poco (aún no es su hora)
 *   'tarde'  → su hora ya pasó y sigue sin sentarse
 *   null     → ni una cosa ni la otra (o ya está sentada, cancelada…)
 */
export function comoVa(reserva, ahora = new Date(), { pronto = 30, tarde = 15 } = {}) {
  // Solo las que siguen esperando: una sentada ya no llega ni se retrasa.
  if (reserva?.estado !== 'confirmada') return null
  const min = minutosDeRetraso(reserva, ahora)
  if (min == null) return null
  if (min >= tarde) return 'tarde'
  if (min >= -pronto) return 'pronto'
  return null
}

/**
 * Lo que reclama atención hoy, para la franja de arriba de la agenda.
 *
 * `sinMesa` se mira solo en las que llegan enseguida: que una reserva de las
 * 22:00 no tenga mesa a las 13:00 no es un problema, es que aún no toca.
 */
export function avisosDeAgenda(reservas = [], ahora = new Date()) {
  const pronto = []
  const tarde = []
  for (const r of (reservas || [])) {
    const c = comoVa(r, ahora)
    if (c === 'pronto') pronto.push(r)
    else if (c === 'tarde') tarde.push(r)
  }
  const porHora = (a, b) => String(a.hora).localeCompare(String(b.hora))
  return {
    pronto: pronto.sort(porHora),
    tarde: tarde.sort(porHora),
    sinMesa: pronto.filter(r => !r.mesaId).sort(porHora),
  }
}

/** «en 12 min», «ahora», «20 min tarde» — para la etiqueta de la tarjeta. */
export function comoSeDice(reserva, ahora = new Date()) {
  const min = minutosDeRetraso(reserva, ahora)
  if (min == null) return ''
  if (min <= -1) return `en ${-min} min`
  if (min < 1) return 'ahora'
  return `${min} min tarde`
}
