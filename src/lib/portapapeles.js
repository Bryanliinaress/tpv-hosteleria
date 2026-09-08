// Copiar al portapapeles y SABER si se copió.
//
// `navigator.clipboard` no existe fuera de un contexto seguro —el TPV abierto
// por http en la red del bar es uno—, y `writeText` puede fallar por permiso.
// Decir «copiado» sin comprobarlo es el mismo fallo que el del papel: el
// encargado se va a Stripe, pega lo que hubiera antes en el portapapeles y
// busca un cobro que no es. Devuelve `true` solo si se copió de verdad.
export async function copiar(texto) {
  const valor = String(texto ?? '')
  if (!valor) return false
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(valor); return true }
  } catch { /* sin permiso o sin contexto seguro: queda la vía de siempre */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = valor
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return !!ok
  } catch { return false }
}
