// Envío de correos de reserva con EmailJS (sin backend, desde el navegador).
// Configurar en .env: VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID y
// VITE_EMAILJS_PUBLIC_KEY. La plantilla de EmailJS solo necesita usar las
// variables {{to_email}}, {{asunto}} y {{mensaje}} (y to_name si se quiere).

import { useStore } from '../store/useStore'
// El texto vive aparte: lo comparten el navegador y el vigilante que manda los
// recordatorios desde el PC del bar (scripts/lib/vigilante.mjs).
import { contenidoReserva, paramsEmailJS } from './textosReserva.js'

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
