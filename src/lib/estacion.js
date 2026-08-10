// ────────────────────────────────────────────────────────────────────────────
// Qué imprime la estación de impresión y por qué impresora.
//
// El montaje real de un bar tiene una impresora en cocina y otra en barra. Una
// misma mesa suele pedir las dos cosas a la vez, así que eso son DOS comandas,
// cada una a su máquina — no una sola con todo mezclado.
// ────────────────────────────────────────────────────────────────────────────

/** Comandas que atiende esta estación, cada una marcada con su destino. */
export function comandasDeEstacion(estacion, pedidosCocina = [], pedidosBarra = []) {
  return [
    ...(estacion === 'barra' ? [] : pedidosCocina.map(p => ({ ...p, destino: 'cocina' }))),
    ...(estacion === 'cocina' ? [] : pedidosBarra.map(p => ({ ...p, destino: 'barra' }))),
  ]
}

/**
 * Agrupa las comandas nuevas en tickets: uno por mesa **y destino**. Sin el
 * destino, en modo «ambas» salía todo por la impresora de cocina y las bebidas
 * no llegaban nunca a la barra.
 */
export function ticketsDeComandas(nuevas = [], ahora = Date.now()) {
  const grupos = {}
  for (const p of nuevas) {
    const destino = p.destino || 'cocina'
    ;(grupos[`${p.mesaId}|${destino}`] ||= []).push({ ...p, destino })
  }
  return Object.entries(grupos).map(([clave, items]) => ({
    id: `tk${ahora}-${clave}`,
    mesaNumero: items[0].mesaNumero,
    destino: items[0].destino,
    items,
    hora: new Date(ahora).toISOString(),
  }))
}
