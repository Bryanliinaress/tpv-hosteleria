import { traducirCarta } from './cartaI18n'
// ────────────────────────────────────────────────────────────────────────────
// El comprobante que se lleva el cliente.
//
// Quien paga desde el móvil se quedaba sin nada: ni qué pidió, ni cuánto pagó.
// Aquí se guarda una foto de su consumo en el momento de pagar (la mesa se
// libera enseguida y el estado desaparece) y se convierte en algo descargable.
//
// OJO: esto es la COPIA DEL CLIENTE. La factura simplificada la emite el local
// con su TPV (y con Veri*Factu si lo tiene). No lo llamamos «factura».
// ────────────────────────────────────────────────────────────────────────────

const CLAVE = (mesaId) => `tpv-recibo-${mesaId}`

/**
 * Foto del consumo de una persona, lista para enseñar y descargar.
 * `lineas` viene ya repartido (un plato compartido cuenta su parte).
 */
export function construirRecibo({ local, mesa, nombre, lineas, propina = 0, metodo = null, metodoLabel = null, fecha = new Date() }) {
  const total = lineas.reduce((s, l) => s + l.importe, 0)
  const ivaPct = local?.ivaPct ?? 10
  // La cuota se saca de la base YA redondeada. Calculando las dos por separado,
  // «base + IVA» podía imprimirse un céntimo por encima del total: en un papel
  // que el cliente compara con lo que ha pagado, eso es una reclamación.
  const cent = (n) => Math.round(n * 100) / 100
  const base = cent(total / (1 + ivaPct / 100))
  return {
    v: 1,
    local: {
      nombre: local?.nombre || 'Mi Local',
      razonSocial: local?.razonSocial || null,
      cif: local?.cif || null,
      direccion: local?.direccion || null,
      telefono: local?.telefono || null,
      pie: local?.pieTicket || '¡Gracias por su visita!',
    },
    moneda: local?.moneda || '€',
    mesa: { numero: mesa?.numero ?? null, zona: mesa?.zona || null },
    nombre: nombre || null,
    lineas,
    total,
    propina,
    ivaPct,
    base,
    iva: cent(total - base),
    metodo,
    // etiqueta legible («Efectivo»), que en el papel quedaba como «efectivo»
    metodoLabel: metodoLabel || null,
    fecha: (fecha instanceof Date ? fecha : new Date(fecha)).toISOString(),
  }
}

/** Cómo se describe una línea: pan, sin/con y nota, igual que en el ticket. */
export function extraDeItem(item) {
  const p = []
  if (item.pan) p.push(`${item.pan.nombreFormato} · ${item.pan.nombreTipo}`)
  if (item.quitados?.length) p.push('sin ' + item.quitados.join(', '))
  if (item.anadidos?.length) p.push('con ' + item.anadidos.join(', '))
  if (item.nota) p.push('“' + item.nota + '”')
  return p.join(' · ')
}

/**
 * Lo que ha consumido una persona, con los platos compartidos ya repartidos:
 * es lo que de verdad paga, y por tanto lo que debe decir su recibo.
 */
export function lineasDeConsumo(mesa, personaId) {
  const lineas = []
  ;(mesa?.personas || []).forEach(owner => (owner.items || []).forEach(item => {
    const socios = [owner.id, ...(item.compartidoCon || [])]
    if (!socios.includes(personaId)) return
    lineas.push({
      nombre: item.nombre,
      uds: item.cantidad,
      importe: item.precio * item.cantidad / socios.length,
      extra: extraDeItem(item) || (owner.id !== personaId ? `de ${owner.nombre}` : ''),
      compartido: socios.length > 1,
    })
  }))
  return lineas
}

