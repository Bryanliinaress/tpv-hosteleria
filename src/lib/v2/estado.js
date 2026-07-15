import { supabase } from '../supabase'
import { useStore } from '../../store/useStore'
import { suscribirLocal } from '../repo'

// ────────────────────────────────────────────────────────────────────────────
// Hidratación v2: lee las TABLAS normalizadas y las proyecta al MISMO shape
// que el store del blob, para que ninguna pantalla cambie. En cada evento
// realtime se refresca el agregado afectado (debounced).
// ────────────────────────────────────────────────────────────────────────────

let localId = null
export const getLocalId = () => localId

// personalización jsonb → campos planos que esperan las pantallas
const desempaquetar = (l) => ({
  uid: l.id, id: l.id,                       // las pantallas usan uid; conservamos id real
  productoId: l.producto_id, nombre: l.nombre, precio: Number(l.precio),
  cantidad: l.cantidad, tipo: l.tipo, estado: l.estado, tiempo: l.tiempo,
  pan: l.personalizacion?.pan ?? null,
  quitados: l.personalizacion?.quitados ?? [],
  anadidos: l.personalizacion?.anadidos ?? [],
  nota: l.personalizacion?.nota ?? '',
})

const notaDe = (l) => {
  const p = []
  const pers = l.personalizacion || {}
  if (pers.pan) p.push(`${pers.pan.nombreFormato} · ${pers.pan.nombreTipo}`)
  if (pers.quitados?.length) p.push('SIN ' + pers.quitados.join(', '))
  if (pers.anadidos?.length) p.push('CON ' + pers.anadidos.join(', '))
  if (pers.nota) p.push(pers.nota)
  return p.join(' · ')
}

async function q(tabla, select, filtro = {}) {
  let query = supabase.from(tabla).select(select)
  for (const [k, v] of Object.entries(filtro)) query = query.eq(k, v)
  const { data, error } = await query
  if (error) throw new Error(`${tabla}: ${error.message}`)
  return data
}

// ── Agregados ───────────────────────────────────────────────────────────────

// Mesa del hash de la URL (#/mesa/<uuid>) — para el cliente QR anónimo
const mesaDeUrl = () => (window.location.hash.match(/#\/mesa\/([0-9a-f-]{36})/) || [])[1] || null

export async function cargarLocal() {
  // autenticado: lee su fila de `locales`; anónimo: RPC config_publica
  let loc = (await q('locales', 'id, slug, nombre, config'))[0]
  if (!loc) {
    const { data, error } = await supabase.rpc('config_publica', { p_mesa: mesaDeUrl() })
    if (error || !data) throw new Error('sin_local')
    loc = { id: data.localId, slug: data.slug, nombre: data.nombre, config: data.config }
  }
  localId = loc.id
  const cfg = loc.config || {}
  useStore.setState({
    local: { nombre: loc.nombre, ...cfg, reservas: undefined, carta: undefined },
    reservasConfig: cfg.reservas || useStore.getState().reservasConfig,
  })
  // formatos/tiposPan/extras/etiquetas del local (config.carta)
  if (cfg.carta) {
    useStore.setState(s => ({ carta: { ...s.carta, ...cfg.carta } }))
  }
  return loc
}

export async function cargarCarta() {
  const [cats, prods] = await Promise.all([
    q('categorias', 'id, nombre, tipo, emoji, orden'),
    q('productos', 'id, categoria_id, nombre, descripcion, precios, modificadores, alergenos, disponible, orden'),
  ])
  cats.sort((a, b) => a.orden - b.orden); prods.sort((a, b) => a.orden - b.orden)
  useStore.setState(s => ({
    carta: {
      ...s.carta,
      categorias: cats.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, emoji: c.emoji })),
      productos: prods.map(p => ({
        id: p.id, categoria: p.categoria_id, nombre: p.nombre, tipo: cats.find(c => c.id === p.categoria_id)?.tipo || 'comida',
        descripcion: p.descripcion, precios: p.precios, alergenos: p.alergenos || [],
        disponible: p.disponible,
        ingredientes: p.modificadores?.ingredientes || [],
        imagen: p.modificadores?.imagen || '',
      })),
    },
  }))
}

