import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'

// Sesión de personal POR DISPOSITIVO (no se sincroniza): quién ha entrado con
// su PIN en este navegador. Guarda solo el id del empleado; el resto (nombre,
// rol, activo) se resuelve contra el padrón de empleados del store, así un
// empleado dado de baja por el admin pierde el acceso al instante.
const KEY = 'tpv-sesion'
const bus = new EventTarget()

export function getSesion() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}
export function setSesion(empleado) {
  localStorage.setItem(KEY, JSON.stringify({ id: empleado.id, nombre: empleado.nombre, rol: empleado.rol }))
  bus.dispatchEvent(new Event('cambio'))
}
export function clearSesion() {
  localStorage.removeItem(KEY)
  bus.dispatchEvent(new Event('cambio'))
}

// Empleado actualmente conectado en este dispositivo, validado contra el padrón
// (devuelve null si ya no existe o está desactivado). Reacciona a login/logout
// y a cambios del padrón.
export function useEmpleadoActual() {
  const empleados = useStore(s => s.empleados)
  const [sesion, setSes] = useState(getSesion)
  useEffect(() => {
    const h = () => setSes(getSesion())
    bus.addEventListener('cambio', h)
    window.addEventListener('storage', h)
    return () => { bus.removeEventListener('cambio', h); window.removeEventListener('storage', h) }
  }, [])
  if (!sesion) return null
  return empleados.find(e => e.id === sesion.id && e.activo) || null
}
