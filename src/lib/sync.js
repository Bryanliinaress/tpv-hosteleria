import { supabase } from './supabase'
import { useStore } from '../store/useStore'

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

// Se resuelve cuando la carga inicial del estado remoto ha terminado, para que
// acciones que dependen del estado (p. ej. marcar pagado al volver de Stripe)
// no se ejecuten antes y acaben sobrescritas.
let resolverListo
export const syncListo = new Promise(r => { resolverListo = r })

const sliceEstado = (s) => ({
  mesas: s.mesas,
  pedidosCocina: s.pedidosCocina,
  pedidosBarra: s.pedidosBarra,
  avisos: s.avisos,
})

function aplicarRemoto(data) {
  if (!data || !data.mesas) return
  aplicandoRemoto = true
  useStore.setState({
    mesas: data.mesas,
    pedidosCocina: data.pedidosCocina || [],
    pedidosBarra: data.pedidosBarra || [],
    avisos: data.avisos || [],
  })
  aplicandoRemoto = false
}

async function empujarEstado() {
  const data = sliceEstado(useStore.getState())
  const { error } = await supabase
    .from('estado')
    .upsert({ id: ROW_ID, data, updated_at: new Date().toISOString() })
  if (error) console.warn('[sync] error al guardar:', error.message)
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
  }
  if (data?.data?.mesas) {
    aplicarRemoto(data.data)
  } else {
    // No había estado remoto: sembramos con el estado local actual
    empujarEstado()
  }
  resolverListo() // la carga inicial ha terminado

  // 2) Realtime: aplica cambios de otros dispositivos
  supabase
    .channel('estado-tpv')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'estado', filter: `id=eq.${ROW_ID}` },
      payload => aplicarRemoto(payload.new?.data))
    .subscribe()

  // 3) Empuja los cambios locales (con debounce, ignorando los recibidos)
  useStore.subscribe((state, prev) => {
    if (aplicandoRemoto) return
    if (state.mesas === prev.mesas && state.pedidosCocina === prev.pedidosCocina && state.pedidosBarra === prev.pedidosBarra && state.avisos === prev.avisos) return
    clearTimeout(writeTimer)
    writeTimer = setTimeout(empujarEstado, 150)
  })
}
