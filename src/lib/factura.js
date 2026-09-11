// ────────────────────────────────────────────────────────────────────────────
// Facturas completas: «¿me haces factura?».
//
// Cada cobro ya es una factura simplificada (el ticket, F2) registrada en la
// AEAT. La factura que pide quien viene por trabajo es la MISMA consumición
// con sus datos —nombre, NIF, domicilio— y se registra como F3, sustituyendo
// al ticket. No es una venta nueva: no suma en caja ni en informes.
//
// Aquí van las reglas que la pantalla comprueba mientras se teclea. El
// servidor (`emitir_factura`) las vuelve a comprobar: es quien manda.
// ────────────────────────────────────────────────────────────────────────────

import { cent, desglosePorTipo } from './dinero.js'

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'
const LETRAS_CIF = 'JABCDEFGHI'

/** Quita espacios, puntos y guiones y pasa a mayúsculas: «12.345.678-z» → «12345678Z». */
export const normalizarNif = (texto) => String(texto ?? '').toUpperCase().replace(/[\s.-]/g, '')

/**
 * ¿Es un DNI, NIE o CIF válido? Comprueba la letra o el dígito de control.
 *
 * Merece la pena hacerlo bien: la AEAT rechaza la factura con un NIF que no
 * existe, y eso se descubre cuando el cliente ya se ha ido con el papel.
 */
export function validarNif(texto) {
  const nif = normalizarNif(texto)
  if (!nif) return { ok: false, error: 'Falta el NIF' }

  if (/^[0-9]{8}[A-Z]$/.test(nif)) {
    const ok = LETRAS_DNI[Number(nif.slice(0, 8)) % 23] === nif[8]
    return ok ? { ok: true, nif, tipo: 'DNI' } : { ok: false, error: 'La letra de ese DNI no cuadra: revísalo' }
  }

  if (/^[XYZ][0-9]{7}[A-Z]$/.test(nif)) {
    const num = Number('XYZ'.indexOf(nif[0]) + nif.slice(1, 8))
    const ok = LETRAS_DNI[num % 23] === nif[8]
    return ok ? { ok: true, nif, tipo: 'NIE' } : { ok: false, error: 'La letra de ese NIE no cuadra: revísalo' }
  }

  if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(nif)) {
    const digitos = nif.slice(1, 8)
    let suma = 0
    for (let i = 0; i < 7; i++) {
      const d = Number(digitos[i])
      if (i % 2 === 0) { const x = d * 2; suma += Math.floor(x / 10) + (x % 10) } else suma += d
    }
    const control = (10 - (suma % 10)) % 10
    const letra = LETRAS_CIF[control]
    // Unas sociedades llevan letra de control, otras dígito, otras cualquiera.
    const soloLetra = 'NPQRSW'.includes(nif[0])
    const soloDigito = 'ABEH'.includes(nif[0])
    const final = nif[8]
    const ok = soloLetra ? final === letra : soloDigito ? final === String(control) : (final === letra || final === String(control))
    return ok ? { ok: true, nif, tipo: 'CIF' } : { ok: false, error: 'El dígito de control de ese CIF no cuadra: revísalo' }
  }

  return { ok: false, error: 'Eso no parece un DNI, NIE ni CIF' }
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Los datos del cliente para una factura completa. La ley pide nombre o
 * razón social, NIF y domicilio del destinatario; el correo es opcional —solo
 * hace falta si se la vas a mandar—.
 */
export function revisarDatosFactura({ nombre, nif, direccion, email } = {}) {
  const n = String(nombre ?? '').trim().replace(/\s+/g, ' ')
  if (!n) return { ok: false, error: 'Falta el nombre o la razón social del cliente' }
  if (n.length > 120) return { ok: false, error: 'El nombre no puede pasar de 120 caracteres' }

  const v = validarNif(nif)
  if (!v.ok) return v

  const d = String(direccion ?? '').trim().replace(/\s+/g, ' ')
  if (!d) return { ok: false, error: 'Falta el domicilio del cliente: la factura completa lo exige' }
  if (d.length > 200) return { ok: false, error: 'El domicilio no puede pasar de 200 caracteres' }

  const e = String(email ?? '').trim()
  if (e && !EMAIL.test(e)) return { ok: false, error: 'Ese correo no parece válido' }

  return { ok: true, valor: { nombre: n, nif: v.nif, direccion: d, email: e || null } }
}

/**
 * Por qué NO se puede facturar un ticket, o `null` si se puede.
 * Lo que se pregunta antes de enseñar el botón, para no ofrecer lo imposible.
 */
export function porQueNoSeFactura(ticket, { historial = [], facturas = [] } = {}) {
  if (!ticket) return 'Ese ticket ya no está'
  if (ticket.rectificaA) return 'Una devolución no se factura'
  if (!(Number(ticket.total) > 0)) return 'Un ticket a cero no se factura'
  const ya = facturas.find(f => f.ticketId === ticket.id)
  if (ya) return `Ya tiene la factura ${numeroDeFactura(ya)}`
  // La AEAT: si la simplificada se abonó, la que la sustituye va como F1 y no
  // como F3. Es otro documento; por aquí no se hace.
  if (historial.some(t => t.rectificaA === ticket.id)) return 'Este ticket tiene devoluciones: no se puede facturar desde aquí'
  return null
}

