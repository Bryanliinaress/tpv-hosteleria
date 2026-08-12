import { supabase } from '../supabase'
import { useStore } from '../../store/useStore'
import { qr, personal, reservas as rpcReservas } from '../repo'
import { toast } from '../../store/useUI'
import { registrarTicket } from '../fiscal'
import { grupoDe } from './grupos'
import { getLocalId, cargarSala, cargarComandas, cargarAvisos, cargarReservas, cargarHistorial, cargarCarta, cargarFichajes, refrescarServicio } from './estado'

// ────────────────────────────────────────────────────────────────────────────
// Acciones v2: misma firma que las del store; por dentro llaman a las RPC
// (transiciones sensibles) o mutan tablas bajo RLS (ediciones del personal).
// Tras cada acción se refresca el agregado (el realtime ya avisa a los DEMÁS
// dispositivos; el refresco local hace de "optimistic" simple y fiable).
// ────────────────────────────────────────────────────────────────────────────

const err = (e) => {
  if (e?.encolada) { toast('Sin conexión: guardado y se enviará solo al volver la red', 'warning'); return }
  toast(traducir(e.codigo || e.message), 'error'); console.warn('v2:', e)
}
const traducir = (c) => ({
  mesa_cerrada: 'La mesa se ha cerrado', mesa_no_existe: 'Mesa no encontrada',
  producto_no_disponible: 'Producto no disponible', sin_aforo: 'No queda aforo para esa hora',
  dia_cerrado: 'Ese día está cerrado', grupo_grande: 'Para grupos grandes, llama al local',
  linea_no_editable: 'Esa línea ya no puede editarse', secundaria_invalida: 'Esa mesa no puede unirse',
}[c] || 'No se pudo completar la operación')

async function tabla(nombre) { return supabase.from(nombre) }

