import { supabase } from './supabase'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'

// Sincroniza el estado del TPV (mesas + colas de cocina/barra) entre todos los
// dispositivos mediante una única fila JSONB en Supabase con Realtime.
//
// - Al arrancar: carga el estado remoto (o lo siembra si no existe).
// - Realtime: cuando otro dispositivo cambia algo, actualiza el store local.
// - Al cambiar el store local: empuja el nuevo estado a Supabase (con debounce).
//
// `aplicandoRemoto` evita el bucle eco (un cambio recibido no se reenvía).

const ROW_ID = 1
let aplicandoRemoto = false
let writeTimer = null

// Identificador de este cliente/pestaña: sirve para ignorar el eco Realtime de
// nuestras propias escrituras (que llegan tarde y pisarían estado más nuevo).
const CLIENT_ID = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

// Se resuelve cuando la carga inicial del estado remoto ha terminado, para que
// acciones que dependen del estado (p. ej. marcar pagado al volver de Stripe)
// no se ejecuten antes y acaben sobrescritas.
let resolverListo
export const syncListo = new Promise(r => { resolverListo = r })

const sliceEstado = (s) => ({
  local: s.local,
  empleados: s.empleados,
  carta: s.carta,
  mesas: s.mesas,
  pedidosCocina: s.pedidosCocina,
  pedidosBarra: s.pedidosBarra,
  avisos: s.avisos,
  historial: s.historial,
  cierres: s.cierres,
  anulaciones: s.anulaciones,
  fichajes: s.fichajes,
  reservas: s.reservas,
  reservasConfig: s.reservasConfig,
})

// Marca de tiempo de un registro (campo _ts, o los dígitos de su id `xx<ms>`).
export const tsRegistro = (item) => item?._ts || Number((String(item?.id).match(/\d+/) || [])[0]) || 0

// Fusión para colecciones "solo-añadir" (fichajes, tickets, anulaciones,
// cierres): parte del remoto (gana en los ids que comparten, p. ej. una
// corrección) y le suma los registros LOCALES recientes (<90 s) que el remoto
// aún no tiene. Así, si dos dispositivos escriben casi a la vez, ninguno pierde
// lo que acaba de crear (evita el "último que escribe gana" en los logs).
export function mergeLog(local, remote) {
  const rem = remote || []
  const ids = new Set(rem.map(x => x.id))
  const limite = Date.now() - 90000
  const extra = (local || []).filter(x => !ids.has(x.id) && tsRegistro(x) >= limite)
  return extra.length ? [...rem, ...extra] : rem
}

function aplicarRemoto(data) {
  if (!data || !data.mesas) return
  if (data._origen === CLIENT_ID) return // eco de una escritura nuestra: ya tenemos ese estado (o uno más nuevo)
  const st = useStore.getState()
  aplicandoRemoto = true
  useStore.setState({
    ...(data.local ? { local: data.local } : {}),
    ...(data.empleados ? { empleados: data.empleados } : {}),
    ...(data.carta ? { carta: data.carta } : {}),
    ...(data.reservasConfig ? { reservasConfig: data.reservasConfig } : {}),
    mesas: data.mesas,
    pedidosCocina: data.pedidosCocina || [],
    pedidosBarra: data.pedidosBarra || [],
    avisos: data.avisos || [],
    // Logs solo-añadir: fusionar para no perder registros de otros dispositivos.
    historial: mergeLog(st.historial, data.historial),
    cierres: mergeLog(st.cierres, data.cierres),
    anulaciones: mergeLog(st.anulaciones, data.anulaciones),
    fichajes: mergeLog(st.fichajes, data.fichajes),
    reservas: data.reservas || [],
  })
  aplicandoRemoto = false
}

// Escritura resiliente: si falla (wifi flojo en el local), reintenta con
// backoff exponencial hasta lograrlo — así un pedido enviado no se pierde por
// un parpadeo de red. Siempre empuja el ESTADO ACTUAL (no una copia vieja), y
// coalesce escrituras solapadas con `hayPendiente`.
let escribiendo = false
let hayPendiente = false
let reintentos = 0
let reintentoTimer = null

async function empujarEstado() {
  if (!supabase) return
  if (escribiendo) { hayPendiente = true; return }
  clearTimeout(reintentoTimer)
  escribiendo = true
  hayPendiente = false
  const data = { ...sliceEstado(useStore.getState()), _origen: CLIENT_ID }
  const { error } = await supabase
    .from('estado')
    .upsert({ id: ROW_ID, data, updated_at: new Date().toISOString() })
  escribiendo = false
  if (error) {
    reintentos++
    useUI.getState().setConexion('sin-conexion')
    const espera = Math.min(1000 * 2 ** (reintentos - 1), 15000)
    console.warn(`[sync] error al guardar (reintento ${reintentos} en ${espera} ms):`, error.message)
    reintentoTimer = setTimeout(empujarEstado, espera)
    return
  }
  reintentos = 0
  useUI.getState().setConexion('ok')
  if (hayPendiente) empujarEstado() // hubo cambios mientras escribíamos: reenvía el estado más nuevo
}

export async function initSync() {
  if (!supabase) {
    console.info('[sync] Supabase no configurado: modo local (localStorage).')
    resolverListo()
    return
  }

  // 1) Carga inicial del estado remoto
  const { data, error } = await supabase.from('estado').select('data').eq('id', ROW_ID).single()
  if (error && error.code !== 'PGRST116') {
    console.warn('[sync] error al cargar estado:', error.message)
    useUI.getState().setConexion('sin-conexion')
  }
  if (data?.data?.mesas) {
    aplicarRemoto(data.data)
  } else {
    // No había estado remoto: sembramos con el estado local actual
    empujarEstado()
  }
  resolverListo() // la carga inicial ha terminado
  useStore.getState().purgarReservasAntiguas() // RGPD: retención de reservas

  // 2) Realtime: aplica cambios de otros dispositivos y vigila la conexión
  supabase
    .channel('estado-tpv')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'estado', filter: `id=eq.${ROW_ID}` },
      payload => aplicarRemoto(payload.new?.data))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        useUI.getState().setConexion('ok')
        // Al (re)conectar, reenvía cualquier escritura que quedó pendiente.
        if (reintentos > 0 || hayPendiente) empujarEstado()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        useUI.getState().setConexion('sin-conexion')
      }
    })

  // El navegador avisa de cortes de red: reflejarlo y reintentar al volver.
  window.addEventListener('offline', () => useUI.getState().setConexion('sin-conexion'))
  window.addEventListener('online', () => empujarEstado())

  // 3) Empuja los cambios locales (con debounce, ignorando los recibidos)
  useStore.subscribe((state, prev) => {
    if (aplicandoRemoto) return
    if (state.local === prev.local && state.empleados === prev.empleados && state.carta === prev.carta && state.mesas === prev.mesas && state.pedidosCocina === prev.pedidosCocina && state.pedidosBarra === prev.pedidosBarra && state.avisos === prev.avisos && state.historial === prev.historial && state.cierres === prev.cierres && state.anulaciones === prev.anulaciones && state.fichajes === prev.fichajes && state.reservas === prev.reservas) return
    clearTimeout(writeTimer)
    writeTimer = setTimeout(empujarEstado, 150)
  })
}
