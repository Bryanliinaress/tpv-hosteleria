// ────────────────────────────────────────────────────────────────────────────
// El dinero, en un solo sitio.
//
// Estaba repartido: el total de un comensal se calculaba en TRECE sitios de
// ocho ficheros, y el desglose de IVA en CUATRO (el ticket de pantalla, el
// recibo del cliente, el papel y la función que registra en la AEAT). Es
// exactamente el patrón que más fallos ha dado aquí: cuando una regla está
// escrita dos veces, una de las dos está mal. Y lo estaba: el papel —el
// documento que se lleva el cliente— no redondeaba la base, y con el IVA al
// 4 % imprimía «base + IVA» un céntimo por encima del total.
// ────────────────────────────────────────────────────────────────────────────

/** Redondeo a céntimos. Todo el dinero pasa por aquí. */
export const cent = (n) => Math.round((Number(n) || 0) * 100) / 100

/** Lo que cuesta una línea del pedido. */
export const importeLinea = (item) => (Number(item?.precio) || 0) * (Number(item?.cantidad) || 0)

/** Lo que ha consumido un comensal (sin repartir lo compartido: eso es `owed`). */
export const totalDe = (persona) => cent((persona?.items || []).reduce((s, i) => s + importeLinea(i), 0))

/** Lo que ha consumido la mesa entera. */
export const totalDeMesa = (mesa) => cent((mesa?.personas || []).reduce((s, p) => s + totalDe(p), 0))

/** Lo que queda por cobrar: los comensales que aún no han pagado. */
export const pendienteDeMesa = (mesa) =>
  cent((mesa?.personas || []).filter(p => !p.pagado).reduce((s, p) => s + totalDe(p), 0))

/**
 * Desglose de una factura simplificada: los precios de la carta llevan el IVA
 * incluido, así que hay que sacar la base y la cuota.
 *
 * La cuota se calcula RESTANDO de la base ya redondeada, no por separado. Si se
 * redondean las dos por su cuenta, «base + IVA» puede imprimirse un céntimo por
 * encima del total — y en un papel que el cliente compara con lo que acaba de
 * pagar, eso es una reclamación. Con el IVA al 4 % pasa en uno de cada
 * cincuenta importes.
 */
export function desgloseIVA(total, ivaPct = 10) {
  const t = Number(total) || 0
  const pct = Number(ivaPct) || 0
  const base = cent(t / (1 + pct / 100))
  return { ivaPct: pct, base, iva: cent(t - base), total: cent(t) }
}

/**
 * Desglose por TIPO de IVA. Un bar de hostelería pura tiene uno solo y esto
 * devuelve una única entrada, idéntica a `desgloseIVA`. Pero en cuanto vende
 * algo al 21 % (una botella para llevar) o al 4 % (pan, leche), la factura
 * simplificada lleva una línea de desglose POR TIPO — no una con la media, que
 * es lo que salía antes.
 *
 * `lineas` son items con { precio, cantidad, ivaPct }. Los que no traen tipo
 * (tickets anteriores a esto) usan el del local.
 */
export function desglosePorTipo(lineas, ivaPorDefecto = 10) {
  const porTipo = new Map()
  for (const l of lineas || []) {
    const pct = Number(l?.ivaPct ?? ivaPorDefecto) || 0
    porTipo.set(pct, cent((porTipo.get(pct) || 0) + importeLinea(l)))
  }
  return [...porTipo.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ivaPct, total]) => desgloseIVA(total, ivaPct))
}

/** Todas las líneas de un ticket o de una mesa, en una sola lista. */
export const lineasDe = (personas) => (personas || []).flatMap(p => p?.items || [])

/**
 * Precios de la carta, siempre como NÚMEROS.
 *
 * El formulario de Admin guarda lo que se teclea, que es texto. Sin pasar por
 * aquí, editar un producto con tamaños dejaba `precios: {"viena": "2.5"}` —una
 * cadena— y la carta del cliente se rompía entera al intentar `.toFixed()`
 * sobre ella: pantalla en blanco en el móvil de quien iba a pedir.
 */
export function preciosNumericos(precios) {
  if (!precios || typeof precios !== 'object') return {}
  const limpio = {}
  for (const [k, v] of Object.entries(precios)) {
    if (v === '' || v === null || v === undefined) continue
    const n = Number(v)
    if (Number.isFinite(n)) limpio[k] = cent(n)
  }
  return limpio
}

/**
 * Por dónde se puede devolver el dinero de un ticket.
 *
 * Manda cómo se cobró: devolver a la tarjeta un cobro que entró en efectivo es
 * imposible, y apuntar como efectivo la devolución de una tarjeta descuadra el
 * arqueo de esa noche —de ese cajón no ha salido nada—. `online` va primero
 * cuando existe, porque es lo que hay que hacer por defecto.
 */
export function metodosDeDevolucion(pagos = {}) {
  const cobrado = Object.entries(pagos || {})
    .filter(([, v]) => Number(v) > 0)
    .map(([k]) => k)
  if (!cobrado.length) return ['efectivo']
  return [...(cobrado.includes('online') ? ['online'] : []), ...cobrado.filter(k => k !== 'online')]
}

/**
 * Lo que queda por devolver de un ticket, visto desde la pantalla.
 *
 * Las rectificativas tienen importe NEGATIVO, así que se SUMAN. Restándolas
 * salía «quedan 15,90 €» de un ticket de 11,90 € del que ya se habían devuelto
 * 4: la pantalla ofrecía devolver más de lo que se cobró. El servidor lo
 * rechazaba, pero el encargado ya se lo había prometido al cliente.
 *
 * Es el mismo cálculo que `_pendiente_de_rectificar` en el servidor, que es
 * quien manda.
 */
export const pendienteDeDevolver = (ticket, rectificativas = []) =>
  Math.max(0, cent(Number(ticket?.total || 0) +
    rectificativas.reduce((s, r) => s + Number(r?.total || 0), 0)))
