import { supabase } from '../supabase'
import { useUI } from '../../store/useUI'

// ────────────────────────────────────────────────────────────────────────────
// Cola offline del backend v2.
//
// En un bar el wifi se cae a mitad de servicio. Las operaciones de SERVICIO
// (pedir, enviar a cocina, marcar listo, avisos) se guardan en el dispositivo
// y se reenvían solas al volver la conexión, en el mismo orden.
//
// NO se encolan los COBROS ni los cierres de caja a propósito: reenviar un
// cobro a ciegas podría duplicar un ticket (dinero). Ahí se avisa al usuario
// para que lo repita cuando haya línea.
// ────────────────────────────────────────────────────────────────────────────

const KEY = 'tpv-cola-v2'
let procesando = false
let temporizador = null

const leer = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
const escribir = (c) => {
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* almacenamiento lleno */ }
  useUI.getState().setPendientes(c.length)
  useUI.getState().setConexion(c.length ? 'sin-conexion' : 'ok')
}

export const pendientes = () => leer().length

// ¿el fallo es de red (reintentable) o lo rechazó el servidor (definitivo)?
export function esFalloDeRed(e) {
  const m = String(e?.message || e || '')
  return /failed to fetch|networkerror|load failed|fetch failed|timeout/i.test(m) || !navigator.onLine
}

export function encolar(fn, args) {
  const cola = leer()
  cola.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fn, args, ts: Date.now() })
  escribir(cola)
  programar(3000)
}

// Reenvía en orden; si vuelve a fallar por red, se detiene y reintenta luego.
export async function procesar() {
  if (procesando || !supabase) return
  const cola = leer()
  if (!cola.length) return
  procesando = true
  try {
    while (true) {
      const actual = leer()
      if (!actual.length) break
      const op = actual[0]
      try {
        const { error } = await supabase.rpc(op.fn, op.args)
        if (error) {
          // supabase-js devuelve los fallos de RED aquí, sin lanzar: si se
          // tratasen como rechazo, se perdería el pedido del cliente.
          if (esFalloDeRed(error)) { programar(8000); break }
          // rechazo real del servidor (mesa ya cobrada, producto retirado…):
          // descartarla, o bloquearía el resto de la cola para siempre.
          console.warn('cola v2: operación descartada por el servidor', op.fn, error.message)
        }
      } catch (e) {
        if (esFalloDeRed(e)) { programar(8000); break }  // sigue sin haber red
        console.warn('cola v2: error no reintentable', op.fn, e)
      }
      escribir(leer().filter(x => x.id !== op.id))
    }
  } finally {
    procesando = false
  }
}

function programar(ms) {
  clearTimeout(temporizador)
  temporizador = setTimeout(procesar, ms)
}

export function iniciarCola() {
  useUI.getState().setPendientes(pendientes())
  window.addEventListener('online', () => procesar())
  window.addEventListener('offline', () => useUI.getState().setConexion('sin-conexion'))
  document.addEventListener('visibilitychange', () => { if (!document.hidden) procesar() })
  if (pendientes()) programar(1500)
}
