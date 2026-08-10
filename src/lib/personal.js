// ────────────────────────────────────────────────────────────────────────────
// Reglas del personal: quién puede entrar y con qué PIN.
//
// Estaban solo en la demo. En la app real no se comprobaba nada, así que se
// podía dar de alta a dos empleados con el MISMO PIN (y entonces el TPV no
// sabe cuál de los dos está fichando) o borrar al último administrador y
// dejar el local sin acceso a Admin.
//
// Devuelven { ok: true } o { ok: false, error } — nunca lanzan: quien las usa
// enseña el error tal cual al usuario.
// ────────────────────────────────────────────────────────────────────────────

const PIN_VALIDO = /^\d{4}$/
const limpio = (s) => (s || '').trim()

/** Alta de un empleado. */
export function revisarNuevoEmpleado(empleados = [], { nombre, pin } = {}) {
  const n = limpio(nombre)
  const p = limpio(pin)
  if (!n) return { ok: false, error: 'Escribe un nombre' }
  if (!PIN_VALIDO.test(p)) return { ok: false, error: 'El PIN debe tener 4 dígitos' }
  if (empleados.some(e => e.pin === p)) return { ok: false, error: 'Ese PIN ya está en uso' }
  return { ok: true, nombre: n, pin: p }
}

/** Cambio en un empleado: solo se valida lo que se toca. */
export function revisarCambioEmpleado(empleados = [], id, cambios = {}) {
  if (cambios.pin !== undefined) {
    const p = limpio(cambios.pin)
    if (!PIN_VALIDO.test(p)) return { ok: false, error: 'El PIN debe tener 4 dígitos' }
    if (empleados.some(e => e.id !== id && e.pin === p)) return { ok: false, error: 'Ese PIN ya está en uso' }
  }
  // Desactivar al último admin deja el local sin quien administre
  if (cambios.activo === false || cambios.rol === 'camarero') {
    if (esUltimoAdmin(empleados, id)) return { ok: false, error: 'Debe quedar al menos un administrador' }
  }
  return { ok: true }
}

/** Baja de un empleado. */
export function revisarBajaEmpleado(empleados = [], id) {
  if (esUltimoAdmin(empleados, id)) return { ok: false, error: 'Debe quedar al menos un administrador' }
  return { ok: true }
}

/** ¿Es el único administrador activo que queda? */
export function esUltimoAdmin(empleados = [], id) {
  const e = empleados.find(x => x.id === id)
  if (e?.rol !== 'admin') return false
  return empleados.filter(x => x.rol === 'admin' && x.activo && x.id !== id).length === 0
}
