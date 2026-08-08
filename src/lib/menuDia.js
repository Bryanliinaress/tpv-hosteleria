// ────────────────────────────────────────────────────────────────────────────
// Menú del día y combos.
//
// Un menú es un producto con **precio cerrado** en el que el cliente elige
// entre varios grupos ("Primero", "Segundo", "Postre o café"). Algunas
// opciones pueden llevar suplemento (el solomillo del menú, +2 €).
//
// Se guarda dentro del propio producto para no tocar el esquema:
//   producto.menu = { grupos: [ { titulo, min, max, opciones: [ {nombre, sup} ] } ] }
// y la elección del cliente viaja en la personalización de la línea:
//   personalizacion.elecciones = [ { grupo, opcion, sup } ]
// ────────────────────────────────────────────────────────────────────────────

export const esMenu = (producto) => Array.isArray(producto?.menu?.grupos) && producto.menu.grupos.length > 0

export const grupoVacio = (titulo = '') => ({ titulo, min: 1, max: 1, opciones: [] })

// Un producto con `precios` se pide eligiendo formato (pan, tamaño)… salvo que
// sea un menú, que TAMBIÉN los tiene (`{ base: 12 }`) y se pide eligiendo de
// sus grupos. Confundirlos manda la comanda a cocina sin saber qué preparar.
export const conFormatos = (producto) => !!producto?.precios && !esMenu(producto)
// ¿Hace falta abrir la hoja de opciones antes de añadirlo al pedido?
export const conOpciones = (producto) => conFormatos(producto) || esMenu(producto)

// ¿La selección actual cumple lo que pide cada grupo?
export function menuCompleto(producto, elecciones = []) {
  if (!esMenu(producto)) return true
  return producto.menu.grupos.every((g, i) => {
    const n = elecciones.filter(e => e.grupo === (g.titulo || `Grupo ${i + 1}`)).length
    return n >= (g.min ?? 1) && n <= (g.max ?? 1)
  })
}

// Lo que falta por elegir, para guiar al cliente ("Elige tu segundo").
export function siguientePendiente(producto, elecciones = []) {
  if (!esMenu(producto)) return null
  return producto.menu.grupos.find((g, i) => {
    const n = elecciones.filter(e => e.grupo === (g.titulo || `Grupo ${i + 1}`)).length
    return n < (g.min ?? 1)
  }) || null
}

// Precio final: el del menú más los suplementos de lo elegido.
export function precioMenu(producto, elecciones = [], base = null) {
  const precioBase = base ?? Number(producto?.precios?.base ?? producto?.precio ?? 0)
  const sup = elecciones.reduce((s, e) => s + (Number(e.sup) || 0), 0)
  return Math.round((precioBase + sup) * 100) / 100
}

// Texto para la comanda de cocina: sin esto, el cocinero no sabe qué preparar.
export function resumenElecciones(elecciones = []) {
  return elecciones.map(e => `${e.grupo}: ${e.opcion}`).join(' · ')
}

// La línea que se manda al pedido cuando se pide un menú. Vale igual para la
// carta del cliente y para la PDA del camarero: el precio lleva los
// suplementos y las elecciones van en la NOTA, que es lo que lee cocina.
export function lineaDeMenu(producto, elecciones = [], nota = '') {
  const detalle = resumenElecciones(elecciones)
  return {
    productoId: producto.id,
    nombre: producto.nombre,
    precio: precioMenu(producto, elecciones),
    tipo: producto.tipo,
    elecciones,
    nota: [detalle, (nota || '').trim()].filter(Boolean).join(' · '),
  }
}

// Alterna una opción respetando el máximo del grupo (si max=1, sustituye).
export function alternarOpcion(grupo, opcion, elecciones = []) {
  const titulo = grupo.titulo
  const yaEsta = elecciones.some(e => e.grupo === titulo && e.opcion === opcion.nombre)
  const sinEsta = elecciones.filter(e => !(e.grupo === titulo && e.opcion === opcion.nombre))
  if (yaEsta) return sinEsta

  const delGrupo = sinEsta.filter(e => e.grupo === titulo)
  const max = grupo.max ?? 1
  const nueva = { grupo: titulo, opcion: opcion.nombre, sup: Number(opcion.sup) || 0 }
  if (delGrupo.length >= max) {
    // grupo lleno: la nueva sustituye a la más antigua de ese grupo
    const fuera = delGrupo[0]
    return [...sinEsta.filter(e => e !== fuera), nueva]
  }
  return [...sinEsta, nueva]
}
