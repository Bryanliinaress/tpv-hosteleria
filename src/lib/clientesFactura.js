// ────────────────────────────────────────────────────────────────────────────
// Clientes de factura guardados: el que vuelve no teclea sus datos otra vez.
//
// El comercial de los martes, el taller de enfrente, la empresa de la comida
// de Navidad. Buscarlo tiene que ser más rápido que escribirlo: por nombre
// («talleres») o por un trozo de NIF («B123»), sin mirar tildes ni puntos.
// ────────────────────────────────────────────────────────────────────────────

import { normalizarNif } from './factura.js'
import { cent } from './dinero.js'

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

const masReciente = (a, b) => String(b.expedidaEn || '').localeCompare(String(a.expedidaEn || ''))

/**
 * Todo lo de un cliente de un vistazo: sus facturas (la última primero),
 * cuántas son y cuánto se le ha facturado.
 *
 * El total NO cuenta las rechazadas por Hacienda: una factura rechazada no
 * vale, y sumarla sería decirle a una gestoría que se facturó lo que no.
 * Se cuentan aparte para que se vea que hay algo que corregir.
 */
export function resumenCliente(cliente, facturas = []) {
  const nif = normalizarNif(cliente?.nif)
  const suyas = nif ? facturas.filter(f => normalizarNif(f?.cliente?.nif) === nif).sort(masReciente) : []
  const validas = suyas.filter(f => f.fiscalEstado !== 'error')
  return {
    facturas: suyas,
    numero: suyas.length,
    total: cent(validas.reduce((s, f) => s + (Number(f.total) || 0), 0)),
    ultima: suyas[0]?.expedidaEn || null,
    rechazadas: suyas.length - validas.length,
  }
}

/**
 * Quien tiene facturas pero no está guardado (se facturó sin marcar
 * «Guardar este cliente»). Con los datos de su ÚLTIMA factura, que son los más
 * al día, para poder guardarlo de un toque.
 */
export function clientesSinGuardar(clientes = [], facturas = []) {
  const guardados = new Set(clientes.map(c => normalizarNif(c.nif)))
  const porNif = new Map()
  for (const f of [...facturas].sort(masReciente)) {
    const nif = normalizarNif(f?.cliente?.nif)
    if (!nif || guardados.has(nif) || porNif.has(nif)) continue
    porNif.set(nif, { nombre: f.cliente.nombre, nif, direccion: f.cliente.direccion, email: f.cliente.email || null, ultima: f.expedidaEn || null })
  }
  return [...porNif.values()]
}

const ESTADO_HACIENDA = { enviado: 'Registrada', pendiente: 'Pendiente', error: 'Rechazada', no_aplica: 'Sin registro' }
const importe = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',')

/**
 * Las facturas de un cliente en CSV, para la gestoría: `;` y coma decimal, que
 * es como Excel en español lo abre sin tocar nada (el BOM lo pone quien
 * descarga). Base e IVA sumados de todos los tipos de la factura.
 */
export function csvFacturasCliente(cliente, facturas = []) {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const cabecera = ['Factura', 'Fecha', 'Cliente', 'NIF', 'Base imponible', 'IVA', 'Total', 'Estado en Hacienda']
  const filas = facturas.map(f => {
    const base = (f.desglose || []).reduce((s, d) => s + (Number(d.base) || 0), 0)
    const cuota = (f.desglose || []).reduce((s, d) => s + (Number(d.cuota) || 0), 0)
    const d = f.expedidaEn ? new Date(f.expedidaEn) : null
    const dia = d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : ''
    return [`${f.serie || 'F'}-${f.numero}`, dia, f.cliente?.nombre || cliente?.nombre || '', f.cliente?.nif || cliente?.nif || '',
      importe(base), importe(cuota), importe(f.total), ESTADO_HACIENDA[f.fiscalEstado] || '']
  })
  return [cabecera, ...filas].map(fila => fila.map(celda).join(';')).join('\n')
}
