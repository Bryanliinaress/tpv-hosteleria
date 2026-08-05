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

/** Agrupa comandas por mesa. La mesa que lleva más esperando, primero. */
export function agruparPorMesa(pedidos) {
  const grupos = new Map()
  for (const p of pedidos || []) {
    const g = grupos.get(p.mesaId) || { mesaId: p.mesaId, mesaNumero: p.mesaNumero, items: [], desde: p.horaEntrada }
    g.items.push(p)
    if (p.horaEntrada && p.horaEntrada < g.desde) g.desde = p.horaEntrada
    grupos.set(p.mesaId, g)
  }
  return [...grupos.values()]
    .map(g => ({
      ...g,
      uds: g.items.reduce((s, i) => s + (i.cantidad || 0), 0),
      comensales: [...new Set(g.items.map(i => i.personaNombre).filter(Boolean))],
      estado: estadoDeGrupo(g.items),
    }))
    .sort((a, b) => new Date(a.desde) - new Date(b.desde))
}

/**
 * Qué platos mueve el botón de la mesa: solo los que están en el estado más
 * atrasado. Así «Preparar» no marca como listo lo que aún no se ha tocado.
 */
export const itemsDelPaso = (grupo) => grupo.items.filter(i => i.estado === grupo.estado)

/** ¿Lleva demasiado tiempo esperando? (lo que ya está listo no corre prisa) */
export const esUrgente = (grupo, minutos = 10) =>
  grupo.estado !== 'listo' && grupo.estado !== 'espera' &&
  Date.now() - new Date(grupo.desde) > minutos * 60 * 1000
