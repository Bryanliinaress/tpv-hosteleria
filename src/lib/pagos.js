// Pago online con Stripe Checkout (tarjeta / Bizum).
// Llama a la Edge Function de Supabase, que crea la sesión de pago, y redirige
// a la página de Stripe. Al volver, la app marca la parte como pagada.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Tener claves de Supabase NO implica que la Edge Function `crear-checkout`
// esté desplegada ni que haya cuenta de Stripe: hace falta activarlo a
// propósito (VITE_PAGOS_ONLINE=1). Sin eso, el cliente paga al camarero y no
// se le ofrece un botón que fallaría.
export const pagoOnlineDisponible =
  !!(SUPABASE_URL && ANON_KEY) && import.meta.env.VITE_PAGOS_ONLINE === '1'

// Inicia el pago: guarda la propina pendiente (para marcarla al volver) y
// redirige a Stripe Checkout.
export async function iniciarPagoOnline({ mesaId, personaId, importe, propina = 0, descripcion }) {
  if (!pagoOnlineDisponible) throw new Error('Pago online no configurado')

  // Guardamos la propina para aplicarla al volver de Stripe
  localStorage.setItem(`tpv-pago-${mesaId}-${personaId}`, String(propina))

  const returnUrl = `${window.location.origin}${import.meta.env.BASE_URL}`

  let res
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/crear-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
      body: JSON.stringify({ mesaId, personaId, importe, descripcion, returnUrl }),
    })
  } catch {
    // sin red, o la Edge Function no está desplegada en este proyecto
    throw new Error('No se pudo contactar con la pasarela de pago')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo iniciar el pago')

  window.location.href = data.url
}

// Lee el resultado del pago de la URL al volver de Stripe.
// Devuelve { estado: 'ok'|'cancel'|null, mesaId, personaId, propina }.
export function leerResultadoPago() {
  const params = new URLSearchParams(window.location.search)
  const pago = params.get('pago')
  if (!pago) return { estado: null }
  const mesaId = params.get('mesa')
  const personaId = params.get('persona')
  const propina = Number(localStorage.getItem(`tpv-pago-${mesaId}-${personaId}`)) || 0
  return { estado: pago, mesaId, personaId, propina }
}

// Limpia los parámetros de pago de la URL (sin recargar) y las propinas
// pendientes de esa mesa que hayan quedado huérfanas en localStorage.
export function limpiarUrlPago(mesaId) {
  const prefijo = `tpv-pago-${mesaId}-`
  Object.keys(localStorage).filter(k => k.startsWith(prefijo)).forEach(k => localStorage.removeItem(k))
  const limpio = `${window.location.pathname}${window.location.hash || ''}`
  window.history.replaceState({}, '', limpio)
}
