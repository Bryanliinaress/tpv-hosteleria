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

/**
 * Receta para volver a pedir una línea igual: se queda con lo que define el
 * plato (producto, pan, extras, nota) y tira el estado, el uid y con quién se
 * compartió, que son de aquella vez.
 */
export function configDeItem(item) {
  const c = {
    productoId: item.productoId, nombre: item.nombre,
    precio: item.precio, tipo: item.tipo,
  }
  if (item.pan) c.pan = item.pan
  if (item.quitados?.length) c.quitados = item.quitados
  if (item.anadidos?.length) c.anadidos = item.anadidos
  if (item.elecciones?.length) c.elecciones = item.elecciones
  if (item.nota) c.nota = item.nota
  if (item.tiempo && item.tiempo !== 1) c.tiempo = item.tiempo
  return c
}

/**
 * La última ronda: lo que se envió a cocina de una vez. Se agrupan por el
 * momento del envío (al segundo) porque una comanda son varias líneas a la vez.
 * En el backend real no hay sello de envío: se usa la fecha de creación de la
 * línea, que agrupa igual de bien la comanda.
 */
export function ultimaRonda(items) {
  const enviados = (items || []).filter(i => i.estado === 'enviado')
  if (!enviados.length) return []
  // El backend v1 sella el envío (`enviadoEn`); el v2 solo tiene la fecha de
  // creación de la línea, que sirve igual para agrupar la comanda.
  const sello = (i) => i.enviadoEn || i.creadoEn || null
  const sellos = enviados.map(sello).filter(Boolean)
  // Sin ninguna fecha no se puede distinguir la última ronda: mejor repetir
  // solo la última línea que arrastrar el servicio entero.
  if (!sellos.length) return enviados.slice(-1)
  const ultimo = sellos.sort().at(-1)
  // mismo minuto = misma comanda: cocina las recibió juntas
  const mismoMinuto = (a, b) => a && b && a.slice(0, 16) === b.slice(0, 16)
  return enviados.filter(i => mismoMinuto(sello(i), ultimo))
}
