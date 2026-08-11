import { supabase } from '../supabase'
import { useStore, propinasPorMetodoDe } from '../../store/useStore'
import { reservas as rpcReservas, personal } from '../repo'
import { toast } from '../../store/useUI'
import { sembrarCartaEjemplo, vaciarCartaV2 } from './plantillaCarta'
import { cabezaDe, miembrosDe } from './grupos'
import { revisarCorreccionFichaje } from '../fichajes'
import { revisarNuevoEmpleado, revisarCambioEmpleado, revisarBajaEmpleado } from '../personal'
import { getLocalId, cargarSala, cargarComandas, cargarReservas, cargarCarta, cargarLocal, cargarHistorial, cargarFichajes, cargarCierres } from './estado'

// Segunda ola de acciones v2: KDS, agenda de reservas, CRUD de carta/sala/
// personal, caja y config del local. Personal/admin operan por RLS.
const err = (e) => { toast('No se pudo completar la operación', 'error'); console.warn('v2:', e) }
const t = (n) => supabase.from(n)

// merge profundo de la config del local (identidad + reservas + carta)
async function actualizarConfig(parche) {
  const { data, error } = await t('locales').select('id, config').eq('id', getLocalId()).single()
  if (error) throw error
  const mezcla = { ...data.config, ...parche }
  for (const k of ['reservas', 'carta']) {
    if (parche[k]) mezcla[k] = { ...(data.config[k] || {}), ...parche[k] }
  }
  const { error: e2 } = await t('locales').update({ config: mezcla }).eq('id', getLocalId())
  if (e2) throw e2
  await cargarLocal(); await cargarCarta()
}
const cartaCfg = () => useStore.getState().carta


