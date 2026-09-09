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
// Primera letra en mayúscula y el resto tal cual.
//
// No vale el `text-transform: capitalize` de CSS: en español pone mayúscula en
// CADA palabra y salía «Miércoles, 26 De Agosto» o «Últimos 7 Días». Las
// preposiciones y los meses van en minúscula.
export function mayusculaInicial(txt) {
  const s = String(txt ?? '')
  return s ? s[0].toLocaleUpperCase('es-ES') + s.slice(1) : s
}

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

// ────────────────────────────────────────────────────────────────────────────
// Un rango a medida, y con qué compararlo.
//
// Solo había cinco botones (hoy, ayer, 7 días, este mes, mes pasado). El
// gestor pide «del 1 al 15» y el dueño quiere ver «el sábado pasado», y no
// había forma: tocaba mirar el mes entero y hacer la resta a mano.
//
// Y un número solo no dice nada. «1.240 €» esta semana solo significa algo al
// lado de lo que se hizo la semana anterior — que es la pregunta que se hace
// quien abre esta pantalla.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Rango entre dos fechas del calendario ('YYYY-MM-DD'), en hora local.
 *
 * El `hasta` que se elige es INCLUSIVO —quien escribe «al 15» quiere el 15
 * entero— pero el servidor consulta con el fin exclusivo, así que se manda el
 * día siguiente a las 00:00. Sin esto, el último día del informe siempre sale
 * a cero y nadie entiende por qué.
 */
export function rangoEntre(desdeYMD, hastaYMD) {
  const dia = (s) => {
    const [y, m, d] = String(s || '').split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }
  const a = dia(desdeYMD)
  const b = dia(hastaYMD)
  if (!a || !b) return null
  // al revés se entiende igual: se cambian
  const [ini, fin] = a <= b ? [a, b] : [b, a]
  const finExclusivo = new Date(fin)
  finExclusivo.setDate(finExclusivo.getDate() + 1)
  return { desde: ini.toISOString(), hasta: finExclusivo.toISOString() }
}

/**
 * El periodo de la MISMA duración pegado justo antes, para comparar. De «los
 * 7 días que acaban hoy» salen «los 7 anteriores», y de «septiembre» sale
 * agosto (con sus días, no con 30 fijos).
 */
export function periodoAnterior({ desde, hasta } = {}) {
  if (!desde || !hasta) return null
  const a = new Date(desde)
  const b = new Date(hasta)
  const dura = b - a
  if (!(dura > 0)) return null
  return { desde: new Date(a - dura).toISOString(), hasta: desde }
}

/**
 * Cuánto ha subido o bajado, en tanto por ciento. `null` cuando no hay con qué
 * comparar: si antes no se vendió nada, «+∞ %» no informa de nada — lo que hay
 * que decir es que no había nada antes.
 */
export function variacion(actual, anterior) {
  const hoy = Number(actual) || 0
  const antes = Number(anterior) || 0
  if (antes === 0) return null
  return ((hoy - antes) / Math.abs(antes)) * 100
}

/** Cómo se escribe un rango a medida: «del 1 al 15 de septiembre». */
export function nombreDeRango(desdeYMD, hastaYMD) {
  const r = rangoEntre(desdeYMD, hastaYMD)
  if (!r) return ''
  const a = new Date(r.desde)
  const b = new Date(r.hasta)
  b.setDate(b.getDate() - 1)              // vuelve al último día incluido
  const dia = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  const conAno = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  if (a.getTime() === b.getTime()) return conAno(a)
  return a.getFullYear() === b.getFullYear()
    ? `del ${dia(a)} al ${conAno(b)}`
    : `del ${conAno(a)} al ${conAno(b)}`
}
