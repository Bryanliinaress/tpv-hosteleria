import { supabase } from '../supabase'
import { useStore } from '../../store/useStore'
import { backendV2, personal, cuenta } from '../repo'
import { cargarTodo, iniciarRealtime, iniciarModoAnon } from './estado'
import { accionesV2 } from './acciones'
import { accionesV2b } from './acciones2'
import { iniciarCola, procesar } from './cola'

// ────────────────────────────────────────────────────────────────────────────
// Arranque del backend v2 (multi-tenant). Sustituye a initSync() del blob.
//
//  - Con sesión de Supabase Auth (el dueño hizo login en este dispositivo):
//    hidrata todo, abre realtime y parchea las acciones del store a RPCs.
//  - Sin sesión: modo cliente anónimo (QR/reservas): hidrata carta+sala en
//    lectura pública y parchea solo las acciones del cliente.
// ────────────────────────────────────────────────────────────────────────────

export { backendV2 }

let listo = null
export function initV2() {
  if (!backendV2 || !supabase) return null
  listo = (async () => {
    // el estado persistido del blob (zustand persist) NO debe pisar el server:
    // hidratamos siempre encima al arrancar.
    try {
      await cargarTodo()
    } catch (e) {
      console.warn('v2: hidratación falló (¿sin permisos de sesión?):', e.message)
    }
    useStore.setState({ ...accionesV2(), ...accionesV2b() })
    iniciarRealtime()
    iniciarCola()
    procesar()   // reenvía lo que quedara guardado de la sesión anterior

    // sin sesión de local → cliente QR: su mesa por estado_mesa (polling)
    const { data } = await supabase.auth.getSession()
    if (!data.session) iniciarModoAnon()
    // RGPD: la retención de reservas la dispara el arranque, como en v1 (allí
    // lo hace sync.js). Solo el personal: el cliente anónimo no puede borrar.
    else useStore.getState().purgarReservasAntiguas?.()

    // Al recuperar el foco, resincroniza (por si el móvil durmió y perdió eventos)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) cargarTodo().catch(() => {})
    })
  })()
  return listo
}

// ── Sesión del LOCAL (Supabase Auth) ────────────────────────────────────────
export async function haySesionLocal() {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

export async function loginLocal(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  await initV2()
  return data.session
}

export async function logoutLocal() {
  await supabase.auth.signOut()
  window.location.reload()
}

// ── Alta de un negocio nuevo ────────────────────────────────────────────────

// Crea la cuenta del dueño. Según la config del proyecto, Supabase puede
// exigir confirmar el email antes de poder entrar.
export async function registrarCuenta(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return { sesion: data.session, requiereConfirmacion: !data.session }
}

// ¿este usuario ya tiene local? (null si aún no ha registrado ninguno)
export const miLocal = () => cuenta.miLocal()

// Registra el local y refresca la sesión: el JWT nuevo lleva el local_id que
// leen todas las policies RLS (sin esto, el usuario no vería sus propios datos).
export async function crearLocal(nombre, pinAdmin = '1234') {
  const id = await cuenta.registrarLocal(nombre, pinAdmin)
  await supabase.auth.refreshSession()
  await initV2()
  return id
}

// ── PIN v2: verificado en servidor (hash bcrypt), nunca en el cliente ───────
export async function verificarPinV2(pin, soloAdmin = false) {
  const res = await personal.verificarPin(pin, soloAdmin)
  return res?.[0] || null   // {id, nombre, rol} o null
}
