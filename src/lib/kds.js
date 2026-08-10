// ────────────────────────────────────────────────────────────────────────────
// Cómo lee cocina (y barra) la cola de comandas.
//
// La regla del oficio: los platos de una mesa salen juntos. Con las comandas
// sueltas, cuatro platos de la mesa 4 aparecían mezclados entre veinte tarjetas
// y salían a destiempo. Aquí se agrupan por mesa y se ordenan por antigüedad.
// ────────────────────────────────────────────────────────────────────────────

// De menos a más avanzado: el estado de una mesa es el de su plato más atrasado
// (si algo sigue «recibido», la mesa no está preparándose del todo).
export const ORDEN_ESTADO = ['espera', 'recibido', 'preparando', 'listo']

export const estadoDeGrupo = (items) => ORDEN_ESTADO.find(e => items.some(i => i.estado === e)) || 'listo'

// Si llega un estado que esa pantalla no tiene declarado (una bebida en
// «espera» en la barra, por ejemplo), la tarjeta se pintaba con `undefined` y
// la pantalla ENTERA se quedaba en blanco. En cocina o barra, con el servicio
// en marcha, eso es lo peor que puede pasar: mejor una tarjeta neutra que se
// pueda marchar a mano.
export const ESTADO_DESCONOCIDO = { label: '⏳ Pendiente', color: '#94a3b8', next: 'recibido', nextLabel: '▶ Marchar ya' }
export const estadoVisible = (estados, clave) => (estados && estados[clave]) || ESTADO_DESCONOCIDO

/** Agrupa comandas por mesa. La mesa que lleva más esperando, primero. */
export function agruparPorMesa(pedidos) {
  const grupos = new Map()
  for (const p of pedidos || []) {
    const g = grupos.get(p.mesaId) || { mesaId: p.mesaId, mesaNumero: p.mesaNumero, items: [], desde: null }
    g.items.push(p)
    // una comanda sin hora no debe fijar el reloj del grupo: `new Date(null)`
    // es 1970, así que esa mesa salía la primera y marcada como urgente
    if (p.horaEntrada && (!g.desde || p.horaEntrada < g.desde)) g.desde = p.horaEntrada
    grupos.set(p.mesaId, g)
  }
  return [...grupos.values()]
    .map(g => ({
      ...g,
      uds: g.items.reduce((s, i) => s + (i.cantidad || 0), 0),
      comensales: [...new Set(g.items.map(i => i.personaNombre).filter(Boolean))],
      estado: estadoDeGrupo(g.items),
    }))
    // sin hora, al final de la cola (no se sabe cuándo entró)
    .sort((a, b) => (a.desde ? new Date(a.desde) : Infinity) - (b.desde ? new Date(b.desde) : Infinity))
}

/**
 * Qué platos mueve el botón de la mesa: solo los que están en el estado más
 * atrasado. Así «Preparar» no marca como listo lo que aún no se ha tocado.
 */
export const itemsDelPaso = (grupo) => grupo.items.filter(i => i.estado === grupo.estado)

/** ¿Lleva demasiado tiempo esperando? (lo que ya está listo no corre prisa) */
export const esUrgente = (grupo, minutos = 10) =>
  !!grupo?.desde && grupo.estado !== 'listo' && grupo.estado !== 'espera' &&
  Date.now() - new Date(grupo.desde) > minutos * 60 * 1000