export async function cargarSala() {
  const [mesas, comensales, lineas, empleados] = await Promise.all([
    q('mesas', 'id, numero, zona, capacidad, estado, unida_a, abierta_desde, camarero_id, reserva'),
    q('comensales', 'id, mesa_id, nombre, pagado, propina, metodo_pago, creado_en'),
    q('lineas_pedido', 'id, comensal_id, producto_id, nombre, precio, cantidad, tipo, estado, tiempo, personalizacion, creado_en'),
    q('empleados', 'id, nombre, rol, activo'),
  ])
  lineas.sort((a, b) => a.creado_en < b.creado_en ? -1 : 1)
  comensales.sort((a, b) => a.creado_en < b.creado_en ? -1 : 1)
  const porComensal = {}
  lineas.forEach(l => { (porComensal[l.comensal_id] ||= []).push(desempaquetar(l)) })
  const personasDe = {}
  comensales.forEach(c => {
    (personasDe[c.mesa_id] ||= []).push({
      id: c.id, nombre: c.nombre, pagado: c.pagado,
      propina: Number(c.propina) || 0, metodoPago: c.metodo_pago,
      items: porComensal[c.id] || [],
    })
  })
  useStore.setState({
    empleados: empleados.map(e => ({ ...e, pin: undefined })),
    mesas: mesas.sort((a, b) => a.numero - b.numero).map(m => ({
      id: m.id, numero: m.numero, zona: m.zona, capacidad: m.capacidad,
      estado: m.estado, unidaA: m.unida_a,
      unidas: mesas.filter(x => x.unida_a === m.id).map(x => x.id),
      abiertaDesde: m.abierta_desde,
      camarero: empleados.find(e => e.id === m.camarero_id)?.nombre || null,
      reserva: m.reserva,
      personas: personasDe[m.id] || [],
    })),
  })
}

export async function cargarComandas() {
  const [comandas, lineas, mesas, comensales] = await Promise.all([
    q('comandas', 'id, mesa_id, linea_id, destino, estado, tiempo, hora_entrada'),
    q('lineas_pedido', 'id, comensal_id, nombre, cantidad, personalizacion'),
    q('mesas', 'id, numero, camarero_id'),
    q('comensales', 'id, nombre'),
  ])
  const linea = Object.fromEntries(lineas.map(l => [l.id, l]))
  const mesa = Object.fromEntries(mesas.map(m => [m.id, m]))
  const nombreCom = Object.fromEntries(comensales.map(c => [c.id, c.nombre]))
  const entries = comandas.map(k => {
    const l = linea[k.linea_id]
    if (!l) return null
    return {
      id: k.id, mesaId: k.mesa_id, mesaNumero: mesa[k.mesa_id]?.numero,
      personaId: l.comensal_id, personaNombre: nombreCom[l.comensal_id] || '',
      camarero: null,
      nombre: l.nombre, cantidad: l.cantidad, nota: notaDe(l),
      tiempo: k.tiempo, estado: k.estado, horaEntrada: k.hora_entrada,
      destino: k.destino, lineaId: k.linea_id,
    }
  }).filter(Boolean).sort((a, b) => a.horaEntrada < b.horaEntrada ? -1 : 1)
  useStore.setState({
    pedidosCocina: entries.filter(e => e.destino === 'cocina'),
    pedidosBarra: entries.filter(e => e.destino === 'barra'),
  })
}

export async function cargarAvisos() {
  const avisos = await q('avisos', 'id, mesa_id, nombre, creado_en')
  const mesas = useStore.getState().mesas
  useStore.setState({
    avisos: avisos.map(a => ({
      id: a.id, mesaId: a.mesa_id,
      mesaNumero: mesas.find(m => m.id === a.mesa_id)?.numero,
      personaNombre: a.nombre, hora: a.creado_en,
    })),
  })
}

export async function cargarReservas() {
  const reservas = await q('reservas', 'id, fecha, hora, personas, nombre, email, telefono, zona, notas, estado, mesa_id')
  useStore.setState({
    reservas: reservas.map(r => ({
      id: r.id, fecha: r.fecha, hora: String(r.hora).slice(0, 5), personas: r.personas,
      nombre: r.nombre, email: r.email, telefono: r.telefono, zona: r.zona,
      notas: r.notas, estado: r.estado, mesaId: r.mesa_id,
    })),
  })
}

export async function cargarHistorial() {
  const tickets = await q('tickets', 'id, numero, mesa_numero, cerrado_en, total, propina, pagos, detalle, camarero, cobrado_por')
  useStore.setState({
    historial: tickets.sort((a, b) => a.cerrado_en < b.cerrado_en ? 1 : -1).map(t => ({
      id: t.id, numero: t.numero, mesaNumero: t.mesa_numero, cerradaEn: t.cerrado_en,
      total: Number(t.total), propina: Number(t.propina), pagos: t.pagos,
      personas: t.detalle, camarero: t.camarero, cobradoPor: t.cobrado_por,
    })),
  })
}

