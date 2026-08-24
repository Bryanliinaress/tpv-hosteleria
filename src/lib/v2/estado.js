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
export const desempaquetar = (l) => ({
  uid: l.id, id: l.id,                       // las pantallas usan uid; conservamos id real
  productoId: l.producto_id, nombre: l.nombre, precio: Number(l.precio),
  cantidad: l.cantidad, tipo: l.tipo, estado: l.estado, tiempo: l.tiempo,
  // sin esto, «otra ronda» no sabe agrupar la última comanda y repetiría todo
  creadoEn: l.creado_en ?? null,
  pan: l.personalizacion?.pan ?? null,
  quitados: l.personalizacion?.quitados ?? [],
  anadidos: l.personalizacion?.anadidos ?? [],
  nota: l.personalizacion?.nota ?? '',
  // sin esto el reparto de la cuenta trata el plato como de uno solo, y el
  // botón de compartir se queda sin saber a quién ya se lo compartiste
  compartidoCon: l.compartido_con ?? [],
  // Las elecciones del menú del día se MANDAN al servidor (ahí calcula el
  // suplemento del solomillo) pero no se leían de vuelta. `configDeItem` las
  // necesita: sin ellas, «otra ronda» repetía el menú SIN suplemento —el bar
  // regalaba los 2 €— y cocina no sabía qué segundo era. Además la línea
  // parecía «sin personalizar» y el +/– de la tarjeta la subía como si fuera
  // un café. En la demo no pasa: allí el item nunca sale de la BBDD.
  elecciones: l.personalizacion?.elecciones ?? [],
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

// Un producto SIN formatos (un café, un refresco) se guarda en la BBDD como
// `precios: { base: 1.30 }`, porque la columna es un mapa. Devolverlo tal cual
// hacía que el resto de la app lo tomara por un producto CON formatos: la hoja
// de pan salía vacía (ningún formato casa con «base») y la línea se añadía a
// **0,00 €**. Se traduce aquí, en el borde: `base` → `precio`, que es el shape
// que documenta el store («o `precios`, o `precio`, nunca los dos»).
export function preciosDeProducto(precios) {
  const mapa = precios && typeof precios === 'object' ? precios : {}
  const claves = Object.keys(mapa)
  const sinFormatos = claves.length === 0 || (claves.length === 1 && claves[0] === 'base')
  return sinFormatos ? { precio: Number(mapa.base) || 0 } : { precios: mapa }
}

// El cliente que entra por el QR NO tiene sesión, y no debe bajarse columnas
// con datos de terceros: `mesas.reserva` lleva el NOMBRE Y EL TELÉFONO de quien
// reservó, y acababa guardado en el móvil de cualquiera que abriera la carta.
const COLS_MESA_PUBLICAS = 'id, numero, zona, capacidad, estado, unida_a'
const COLS_MESA_PERSONAL = `${COLS_MESA_PUBLICAS}, abierta_desde, camarero_id, reserva`
async function conSesion() {
  const { data } = await supabase.auth.getSession()
  return !!data?.session
}

async function q(tabla, select, filtro = {}, desde = null) {
  let query = supabase.from(tabla).select(select)
  for (const [k, v] of Object.entries(filtro)) query = query.eq(k, v)
  if (desde) query = query.gte(desde.col, desde.valor)
  const { data, error } = await query
  if (error) throw new Error(`${tabla}: ${error.message}`)
  return data
}

// ── Cuánto historial se baja ────────────────────────────────────────────────
//
// `cargarHistorial` se traía TODOS los tickets del local, con su `detalle`
// entero (las líneas de cada comensal), y `cargarTodo()` corre al arrancar Y
// cada vez que la tablet vuelve del segundo plano. Con 5 tickets no se nota;
// a 100 tickets al día son decenas de MB bajándose en cada despertar, en cada
// aparato. Y ninguna pantalla enseña más que el mes: Admin e Informes filtran
// por mes, Mostrador y PDA por hoy.
//
// La ventana empieza en el mes ANTERIOR (margen de sobra para el mes en curso)
// y, si el bar lleva sin cerrar caja más tiempo que eso, se estira hasta el
// último cierre: el arqueo suma «desde el último cierre» y dejarse tickets
// fuera sería descuadrar la caja.
const MESES_HISTORIAL = 2
export function inicioVentanaHistorial(ahora = new Date(), ultimoCierre = null) {
  const d = new Date(ahora.getFullYear(), ahora.getMonth() - (MESES_HISTORIAL - 1), 1)
  if (ultimoCierre) {
    const c = new Date(ultimoCierre)
    if (!Number.isNaN(c.getTime()) && c < d) return c.toISOString()
  }
  return d.toISOString()
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
    // `nombre` va DESPUÉS del spread a propósito: la columna manda sobre lo que
    // haya quedado dentro de `config`. Al sembrar un local, la config se copia
    // entera del origen y arrastra su `nombre`; con el orden al revés, renombrar
    // el local no se veía en ninguna pantalla — se renombró en la BBDD y todo
    // seguía diciendo «Casa Loli».
    local: { ...cfg, nombre: loc.nombre, reservas: undefined, carta: undefined },
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
        descripcion: p.descripcion, ...preciosDeProducto(p.precios), alergenos: p.alergenos || [],
        disponible: p.disponible,
        ingredientes: p.modificadores?.ingredientes || [],
        imagen: p.modificadores?.imagen || '',
        menu: p.modificadores?.menu || null,
        nombreEn: p.modificadores?.nombreEn || '',
        descripcionEn: p.modificadores?.descripcionEn || '',
      })),
    },
    // A partir de aquí lo que se ve es la carta DEL LOCAL, no la de ejemplo con
    // la que arranca el store. Hasta este momento la pantalla dice «cargando»
    // en vez de «no hay nada», que es lo que leía el cliente al escanear.
    hidratado: true,
  }))
}

