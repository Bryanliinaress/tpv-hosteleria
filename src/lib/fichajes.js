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

/**
 * El nombre de quien fichó.
 *
 * En v1 el fichaje se guarda con el nombre dentro; en v2 solo viaja
 * `empleadoId` y hay que resolverlo contra la plantilla. Sin esto, la app real
 * enseñaba «👤 undefined» en cada línea y —peor— sumaba las horas de TODOS bajo
 * esa misma clave: el resumen por empleado, que es para lo que existe la
 * pantalla, daba un solo total mezclado.
 */
export function nombreDeFichaje(f, empleados = []) {
  if (f?.nombre) return f.nombre
  const e = empleados.find(x => x.id === f?.empleadoId)
  return e?.nombre || 'Sin asignar'
}

/** Fichajes con el nombre ya resuelto, para pintarlos y para el CSV. */
export const conNombre = (fichajes = [], empleados = []) =>
  fichajes.map(f => ({ ...f, nombre: nombreDeFichaje(f, empleados) }))

/**
 * Comprueba un alta manual de jornada.
 *
 * Se podían corregir fichajes pero no CREARLOS: si alguien olvidaba fichar la
 * entrada del todo, no había forma de dejar constancia de esa jornada. Un
 * registro legal en el que no puedes añadir lo que falta es un registro con
 * agujeros — y el RD-ley 8/2019 obliga a conservarlo cuatro años.
 */
export function revisarNuevoFichaje({ empleadoId, entrada, salida } = {}, empleados = []) {
  if (!empleadoId) return { ok: false, error: 'Elige de quién es la jornada' }
  if (empleados.length && !empleados.some(e => e.id === empleadoId)) {
    return { ok: false, error: 'Ese empleado no está en la plantilla' }
  }
  // Las mismas reglas que una corrección: la entrada manda y la salida no puede
  // ir antes.
  return revisarCorreccionFichaje({ entrada: null, salida: null }, { entrada, salida })
}
