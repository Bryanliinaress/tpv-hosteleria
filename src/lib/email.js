// Envío de correos de reserva con EmailJS (sin backend, desde el navegador).
// Configurar en .env: VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID y
// VITE_EMAILJS_PUBLIC_KEY. La plantilla de EmailJS solo necesita usar las
// variables {{to_email}}, {{asunto}} y {{mensaje}} (y to_name si se quiere).

import { useStore } from '../store/useStore'
// El texto vive aparte: lo comparten el navegador y el vigilante que manda los
// recordatorios desde el PC del bar (scripts/lib/vigilante.mjs).
import { contenidoReserva, paramsEmailJS } from './textosReserva.js'
import { bytesABase64 } from './facturaPdf.js'
import { interpretarEnvio } from './envioFactura.js'
import { supabase, supabaseActivo } from './supabase'

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
// El PDF va ADJUNTO, no un enlace: es lo que espera una gestoría.
//
// Sale del SERVIDOR (Edge Function `enviar-factura`, por Resend), desde el
// dominio del bar. No desde EmailJS: su plan gratuito no adjunta archivos, y
// un documento fiscal no debería depender de una clave que viaja en la web.
//
// Si el bar aún no ha configurado su correo (secretos RESEND_API_KEY y
// CORREO_REMITENTE en Supabase), o no hay servidor (la demo), se hace lo
// mejor que puede hacer una web: el menú «Compartir» del sistema con el PDF
// ya adjunto (Gmail, Outlook, WhatsApp) y, si ni eso, descargarlo y abrir el
// correo para adjuntarlo a mano.

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

async function enviarDesdeServidor({ facturaId, para, pdf }) {
  if (!supabaseActivo || !facturaId) return { alternativa: true }
  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion?.session?.access_token
  if (!token) return { alternativa: true }
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-factura`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ facturaId, para, pdf: bytesABase64(pdf) }),
  })
  // Una función que aún no está desplegada en esta instalación responde 404:
  // eso es «sin configurar», no un error del bar.
  if (res.status === 404) return { alternativa: true }
  return interpretarEnvio(await res.json().catch(() => ({})), res.status)
}

export async function enviarCorreoFactura({ facturaId, para, asunto, mensaje, pdf, nombreArchivo }) {
  if (!para) throw new Error('Falta el correo del cliente')
  if (!pdf?.length) throw new Error('No se pudo generar el PDF')

  const r = await enviarDesdeServidor({ facturaId, para, pdf })
  if (r.enviado) return { via: 'servidor' }
  if (r.error) throw new Error(r.error)

  const archivo = typeof File !== 'undefined' ? new File([pdf], nombreArchivo, { type: 'application/pdf' }) : null
  if (archivo && navigator.canShare?.({ files: [archivo] })) {
    await navigator.share({ files: [archivo], title: asunto, text: mensaje })
    return { via: 'compartir' }
  }
  descargarPdf(pdf, nombreArchivo)
  window.open(`mailto:${para}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`)
  return { via: 'mailto' }
}
