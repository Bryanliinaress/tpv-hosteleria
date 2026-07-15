import { supabase } from './supabase'

// ────────────────────────────────────────────────────────────────────────────
// Repositorio por entidad contra el backend multi-tenant (migraciones 01+02).
//
// Cada operación llama a su RPC transaccional: dos camareros ya no se pisan
// (adiós al last-write-wins del blob). La API replica la semántica de las
// acciones del store actual para que el cambio de backend sea un intercambio
// de implementación, no un rediseño de la UI.
//
// ACTIVACIÓN (cuando exista el proyecto de producción):
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY → proyecto multi-tenant
//   VITE_BACKEND=v2                            → usa este repositorio
// Mientras VITE_BACKEND no sea 'v2', la app sigue con el blob (lib/sync.js)
// y este módulo no se usa. Ver supabase/BACKEND.md (plan de migración, paso 3).
// ────────────────────────────────────────────────────────────────────────────

export const backendV2 = import.meta.env.VITE_BACKEND === 'v2'

async function rpc(fn, args) {
  if (!supabase) throw new Error('backend no configurado')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    // los RAISE EXCEPTION de las RPC llegan como message ('sin_aforo', …)
    const e = new Error(error.message)
    e.codigo = error.message
    throw e
  }
  return data
}

// ── Cliente anónimo (QR) ────────────────────────────────────────────────────

export const qr = {
  // Se une a la mesa (la abre si estaba libre). → uuid del comensal
  unirseMesa: (mesaId, nombre) =>
    rpc('qr_unirse_mesa', { p_mesa: mesaId, p_nombre: nombre }),

  // Añade una línea; el PRECIO lo resuelve el servidor desde la carta.
  // personalizacion = { pan, quitados, anadidos, nota } (jsonb opaco)
  agregarLinea: (comensalId, productoId, { variante = null, personalizacion = {}, tiempo = 1, cantidad = 1 } = {}) =>
    rpc('qr_agregar_linea', {
      p_comensal: comensalId, p_producto: productoId, p_variante: variante,
      p_personalizacion: personalizacion, p_tiempo: tiempo, p_cantidad: cantidad,
    }),

  // Cambia cantidad de una línea pendiente propia (0 = borrar)
  cambiarCantidad: (lineaId, comensalId, cantidad) =>
    rpc('qr_cambiar_cantidad', { p_linea: lineaId, p_comensal: comensalId, p_cantidad: cantidad }),

  // Envía lo pendiente de la mesa a cocina/barra. → nº de comandas creadas
  confirmarPedido: (mesaId) => rpc('qr_confirmar_pedido', { p_mesa: mesaId }),

  llamarCamarero: (mesaId, nombre) =>
    rpc('qr_llamar_camarero', { p_mesa: mesaId, p_nombre: nombre ?? null }),
  cancelarAviso: (mesaId) => rpc('qr_cancelar_aviso', { p_mesa: mesaId }),
  pedirCuenta: (mesaId) => rpc('qr_pedir_cuenta', { p_mesa: mesaId }),
}

// ── Reservas online (anónimo, autogestión por token) ────────────────────────

export const reservas = {
  // Valida aforo/solape EN SERVIDOR. → { reserva_id, token }
  crear: (localId, r) =>
    rpc('crear_reserva', {
      p_local: localId, p_fecha: r.fecha, p_hora: r.hora, p_personas: r.personas,
      p_nombre: r.nombre, p_email: r.email || null, p_telefono: r.telefono || null,
      p_zona: r.zona || null, p_notas: r.notas || null,   // '' = sin preferencia → null
    }),
  porToken: (token) => rpc('reserva_por_token', { p_token: token }),
  cancelar: (token) => rpc('cancelar_reserva', { p_token: token }),
}

// ── Personal (autenticado; transiciones transaccionales) ────────────────────

export const personal = {
  // Cambio rápido de usuario por PIN (hash verificado en servidor)
  verificarPin: (pin, soloAdmin = false) =>
    rpc('verificar_pin', { p_pin: pin, p_solo_admin: soloAdmin }),
  fijarPin: (empleadoId, pin) =>
    rpc('fijar_pin', { p_empleado: empleadoId, p_pin: pin }),

  // → { cerrada, ticket } (cierra el grupo si era el último en pagar)
  pagarParte: (comensalId, { propina = 0, metodo = 'efectivo', cobradoPor = null } = {}) =>
    rpc('pagar_parte', { p_comensal: comensalId, p_propina: propina, p_metodo: metodo, p_cobrado_por: cobradoPor }),

  // pagos = desglose {efectivo: x, tarjeta: y}. → nº de ticket (fiscal)
  cobrarMesa: (mesaId, { pagos = {}, propina = 0, cobradoPor = null, descuento = 0 } = {}) =>
    rpc('cobrar_mesa', { p_mesa: mesaId, p_pagos: pagos, p_propina: propina, p_cobrado_por: cobradoPor, p_descuento: descuento }),

  agruparMesas: (principalId, secundariaId) =>
    rpc('agrupar_mesas', { p_principal: principalId, p_secundaria: secundariaId }),
  separarMesas: (mesaId) => rpc('separar_mesas', { p_mesa: mesaId }),

  // Lanza el siguiente tiempo en espera. → nº de comandas lanzadas
  marcharSiguiente: (mesaId) => rpc('marchar_siguiente', { p_mesa: mesaId }),

  anularLinea: (lineaId, motivo, por) =>
    rpc('anular_linea', { p_linea: lineaId, p_motivo: motivo, p_por: por }),
}

// ── Realtime por entidad (sustituye a la fila global) ───────────────────────

// Suscribe los canales del local y despacha cambios por tabla.
// handlers = { mesas, comensales, lineas_pedido, comandas, avisos, reservas }
export function suscribirLocal(localId, handlers) {
  if (!supabase) return () => {}
  const canal = supabase.channel(`local-${localId}`)
  for (const tabla of ['mesas', 'comensales', 'lineas_pedido', 'comandas', 'avisos', 'reservas']) {
    if (!handlers[tabla]) continue
    canal.on('postgres_changes',
      { event: '*', schema: 'public', table: tabla, filter: `local_id=eq.${localId}` },
      payload => handlers[tabla](payload))
  }
  canal.subscribe()
  return () => supabase.removeChannel(canal)
}
