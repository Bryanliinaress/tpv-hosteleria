import { importeDesdeTexto } from './dinero.js'

// ────────────────────────────────────────────────────────────────────────────
// Los datos del local, saneados antes de guardarlos.
//
// La regla existía… pero solo en la demo. `updateLocal` de la app real era
// `actualizarConfig(cambios)` a pelo, así que lo que se escribía en Admin →
// Local se guardaba tal cual. Y dos de esos campos son dinero:
//
//   · **El IVA con coma.** «10,5» se guardaba como la cadena `"10,5"`, y todo
//     el que lo lee hace `Number(ivaPct) || 0` → NaN → **0 %**. El ticket de
//     pantalla, el recibo del cliente y el papel de la impresora salían con
//     «IVA (0%)» y la base igual al total. No falla nada: sale mal y con buena
//     cara, que es lo peor en una factura simplificada.
//   · **La moneda vacía.** Borrar el campo dejaba `""` y los importes salían
//     sin símbolo.
//
// Es la misma trampa que el efectivo contado del arqueo («2,50» → NaN → 0) y
// la misma familia que el resto: una regla escrita en un solo lado.
// ────────────────────────────────────────────────────────────────────────────

/** El IVA más alto que tiene sentido teclear. Por encima, es un dedo torcido. */
const IVA_MAX = 100

/**
 * Comprueba y sanea un parche de `local`. Devuelve `{ ok: true, cambios }` con
 * lo que hay que guardar, o `{ ok: false, error }` para que la pantalla lo
 * diga y devuelva el campo a lo que había.
 *
 * Solo toca lo que viene en el parche: el resto de la ficha no se toca.
 */
export function revisarCambiosLocal(cambios = {}) {
  const salida = { ...cambios }

  if (salida.ivaPct !== undefined) {
    const txt = String(salida.ivaPct ?? '').trim()
    // Vacío NO es «0 %»: es un descuido. Guardar 0 dejaría los tickets
    // diciendo «IVA (0%)» sin que nadie lo haya decidido.
    if (!txt) return { ok: false, error: 'Escribe el IVA: dejarlo vacío pondría «IVA 0%» en todos los tickets' }
    const n = importeDesdeTexto(txt)      // entiende «10,5» y «10.5»
    if (n === null) return { ok: false, error: `«${txt}» no es un porcentaje de IVA` }
    if (n < 0 || n > IVA_MAX) return { ok: false, error: `El IVA va entre 0 y ${IVA_MAX}%` }
    salida.ivaPct = n
  }

  if (salida.moneda !== undefined) {
    salida.moneda = String(salida.moneda ?? '').trim() || '€'
  }

  // Los textos que salen impresos van sin espacios de más: un nombre con un
  // espacio delante descoloca el encabezado centrado del ticket.
  for (const campo of ['nombre', 'subtitulo', 'direccion', 'telefono', 'cif', 'razonSocial', 'direccionFiscal', 'urlResena', 'pieTicket']) {
    if (salida[campo] !== undefined) salida[campo] = String(salida[campo] ?? '').trim()
  }

  return { ok: true, cambios: salida }
}

/**
 * Qué falta por rellenar para que un ticket esté completo, con lo que se nota
 * si no está. Un hueco vacío aquí no se ve hasta que sale un ticket sin
 * dirección o un «Llámanos» que no lleva a ningún sitio.
 */
export function loQueFaltaDelLocal(local = {}) {
  return [
    !local.direccion && { campo: 'la dirección', donde: 'el ticket y el recibo del cliente' },
    !local.telefono && { campo: 'el teléfono', donde: '«Llámanos» de la página de reservas' },
    // El CIF y el IVA son los dos que exige una factura simplificada.
    !local.cif && { campo: 'el CIF', donde: 'el ticket — es obligatorio en una factura simplificada', fiscal: true },
    (local.ivaPct == null || local.ivaPct === '') && { campo: 'el IVA', donde: 'el desglose del ticket', fiscal: true },
  ].filter(Boolean)
}
