import { supabase } from '../supabase'
import { perfil } from '../perfil'
import { cargarTodo } from './estado'

// ────────────────────────────────────────────────────────────────────────────
// Autorización del dispositivo.
//
// Conectar un aparato pedía el correo y la contraseña del local — una
// credencial que alguien tiene que custodiar y acaba olvidando. Ahora el
// aparato pide permiso y el encargado se lo da desde su panel; el primero de
// todos lo autoriza quien monta el bar, desde el terminal.
//
// El secreto se guarda en ESTE dispositivo y no vuelve a salir de aquí. Es lo
// que autentica; el código de 6 dígitos solo sirve para que dos personas se
// entiendan en voz alta.
// ────────────────────────────────────────────────────────────────────────────

const CLAVE = 'tpv-dispositivo'

export const secretoGuardado = () => {
  try { return JSON.parse(localStorage.getItem(CLAVE) || 'null') } catch { return null }
}
const guardar = (v) => localStorage.setItem(CLAVE, JSON.stringify(v))
export const olvidarDispositivo = () => localStorage.removeItem(CLAVE)

// Un nombre que le diga algo al encargado cuando vea la solicitud. No se
// pretende identificar el aparato, solo distinguir «la tablet» del «PC».
function nombrePorDefecto() {
  const ua = navigator.userAgent || ''
  if (/iPad|Tablet/i.test(ua)) return 'Tablet'
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Móvil'
  if (/Windows/i.test(ua)) return 'PC'
  if (/Mac/i.test(ua)) return 'Mac'
  return 'Dispositivo'
}

/** Pide acceso. Devuelve { codigo } y se guarda el secreto. */
export async function pedirAcceso(nombre) {
  const { data, error } = await supabase.rpc('solicitar_dispositivo', {
    p_slug: perfil.slug,
    p_nombre: nombre || nombrePorDefecto(),
  })
  if (error) throw new Error(error.message)
  const fila = Array.isArray(data) ? data[0] : data
  if (!fila?.secreto) throw new Error('respuesta inesperada al pedir acceso')
  guardar({ secreto: fila.secreto, codigo: fila.codigo, pedidoEn: Date.now() })
  return { codigo: fila.codigo }
}

/**
 * ¿Ya nos han autorizado? Si sí, canjea el secreto por una sesión y la deja
 * puesta. Devuelve 'pendiente' | 'aprobado' | 'revocado' | 'desconocido'.
 */
export async function comprobarAcceso() {
  const guardado = secretoGuardado()
  if (!guardado?.secreto) return 'sin-solicitud'

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/canjear-dispositivo`
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: clave, Authorization: `Bearer ${clave}` },
      body: JSON.stringify({ secreto: guardado.secreto }),
    })
  } catch {
    return 'sin-red'
  }

  if (res.status === 202) return 'pendiente'
  if (res.status === 404) { olvidarDispositivo(); return 'desconocido' }
  if (res.status === 403) { olvidarDispositivo(); return 'revocado' }
  if (!res.ok) return 'error'

  const datos = await res.json().catch(() => null)
  const s = datos?.session
  if (!s?.access_token) return 'error'

  // Sesión normal de Supabase: se refresca sola y sobrevive a los reinicios,
  // igual que la que daba el login con contraseña.
  const { error } = await supabase.auth.setSession({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
  })
  if (error) return 'error'

  // Y ahora hay que RECARGAR. La app arrancó sin sesión, así que la
  // hidratación no pudo traer nada: el padrón de empleados quedó vacío. Y el
  // PIN se resuelve contra ese padrón, así que sin esto el camarero teclea su
  // PIN correcto, el servidor lo da por bueno… y la pantalla no se mueve, sin
  // decir nada. Costó un buen rato encontrarlo.
  try { await cargarTodo() } catch { /* si falla, lo reintenta el arranque */ }
  return 'aprobado'
}
