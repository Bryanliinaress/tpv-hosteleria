import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'

// Sesión de personal POR DISPOSITIVO (no se sincroniza): quién ha entrado con
// su PIN en este navegador. Guarda solo el id del empleado; el resto (nombre,
// rol, activo) se resuelve contra el padrón de empleados del store, así un
// empleado dado de baja por el admin pierde el acceso al instante.
const KEY = 'tpv-sesion'
const bus = new EventTarget()

// ── Caducidad por inactividad ───────────────────────────────────────────────
//
// La sesión no caducaba NUNCA. El encargado entra con su PIN para autorizar un
// aparato o mirar la caja, deja la tablet en la barra, y a partir de ahí quien
// la coja —un camarero, o un cliente— tiene Admin: caja, precios, borrar
// empleados, cerrar mesas sin cobrar. El bloqueo tras 5 PIN fallidos protege la
// puerta y dejaba la casa abierta.
//
// Los dos plazos son muy distintos a propósito. Al camarero no se le puede
// pedir el PIN cada diez minutos en pleno servicio: acabaría poniéndose 0000 o
// compartiéndolo, que es peor que no tener PIN. Al administrador sí, porque lo
// suyo es entrar, hacer algo y salir.
export const CADUCIDAD = { admin: 5 * 60_000, staff: 12 * 60 * 60_000 }

/** ¿Se ha quedado sin usar más tiempo del que le toca a su rol? */
export function caducada(sesion, ahora = Date.now()) {
  if (!sesion?.id) return true
  const limite = CADUCIDAD[sesion.rol === 'admin' ? 'admin' : 'staff']
  // Una sesión guardada por una versión anterior no trae `visto`: se le da por
  // buena esta vez y el primer toque la pone al día (mejor que echar a todo el
  // mundo a la vez el día que se despliega esto).
  if (!sesion.visto) return false
  return ahora - sesion.visto > limite
}

export function getSesion() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}
export function setSesion(empleado) {
  localStorage.setItem(KEY, JSON.stringify({
    id: empleado.id, nombre: empleado.nombre, rol: empleado.rol, visto: Date.now(),
  }))
  bus.dispatchEvent(new Event('cambio'))
}

/** Marca actividad. Se llama mucho, así que no escribe más de una vez por minuto. */
export function tocarSesion(ahora = Date.now()) {
  const s = getSesion()
  if (!s?.id) return
  if (s.visto && ahora - s.visto < 60_000) return
  localStorage.setItem(KEY, JSON.stringify({ ...s, visto: ahora }))
}
export function clearSesion() {
  localStorage.removeItem(KEY)
  bus.dispatchEvent(new Event('cambio'))
}

/**
 * Resuelve la sesión guardada contra el padrón de empleados. Es la regla de
 * seguridad del acceso, y por eso está aparte y probada: lo que vale es el rol
 * del PADRÓN, nunca el que traiga la sesión guardada en el dispositivo (que
 * cualquiera podría editar a mano). Devuelve null si el empleado ya no existe
 * o está desactivado.
 */
export function resolverEmpleado(empleados, sesion, ahora = Date.now()) {
  if (!sesion?.id) return null
  const emp = (empleados || []).find(e => e.id === sesion.id && e.activo)
  if (!emp) return null
  // El plazo lo decide el rol del PADRÓN, no el que traiga el dispositivo. Si
  // saliera del guardado, un administrador podría escribirse `rol: camarero`
  // en localStorage y regalarse doce horas de sesión con permisos de admin:
  // la misma trampa que esta función ya impide para los permisos.
  if (caducada({ ...sesion, rol: emp.rol }, ahora)) return null
  return emp
}

// Empleado actualmente conectado en este dispositivo, validado contra el padrón
// (devuelve null si ya no existe o está desactivado). Reacciona a login/logout
// y a cambios del padrón.
export function useEmpleadoActual() {
  const empleados = useStore(s => s.empleados)
  const [sesion, setSes] = useState(getSesion)
  // Relee la sesión cada poco para que la caducidad se note sola: si no, la
  // pantalla seguiría pintada hasta que algo la volviera a renderizar.
  const [, latido] = useState(0)
  useEffect(() => {
    const h = () => setSes(getSesion())
    bus.addEventListener('cambio', h)
    window.addEventListener('storage', h)

    // Cualquier señal de que hay alguien delante cuenta como actividad.
    const actividad = () => { tocarSesion(); h() }
    const eventos = ['pointerdown', 'keydown', 'visibilitychange']
    for (const e of eventos) window.addEventListener(e, actividad, { passive: true })

    const t = setInterval(() => latido(n => n + 1), 30_000)
    return () => {
      bus.removeEventListener('cambio', h); window.removeEventListener('storage', h)
      for (const e of eventos) window.removeEventListener(e, actividad)
      clearInterval(t)
    }
  }, [])
  return resolverEmpleado(empleados, sesion)
}
