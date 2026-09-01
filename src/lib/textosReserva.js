// ────────────────────────────────────────────────────────────────────────────
// El texto de los correos de reserva.
//
// Vive aparte de `email.js` porque ahora lo escriben DOS sitios: el navegador
// —cuando el cliente reserva o cancela— y el vigilante que corre en el PC del
// bar, que manda los recordatorios sin que nadie abra nada. Escrito dos veces,
// una de las dos acabaría diciendo otra cosa.
//
// Aquí no se toca `window` ni el store: el nombre del local y el enlace de
// gestión se pasan como argumentos, porque en Node no existe ninguno de los dos.
// ────────────────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * Fecha en texto («4 de agosto de 2026»).
 *
 * Se evitan las barras a propósito: EmailJS escapa el HTML de las variables y
 * «04/08/2026» llegaba al asunto como «04&#x2F;08&#x2F;2026».
 */
export const fechaBonita = (f) => {
  const [y, m, d] = String(f).split('-')
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${y}`
}

/** Asunto y cuerpo según el tipo. `enlace` puede ser null (sin token). */
export function contenidoReserva(tipo, r, { nombreLocal = 'el restaurante', enlace = null } = {}) {
  if (tipo === 'cancelacion') {
    return {
      asunto: `Reserva cancelada · ${fechaBonita(r.fecha)} ${r.hora}`,
      mensaje: [
        `Hola ${r.nombre},`,
        '',
        `Tu reserva del ${fechaBonita(r.fecha)} a las ${r.hora} (${r.personas} personas) ha quedado cancelada.`,
        '',
        'Si ha sido un error o quieres volver a reservar, puedes hacerlo cuando quieras.',
        '',
        `Un saludo, ${nombreLocal}.`,
      ].join('\n'),
    }
  }
  const recordatorio = tipo === 'recordatorio'
  const asunto = `${recordatorio ? 'Recordatorio de tu reserva' : 'Reserva confirmada'} · ${fechaBonita(r.fecha)} ${r.hora}`
  const intro = recordatorio ? 'Te recordamos tu próxima reserva:' : 'Tu reserva ha quedado confirmada:'
  const mensaje = [
    `Hola ${r.nombre},`,
    '',
    intro,
    `📅 Día: ${fechaBonita(r.fecha)}`,
    `🕐 Hora: ${r.hora}`,
    `👥 Personas: ${r.personas}`,
    ...(r.zona ? [`📍 Zona: ${r.zona}`] : []),
    ...(enlace ? ['', '¿Necesitas cancelar o modificar tu reserva?', enlace] : []),
    '',
    `¡Te esperamos en ${nombreLocal}!`,
  ].join('\n')
  return { asunto, mensaje }
}

/** Lo que espera la plantilla de EmailJS. */
export function paramsEmailJS(tipo, r, opciones = {}) {
  const { nombreLocal = 'el restaurante' } = opciones
  const { asunto, mensaje } = contenidoReserva(tipo, r, opciones)
  return {
    to_email: r.email,
    to_name: r.nombre,
    asunto,
    mensaje,
    tipo: tipo === 'recordatorio' ? 'Recordatorio' : 'Confirmación',
    fecha: fechaBonita(r.fecha),
    hora: r.hora,
    personas: r.personas,
    zona: r.zona || '',
    local: nombreLocal,
    from_name: nombreLocal,
  }
}
