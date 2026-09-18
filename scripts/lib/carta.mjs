// ────────────────────────────────────────────────────────────────────────────
// Leer una carta de un fichero y convertirla en filas de `categorias` y
// `productos`.
//
// Hasta ahora solo se podía sembrar una carta de dos maneras: copiando la de
// la demo (`copiar-carta.mjs`) o con la plantilla de fábrica. Ninguna sirve
// para un bar de verdad, que llega con SU carta. Casa Loli son 75 productos:
// a mano son 75 oportunidades de teclear mal un precio.
//
// Aquí solo está la parte que no toca la red, para poder probarla entera sin
// escribir en la base de nadie. El que habla con Supabase es `cargar-carta.mjs`.
// ────────────────────────────────────────────────────────────────────────────

import { esAlergeno } from '../../src/lib/alergenos.js'

const esNumero = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * Revisa la carta ANTES de tocar nada y devuelve la lista de problemas.
 *
 * Se revisa entera y se devuelven TODOS los fallos, no el primero: si hay seis
 * precios mal, quien los arregla quiere verlos de una vez, no descubrirlos de
 * seis en seis.
 */
export function revisarCarta(carta) {
  const fallos = []
  const pega = (m) => fallos.push(m)

  if (!carta || typeof carta !== 'object') return ['el fichero no contiene un objeto JSON']
  if (!Array.isArray(carta.categorias) || !carta.categorias.length) pega('no hay categorías')
  if (!Array.isArray(carta.productos) || !carta.productos.length) pega('no hay productos')
  if (fallos.length) return fallos

  const ids = new Set()
  for (const c of carta.categorias) {
    if (!c?.id) { pega(`categoría sin id: ${JSON.stringify(c)}`); continue }
    if (!c.nombre) pega(`la categoría «${c.id}» no tiene nombre`)
    if (ids.has(c.id)) pega(`la categoría «${c.id}» está repetida`)
    if (c.tipo && c.tipo !== 'comida' && c.tipo !== 'bebida') {
      pega(`la categoría «${c.id}» tiene tipo «${c.tipo}»; solo vale comida o bebida`)
    }
    ids.add(c.id)
  }

  const vistos = new Set()
  for (const p of carta.productos) {
    const quien = p?.nombre || JSON.stringify(p)
    if (!p?.nombre) { pega(`producto sin nombre: ${quien}`); continue }
    if (!ids.has(p.categoria)) pega(`«${p.nombre}» apunta a la categoría «${p.categoria}», que no existe`)

    const clave = `${p.categoria}|${p.nombre.toLowerCase()}`
    if (vistos.has(clave)) pega(`«${p.nombre}» aparece dos veces en la misma categoría`)
    vistos.add(clave)

    const precios = p.precios || {}
    const claves = Object.keys(precios)
    if (!claves.length) pega(`«${p.nombre}» no tiene ningún precio`)
    for (const k of claves) {
      if (!esNumero(precios[k])) pega(`«${p.nombre}» tiene el precio «${k}» a ${JSON.stringify(precios[k])}, que no es un número`)
      else if (precios[k] < 0) pega(`«${p.nombre}» tiene el precio «${k}» en negativo`)
    }

    for (const a of p.alergenos || []) {
      if (!esAlergeno(a)) pega(`«${p.nombre}» declara el alérgeno «${a}», que no es uno de los 14`)
    }

    for (const g of p.menu?.grupos || []) {
      if (!g?.nombre) pega(`«${p.nombre}» tiene un grupo de menú sin nombre`)
      for (const o of g.opciones || []) {
        if (!o?.nombre) pega(`«${p.nombre}» tiene una opción sin nombre en el grupo «${g.nombre}»`)
        if (o?.suplemento != null && !esNumero(o.suplemento)) {
          pega(`«${p.nombre}» → «${o.nombre}» tiene un suplemento que no es un número`)
        }
      }
    }
  }
  return fallos
}

/** Filas para la tabla `categorias`, en el orden en que vienen. */
export const filasCategorias = (carta, localId) =>
  carta.categorias.map((c, i) => ({
    local_id: localId,
    nombre: c.nombre,
    tipo: c.tipo || 'comida',
    emoji: c.emoji || null,
    orden: i,
  }))

/**
 * Filas para `productos`. `idDeCategoria` traduce el id del fichero al uuid que
 * la base acaba de asignar.
 *
 * El orden se lleva POR CATEGORÍA: si fuera global, la primera categoría se
 * quedaría con los números bajos y al reordenar una sola habría que tocar
 * todas. `desde` permite seguir numerando cuando ya hay productos.
 */
export function filasProductos(carta, localId, idDeCategoria, desde = {}) {
  const contador = { ...desde }
  return carta.productos.map((p) => {
    const orden = (contador[p.categoria] = (contador[p.categoria] ?? 0) + 1) - 1
    return {
      local_id: localId,
      categoria_id: idDeCategoria[p.categoria],
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precios: p.precios,
      // Misma forma que usa `copiar-carta.mjs`: lo que la app espera leer.
      modificadores: {
        ingredientes: p.ingredientes || [],
        imagen: p.imagen || '',
        ...(p.menu ? { menu: p.menu } : {}),
        ...(p.nombreEn ? { nombreEn: p.nombreEn } : {}),
        ...(p.descripcionEn ? { descripcionEn: p.descripcionEn } : {}),
      },
      alergenos: p.alergenos || [],
      disponible: p.disponible !== false,
      orden,
    }
  })
}

/** Resumen para enseñar antes de escribir: cuántos por categoría y el total. */
export function resumen(carta) {
  const porCategoria = carta.categorias.map(c => ({
    nombre: c.nombre,
    cuantos: carta.productos.filter(p => p.categoria === c.id).length,
  }))
  return {
    porCategoria,
    productos: carta.productos.length,
    conMenu: carta.productos.filter(p => p.menu?.grupos?.length).length,
    sinAlergenos: carta.productos.filter(p => !(p.alergenos || []).length).length,
  }
}
