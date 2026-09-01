// ────────────────────────────────────────────────────────────────────────────
// A quién toca recordarle su reserva.
//
// El recordatorio existía —plantilla, botón «🔔 Recordar» y todo— pero había
// que pulsarlo reserva por reserva. En un bar eso no ocurre: es la palanca más
// eficaz contra el no-show y quedaba a que alguien se acordara.
//
// Y hay algo peor que perder una mesa: la nota de privacidad que el cliente
// acepta al reservar dice literalmente «(confirmación, cambios y recordatorio)».
// Prometerle un correo que no llega es decirle algo que no es verdad.
// ────────────────────────────────────────────────────────────────────────────

/** El momento exacto de una reserva, en la hora del bar (no en UTC). */
export function cuandoEs(r) {
  // Ojo con `Number('')`, que es 0 y no NaN: sin hora se construía una reserva
  // a medianoche en vez de descartarla.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r?.fecha ?? ''))) return null
  if (!/^\d{1,2}:\d{2}/.test(String(r?.hora ?? ''))) return null
  const [y, m, d] = String(r.fecha).split('-').map(Number)
  const [hh, mm] = String(r.hora).split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

/**
 * Las reservas a las que toca mandarles el recordatorio ahora mismo.
 *
 * Se manda `horas` antes de sentarse. Se descartan:
 *
 *  · las que no están confirmadas —una cancelada no se recuerda—;
 *  · las que no dejaron email;
 *  · las que ya lo recibieron (`recordatorio_en`), o el vigilante lo mandaría
 *    otra vez en cada pasada;
 *  · las que ya pasaron: recordar una cena de ayer es peor que no recordar nada;
 *  · y las que se reservaron YA DENTRO de la ventana. Si alguien reserva a la
 *    una para las tres, no necesita que le recuerden a la una y media lo que
 *    acaba de hacer: recibiría el recordatorio pisando a la confirmación.
 */
export function paraRecordar(reservas = [], { ahora = new Date(), horas = 4 } = {}) {
  const ventanaMs = horas * 3600_000
  return (reservas || []).filter(r => {
    if (!r || r.estado !== 'confirmada') return false
    if (!r.email) return false
    if (r.recordatorio_en) return false
    const cuando = cuandoEs(r)
    if (!cuando) return false
    const faltan = cuando.getTime() - ahora.getTime()
    if (faltan <= 0) return false                 // ya pasó
    if (faltan > ventanaMs) return false          // todavía es pronto
    // ¿se reservó ya dentro de la ventana? entonces no hace falta recordar
    const creada = r.creada_en ? new Date(r.creada_en).getTime() : null
    if (creada && cuando.getTime() - creada <= ventanaMs) return false
    return true
  })
}

/**
 * Una pasada de recordatorios.
 *
 * `deps` se inyecta para probarlo sin red: { listar, enviar, marcar, log }.
 * Si un envío falla NO se marca: se reintentará en la siguiente pasada, que es
 * lo que hay que hacer con un correo que no salió.
 */
export async function pasadaRecordatorios({ listar, enviar, marcar, log = () => {}, ahora = new Date(), horas = 4 }) {
  const reservas = await listar()
  const toca = paraRecordar(reservas, { ahora, horas })
  if (!toca.length) return { enviados: 0, fallidos: 0 }

  let enviados = 0, fallidos = 0
  for (const r of toca) {
    try {
      await enviar(r)
      await marcar(r)
      enviados++
    } catch (e) {
      fallidos++
      log(`⚠️  no salió el recordatorio de ${r.nombre}: ${e.message}`)
    }
  }
  log(`📧 recordatorios · ${enviados} enviado(s)${fallidos ? `, ${fallidos} sin salir` : ''}`)
  return { enviados, fallidos }
}
