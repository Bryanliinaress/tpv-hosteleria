// ────────────────────────────────────────────────────────────────────────────
// Reglas de la carta que comparten el cliente (QR) y el personal (PDA, TPV).
// Están aquí para que buscar un producto se comporte IGUAL en todas partes:
// el camarero encuentra lo mismo que el cliente, y hay un solo sitio que tocar.
// ────────────────────────────────────────────────────────────────────────────

// Sin tildes y en minúsculas: «jamon» encuentra «Jamón», que es como se teclea
// con prisa y con una mano.
export const normalizar = (s) => (s || '').toString().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * Busca en la carta por nombre, descripción e ingredientes. Cada palabra debe
 * aparecer en algún sitio («cafe leche» encuentra «Café con leche»).
 */
export function buscarProductos(productos, texto) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean)
  if (!palabras.length) return []
  return productos.filter(p => {
    const heno = normalizar([p.nombre, p.descripcion, ...(p.ingredientes || [])].join(' '))
    return palabras.every(w => heno.includes(w))
  })
}

/**
 * Qué productos tocan en pantalla: los de la búsqueda si se está buscando, y
 * si no los de la categoría abierta. Solo lo disponible, salvo que se pida
 * incluir lo agotado (el personal sí lo ve, para poder reactivarlo).
 */
export function productosVisibles(carta, { busqueda = '', categoria = null, incluirNoDisponibles = false } = {}) {
  const base = incluirNoDisponibles ? carta.productos : carta.productos.filter(p => p.disponible)
  if (normalizar(busqueda)) return buscarProductos(base, busqueda)
  return base.filter(p => p.categoria === categoria)
}

/** Muchas cartas repiten nombre y descripción: no hay que enseñarla dos veces. */
export const descripcionUtil = (prod) =>
  (prod?.descripcion && normalizar(prod.descripcion) !== normalizar(prod.nombre)) ? prod.descripcion : ''

/**
 * La línea pendiente de un producto pedido «tal cual» (sin pan, extras ni
 * nota). Es la que se puede subir y bajar desde la propia tarjeta: si el
 * cliente lo personalizó, cada línea es distinta y hay que ir al pedido.
 */
export const lineaSimplePendiente = (items, productoId) => (items || []).find(i =>
  i.productoId === productoId && i.estado === 'pendiente' &&
  !i.pan && !i.nota && !(i.anadidos || []).length && !(i.quitados || []).length && !(i.elecciones || []).length)

/** Unidades totales (3 cafés son 3, no 1 línea). */
export const unidades = (items) => (items || []).reduce((s, i) => s + (i.cantidad || 0), 0)