export async function cargarFichajes() {
  try {
    const fichajes = await q('fichajes', 'id, empleado_id, entrada, salida, editado_por')
    useStore.setState({
      fichajes: fichajes.map(f => ({
        id: f.id, empleadoId: f.empleado_id, entrada: f.entrada, salida: f.salida,
        editadoPor: f.editado_por,
      })),
    })
  } catch { /* tabla aún no migrada: se ignora */ }
}

export async function cargarTodo() {
  // la identidad puede fallar (anon sin migración 05): carta y sala son
  // lecturas públicas y deben cargar igualmente.
  try { await cargarLocal() } catch (e) { console.warn('v2 local:', e.message) }
  await Promise.all([cargarCarta(), cargarSala()])
  await Promise.all([cargarComandas(), cargarAvisos(), cargarReservas(), cargarHistorial(), cargarFichajes()])
}

// ── Cliente QR anónimo: su mesa vía estado_mesa (RLS no le deja ver tablas) ──
export async function refrescarMesaAnon() {
  const mesaId = mesaDeUrl()
  if (!mesaId) return
  const { data, error } = await supabase.rpc('estado_mesa', { p_mesa: mesaId })
  if (error || !data?.mesa) return
  const personas = (data.comensales || []).map(c => ({
    id: c.id, nombre: c.nombre, pagado: c.pagado,
    items: (c.items || []).map(i => ({
      uid: i.id, id: i.id, nombre: i.nombre, precio: Number(i.precio),
      cantidad: i.cantidad, tipo: i.tipo, estado: i.estado, tiempo: i.tiempo,
      pan: i.personalizacion?.pan ?? null, quitados: i.personalizacion?.quitados ?? [],
      anadidos: i.personalizacion?.anadidos ?? [], nota: i.personalizacion?.nota ?? '',
      preparacion: i.preparacion,
    })),
  }))
  // pseudo-comandas para que el cliente vea el estado de SU pedido
  const pedidos = personas.flatMap(p => p.items
    .filter(i => i.estado === 'enviado' && i.preparacion)
    .map(i => ({
      id: 'v2-' + i.uid, mesaId, personaId: p.id, personaNombre: p.nombre,
      nombre: i.nombre, cantidad: i.cantidad, tipo: i.tipo,
      estado: i.preparacion, horaEntrada: null,
    })))
  useStore.setState(s => ({
    mesas: s.mesas.map(m => m.id !== mesaId ? m : {
      ...m, estado: data.mesa.estado, abiertaDesde: data.mesa.abiertaDesde, personas,
    }),
    pedidosCocina: pedidos.filter(p => p.tipo === 'comida'),
    pedidosBarra: pedidos.filter(p => p.tipo !== 'comida'),
    avisos: data.avisoActivo
      ? [{ id: 'aviso-' + mesaId, mesaId, mesaNumero: data.mesa.numero, hora: new Date().toISOString() }]
      : [],
  }))
}

let pollAnon = null
export let esAnon = false
export function iniciarModoAnon() {
  esAnon = true
  refrescarMesaAnon()
  clearInterval(pollAnon)
  pollAnon = setInterval(refrescarMesaAnon, 4000)
  window.addEventListener('hashchange', refrescarMesaAnon)
}

// Refresco del servicio según el modo: personal ve las tablas (RLS);
// el cliente anónimo solo SU mesa (estado_mesa). Si el anónimo llamara a
// cargarSala, el RLS le devolvería comensales vacíos y pisaría su mesa.
export function refrescarServicio() {
  return esAnon ? refrescarMesaAnon() : cargarSala()
}

// ── Realtime: refresco por agregado, con debounce ───────────────────────────
const pendientes = new Set()
let timer = null
function programar(recarga) {
  pendientes.add(recarga)
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const lote = [...pendientes]; pendientes.clear()
    for (const fn of lote) { try { await fn() } catch (e) { console.warn('recarga v2:', e.message) } }
  }, 250)
}

export function iniciarRealtime() {
  return suscribirLocal(localId, {
    mesas: () => programar(cargarSala),
    comensales: () => programar(cargarSala),
    lineas_pedido: () => { programar(cargarSala); programar(cargarComandas) },
    comandas: () => programar(cargarComandas),
    avisos: () => programar(cargarAvisos),
    reservas: () => programar(cargarReservas),
  })
}
