// Enlace al Dashboard de Stripe para una referencia de cobro.
//
// La `referencia` que guardamos es el id de la sesión de Checkout
// (`cs_test_…` en pruebas, `cs_live_…`/`cs_…` en real). Buscar ese id en el
// Dashboard lleva al objeto, y el propio id dice en qué modo está: así el
// enlace no depende de ninguna configuración que pueda quedarse vieja el día
// que el bar pase a producción.
export function urlStripe(referencia) {
  const ref = String(referencia || '').trim()
  if (!ref) return null
  const pruebas = /_test_/.test(ref)
  return `https://dashboard.stripe.com/${pruebas ? 'test/' : ''}search?query=${encodeURIComponent(ref)}`
}

// La referencia entera son ~60 caracteres y en una fila no cabe. Se enseña el
// principio y el final —que es lo que se compara de un vistazo con Stripe— y
// la entera va en el `title` y en el botón de copiar.
export function refCorta(referencia, visible = 10) {
  const ref = String(referencia || '')
  if (ref.length <= visible * 2 + 1) return ref
  return `${ref.slice(0, visible)}…${ref.slice(-6)}`
}
