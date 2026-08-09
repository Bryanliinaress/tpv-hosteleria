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

// Devuelve false si NO se pudo guardar (almacenamiento lleno o modo privado).
// Importante avisar: el camarero cree que el pedido está a salvo y no lo está.
const escribir = (c) => {
  let guardado = true
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { guardado = false }
  useUI.getState().setPendientes(c.length)
  useUI.getState().setConexion(c.length ? 'sin-conexion' : 'ok')
  return guardado
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
  if (!escribir(cola)) {
    // Sin sitio para guardarlo, callarse sería lo peor: el pedido se pierde y
    // nadie se entera hasta que el cliente reclama.
    useUI.getState().toast('No se pudo guardar el pedido sin conexión: repítelo cuando haya línea', 'error', 8000)
    return false
  }
  programar(3000)
  return true
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
          // descartarla, o bloquearía el resto de la cola para siempre. Pero
          // se avisa: es un pedido del cliente que NO ha llegado.
          console.warn('cola v2: operación descartada por el servidor', op.fn, error.message)
          avisarDescartada(op, error.message)
        }
      } catch (e) {
        if (esFalloDeRed(e)) { programar(8000); break }  // sigue sin haber red
        console.warn('cola v2: error no reintentable', op.fn, e)
        avisarDescartada(op, e?.message)
      }
      escribir(leer().filter(x => x.id !== op.id))
    }
  } finally {
    procesando = false
  }
}

// Qué se le dice al camarero cuando una operación encolada no se pudo aplicar.
// Las claves son los nombres REALES de los RPC (ver ENCOLABLES en repo.js). Con
// los nombres a medias, el aviso salía siempre como «una operación» justo en el
// momento en que el camarero necesita saber qué se ha perdido.
export const QUE_ERA = {
  qr_agregar_linea: 'un producto del pedido',
  qr_confirmar_pedido: 'el envío de una comanda a cocina',
  qr_cambiar_cantidad: 'un cambio de cantidad',
  qr_llamar_camarero: 'un aviso de mesa',
  qr_cancelar_aviso: 'la retirada de un aviso',
  qr_pedir_cuenta: 'una petición de cuenta',
  marchar_siguiente: 'un «marchar» de cocina',
}
function avisarDescartada(op, motivo) {
  const que = QUE_ERA[op.fn] || 'una operación'
  useUI.getState().toast(`No se pudo aplicar ${que} que quedó pendiente${motivo ? ` (${motivo})` : ''}. Revísalo.`, 'error', 8000)
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
