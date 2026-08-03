// Envío de correos de reserva con EmailJS (sin backend, desde el navegador).
// Configurar en .env: VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID y
// VITE_EMAILJS_PUBLIC_KEY. La plantilla de EmailJS solo necesita usar las
// variables {{to_email}}, {{asunto}} y {{mensaje}} (y to_name si se quiere).

import { useStore } from '../store/useStore'

const SERVICE = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

// nombre del local para firmar los correos (cae a un genérico si no está)
const nombreLocal = () => useStore.getState().local?.nombre || 'el restaurante'

export const emailConfigurado = !!(SERVICE && TEMPLATE && PUBLIC_KEY)

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Fecha en texto ("4 de agosto de 2026"). Se evitan las barras a propósito:
// EmailJS escapa el HTML de las variables y "04/08/2026" llegaba al asunto
// como "04&#x2F;08&#x2F;2026".
const fechaBonita = (f) => {
  const [y, m, d] = f.split('-')
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${y}`
}

// Enlace público para que el cliente gestione (cancele o modifique) su reserva.
export function enlaceGestion(r) {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/reservar?r=${r.id}&t=${r.token || ''}`
}

// Construye asunto + cuerpo según el tipo de correo.
function contenido(tipo, r) {
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
        `Un saludo, ${nombreLocal()}.`,
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
    ...(r.token ? ['', '¿Necesitas cancelar o modificar tu reserva?', enlaceGestion(r)] : []),
    '',
    `¡Te esperamos en ${nombreLocal()}!`,
  ].join('\n')
  return { asunto, mensaje }
}

// Expuesto solo para los tests: comprobar asunto y cuerpo sin enviar nada.
export const __contenido = contenido

// Envía el correo. Si EmailJS está configurado, lo manda de verdad; si no,
// abre el cliente de correo (mailto) como alternativa para la demo.
export async function enviarEmailReserva(tipo, r, { permitirMailto = true } = {}) {
  if (!r.email) throw new Error('La reserva no tiene email')
  const { asunto, mensaje } = contenido(tipo, r)

  if (!emailConfigurado) {
    if (!permitirMailto) return { via: 'sin-config' }
    window.open(`mailto:${r.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`)
    return { via: 'mailto' }
  }

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: SERVICE,
      template_id: TEMPLATE,
      user_id: PUBLIC_KEY,
      template_params: {
        to_email: r.email,
        to_name: r.nombre,
        asunto,
        mensaje,
        tipo: tipo === 'recordatorio' ? 'Recordatorio' : 'Confirmación',
        fecha: fechaBonita(r.fecha),
        hora: r.hora,
        personas: r.personas,
        zona: r.zona || '',
        local: nombreLocal(),
        from_name: nombreLocal(),
      },
    }),
  })
  if (!res.ok) throw new Error(`EmailJS ${res.status}: ${await res.text()}`)
  return { via: 'emailjs' }
}
