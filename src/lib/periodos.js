// ────────────────────────────────────────────────────────────────────────────
// Los periodos que se pueden mirar en Informes.
//
// Se calculan en HORA LOCAL y se mandan al servidor como instantes. Un «hoy»
// que empiece a medianoche UTC mete en el informe de hoy los cobros de la
// madrugada de ayer, y en un bar la madrugada es media caja del sábado.
//
// El fin es SIEMPRE exclusivo (`< hasta`), que es como consulta el servidor: si
// fuera inclusivo, un cobro a las 00:00:00 clavadas contaría en dos periodos.
// ────────────────────────────────────────────────────────────────────────────

const alInicioDelDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const sumandoDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export const PERIODOS = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: 'ayer', etiqueta: 'Ayer' },
  { id: 'semana', etiqueta: '7 días' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mesPasado', etiqueta: 'Mes pasado' },
]

/** Rango { desde, hasta } en ISO para un periodo, respecto a `ahora`. */
export function rangoDe(id, ahora = new Date()) {
  const hoy = alInicioDelDia(ahora)
  const iso = (d) => d.toISOString()
  switch (id) {
    case 'hoy':
      return { desde: iso(hoy), hasta: iso(sumandoDias(hoy, 1)) }
    case 'ayer':
      return { desde: iso(sumandoDias(hoy, -1)), hasta: iso(hoy) }
    case 'semana':
      // los últimos 7 días CONTANDO hoy, que es lo que la gente entiende por
      // «la última semana» al mirarlo un martes por la tarde
      return { desde: iso(sumandoDias(hoy, -6)), hasta: iso(sumandoDias(hoy, 1)) }
    case 'mesPasado': {
      const ini = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
      const fin = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      return { desde: iso(ini), hasta: iso(fin) }
    }
    case 'mes':
    default: {
      const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      return { desde: iso(ini), hasta: iso(sumandoDias(hoy, 1)) }
    }
  }
}

/** Cómo se llama el periodo por escrito, para el encabezado y el CSV. */
export function nombreDe(id, ahora = new Date()) {
  const mes = (d) => d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  switch (id) {
    case 'hoy': return ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    case 'ayer': return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1)
      .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    case 'semana': return 'últimos 7 días'
    case 'mesPasado': return mes(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1))
    default: return mes(ahora)
  }
}
