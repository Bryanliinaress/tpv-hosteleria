import { toast } from '../store/useUI'

// ────────────────────────────────────────────────────────────────────────────
// Envío de los bytes ESC/POS a la impresora térmica. Tres caminos, por orden
// de preferencia, según lo que tenga el local:
//
//  1. USB directo (WebUSB): la impresora enchufada al PC de barra. Sin
//     instalar nada, pero el navegador exige que el dueño la elija una vez.
//  2. Puente local (HTTP → TCP 9100): un agente en la red para impresoras
//     Ethernet o para varias estaciones. Ver docs/IMPRESION.md.
//  3. Navegador (window.print): lo que había hasta ahora; queda de reserva.
//
// La elección se guarda por dispositivo: cada terminal puede imprimir distinto.
// ────────────────────────────────────────────────────────────────────────────

const KEY = 'tpv-impresora'

export const MODOS = {
  navegador: 'Diálogo del navegador',
  usb: 'USB directo (ESC/POS)',
  puente: 'Puente de red (ESC/POS)',
}

export const config = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || { modo: 'navegador' } }
  catch { return { modo: 'navegador' } }
}
export const guardarConfig = (c) => localStorage.setItem(KEY, JSON.stringify({ ...config(), ...c }))

export const usbDisponible = () => typeof navigator !== 'undefined' && !!navigator.usb

// ── USB (WebUSB) ────────────────────────────────────────────────────────────

let dispositivo = null

// Pide al usuario que elija la impresora (hay que llamarlo desde un clic).
export async function elegirImpresoraUSB() {
  if (!usbDisponible()) throw new Error('Este navegador no permite USB directo (usa Chrome o Edge)')
  // clase 7 = impresoras; algunas térmicas chinas se declaran como vendor-specific
  dispositivo = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }, {}] })
  await prepararUSB()
  guardarConfig({ modo: 'usb', usbNombre: dispositivo.productName || 'Impresora USB' })
  return dispositivo.productName || 'Impresora USB'
}

async function prepararUSB() {
  if (!dispositivo) {
    const previos = await navigator.usb.getDevices()
    dispositivo = previos[0]
    if (!dispositivo) throw new Error('No hay impresora USB autorizada: elígela en Ajustes')
  }
  if (!dispositivo.opened) await dispositivo.open()
  if (!dispositivo.configuration) await dispositivo.selectConfiguration(1)
  // busca la interfaz con un endpoint de salida
  for (const iface of dispositivo.configuration.interfaces) {
    const alt = iface.alternates[0]
    const salida = alt.endpoints.find(e => e.direction === 'out')
    if (!salida) continue
    if (!iface.claimed) { try { await dispositivo.claimInterface(iface.interfaceNumber) } catch { continue } }
    return { iface: iface.interfaceNumber, endpoint: salida.endpointNumber }
  }
  throw new Error('La impresora no expone un canal de escritura')
}

async function imprimirUSB(bytes) {
  const { endpoint } = await prepararUSB()
  await dispositivo.transferOut(endpoint, bytes)
}

// ── Puente local (para impresoras de red) ───────────────────────────────────

// `destino` ('cocina' | 'barra' | 'caja') le dice al puente POR CUÁL de las
// impresoras del local tiene que sacarlo. Así un solo PC con dos impresoras
// manda las comandas de cocina a una y las de barra a otra. Si el puente no
// tiene esa impresora configurada, usa la suya por defecto.
async function imprimirPuente(bytes, destino) {
  const { puenteUrl } = config()
  if (!puenteUrl) throw new Error('Falta la dirección del puente de impresión')
  const url = puenteUrl.replace(/\/$/, '') + '/imprimir' + (destino ? `?destino=${encodeURIComponent(destino)}` : '')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  })
  if (!res.ok) throw new Error(`El puente respondió ${res.status}`)
}

// ── API pública ─────────────────────────────────────────────────────────────

// Imprime bytes ESC/POS. Si falla el camino elegido, avisa y cae al navegador
// para no dejar al camarero sin comanda.
export async function imprimirESCPOS(bytes, { alternativa, destino } = {}) {
  const { modo } = config()
  try {
    if (modo === 'usb') { await imprimirUSB(bytes); return { via: 'usb' } }
    if (modo === 'puente') { await imprimirPuente(bytes, destino); return { via: 'puente' } }
  } catch (e) {
    console.warn('impresión ESC/POS:', e)
    toast(`No se pudo imprimir: ${e.message}`, 'error')
  }
  if (typeof alternativa === 'function') { alternativa(); return { via: 'navegador' } }
  return { via: 'ninguna' }
}

// Abre el cajón portamonedas sin imprimir nada (botón manual y cobro en
// efectivo). Va por la impresora de caja, que es donde está el cajón.
export async function abrirCajon() {
  const { abrirCajonESCPOS } = await import('./escpos')
  return imprimirESCPOS(abrirCajonESCPOS(), { destino: 'caja' })
}

// Ticket de prueba para comprobar la instalación desde Ajustes.
export async function imprimirPrueba() {
  const { crearTicket } = await import('./escpos')
  const bytes = crearTicket().init()
    .alinear(1).tamano(2, 2).negrita(true).linea('PRUEBA').negrita(false).tamano(1, 1)
    .linea('Impresora configurada').salto()
    .alinear(0)
    .linea('Acentos: aeiou AEIOU n N')
    .linea('Simbolos: 12,50 EUR - 21% IVA')
    .separador()
    .fila('TOTAL', '12,50')
    .salto().alinear(1).qr('https://bryanliinaress.github.io/tpv-hosteleria/', 5)
    .cortar().bytes()
  return imprimirESCPOS(bytes)
}