export function accionesV2b() {
  const st = () => useStore.getState()
  const acciones = {
    // ── KDS (nombres reales que usan las pantallas) ─────────────
    actualizarEstadoCocina: async (id, estado) => {
      try { await t('comandas').update({ estado }).eq('id', id); cargarComandas() } catch (e) { err(e) }
    },
    actualizarEstadoBarra: async (id, estado) => {
      try { await t('comandas').update({ estado }).eq('id', id); cargarComandas() } catch (e) { err(e) }
    },

    // ── Reservas: cliente online (RPC anónima, aforo en servidor) ──
    crearReserva: (datos) => {
      return rpcReservas.crear(getLocalId(), datos).then(res => {
        const fila = Array.isArray(res) ? res[0] : res
        // copia local para que el cliente vea "su" reserva en esta sesión
        useStore.setState(s => ({
          reservas: [...s.reservas, {
            id: fila.reserva_id, token: fila.token, ...datos,
            estado: 'confirmada', mesaId: null, creada: new Date().toISOString(),
          }],
        }))
        return fila.reserva_id
      }).catch(e => { err(e); return null })
    },

    // ── Reservas: agenda del personal ───────────────────────────
    cambiarEstadoReserva: async (id, estado) => {
      const r = st().reservas.find(x => x.id === id)
      try {
        const { count } = await t('reservas').update({ estado }, { count: 'exact' }).eq('id', id)
        if (!count && estado === 'cancelada' && r?.token) await rpcReservas.cancelar(r.token) // cliente anónimo
        if (r?.mesaId) await t('mesas').update({ estado: 'libre', reserva: null }).eq('id', r.mesaId).eq('estado', 'reservada')
        cargarReservas(); cargarSala()
      } catch (e) { err(e) }
    },
    actualizarReserva: async (id, cambios) => {
      const r = st().reservas.find(x => x.id === id)
      try {
        await t('reservas').update({
          fecha: cambios.fecha ?? r.fecha, hora: cambios.hora ?? r.hora,
          personas: cambios.personas ?? r.personas, zona: cambios.zona ?? r.zona,
          nombre: cambios.nombre ?? r.nombre, email: cambios.email ?? r.email,
          telefono: cambios.telefono ?? r.telefono, notas: cambios.notas ?? r.notas,
          mesa_id: null,
        }).eq('id', id)
        if (r?.mesaId) await t('mesas').update({ estado: 'libre', reserva: null }).eq('id', r.mesaId).eq('estado', 'reservada')
        cargarReservas(); cargarSala()
      } catch (e) { err(e) }
    },
    asignarReservaMesa: async (id, mesaId) => {
      const r = st().reservas.find(x => x.id === id)
      try {
        if (r?.mesaId && r.mesaId !== mesaId) await t('mesas').update({ estado: 'libre', reserva: null }).eq('id', r.mesaId).eq('estado', 'reservada')
        await t('reservas').update({ mesa_id: mesaId }).eq('id', id)
        await t('mesas').update({ estado: 'reservada', reserva: { nombre: r.nombre, hora: r.hora, personas: r.personas, telefono: r.telefono, reservaId: r.id } }).eq('id', mesaId).eq('estado', 'libre')
        cargarReservas(); cargarSala()
      } catch (e) { err(e) }
    },
    sentarReservaAgenda: async (id) => {
      const r = st().reservas.find(x => x.id === id)
      if (!r?.mesaId) return null
      try {
        await t('mesas').update({ estado: 'libre', reserva: null }).eq('id', r.mesaId)
        const pid = await st().unirseAMesa(r.mesaId, r.nombre)
        await t('reservas').update({ estado: 'sentada' }).eq('id', id)
        cargarReservas(); cargarSala()
        return pid
      } catch (e) { err(e); return null }
    },
    // bloqueo puntual de mesa (sin agenda) y sentar
    reservarMesa: async (mesaId, datos) => {
      try { await t('mesas').update({ estado: 'reservada', reserva: datos }).eq('id', mesaId).eq('estado', 'libre'); cargarSala() } catch (e) { err(e) }
    },
    cancelarReserva: async (mesaId) => {
      try { await t('mesas').update({ estado: 'libre', reserva: null }).eq('id', mesaId).eq('estado', 'reservada'); cargarSala() } catch (e) { err(e) }
    },
    sentarReserva: async (mesaId, nombre) => {
      try {
        await t('mesas').update({ estado: 'libre', reserva: null }).eq('id', mesaId)
        return await st().unirseAMesa(mesaId, nombre)
      } catch (e) { err(e); return null }
    },

    // ── Sala (admin) ────────────────────────────────────────────
    addMesa: async () => {
      const ms = st().mesas
      const numero = Math.max(0, ...ms.map(m => m.numero)) + 1
      try { await t('mesas').insert({ local_id: getLocalId(), numero, zona: ms[ms.length - 1]?.zona || 'Sala', capacidad: 4 }); cargarSala() } catch (e) { err(e) }
    },
    removeMesa: async (mesaId) => {
      try { await t('mesas').delete().eq('id', mesaId).eq('estado', 'libre'); cargarSala() } catch (e) { err(e) }
    },
    // Zona y capacidad de una mesa. Sin esto, el admin de la app real las
    // cambiaba «en pantalla» y la siguiente sincronización las devolvía.
    updateMesa: async (mesaId, cambios) => {
      const parche = {}
      if (cambios.capacidad !== undefined) parche.capacidad = Math.max(1, Number(cambios.capacidad) || 1)
      if (cambios.zona !== undefined) parche.zona = (cambios.zona || '').trim() || 'Sala'
      if (!Object.keys(parche).length) return
      try { await t('mesas').update(parche).eq('id', mesaId); cargarSala() } catch (e) { err(e) }
    },
    // El Mostrador junta mesas con `agruparMesas` y la PDA con `fusionarMesa`:
    // son la misma operación y las dos tienen que llegar al servidor.
    //
    // Ojo con los GRUPOS: aquí los comensales se quedan en su mesa y lo que las
    // une es `unida_a` (al cobrar, el servidor recoge el grupo entero). El RPC
    // rechaza una secundaria que ya sea cabeza de otro grupo, así que juntar
    // dos grupos —dos mesas de cuatro ya unidas más otra— fallaba, y encima la
    // pantalla cantaba «mesas unidas».
    agruparMesas: async (principalId, secundariaId) => {
      const mesas = st().mesas
      const p = cabezaDe(mesas.find(m => m.id === principalId), mesas)
      const s = cabezaDe(mesas.find(m => m.id === secundariaId), mesas)
      if (!p || !s || p.id === s.id) return
      const grupoSec = miembrosDe(s, mesas)
      try {
        if (grupoSec.length === 1) {
          await personal.agruparMesas(p.id, s.id)     // camino normal, validado en el servidor
        } else {
          await t('mesas').update({ unida_a: p.id, estado: p.estado }).in('id', grupoSec)
        }
        cargarSala(); cargarComandas()
      } catch (e) { err(e) }
    },
    // Separar deja las secundarias libres. Antes de eso hay que llevarse la
    // cuenta a la cabeza: en v2 los comensales siguen en su mesa, así que sin
    // esto una mesa volvía a figurar LIBRE con gente sentada y su consumo sin
    // cobrar — y el siguiente cliente que escanease ese QR se encontraría la
    // cuenta del anterior.
    separarMesas: async (mesaId) => {
      const mesas = st().mesas
      const cab = cabezaDe(mesas.find(m => m.id === mesaId), mesas)
      const secundarias = mesas.filter(m => m.unidaA === cab?.id).map(m => m.id)
      if (!cab || !secundarias.length) return
      try {
        await t('comensales').update({ mesa_id: cab.id }).in('mesa_id', secundarias)
        await t('comandas').update({ mesa_id: cab.id }).in('mesa_id', secundarias)
        await personal.separarMesas(cab.id)
        cargarSala(); cargarComandas()
      } catch (e) { err(e) }
    },
    // Mover a un cliente de mesa: se lleva sus líneas (cuelgan de él) y sus
    // comandas (que cuelgan de la mesa: si no, cocina sigue viendo la vieja).
    transferirComensal: async (origenId, personaId, destinoId) => {
      if (origenId === destinoId) return
      const origen = st().mesas.find(m => m.id === origenId)
      const destino = st().mesas.find(m => m.id === destinoId)
      const persona = origen?.personas.find(p => p.id === personaId)
      if (!persona || !destino) return
      try {
        await t('comensales').update({ mesa_id: destinoId }).eq('id', personaId)
        const lineas = (persona.items || []).map(i => i.uid).filter(Boolean)
        if (lineas.length) await t('comandas').update({ mesa_id: destinoId }).in('linea_id', lineas)
        if (destino.estado === 'libre') {
          await t('mesas').update({ estado: 'ocupada', abierta_desde: new Date().toISOString() }).eq('id', destinoId)
        }
        if (origen.personas.filter(p => p.id !== personaId).length === 0) {
          await t('mesas').update({ estado: 'libre', abierta_desde: null, camarero_id: null }).eq('id', origenId)
        }
        cargarSala(); cargarComandas()
      } catch (e) { err(e) }
    },
    // El asistente de alta manda `{nombre, mesas, capacidad}`. Aquí se leía
    // `z.n`, que no existe: `Array.from({length: undefined})` da [], así que el
    // alta de un bar BORRABA la sala y no creaba ninguna mesa — y encima el
    // aviso decía «Sala configurada: undefined mesas».
    configurarSala: (zonas) => {
      const ocupadas = st().mesas.some(m => m.estado !== 'libre')
      if (ocupadas) return { ok: false, error: 'Hay mesas ocupadas: cierra la sala antes de reconfigurarla' }
      const plan = (zonas || []).map(z => ({
        nombre: (z.nombre || 'Sala').trim() || 'Sala',
        n: Math.max(0, Number(z.mesas ?? z.n) || 0),
        capacidad: Math.max(1, Number(z.capacidad) || 4),
      }))
      const total = plan.reduce((s, z) => s + z.n, 0)
      // sin mesas que crear no se borra nada: dejar al bar sin sala es peor
      if (!total) return { ok: false, error: 'Configura al menos una mesa' }
      ;(async () => {
        try {
          await t('mesas').delete().eq('local_id', getLocalId())
          let n = 1
          const filas = plan.flatMap(z => Array.from({ length: z.n }, () => ({
            local_id: getLocalId(), numero: n++, zona: z.nombre, capacidad: z.capacidad,
          })))
          await t('mesas').insert(filas)
          cargarSala()
        } catch (e) { err(e) }
      })()
      return { ok: true, total }
    },

    // ── Carta (admin) ───────────────────────────────────────────
    addProducto: async (p) => {
      try {
        await t('productos').insert({
          local_id: getLocalId(), categoria_id: p.categoria, nombre: p.nombre,
          descripcion: p.descripcion || '', precios: p.precios || { base: p.precio ?? 0 },
          modificadores: { ingredientes: p.ingredientes || [], imagen: p.imagen || '', menu: p.menu || null, nombreEn: (p.nombreEn || '').trim(), descripcionEn: (p.descripcionEn || '').trim() },
          alergenos: p.alergenos || [], disponible: true,
          orden: st().carta.productos.length,
        }); cargarCarta()
      } catch (e) { err(e) }
    },
    updateProducto: async (id, c) => {
      const p = st().carta.productos.find(x => x.id === id)
      try {
        await t('productos').update({
          categoria_id: c.categoria ?? p.categoria, nombre: c.nombre ?? p.nombre,
          descripcion: c.descripcion ?? p.descripcion,
          // sin el último fallback, editar solo el nombre de un café (que ya no
          // lleva `precios`, ver preciosDeProducto) le borraba el precio
          precios: c.precios ?? (c.precio != null ? { base: c.precio } : p.precios ?? { base: p.precio ?? 0 }),
          modificadores: { ingredientes: c.ingredientes ?? p.ingredientes, imagen: c.imagen ?? p.imagen, menu: c.menu !== undefined ? c.menu : p.menu ?? null, nombreEn: (c.nombreEn ?? p.nombreEn ?? '').trim(), descripcionEn: (c.descripcionEn ?? p.descripcionEn ?? '').trim() },
          alergenos: c.alergenos ?? p.alergenos,
        }).eq('id', id); cargarCarta()
      } catch (e) { err(e) }
    },
    deleteProducto: async (id) => { try { await t('productos').delete().eq('id', id); cargarCarta() } catch (e) { err(e) } },
    addCategoria: async (nombre, tipo) => {
      try { await t('categorias').insert({ local_id: getLocalId(), nombre, tipo: tipo || 'comida', orden: st().carta.categorias.length }); cargarCarta() } catch (e) { err(e) }
    },
    removeCategoria: async (id) => { try { await t('categorias').delete().eq('id', id); cargarCarta() } catch (e) { err(e) } },

    // Un local recién registrado nace sin carta: puede arrancar con la de
    // ejemplo (para editarla) o vaciarla y hacer la suya.
    sembrarCarta: () => sembrarCartaEjemplo().catch(err),
    vaciarCarta: () => vaciarCartaV2().catch(err),

    // config de carta del local (formatos/panes/extras/etiquetas)
    addFormato: (nombre) => actualizarConfig({ carta: { formatos: [...(cartaCfg().formatos || []), { id: nombre.toLowerCase().replace(/\W+/g, '-'), nombre }] } }).catch(err),
    removeFormato: (id) => actualizarConfig({ carta: { formatos: (cartaCfg().formatos || []).filter(f => f.id !== id) } }).catch(err),
    renombrarFormato: (id, nombre) => actualizarConfig({ carta: { formatos: (cartaCfg().formatos || []).map(f => f.id === id ? { ...f, nombre } : f) } }).catch(err),
    // `sup`, no `suplemento`: es la clave que leen las pantallas (y el servidor
    // al cobrar). Con el nombre viejo, el «sin gluten +1,20 €» creado desde la
    // app real ni se enseñaba ni se cobraba.
    addTipoPan: (nombre, sup) => actualizarConfig({ carta: { tiposPan: [...(cartaCfg().tiposPan || []), { id: nombre.toLowerCase().replace(/\W+/g, '-'), nombre, sup: Number(sup) || 0 }] } }).catch(err),
    removeTipoPan: (id) => actualizarConfig({ carta: { tiposPan: (cartaCfg().tiposPan || []).filter(x => x.id !== id) } }).catch(err),
    addExtra: (nombre, precio = 0.2) => actualizarConfig({ carta: { extras: [...(cartaCfg().extras || []), { nombre, precio }] } }).catch(err),
    removeExtra: (nombre) => actualizarConfig({ carta: { extras: (cartaCfg().extras || []).filter(e => (e.nombre || e) !== nombre) } }).catch(err),

    // ── Personal (admin) ────────────────────────────────────────
    // Las pantallas leen el resultado EN EL ACTO (`if (!r.ok)`): si esto fuera
    // async devolvería una promesa y el alta de un empleado cantaría un error
    // falso aunque se hubiera creado. Se valida ya y se escribe por detrás.
    addEmpleado: ({ nombre, pin, rol }) => {
      const r = revisarNuevoEmpleado(st().empleados, { nombre, pin })
      if (!r.ok) return r
      ;(async () => {
        try {
          const { data, error } = await t('empleados').insert({ local_id: getLocalId(), nombre: r.nombre, rol: rol === 'admin' ? 'admin' : 'camarero' }).select('id').single()
          if (error) throw error
          await personal.fijarPin(data.id, r.pin)
          cargarSala()
        } catch (e) { err(e) }
      })()
      return { ok: true }
    },
    updateEmpleado: (id, cambios) => {
      const rev = revisarCambioEmpleado(st().empleados, id, cambios)
      if (!rev.ok) return rev
      ;(async () => {
        try {
          const { pin, ...resto } = cambios
          if (Object.keys(resto).length) await t('empleados').update(resto).eq('id', id)
          if (pin) await personal.fijarPin(id, pin)
          cargarSala()
        } catch (e) { err(e) }
      })()
      return { ok: true }
    },
    removeEmpleado: (id) => {
      const rev = revisarBajaEmpleado(st().empleados, id)
      if (!rev.ok) return rev
      ;(async () => {
        try { await t('empleados').delete().eq('id', id); cargarSala() } catch (e) { err(e) }
      })()
      return { ok: true }
    },

    // ── Local / reservas config ─────────────────────────────────
    updateLocal: (cambios) => actualizarConfig(cambios).catch(err),
    updateEtiquetas: (cambios) => actualizarConfig({ carta: { etiquetas: { ...(cartaCfg().etiquetas || {}), ...cambios } } }).catch(err),
    updateReservasConfig: (cambios) => actualizarConfig({ reservas: cambios }).catch(err),

    // ── Fichajes (correcciones del admin) ───────────────────────
    // La pantalla lee el resultado en el acto (`if (!r.ok)`), así que esto
    // responde ya y escribe por detrás. Antes devolvía una promesa: el admin
    // veía «error» —vacío— aunque la corrección se hubiera guardado bien.
    editarFichaje: (id, cambios) => {
      const r = revisarCorreccionFichaje(st().fichajes.find(x => x.id === id), cambios)
      if (!r.ok) return r
      ;(async () => {
        try {
          await t('fichajes').update({ entrada: r.entrada, salida: r.salida, editado_por: cambios.editadoPor || 'admin' }).eq('id', id)
          cargarFichajes()
        } catch (e) { err(e) }
      })()
      return { ok: true }
    },
    borrarFichaje: async (id) => { try { await t('fichajes').delete().eq('id', id); cargarFichajes() } catch (e) { err(e) } },

    // ── Caja (arqueo Z sobre tickets del servidor) ──────────────
    cerrarCaja: async (contado) => {
      try {
        const { data: cierres } = await t('cierres_caja').select('hasta').order('hasta', { ascending: false }).limit(1)
        const desde = cierres?.[0]?.hasta || null
        // `detalle` hace falta para saber qué propinas se dejaron EN METÁLICO:
        // ese dinero está en el cajón y hay que esperarlo al contar
        let qt = t('tickets').select('total, propina, pagos, detalle')
        if (desde) qt = qt.gt('cerrado_en', desde)
        const { data: tk } = await qt
        const total = tk.reduce((s, x) => s + Number(x.total), 0)
        const propinas = tk.reduce((s, x) => s + Number(x.propina), 0)
        const pagos = {}
        tk.forEach(x => Object.entries(x.pagos || {}).forEach(([k, v]) => { if (k !== 'descuento') pagos[k] = (pagos[k] || 0) + (Number(v) || 0) }))
        const propinasEfectivo = tk.reduce((s, x) => s + (propinasPorMetodoDe({ personas: x.detalle }).efectivo || 0), 0)
        const efectivoEsperado = Math.round(((pagos.efectivo || 0) + propinasEfectivo) * 100) / 100
        await t('cierres_caja').insert({
          local_id: getLocalId(), desde, total, propinas, pagos, n_tickets: tk.length,
          contado: contado != null ? Number(contado) : null,
          descuadre: contado != null ? Math.round((Number(contado) - efectivoEsperado) * 100) / 100 : null,
        })
        cargarHistorial(); cargarCierres()
      } catch (e) { err(e) }
    },
  }
  // OJO al orden: la PDA dice «mover / juntar A la mesa elegida», así que su
  // segundo argumento es el DESTINO, que es quien se queda la cuenta. En
  // `agruparMesas` la cabeza es el primero. Pasándolos tal cual, en la app real
  // la cuenta se quedaba en la mesa de origen y la elegida colgaba de ella:
  // justo lo contrario de lo que pedía el camarero.
  acciones.fusionarMesa = (origenId, destinoId) => acciones.agruparMesas(destinoId, origenId)
  return acciones
}