/** Nombre de fichero legible: recibo-bar-manolo-mesa3-2026-08-05.html */
export function nombreFichero(recibo) {
  const slug = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const dia = recibo.fecha.slice(0, 10)
  return ['recibo', slug(recibo.local.nombre), recibo.mesa.numero ? `mesa${recibo.mesa.numero}` : '', dia]
    .filter(Boolean).join('-') + '.html'
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/**
 * El recibo como página independiente: se abre sin conexión, se imprime y se
 * guarda como PDF desde el propio navegador. Sin imágenes ni fuentes externas
 * para que siga viéndose igual dentro de un año.
 */
export function reciboHTML(recibo, { t = (x) => x, idioma = 'es' } = {}) {
  const f = (n) => n.toFixed(2)
  const m = esc(recibo.moneda)
  // el cliente se lleva el papel: va en SU idioma, con su formato de fecha
  const fecha = new Date(recibo.fecha).toLocaleString(idioma === 'en' ? 'en-GB' : 'es-ES')
  const nombreLinea = (l) => esc(traducirCarta(idioma, l.nombre))
  const filas = recibo.lineas.map(l => `
      <tr>
        <td>${nombreLinea(l)}${l.extra ? `<div class="extra">${esc(traducirCarta(idioma, l.extra))}</div>` : ''}${l.compartido ? `<div class="extra">${esc(t('compartido'))}</div>` : ''}</td>
        <td class="num">${l.uds}</td>
        <td class="num">${f(l.importe)}</td>
      </tr>`).join('')

  return `<!doctype html>
<html lang="${idioma === 'en' ? 'en' : 'es'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t('Recibo'))} · ${esc(recibo.local.nombre)}</title>
<style>
  body { font-family: ui-monospace, "Courier New", monospace; background: #f4f4f5; color: #111; margin: 0; padding: 1.5rem; }
  .hoja { max-width: 22rem; margin: 0 auto; background: #fff; padding: 1.25rem; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  h1 { font-size: 1.1rem; text-align: center; margin: 0 0 .15rem; }
  .sub { text-align: center; font-size: .75rem; color: #555; }
  hr { border: none; border-top: 1px dashed #bbb; margin: .7rem 0; }
  table { width: 100%; border-collapse: collapse; font-size: .8rem; }
  th { text-align: left; font-size: .68rem; color: #555; border-bottom: 1px solid #ddd; padding-bottom: .2rem; }
  td { padding: .25rem 0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .extra { font-size: .68rem; color: #666; }
  .tot { display: flex; justify-content: space-between; font-size: .8rem; }
  .total { font-size: 1.25rem; font-weight: 800; }
  .pie { text-align: center; font-size: .7rem; color: #666; margin-top: .8rem; }
  .aviso { font-size: .64rem; color: #777; text-align: center; margin-top: .6rem; line-height: 1.4; }
  @media print { body { background: #fff; padding: 0; } .hoja { box-shadow: none; max-width: none; } }
</style></head>
<body><div class="hoja">
  <h1>${esc(recibo.local.nombre)}</h1>
  ${recibo.local.razonSocial ? `<div class="sub">${esc(recibo.local.razonSocial)}</div>` : ''}
  ${recibo.local.cif ? `<div class="sub">N.I.F.: ${esc(recibo.local.cif)}</div>` : ''}
  ${recibo.local.direccion ? `<div class="sub">${esc(recibo.local.direccion)}</div>` : ''}
  ${recibo.local.telefono ? `<div class="sub">Tel.: ${esc(recibo.local.telefono)}</div>` : ''}
  <hr>
  <div class="tot"><span>${esc(t('Fecha'))}</span><span>${esc(fecha)}</span></div>
  ${recibo.mesa.numero ? `<div class="tot"><span>${esc(t('Mesa'))}</span><span>${esc(recibo.mesa.numero)}${recibo.mesa.zona ? ` · ${esc(recibo.mesa.zona)}` : ''}</span></div>` : ''}
  ${recibo.nombre ? `<div class="tot"><span>${esc(t('Cliente'))}</span><span>${esc(recibo.nombre)}</span></div>` : ''}
  <hr>
  <table>
    <thead><tr><th>${esc(t('Descripción'))}</th><th class="num">${esc(t('Uds'))}</th><th class="num">${esc(t('Importe'))}</th></tr></thead>
    <tbody>${filas || `<tr><td colspan="3">${esc(t('Sin consumo'))}</td></tr>`}</tbody>
  </table>
  <hr>
  <div class="tot"><span>${esc(t('Base imponible'))}</span><span>${f(recibo.base)} ${m}</span></div>
  <div class="tot"><span>${esc(t('IVA'))} (${recibo.ivaPct}%)</span><span>${f(recibo.iva)} ${m}</span></div>
  ${recibo.propina > 0 ? `<div class="tot"><span>${esc(t('Propina'))}</span><span>${f(recibo.propina)} ${m}</span></div>` : ''}
  <div class="tot total"><span>${esc(t('Total'))}</span><span>${f(recibo.total + recibo.propina)} ${m}</span></div>
  ${recibo.metodo ? `<div class="tot"><span>${esc(t('Pagado con'))}</span><span>${esc(t(recibo.metodoLabel || recibo.metodo))}</span></div>` : ''}
  <div class="pie">${esc(recibo.local.pie)}</div>
  <div class="aviso">${esc(t('Copia para el cliente de su consumo.'))}<br>${esc(t('No sustituye a la factura simplificada, que emite el establecimiento.'))}</div>
</div></body></html>`
}

/** Descarga el recibo como fichero, sin servidor ni dependencias. */
export function descargarRecibo(recibo, doc = document, opciones = {}) {
  const blob = new Blob([reciboHTML(recibo, opciones)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = doc.createElement('a')
  a.href = url
  a.download = nombreFichero(recibo)
  doc.body.appendChild(a)
  a.click()
  a.remove()
  // dar tiempo al navegador a empezar la descarga antes de soltar el objeto
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return a.download
}

// ── Guardado local ──────────────────────────────────────────────────────────
// La mesa se libera al cobrar y el consumo desaparece del estado: guardamos la
// foto antes, en el propio móvil del cliente.

export function guardarRecibo(mesaId, recibo, store = localStorage) {
  try { store.setItem(CLAVE(mesaId), JSON.stringify(recibo)) } catch { /* modo privado lleno */ }
}

export function leerRecibo(mesaId, store = localStorage) {
  try {
    const bruto = store.getItem(CLAVE(mesaId))
    if (!bruto) return null
    const r = JSON.parse(bruto)
    return r?.v === 1 ? r : null
  } catch { return null }
}

export function olvidarRecibo(mesaId, store = localStorage) {
  try { store.removeItem(CLAVE(mesaId)) } catch { /* noop */ }
}

/**
 * ¿Hay un recibo de ESTE servicio? Sirve para enseñar la pantalla de «pagado»
 * a quien cierra la app y la vuelve a abrir. Pasadas unas horas ya no: quien
 * escanea el QR de esa mesa al día siguiente viene a comer, no a ver lo de ayer.
 */
export function reciboReciente(mesaId, { horas = 6, ahora = Date.now(), store = localStorage } = {}) {
  const r = leerRecibo(mesaId, store)
  if (!r) return null
  return (ahora - new Date(r.fecha).getTime()) < horas * 3600 * 1000 ? r : null
}
