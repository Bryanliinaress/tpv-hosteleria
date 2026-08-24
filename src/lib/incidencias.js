import { supabase } from './supabase'

// ────────────────────────────────────────────────────────────────────────────
// Contar lo que se rompe.
//
// Hasta ahora, si la tablet de la barra se atascaba un sábado, se enteraban
// ellos y con suerte avisaban el lunes. Esto deja constancia en la base del
// propio local (no se manda nada a ningún servicio de fuera) y `npm run salud`
// lo lee.
//
// Tres reglas para que el remedio no sea peor que la enfermedad:
//   · nunca lanza: un fallo registrando un fallo no puede romper la pantalla;
//   · no repite: el mismo error solo se manda una vez por sesión, o un bucle de
//     render mandaría miles de peticiones desde un bar con mala conexión;
//   · no manda nada que haya escrito nadie: solo el mensaje, recortado.
// ────────────────────────────────────────────────────────────────────────────

const VERSION = import.meta.env.VITE_VERSION || ''
const yaVistos = new Set()
const TOPE_POR_SESION = 20

/** La ruta, sin ids: `#/mesa/9f3c-…` es la misma pantalla que `#/mesa/1a2b-…`. */
export function pantallaActual(hash = (typeof location !== 'undefined' ? location.hash : '')) {
  return String(hash).replace(/^#/, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:n')
    .slice(0, 80) || '/'
}

/** Mensaje corto y estable, para poder agrupar. */
export function resumir(error) {
  const e = error || {}
  const texto = e.message || e.reason?.message || (typeof e === 'string' ? e : '') || String(e.reason || e) || 'error sin mensaje'
  return String(texto).replace(/\s+/g, ' ').trim().slice(0, 300)
}

export function registrar(clase, error, pantalla = pantallaActual()) {
  try {
    if (!supabase) return
    const mensaje = resumir(error)
    const clave = `${clase}|${mensaje}|${pantalla}`
    if (yaVistos.has(clave) || yaVistos.size >= TOPE_POR_SESION) return
    yaVistos.add(clave)
    // sin `await` a propósito: esto no debe hacer esperar a nadie
    supabase.rpc('registrar_incidencia', {
      p_clase: clase, p_mensaje: mensaje, p_pantalla: pantalla, p_version: VERSION,
    }).then(() => {}, () => {})
  } catch { /* registrar un fallo no puede provocar otro */ }
}

/** Engancha los fallos que nadie atrapa. Se llama una vez, al arrancar. */
export function vigilarErrores() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (ev) => {
    // los errores de carga de recursos llegan aquí sin `error`: no son fallos
    // de la app y ensuciarían el listado
    if (ev?.error) registrar('js', ev.error)
  })
  window.addEventListener('unhandledrejection', (ev) => registrar('promesa', ev?.reason))
}
