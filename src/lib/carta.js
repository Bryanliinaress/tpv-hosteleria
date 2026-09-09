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
export function buscarProductos(productos, texto, extra = null) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean)
  if (!palabras.length) return []
  return productos.filter(p => {
    // `extra` añade la traducción del producto: con la carta en inglés,
    // «cheese» tiene que encontrar el queso igual que «queso»
    const heno = normalizar([p.nombre, p.descripcion, ...(p.ingredientes || []), extra ? extra(p) : ''].join(' '))
    return palabras.every(w => heno.includes(w))
  })
}

/**
 * Qué productos tocan en pantalla: los de la búsqueda si se está buscando, y
 * si no los de la categoría abierta. Solo lo disponible, salvo que se pida
 * incluir lo agotado (el personal sí lo ve, para poder reactivarlo).
 */
export function productosVisibles(carta, { busqueda = '', categoria = null, incluirNoDisponibles = false, extra = null } = {}) {
  const base = incluirNoDisponibles ? carta.productos : carta.productos.filter(p => p.disponible)
  if (normalizar(busqueda)) return buscarProductos(base, busqueda, extra)
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

/**
 * ¿Queda algo en la mesa que la cocina no haya visto?
 *
 * La cuenta incluye las líneas sin enviar (`_debe_por_comensal` no mira el
 * estado), así que se podía pagar por Stripe un plato que nadie estaba
 * haciendo: el dinero entra y la comida no existe para nadie. Antes de cobrar
 * —por tarjeta o llamando al camarero— hay que mandarlas.
 */
export const hayLineasSinEnviar = (mesa) =>
  (mesa?.personas || []).some(p => (p?.items || []).some(i => i?.estado === 'pendiente'))

// ────────────────────────────────────────────────────────────────────────────
// Los apartados de la carta (lo que en el código se llama «categorías»).
//
// Solo se podían crear y borrar, y borrar se lleva por delante TODOS sus
// productos: una errata al escribir «Bocadilos» obligaba a borrar el apartado
// entero y volver a meter los doce bocadillos a mano. Tampoco se podía tocar
// el emoji —lo elegía el código, 🍽 o 🥤— ni el orden, que es justo el orden
// en el que el cliente ve la carta al escanear el QR.
//
// Y el tipo (comida/bebida) no era cosmético: es lo que decide si la comanda
// sale por la impresora de COCINA o por la de BARRA. Elegirlo mal al crear el
// apartado no tenía arreglo.
// ────────────────────────────────────────────────────────────────────────────

/** A dónde van las comandas de cada tipo de apartado. */
export const TIPOS_APARTADO = {
  comida: { label: 'Cocina', emoji: '🍳', desc: 'Sus comandas salen por la impresora de cocina y aparecen en el KDS de cocina' },
  bebida: { label: 'Barra', emoji: '🍺', desc: 'Sus comandas salen por la impresora de barra y aparecen en el KDS de barra' },
}

/** Emoji por defecto de un apartado nuevo, según a dónde vaya. */
export const emojiPorTipo = (tipo) => (tipo === 'bebida' ? '🥤' : '🍽')

/** Los de siempre en un bar, para no tener que buscarlos en el teclado. */
export const EMOJIS_APARTADO = [
  '🍽', '🥪', '🍳', '🥐', '🧀', '🍖', '🍗', '🥩', '🐟', '🥗', '🍟', '🍕',
  '🍝', '🍚', '🥘', '🍲', '🌮', '🍔', '🌭', '🍰', '🍮', '🍦', '🍫',
  '🥤', '☕', '🍺', '🍷', '🍸', '🍹', '🧃', '🧊', '🥂', '🫖',
]

/** Comprueba el nombre de un apartado. Devuelve { ok, nombre } o { ok, error }. */
export function revisarNombreApartado(categorias = [], id, nombre) {
  const n = String(nombre ?? '').trim()
  if (!n) return { ok: false, error: 'El apartado necesita un nombre' }
  const repetido = (categorias || []).some(c => c.id !== id && (c.nombre || '').trim().toLowerCase() === n.toLowerCase())
  if (repetido) return { ok: false, error: `Ya hay un apartado «${n}»` }
  return { ok: true, nombre: n }
}

/**
 * Mueve un elemento una posición arriba (-1) o abajo (+1). Devuelve una lista
 * nueva; si ya está en el extremo, devuelve la misma (no es un error: es que
 * no hay a dónde ir).
 */
export function moverEnLista(lista = [], id, direccion) {
  const xs = [...(lista || [])]
  const i = xs.findIndex(x => x.id === id)
  const j = i + (direccion < 0 ? -1 : 1)
  if (i < 0 || j < 0 || j >= xs.length) return xs
  ;[xs[i], xs[j]] = [xs[j], xs[i]]
  return xs
}

// ────────────────────────────────────────────────────────────────────────────
// Ordenar y copiar productos dentro de la carta.
//
// Los apartados ya se ordenan (v0.118.0), pero los productos de dentro salían
// en el orden en que se crearon — y ese es el orden en el que el cliente los
// lee al escanear el QR. Un bar quiere el bocadillo estrella arriba, no el
// último que dio de alta.
//
// Y montar una carta son ocho bocadillos que solo cambian el relleno: sin
// copiar, cada uno es teclear otra vez precio, formatos, alérgenos e IVA.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sube o baja un producto DENTRO de su apartado, devolviendo la lista entera.
 *
 * Se mueve entre hermanos —los de su misma categoría—, no entre vecinos de la
 * lista global: si se intercambiara con el de al lado a secas, un producto se
 * cambiaría de apartado al llegar al borde, que no es lo que pide nadie al
 * pulsar una flecha.
 */
export function moverProductoEnCarta(productos = [], id, direccion) {
  const xs = [...(productos || [])]
  const p = xs.find(x => x.id === id)
  if (!p) return xs
  const hermanos = xs.filter(x => x.categoria === p.categoria)
  const i = hermanos.findIndex(x => x.id === id)
  const j = i + (direccion < 0 ? -1 : 1)
  if (j < 0 || j >= hermanos.length) return xs        // ya está en el extremo
  const a = xs.findIndex(x => x.id === p.id)
  const b = xs.findIndex(x => x.id === hermanos[j].id)
  ;[xs[a], xs[b]] = [xs[b], xs[a]]
  return xs
}

/** ¿Es el primero (o el último) de su apartado? Para apagar las flechas. */
export function esExtremoDeApartado(productos = [], id) {
  const p = (productos || []).find(x => x.id === id)
  if (!p) return { primero: true, ultimo: true }
  const hermanos = (productos || []).filter(x => x.categoria === p.categoria)
  const i = hermanos.findIndex(x => x.id === id)
  return { primero: i <= 0, ultimo: i === hermanos.length - 1 }
}

/**
 * Los datos de un producto nuevo copiado de otro.
 *
 * El nombre lleva «(copia)» a propósito: dos productos con el mismo nombre en
 * la carta del cliente son dos líneas idénticas con precios que pueden diferir,
 * y en la comanda de cocina no hay forma de saber cuál pidió. Así se ve que
 * falta renombrarlo.
 */
export function copiaDeProducto(producto) {
  if (!producto) return null
  const { id, disponible, ...resto } = producto      // eslint-disable-line no-unused-vars
  return { ...structuredClone(resto), nombre: `${producto.nombre} (copia)` }
}

/** Lo que está marcado agotado. Al día siguiente se repone, y son varios. */
export const agotadosDe = (carta) => (carta?.productos || []).filter(p => !p.disponible)
