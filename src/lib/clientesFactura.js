// ────────────────────────────────────────────────────────────────────────────
// Clientes de factura guardados: el que vuelve no teclea sus datos otra vez.
//
// El comercial de los martes, el taller de enfrente, la empresa de la comida
// de Navidad. Buscarlo tiene que ser más rápido que escribirlo: por nombre
// («talleres») o por un trozo de NIF («B123»), sin mirar tildes ni puntos.
// ────────────────────────────────────────────────────────────────────────────

import { normalizarNif } from './factura.js'

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const reciente = (a, b) => String(b.usadoEn || '').localeCompare(String(a.usadoEn || ''))

/**
 * Los clientes que casan con lo tecleado, los más recientes primero. Sin
 * texto, los últimos usados: al abrir la factura, el habitual ya está ahí.
 * Un NIF que EMPIEZA por lo tecleado va antes que un nombre que lo contiene.
 */
export function buscarClientes(lista = [], texto = '', max = 6) {
  const q = sinTildes(texto)
  if (!q) return [...lista].sort(reciente).slice(0, max)
  const qNif = normalizarNif(texto)
  const puntua = (c) => {
    const nif = normalizarNif(c.nif)
    if (qNif && nif.startsWith(qNif)) return 3
    if (sinTildes(c.nombre).startsWith(q)) return 2
    if (sinTildes(c.nombre).includes(q) || (qNif.length >= 3 && nif.includes(qNif))) return 1
    return 0
  }
  return lista
    .map(c => ({ c, p: puntua(c) }))
    .filter(x => x.p > 0)
    .sort((a, b) => b.p - a.p || reciente(a.c, b.c))
    .slice(0, max)
    .map(x => x.c)
}

/** El cliente guardado con ese NIF, escrito como sea («b-12.345.674»). */
export const clientePorNif = (lista = [], nif = '') => {
  const n = normalizarNif(nif)
  return n ? lista.find(c => normalizarNif(c.nif) === n) || null : null
}

/**
 * Guarda (o pone al día) un cliente en la lista, como hace el servidor: un NIF
 * es un cliente; si vuelve con otro domicilio, vale el de hoy; un correo vacío
 * no borra el que ya había. Es lo que usa la demo.
 */
export function guardarCliente(lista = [], datos, { id, ahora = new Date().toISOString() } = {}) {
  const ya = clientePorNif(lista, datos.nif)
  if (ya) {
    return lista.map(c => c !== ya ? c : {
      ...c, nombre: datos.nombre, direccion: datos.direccion,
      email: datos.email || c.email || null, facturas: (c.facturas || 0) + 1, usadoEn: ahora,
    })
  }
  return [...lista, {
    id, nombre: datos.nombre, nif: normalizarNif(datos.nif), direccion: datos.direccion,
    email: datos.email || null, facturas: 1, usadoEn: ahora,
  }]
}