/** Lo que le falta al LOCAL para poder emitir facturas completas. */
export function faltaParaFacturar(local = {}) {
  const falta = []
  if (!String(local.cif || '').trim()) falta.push('el CIF')
  if (!String(local.direccionFiscal || local.direccion || '').trim()) falta.push('la dirección fiscal')
  return falta
}

/** «F-12». */
export const numeroDeFactura = (f) => (f?.numero != null ? `${f.serie || 'F'}-${f.numero}` : 'sin número')

const euros = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`

/**
 * Asunto y cuerpo del correo que ACOMPAÑA al PDF adjunto (sin enlaces: la
 * factura es el adjunto). Texto plano a propósito: la plantilla de EmailJS
 * del local ya sabe pintar {{asunto}} y {{mensaje}}, y un correo con la
 * factura escrita y el enlace para verla e imprimirla se lee en cualquier
 * cliente de correo —también en el de la gestoría—.
 */
export function correoDeFactura(f) {
  const emisor = f.emisor || {}
  const quien = emisor.razonSocial || emisor.nombre || 'el local'
  const lineas = (f.lineas || []).map(l => `  ${l.cantidad}× ${l.nombre} — ${euros(l.importe)}`).join('\n')
  const desglose = (f.desglose || []).map(d => `  Base ${euros(d.base)} · IVA ${d.ivaPct} % ${euros(d.cuota)}`).join('\n')
  const asunto = `Factura ${numeroDeFactura(f)} de ${quien}`
  const mensaje = [
    `Hola${f.cliente?.nombre ? `, ${f.cliente.nombre}` : ''}:`,
    '',
    `Te adjuntamos en PDF la factura ${numeroDeFactura(f)} de ${quien}.`,
    '',
    lineas,
    '',
    desglose,
    `  TOTAL ${euros(f.total)}`,
    '',
    `${quien} · NIF ${emisor.cif || ''}`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
  return { asunto, mensaje }
}

/**
 * Las líneas de la factura a partir del detalle del ticket, AGRUPADAS: en la
 * comida de empresa «4× Menú del día» es una línea, no cuatro repartidas por
 * comensal. Mismo criterio que `emitir_factura` en el servidor (nombre, precio
 * y tipo de IVA iguales = misma línea), para que la demo y la real coincidan.
 */
export function lineasParaFactura(personas, ivaPorDefecto = 10) {
  const grupos = new Map()
  for (const p of personas || []) {
    for (const i of p?.items || []) {
      const ivaPct = Number(i.ivaPct ?? ivaPorDefecto)
      const precio = Number(i.precio) || 0
      const clave = `${i.nombre}|${precio}|${ivaPct}`
      const g = grupos.get(clave) || { nombre: i.nombre, precio, ivaPct, cantidad: 0 }
      g.cantidad += Number(i.cantidad) || 0
      grupos.set(clave, g)
    }
  }
  return [...grupos.values()].filter(g => g.cantidad !== 0).map(g => ({ ...g, importe: cent(g.precio * g.cantidad) }))
}

/** Base, cuota y total por tipo de IVA, con la misma cuenta que el ticket. */
export const desgloseParaFactura = (lineas) =>
  desglosePorTipo((lineas || []).map(l => ({ precio: l.importe, cantidad: 1, ivaPct: l.ivaPct })))
    .map(d => ({ ivaPct: d.ivaPct, base: d.base, cuota: d.iva, total: d.total }))

/**
 * Enlace público de la factura: se abre sin sesión, desde el correo.
 * El origen y la base se pueden pasar para probarlo; en el navegador salen
 * solos (y con `VITE_BASE`, la del perfil publicado).
 */
export const enlaceFactura = (f, origen = globalThis.location?.origin ?? '', base = import.meta.env?.BASE_URL ?? '/') =>
  `${origen}${base}#/factura?t=${f.token}`

/**
 * ¿Se puede corregir y reenviar? Solo si Hacienda la RECHAZÓ: entonces nunca
 * llegó a constar y se reenvía con el mismo número. Una aceptada ya no se
 * toca (eso sería rectificarla), y una pendiente aún no ha tenido respuesta.
 */
export const puedeCorregirse = (f) => f?.fiscalEstado === 'error'

/** ¿Los datos tecleados son los mismos que ya tiene la factura? */
export function mismosDatosCliente(f, datos) {
  const c = f?.cliente || {}
  const limpio = (s) => String(s ?? '').trim().replace(/\s+/g, ' ')
  return limpio(c.nombre) === limpio(datos.nombre) && normalizarNif(c.nif) === normalizarNif(datos.nif) &&
    limpio(c.direccion) === limpio(datos.direccion) && limpio(c.email) === limpio(datos.email)
}
