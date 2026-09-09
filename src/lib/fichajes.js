import { horasEntre } from './fechas.js'

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

// ────────────────────────────────────────────────────────────────────────────
// Lo que lleva trabajado cada persona, y quién está en turno AHORA.
//
// El panel de personal no decía ninguna de las dos cosas: para saber si María
// se había dejado el turno abierto había que irse a otra pestaña, elegir el
// mes y buscar su nombre entre los fichajes de todos. Y las horas son el
// número que va a la nómina — ya salieron una vez todas juntas bajo un mismo
// «undefined» (v0.105.0), así que se calculan en un solo sitio y con test.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Jornada de un empleado dentro de los fichajes que se le pasen (ya filtrados
 * por el periodo que se esté mirando).
 * → { horas, jornadas, abierto } — `abierto` es el fichaje sin salida, si lo hay.
 */
export function jornadaDe(fichajes = [], empleadoId) {
  const suyos = (fichajes || []).filter(f => f?.empleadoId === empleadoId)
  return {
    // Un turno abierto no suma horas: todavía no se sabe cuántas son, y
    // contarlas «hasta ahora» pondría en la nómina un número que cambia solo.
    horas: suyos.reduce((s, f) => s + (f.salida ? horasEntre(f.entrada, f.salida) : 0), 0),
    jornadas: suyos.length,
    abierto: suyos.find(f => !f.salida) || null,
  }
}
