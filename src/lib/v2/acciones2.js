import { supabase } from '../supabase'
import { useStore } from '../../store/useStore'
import { reservas as rpcReservas, personal } from '../repo'
import { toast } from '../../store/useUI'
import { getLocalId, cargarSala, cargarComandas, cargarReservas, cargarCarta, cargarLocal, cargarHistorial, cargarFichajes } from './estado'

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
  return {
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
    configurarSala: (zonas) => {
      const ocupadas = st().mesas.some(m => m.estado !== 'libre')
      if (ocupadas) return { ok: false, error: 'Hay mesas ocupadas: cierra la sala antes de reconfigurarla' }
      ;(async () => {
        try {
          await t('mesas').delete().eq('local_id', getLocalId())
          let n = 1
          const filas = zonas.flatMap(z => Array.from({ length: z.n }, () => ({ local_id: getLocalId(), numero: n++, zona: z.nombre, capacidad: z.capacidad || 4 })))
          if (filas.length) await t('mesas').insert(filas)
          cargarSala()
        } catch (e) { err(e) }
      })()
      return { ok: true }
    },

    // ── Carta (admin) ───────────────────────────────────────────
    addProducto: async (p) => {
      try {
        await t('productos').insert({
          local_id: getLocalId(), categoria_id: p.categoria, nombre: p.nombre,
          descripcion: p.descripcion || '', precios: p.precios || { base: p.precio ?? 0 },
          modificadores: { ingredientes: p.ingredientes || [], imagen: p.imagen || '' },
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
          precios: c.precios ?? (c.precio != null ? { base: c.precio } : p.precios),
          modificadores: { ingredientes: c.ingredientes ?? p.ingredientes, imagen: c.imagen ?? p.imagen },
          alergenos: c.alergenos ?? p.alergenos,
        }).eq('id', id); cargarCarta()
      } catch (e) { err(e) }
    },
    deleteProducto: async (id) => { try { await t('productos').delete().eq('id', id); cargarCarta() } catch (e) { err(e) } },
    addCategoria: async (nombre, tipo) => {
      try { await t('categorias').insert({ local_id: getLocalId(), nombre, tipo: tipo || 'comida', orden: st().carta.categorias.length }); cargarCarta() } catch (e) { err(e) }
    },
    removeCategoria: async (id) => { try { await t('categorias').delete().eq('id', id); cargarCarta() } catch (e) { err(e) } },

    // config de carta del local (formatos/panes/extras/etiquetas)
    addFormato: (nombre) => actualizarConfig({ carta: { formatos: [...(cartaCfg().formatos || []), { id: nombre.toLowerCase().replace(/\W+/g, '-'), nombre }] } }).catch(err),
    removeFormato: (id) => actualizarConfig({ carta: { formatos: (cartaCfg().formatos || []).filter(f => f.id !== id) } }).catch(err),
    renombrarFormato: (id, nombre) => actualizarConfig({ carta: { formatos: (cartaCfg().formatos || []).map(f => f.id === id ? { ...f, nombre } : f) } }).catch(err),
    addTipoPan: (nombre, sup) => actualizarConfig({ carta: { tiposPan: [...(cartaCfg().tiposPan || []), { id: nombre.toLowerCase().replace(/\W+/g, '-'), nombre, suplemento: Number(sup) || 0 }] } }).catch(err),
    removeTipoPan: (id) => actualizarConfig({ carta: { tiposPan: (cartaCfg().tiposPan || []).filter(x => x.id !== id) } }).catch(err),
    addExtra: (nombre, precio = 0.2) => actualizarConfig({ carta: { extras: [...(cartaCfg().extras || []), { nombre, precio }] } }).catch(err),
    removeExtra: (nombre) => actualizarConfig({ carta: { extras: (cartaCfg().extras || []).filter(e => (e.nombre || e) !== nombre) } }).catch(err),

    // ── Personal (admin) ────────────────────────────────────────
    addEmpleado: async ({ nombre, pin, rol }) => {
      try {
        const { data, error } = await t('empleados').insert({ local_id: getLocalId(), nombre, rol: rol || 'camarero' }).select('id').single()
        if (error) throw error
        if (pin) await personal.fijarPin(data.id, pin)
        cargarSala()
        return { ok: true }
      } catch (e) { err(e); return { ok: false, error: 'No se pudo crear' } }
    },
    updateEmpleado: async (id, cambios) => {
      try {
        const { pin, ...resto } = cambios
        if (Object.keys(resto).length) await t('empleados').update(resto).eq('id', id)
        if (pin) await personal.fijarPin(id, pin)
        cargarSala()
        return { ok: true }
      } catch (e) { err(e); return { ok: false, error: 'No se pudo actualizar' } }
    },
    removeEmpleado: async (id) => { try { await t('empleados').delete().eq('id', id); cargarSala() } catch (e) { err(e) } },

    // ── Local / reservas config ─────────────────────────────────
    updateLocal: (cambios) => actualizarConfig(cambios).catch(err),
    updateReservasConfig: (cambios) => actualizarConfig({ reservas: cambios }).catch(err),

    // ── Fichajes (correcciones del admin) ───────────────────────
    editarFichaje: async (id, cambios) => {
      try { await t('fichajes').update({ entrada: cambios.entrada, salida: cambios.salida, editado_por: cambios.editadoPor || 'admin' }).eq('id', id); cargarFichajes() } catch (e) { err(e) }
    },
    borrarFichaje: async (id) => { try { await t('fichajes').delete().eq('id', id); cargarFichajes() } catch (e) { err(e) } },

    // ── Caja (arqueo Z sobre tickets del servidor) ──────────────
    cerrarCaja: async (contado) => {
      try {
        const { data: cierres } = await t('cierres_caja').select('hasta').order('hasta', { ascending: false }).limit(1)
        const desde = cierres?.[0]?.hasta || null
        let qt = t('tickets').select('total, propina, pagos')
        if (desde) qt = qt.gt('cerrado_en', desde)
        const { data: tk } = await qt
        const total = tk.reduce((s, x) => s + Number(x.total), 0)
        const propinas = tk.reduce((s, x) => s + Number(x.propina), 0)
        const pagos = {}
        tk.forEach(x => Object.entries(x.pagos || {}).forEach(([k, v]) => { if (k !== 'descuento') pagos[k] = (pagos[k] || 0) + (Number(v) || 0) }))
        await t('cierres_caja').insert({
          local_id: getLocalId(), desde, total, propinas, pagos, n_tickets: tk.length,
          contado: contado != null ? Number(contado) : null,
          descuadre: contado != null ? Number(contado) - (pagos.efectivo || 0) : null,
        })
        cargarHistorial()
        const { data: cs } = await t('cierres_caja').select('*').order('hasta', { ascending: false })
        useStore.setState({ cierres: (cs || []).map(c => ({ id: c.id, desde: c.desde, hasta: c.hasta, total: Number(c.total), propinas: Number(c.propinas), pagos: c.pagos, nTickets: c.n_tickets, contado: c.contado != null ? Number(c.contado) : null, descuadre: c.descuadre != null ? Number(c.descuadre) : null })) })
      } catch (e) { err(e) }
    },
  }
}
