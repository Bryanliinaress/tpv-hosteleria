// Envío de correos de reserva con EmailJS (sin backend, desde el navegador).
// Configurar en .env: VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID y
// VITE_EMAILJS_PUBLIC_KEY. La plantilla de EmailJS solo necesita usar las
// variables {{to_email}}, {{asunto}} y {{mensaje}} (y to_name si se quiere).

import { useStore } from '../store/useStore'
// El texto vive aparte: lo comparten el navegador y el vigilante que manda los
// recordatorios desde el PC del bar (scripts/lib/vigilante.mjs).
import { contenidoReserva, paramsEmailJS } from './textosReserva.js'
import { bytesABase64 } from './facturaPdf.js'

const SERVICE = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

// nombre del local para firmar los correos (cae a un genérico si no está)
const nombreLocal = () => useStore.getState().local?.nombre || 'el restaurante'

export const emailConfigurado = !!(SERVICE && TEMPLATE && PUBLIC_KEY)

// Enlace público para que el cliente gestione (cancele o modifique) su reserva.
export function enlaceGestion(r) {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/reservar?r=${r.id}&t=${r.token || ''}`
}

// Asunto y cuerpo: el texto está en `textosReserva.js`; aquí solo se le pasa
// lo que depende del navegador (nombre del local y enlace de gestión).
const contenido = (tipo, r) =>
  contenidoReserva(tipo, r, { nombreLocal: nombreLocal(), enlace: r.token ? enlaceGestion(r) : null })

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
      template_params: paramsEmailJS(tipo, r, { nombreLocal: nombreLocal(), enlace: r.token ? enlaceGestion(r) : null }),
    }),
  })
  if (!res.ok) throw new Error(`EmailJS ${res.status}: ${await res.text()}`)
  return { via: 'emailjs' }
}

// ── Correo con la factura EN PDF ────────────────────────────────────────────
//
// El PDF va ADJUNTO, no un enlace: es lo que espera una gestoría, y un enlace
// a una web es algo que un departamento de administración no abre.
//
// EmailJS solo adjunta si la plantilla lo tiene configurado (pestaña
// «Attachments» → «Add Variable Attachment», parámetro `factura_pdf`,
// tipo PDF). Eso se hace en su panel, no desde aquí, y por eso es una
// plantilla APARTE (`VITE_EMAILJS_TEMPLATE_FACTURA_ID`): la de reservas no
// lleva adjunto y no hay que tocarla. No es un secreto: los id de EmailJS
// viajan igualmente en el navegador.
//
// Sin esa plantilla, lo mejor que puede hacer una web: el menú «Compartir»
// del sistema con el archivo (en el móvil y en Windows abre Gmail, Outlook o
// WhatsApp con el PDF ya adjunto) y, si ni eso, descargar el PDF y abrir el
// correo para adjuntarlo a mano.
const TEMPLATE_FACTURA = import.meta.env.VITE_EMAILJS_TEMPLATE_FACTURA_ID

export const correoConAdjunto = !!(SERVICE && TEMPLATE_FACTURA && PUBLIC_KEY)

/** Descarga un PDF generado en el navegador. */
export function descargarPdf(bytes, nombreArchivo) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function enviarCorreoFactura({ para, nombre, asunto, mensaje, pdf, nombreArchivo }) {
  if (!para) throw new Error('Falta el correo del cliente')
  if (!pdf?.length) throw new Error('No se pudo generar el PDF')

  if (correoConAdjunto) {
    const local = nombreLocal()
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: SERVICE, template_id: TEMPLATE_FACTURA, user_id: PUBLIC_KEY,
        template_params: {
          to_email: para, to_name: nombre || '', asunto, mensaje, local, from_name: local,
          factura_pdf: `data:application/pdf;base64,${bytesABase64(pdf)}`,
          nombre_archivo: nombreArchivo,
        },
      }),
    })
    if (!res.ok) throw new Error(`EmailJS ${res.status}: ${await res.text()}`)
    return { via: 'emailjs' }
  }

  const archivo = typeof File !== 'undefined' ? new File([pdf], nombreArchivo, { type: 'application/pdf' }) : null
  if (archivo && navigator.canShare?.({ files: [archivo] })) {
    await navigator.share({ files: [archivo], title: asunto, text: mensaje })
    return { via: 'compartir' }
  }
  descargarPdf(pdf, nombreArchivo)
  window.open(`mailto:${para}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`)
  return { via: 'mailto' }
}
