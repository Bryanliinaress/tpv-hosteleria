// ────────────────────────────────────────────────────────────────────────────
// Correcciones de fichajes (las hace el admin y salen en la nómina).
//
// La validación vive aquí porque la hacen dos sitios: la demo, que edita el
// estado, y la app real, que escribe en la BBDD. Estaba solo en la demo, así
// que en el bar de verdad se podía guardar una salida ANTERIOR a la entrada
// —horas negativas en la nómina— y encima la pantalla cantaba un error falso
// cuando en realidad se había guardado.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Comprueba una corrección y devuelve los valores finales.
 * → { ok: true, entrada, salida } | { ok: false, error }
 */
export function revisarCorreccionFichaje(fichaje, cambios = {}) {
  if (!fichaje) return { ok: false, error: 'Fichaje no encontrado' }
  const entrada = cambios.entrada !== undefined ? cambios.entrada : fichaje.entrada
  const salida = cambios.salida !== undefined ? cambios.salida : fichaje.salida
  if (!entrada) return { ok: false, error: 'La entrada es obligatoria' }
  if (isNaN(new Date(entrada))) return { ok: false, error: 'La entrada no es una fecha válida' }
  if (salida && isNaN(new Date(salida))) return { ok: false, error: 'La salida no es una fecha válida' }
  if (salida && new Date(salida) < new Date(entrada)) {
    return { ok: false, error: 'La salida no puede ser anterior a la entrada' }
  }
  return { ok: true, entrada, salida: salida || null }
}