export function accionesV2() {
  const st = () => useStore.getState()
  return {
    // ── Cliente QR ──────────────────────────────────────────────
    unirseAMesa: (mesaId, nombre) => {
      // devuelve el id nuevo de forma síncrona imposible en v2 → las pantallas
      // esperan el id; devolvemos una promesa y CartaCliente v2-aware la espera.
      return qr.unirseMesa(mesaId, nombre).then(id => { refrescarServicio(); return id }).catch(e => { err(e); return null })
    },
    agregarItem: (mesaId, personaId, config) => {
      const variante = config.pan?.formato ?? null
      const personalizacion = {
        pan: config.pan || null, quitados: config.quitados || [],
        anadidos: config.anadidos || [], nota: config.nota || '',
        // el precio lo pone el servidor: sin las elecciones no puede cobrar el
        // suplemento del menú (el solomillo, +2 €) — ver migración 11
        ...(config.elecciones?.length ? { elecciones: config.elecciones } : {}),
      }
      qr.agregarLinea(personaId, config.productoId, {
        variante, personalizacion, tiempo: config.tiempo || 1, cantidad: 1,
      }).then(refrescarServicio).catch(err)
    },
    confirmarPedido: (mesaId) => { qr.confirmarPedido(mesaId).then(() => { refrescarServicio(); cargarComandas() }).catch(err) },
    llamarCamarero: (mesaId, personaNombre) => { qr.llamarCamarero(mesaId, personaNombre).then(cargarAvisos).catch(err) },
    cancelarAviso: (mesaId) => { qr.cancelarAviso(mesaId).then(cargarAvisos).catch(err) },
    pedirCuenta: (mesaId) => { qr.pedirCuenta(mesaId).then(refrescarServicio).catch(err) },

    // cantidad: cliente en pendiente (RPC), personal en enviada (RLS + comanda)
    cambiarCantidad: async (mesaId, personaId, uid, delta) => {
      const mesa = st().mesas.find(m => m.id === mesaId)
      const item = mesa?.personas.find(p => p.id === personaId)?.items.find(i => i.uid === uid)
      if (!item) return
      const nueva = item.cantidad + delta
      try {
        if (item.estado === 'pendiente') {
          await qr.cambiarCantidad(uid, personaId, Math.max(nueva, 0))
        } else if (nueva <= 0) {
          await (await tabla('comandas')).delete().eq('linea_id', uid)
          await (await tabla('lineas_pedido')).delete().eq('id', uid)
        } else {
          await (await tabla('lineas_pedido')).update({ cantidad: nueva }).eq('id', uid)
        }
        refrescarServicio(); cargarComandas()
      } catch (e) { err(e) }
    },
    setTiempoItem: async (mesaId, personaId, uid, tiempo) => {
      try { await (await tabla('lineas_pedido')).update({ tiempo }).eq('id', uid).eq('estado', 'pendiente'); cargarSala() }
      catch (e) { err(e) }
    },
    moverItem: async (mesaId, origenId, uid, destinoId) => {
      try { await (await tabla('lineas_pedido')).update({ comensal_id: destinoId }).eq('id', uid); cargarSala(); cargarComandas() }
      catch (e) { err(e) }
    },
    // Compartir un plato (fallo 27). Necesita RPC porque lo pide el cliente
    // anónimo del QR, que no puede escribir `lineas_pedido` bajo RLS.
    toggleCompartir: (mesaId, ownerId, uid, sharerId) => {
      qr.compartirLinea(uid, ownerId, sharerId).then(refrescarServicio).catch(err)
    },
    anularItem: (mesaId, personaId, uid, opts = {}) => {
      personal.anularLinea(uid, opts.motivo, opts.por).then(() => { cargarSala(); cargarComandas() }).catch(err)
    },

    // ── Sala / cobro ────────────────────────────────────────────
    asignarCamarero: async (mesaId, nombre) => {
      const emp = st().empleados.find(e => e.nombre === nombre)
      try { await (await tabla('mesas')).update({ camarero_id: emp?.id ?? null }).eq('id', mesaId); cargarSala() }
      catch (e) { err(e) }
    },
    pagarParte: (mesaId, personaId, opts) => {
      const o = typeof opts === 'number' ? { propina: opts } : (opts || {})
      personal.pagarParte(personaId, o).then(async (r) => {
        cargarSala(); await cargarHistorial()
        // si esta parte cerró la mesa, hay ticket que registrar
        const fila = Array.isArray(r) ? r[0] : r
        const ult = st().historial[0]
        if (fila?.cerrada && ult?.id) registrarTicket(ult.id).then(() => cargarHistorial())
      }).catch(err)
    },
    pagarTodo: (mesaId, opts = {}) => {
      const pagos = opts.metodo ? { [opts.metodo]: null } : {}
      personal.cobrarMesa(mesaId, { pagos, propina: opts.propina || 0, cobradoPor: opts.cobradoPor })
        .then(() => { cargarSala(); cargarComandas(); cargarHistorial() }).catch(err)
    },
    cobrarMesa: (mesaId, opts = {}) => {
      const o = typeof opts === 'number' ? { propina: opts } : opts
      personal.cobrarMesa(mesaId, {
        pagos: o.pagos || (o.metodo ? { [o.metodo]: null } : {}),
        propina: o.propina || 0, cobradoPor: o.cobradoPor, descuento: o.descuento || 0,
      }).then(async () => {
        cargarSala(); cargarComandas()
        await cargarHistorial()
        // registro fiscal en segundo plano: si falla, el ticket queda
        // pendiente y se reintenta (el cobro nunca se bloquea)
        const ult = st().historial[0]
        if (ult?.id) registrarTicket(ult.id).then(() => cargarHistorial())
      }).catch(err)
    },
    // Cerrar una mesa unida cierra TODO el grupo. Liberando solo la cabeza, las
    // demás se quedaban colgando de una mesa ya libre, con sus comensales y su
    // consumo dentro: mesas fantasma que nadie cobra.
    liberarMesa: async (mesaId) => {
      const grupo = grupoDe(mesaId, st().mesas)
      try {
        await (await tabla('comensales')).delete().in('mesa_id', grupo)
        await (await tabla('comandas')).delete().in('mesa_id', grupo)
        await (await tabla('avisos')).delete().in('mesa_id', grupo)
        await (await tabla('mesas')).update({ estado: 'libre', abierta_desde: null, camarero_id: null, unida_a: null }).in('id', grupo)
        cargarSala(); cargarComandas(); cargarAvisos()
      } catch (e) { err(e) }
    },
    fusionarMesa: (principalId, secundariaId) => {
      personal.agruparMesas(principalId, secundariaId).then(cargarSala).catch(err)
    },
    // `separarMesas` vive en acciones2.js junto al resto de la sala: antes de
    // separar hay que llevarse la cuenta a la cabeza del grupo.
    marcharSiguiente: (mesaId) => { personal.marcharSiguiente(mesaId).then(cargarComandas).catch(err) },
    atenderAviso: async (avisoId) => {
      try { await (await tabla('avisos')).delete().eq('id', avisoId); cargarAvisos() } catch (e) { err(e) }
    },

    // ── KDS (cocina/barra) ──────────────────────────────────────
    empezarPedido: async (id) => {
      try { await (await tabla('comandas')).update({ estado: 'preparando' }).eq('id', id); cargarComandas() } catch (e) { err(e) }
    },
    terminarPedido: async (id) => {
      try { await (await tabla('comandas')).update({ estado: 'listo' }).eq('id', id); cargarComandas() } catch (e) { err(e) }
    },
    servirMesa: async (mesaId) => {
      try { await (await tabla('comandas')).delete().eq('mesa_id', mesaId).eq('estado', 'listo'); cargarComandas() } catch (e) { err(e) }
    },

    // ── Reservas ────────────────────────────────────────────────
    crearReservaOnline: (r) => rpcReservas.crear(getLocalId(), r).then(res => { cargarReservas(); return res }).catch(e => { err(e); throw e }),
    cancelarReservaPorToken: (token) => rpcReservas.cancelar(token).then(cargarReservas).catch(err),

    // ── Fichajes ────────────────────────────────────────────────
    // La PDA mira `r.accion` para decir «entrada fichada» o «salida fichada».
    // Siendo async devolvía una promesa: el empleado fichaba la salida y no
    // recibía ninguna confirmación — y es su nómina.
    ficharEmpleado: (empleadoId) => {
      const abierto = st().fichajes?.find(f => f.empleadoId === empleadoId && !f.salida)
      const accion = abierto ? 'salida' : 'entrada'
      ;(async () => {
        try {
          if (abierto) await (await tabla('fichajes')).update({ salida: new Date().toISOString() }).eq('id', abierto.id)
          else await (await tabla('fichajes')).insert({ local_id: getLocalId(), empleado_id: empleadoId })
          cargarFichajes()
        } catch (e) { err(e) }
      })()
      return { ok: true, accion }
    },

    // ── Carta (admin) ───────────────────────────────────────────
    toggleDisponible: async (productoId) => {
      const p = st().carta.productos.find(x => x.id === productoId)
      try { await (await tabla('productos')).update({ disponible: !p.disponible }).eq('id', productoId); cargarCarta() }
      catch (e) { err(e) }
    },
  }
}
