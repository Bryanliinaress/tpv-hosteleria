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