export async function cargarSala() {
  const personal = await conSesion()
  const [mesas, comensales, lineas, empleados] = await Promise.all([
    q('mesas', personal ? COLS_MESA_PERSONAL : COLS_MESA_PUBLICAS),
    q('comensales', 'id, mesa_id, nombre, pagado, propina, metodo_pago, creado_en'),
    q('lineas_pedido', 'id, comensal_id, producto_id, nombre, precio, cantidad, tipo, estado, tiempo, personalizacion, compartido_con, creado_en'),
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
      abiertaDesde: m.abierta_desde ?? null,
      camarero: empleados.find(e => e.id === m.camarero_id)?.nombre || null,
      reserva: m.reserva ?? null,
      personas: personasDe[m.id] || [],
    })),
  })
}

export async function cargarComandas() {
  const [comandas, lineas, mesas, comensales] = await Promise.all([
    q('comandas', 'id, mesa_id, linea_id, destino, estado, tiempo, hora_entrada'),
    q('lineas_pedido', 'id, comensal_id, nombre, cantidad, personalizacion'),
    q('mesas', await conSesion() ? 'id, numero, camarero_id' : 'id, numero'),
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
  const ultimoCierre = useStore.getState().cierres?.[0]?.hasta ?? null
  const desde = { col: 'cerrado_en', valor: inicioVentanaHistorial(new Date(), ultimoCierre) }
  const tickets = await q('tickets', 'id, numero, mesa_numero, cerrado_en, total, propina, pagos, detalle, camarero, cobrado_por, fiscal_estado, fiscal_qr, fiscal_url, fiscal_error', {}, desde)
  useStore.setState({
    historial: tickets.sort((a, b) => a.cerrado_en < b.cerrado_en ? 1 : -1).map(t => ({
      id: t.id, numero: t.numero, mesaNumero: t.mesa_numero, cerradaEn: t.cerrado_en,
      total: Number(t.total), propina: Number(t.propina), pagos: t.pagos,
      fiscalEstado: t.fiscal_estado, fiscalQr: t.fiscal_qr, fiscalUrl: t.fiscal_url, fiscalError: t.fiscal_error,
      personas: t.detalle, camarero: t.camarero, cobradoPor: t.cobrado_por,
    })),
  })
}

export async function cargarCierres() {
  const haceUnAno = new Date(Date.now() - 365 * 86400000).toISOString()
  const cierres = await q('cierres_caja', 'id, desde, hasta, total, propinas, pagos, n_tickets, contado, descuadre', {}, { col: 'hasta', valor: haceUnAno })
  useStore.setState({
    cierres: cierres.sort((a, b) => a.hasta < b.hasta ? 1 : -1).map(c => ({
      id: c.id, desde: c.desde, hasta: c.hasta,
      total: Number(c.total), propinas: Number(c.propinas), pagos: c.pagos,
      nTickets: c.n_tickets,
      contado: c.contado != null ? Number(c.contado) : null,
      descuadre: c.descuadre != null ? Number(c.descuadre) : null,
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
  // Los cierres van ANTES que el historial: la ventana de tickets se estira
  // hasta el último cierre, y si aún no están cargados no hay hasta dónde.
  await cargarCierres().catch(() => {})
  await Promise.all([cargarComandas(), cargarAvisos(), cargarReservas(), cargarHistorial(), cargarFichajes()])
}

// ── Cliente QR anónimo: su mesa vía estado_mesa (RLS no le deja ver tablas) ──
export async function refrescarMesaAnon() {
  const mesaId = mesaDeUrl()
  if (!mesaId) return
  const { data, error } = await supabase.rpc('estado_mesa', { p_mesa: mesaId })
  if (error || !data?.mesa) return
  // MISMO desempaquetado que el personal, a propósito. Antes esto era una copia
  // a mano y se quedaba corta cada vez que se añadía un campo: se dejaba fuera
  // `compartido_con` —y el botón de «Dividir este plato» vive precisamente en
  // esta pantalla, la del móvil del cliente— y las `elecciones` del menú. Dos
  // sitios que hacen lo mismo significa que uno de los dos está mal.
  const personas = (data.comensales || []).map(c => ({
    id: c.id, nombre: c.nombre, pagado: c.pagado,
    // el recibo del cliente lee los suyos; sin esto sale «propina 0» y sin
    // método aunque acabe de pagar con tarjeta
    propina: Number(c.propina) || 0, metodoPago: c.metodo_pago ?? null,
    items: (c.items || []).map(i => ({ ...desempaquetar(i), preparacion: i.preparacion })),
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
