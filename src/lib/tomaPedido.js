// ────────────────────────────────────────────────────────────────────────────
// Tomar pedido: las cuentas que hace la pantalla mientras se pide.
//
// Viven aquí y no dentro del componente porque hay DOS pantallas que piden
// —la PDA, en una mano, y el Mostrador, en un monitor— y una regla escrita dos
// veces es una regla que acaba diciendo cosas distintas en cada una.
//
// Ya pasaba: el botón «Enviar 2 a cocina/barra» de la PDA contaba solo lo del
// comensal elegido, pero `confirmarPedido` envía lo pendiente de TODA la mesa.
// Con dos comensales pidiendo, el botón decía «2» y a cocina salían 5.
// ────────────────────────────────────────────────────────────────────────────

import { cent, importeLinea } from './dinero.js'

const pendientes = (items) => (items || []).filter(i => i?.estado === 'pendiente')
const suma = (items) => items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0)

/**
 * Todo lo que la mesa tiene sin enviar, que es exactamente lo que va a salir
 * por cocina y barra al pulsar «Enviar». Por comensal para poder pintarlo, y
 * con el total de la mesa para el botón.
 */
export function sinEnviar(mesa) {
  const porPersona = (mesa?.personas || []).map(p => {
    const items = pendientes(p.items)
    return { persona: p, items, unidades: suma(items), total: cent(items.reduce((s, i) => s + importeLinea(i), 0)) }
  })
  return {
    porPersona,
    unidades: porPersona.reduce((s, x) => s + x.unidades, 0),
    total: cent(porPersona.reduce((s, x) => s + x.total, 0)),
  }
}

/**
 * Cuántas unidades de un producto lleva ya pedidas (sin enviar) un comensal,
 * contando también las personalizadas: dos mixtos, uno sin queso, son 2.
 * Es el número que se pinta en la tarjeta para no pedir dos veces lo mismo.
 */
export const unidadesDe = (items, productoId) =>
  suma(pendientes(items).filter(i => i.productoId === productoId))

/**
 * Lo que se añade al pulsar Enter en el buscador: el primer resultado. En un
 * mostrador con teclado, «caña ⏎» tiene que ser un pedido, no una búsqueda.
 * Solo si la búsqueda deja UN candidato claro: con «caf» y cinco cafés, Enter
 * a ciegas añadiría uno que nadie ha elegido.
 */
export function candidatoDeEnter(productos, busqueda) {
  const q = String(busqueda || '').trim()
  if (!q || !productos?.length) return null
  if (productos.length === 1) return productos[0]
  const n = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const exactos = productos.filter(p => n(p.nombre) === n(q))
  return exactos.length === 1 ? exactos[0] : null
}
