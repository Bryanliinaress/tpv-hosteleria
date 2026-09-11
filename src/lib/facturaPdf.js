// ────────────────────────────────────────────────────────────────────────────
// La factura en PDF, para adjuntarla al correo o descargarla.
//
// Sin librerías, a propósito: un PDF de texto con tablas es un formato
// sencillo, y así el mismo código sirve en el navegador y en Node (el servicio
// de impresión y los tests) sin añadir cientos de KB al bundle del mostrador.
//
// Usa las fuentes que todo lector de PDF trae de serie (Helvetica y
// Helvetica-Bold) con codificación WinAnsi, que tiene el «€», la «ñ» y todas
// las tildes. No se incrusta ninguna fuente: la factura de una comida pesa unos
// pocos KB y cabe de sobra como adjunto.
//
// Las anchuras de letra son las oficiales de las fuentes (AFM): hacen falta
// para alinear las cifras a la derecha y partir los conceptos largos. Una
// columna de importes que no está alineada es una factura que parece falsa.
// ────────────────────────────────────────────────────────────────────────────

import { numeroDeFactura } from './factura.js'

const A4 = { w: 595.28, h: 841.89 }
const MARGEN = 48
const DERECHA = A4.w - MARGEN

// Anchuras en milésimas de em, caracteres 32..126.
const ANCHO_NORMAL = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]
const ANCHO_NEGRITA = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]
const ANCHO_EXTRA = { '€': 556, 'º': 365, 'ª': 370, '·': 278, '«': 556, '»': 556, '×': 584, '¿': 611, '¡': 333, '…': 1000, '–': 556, '—': 1000 }

// Lo que WinAnsi pone fuera de Latin-1.
const WINANSI = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 }

const base = (ch) => ch.normalize('NFD')[0]

/** Anchura de un texto en puntos, con las métricas de Helvetica. */
export function anchoTexto(texto, tamano = 10, negrita = false) {
  const tabla = negrita ? ANCHO_NEGRITA : ANCHO_NORMAL
  let total = 0
  for (const ch of String(texto ?? '')) {
    const c = ch.charCodeAt(0)
    let w = c >= 32 && c <= 126 ? tabla[c - 32] : ANCHO_EXTRA[ch]
    if (w == null) {
      const b = base(ch).charCodeAt(0)   // «á» mide lo que «a»
      w = b >= 32 && b <= 126 ? tabla[b - 32] : 556
    }
    total += w
  }
  return (total * tamano) / 1000
}

/** Texto a cadena PDF en WinAnsi, con los paréntesis y barras escapados. */
export function textoPdf(texto) {
  let s = ''
  for (const ch of String(texto ?? '')) {
    const c = ch.charCodeAt(0)
    let byte
    if (WINANSI[ch] != null) byte = WINANSI[ch]
    else if (c < 128 || (c >= 0xa0 && c <= 0xff)) byte = c
    else {
      const b = base(ch).charCodeAt(0)
      byte = b < 128 ? b : 63   // lo que no existe en WinAnsi sale como «?»
    }
    if (byte < 32 && byte !== 9) byte = 32
    const car = String.fromCharCode(byte)
    s += car === '(' || car === ')' || car === '\\' ? `\\${car}` : car
  }
  return s
}

/** Parte un texto en líneas que caben en `ancho` puntos. */
export function partir(texto, ancho, tamano = 10, negrita = false) {
  const palabras = String(texto ?? '').split(/\s+/).filter(Boolean)
  const lineas = []
  let actual = ''
  for (let p of palabras) {
    // Una palabra más larga que la columna (un NIF pegado a una dirección,
    // una URL) se corta a la fuerza: si no, se sale por el borde del papel.
    while (anchoTexto(p, tamano, negrita) > ancho) {
      let i = p.length
      while (i > 1 && anchoTexto(p.slice(0, i), tamano, negrita) > ancho) i--
      if (actual) { lineas.push(actual); actual = '' }
      lineas.push(p.slice(0, i))
      p = p.slice(i)
    }
    const prueba = actual ? `${actual} ${p}` : p
    if (anchoTexto(prueba, tamano, negrita) <= ancho) actual = prueba
    else { if (actual) lineas.push(actual); actual = p }
  }
  if (actual) lineas.push(actual)
  return lineas.length ? lineas : ['']
}

const num = (v) => String(Math.round(v * 100) / 100)

/** «1.234,50 €», como se escribe en España. */
export function euros(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  const [ent, dec] = Math.abs(v).toFixed(2).split('.')
  return `${v < 0 ? '-' : ''}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`
}

const fecha = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Los tramos de un QR de `qrcode.react` a partir del atributo `d` de su ruta:
 * cada «M x y h ancho v1 H x z» es un tramo de módulos negros en una fila.
 */
export function trazosQr(d) {
  const trazos = []
  for (const m of String(d ?? '').matchAll(/M\s*(\d+)[\s,]+(\d+)\s*h\s*(\d+)/g)) {
    trazos.push([Number(m[1]), Number(m[2]), Number(m[3])])
  }
  return trazos
}

const GRIS = '0.4 0.4 0.43'
const NEGRO = '0.09 0.09 0.1'

function lienzo() {
  const ops = []
  return {
    ops,
    texto(x, y, texto, { tamano = 9, negrita = false, color = NEGRO, alinear = 'izq' } = {}) {
      const w = anchoTexto(texto, tamano, negrita)
      const xx = alinear === 'der' ? x - w : x
      ops.push(`BT /${negrita ? 'F2' : 'F1'} ${num(tamano)} Tf ${color} rg ${num(xx)} ${num(y)} Td (${textoPdf(texto)}) Tj ET`)
    },
    linea(x1, y1, x2, y2, { grosor = 0.5, color = '0.83 0.83 0.85' } = {}) {
      ops.push(`${color} RG ${num(grosor)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`)
    },
    caja(x, y, w, h) {
      ops.push(`0.83 0.83 0.85 RG 0.6 w ${num(x)} ${num(y)} ${num(w)} ${num(h)} re S`)
    },
    qr(x, yArriba, lado, { n, trazos }) {
      const celda = lado / n
      const r = trazos.map(([cx, cy, cw]) => `${num(x + cx * celda)} ${num(yArriba - (cy + 1) * celda)} ${num(cw * celda)} ${num(celda)} re`)
      ops.push(`0 0 0 rg ${r.join(' ')} f`)
    },
  }
}

// Columnas de la tabla de líneas (x de la derecha de cada cifra).
const COL = { concepto: MARGEN + 4, anchoConcepto: 250, cant: MARGEN + 318, precio: MARGEN + 392, iva: MARGEN + 440, importe: DERECHA - 4 }

/**
 * La factura completa en PDF (A4). Devuelve los bytes.
 *
 * `qr` es opcional —`{ n, trazos }`, ver `trazosQr`—: solo existe cuando la
 * factura ya consta en Hacienda, y entonces tiene que ir impreso.
 */
export function pdfDeFactura(f, { qr = null } = {}) {
  const e = f.emisor || {}
  const c = f.cliente || {}
  const titulo = `Factura ${numeroDeFactura(f)}`
  const paginas = []
  let p
  let y

  const cabeceraTabla = () => {
    p.texto(COL.concepto, y, 'CONCEPTO', { tamano: 7.5, negrita: true })
    p.texto(COL.cant, y, 'CANT.', { tamano: 7.5, negrita: true, alinear: 'der' })
    p.texto(COL.precio, y, 'PRECIO', { tamano: 7.5, negrita: true, alinear: 'der' })
    p.texto(COL.iva, y, 'IVA', { tamano: 7.5, negrita: true, alinear: 'der' })
    p.texto(COL.importe, y, 'IMPORTE', { tamano: 7.5, negrita: true, alinear: 'der' })
    y -= 6
    p.linea(MARGEN, y, DERECHA, y, { grosor: 1.2, color: NEGRO })
    y -= 13
  }

  const paginaNueva = (continua) => {
    p = lienzo()
    paginas.push(p)
    y = A4.h - MARGEN
    if (continua) {
      p.texto(MARGEN, y - 10, `${titulo} (continuación)`, { tamano: 10, negrita: true })
      y -= 34
      cabeceraTabla()
    }
  }

  // ── Cabecera: emisor a la izquierda, número y fecha a la derecha ─────────
  paginaNueva(false)
  const arriba = y
  y -= 14
  for (const l of partir(e.razonSocial || e.nombre || '', 300, 15, true)) { p.texto(MARGEN, y, l, { tamano: 15, negrita: true }); y -= 17 }
  if (e.razonSocial && e.nombre && e.razonSocial !== e.nombre) { p.texto(MARGEN, y, e.nombre, { tamano: 9, color: GRIS }); y -= 12 }
  p.texto(MARGEN, y, `NIF ${e.cif || ''}`, { tamano: 9, color: GRIS }); y -= 12
  for (const l of partir(e.direccion || '', 300, 9)) { p.texto(MARGEN, y, l, { tamano: 9, color: GRIS }); y -= 12 }

  p.texto(DERECHA, arriba - 18, 'FACTURA', { tamano: 22, negrita: true, alinear: 'der' })
  p.texto(DERECHA, arriba - 34, `Nº ${numeroDeFactura(f)}`, { tamano: 11, negrita: true, alinear: 'der' })
  p.texto(DERECHA, arriba - 48, `Fecha de expedición: ${fecha(f.expedidaEn)}`, { tamano: 9, color: GRIS, alinear: 'der' })
  y = Math.min(y, arriba - 60) - 16

  // ── Cliente ──────────────────────────────────────────────────────────────
  const dirCliente = partir(c.direccion || '', A4.w - 2 * MARGEN - 24, 9.5)
  const altoCliente = 16 + 15 + 13 + dirCliente.length * 13 + 8
  p.caja(MARGEN, y - altoCliente, A4.w - 2 * MARGEN, altoCliente)
  let yc = y - 14
  p.texto(MARGEN + 12, yc, 'CLIENTE', { tamano: 7, negrita: true, color: GRIS }); yc -= 15
  p.texto(MARGEN + 12, yc, c.nombre || '', { tamano: 11, negrita: true }); yc -= 13
  p.texto(MARGEN + 12, yc, `NIF ${c.nif || ''}`, { tamano: 9.5 }); yc -= 13
  for (const l of dirCliente) { p.texto(MARGEN + 12, yc, l, { tamano: 9.5 }); yc -= 13 }
  y -= altoCliente + 26

  // ── Líneas ───────────────────────────────────────────────────────────────
  cabeceraTabla()
  for (const l of f.lineas || []) {
    const trozos = partir(l.nombre, COL.anchoConcepto, 9.5)
    const alto = trozos.length * 12 + 7
    if (y - alto < MARGEN + 40) paginaNueva(true)
    p.texto(COL.cant, y, String(Number(l.cantidad)), { tamano: 9.5, alinear: 'der' })
    p.texto(COL.precio, y, euros(l.precio), { tamano: 9.5, alinear: 'der' })
    p.texto(COL.iva, y, `${Number(l.ivaPct)} %`, { tamano: 9.5, alinear: 'der' })
    p.texto(COL.importe, y, euros(l.importe), { tamano: 9.5, alinear: 'der' })
    trozos.forEach((t, i) => p.texto(COL.concepto, y - i * 12, t, { tamano: 9.5 }))
    y -= alto - 6
    p.linea(MARGEN, y, DERECHA, y)
    y -= 13
  }
  p.texto(MARGEN, y - 2, 'Precios con IVA incluido.', { tamano: 7.5, color: GRIS })
  y -= 26

  // ── Totales y, a su izquierda, el QR y a qué ticket sustituye ────────────
  const desglose = f.desglose || []
  const altoTotales = desglose.length * 2 * 15 + 30
  const sustituye = e.ticketNumero != null
    ? `Emitida en sustitución de la factura simplificada ${e.serieTickets || 'TPV'}-${e.ticketNumero} del ${fecha(e.ticketFecha)}.`
    : ''
  const lineasSust = sustituye ? partir(sustituye, 220, 8) : []
  const altoIzq = (qr ? 90 : 0) + lineasSust.length * 11
  if (y - Math.max(altoTotales, altoIzq) < MARGEN + 30) paginaNueva(false)

  const xEtiqueta = DERECHA - 200
  let yt = y
  for (const d of desglose) {
    p.texto(xEtiqueta, yt, `Base imponible al ${Number(d.ivaPct)} %`, { tamano: 9.5 })
    p.texto(DERECHA, yt, euros(d.base), { tamano: 9.5, alinear: 'der' })
    yt -= 15
  }
  for (const d of desglose) {
    p.texto(xEtiqueta, yt, `Cuota IVA ${Number(d.ivaPct)} %`, { tamano: 9.5 })
    p.texto(DERECHA, yt, euros(d.cuota), { tamano: 9.5, alinear: 'der' })
    yt -= 15
  }
  yt += 5
  p.linea(xEtiqueta, yt, DERECHA, yt, { grosor: 1.2, color: NEGRO })
  yt -= 16
  p.texto(xEtiqueta, yt, 'TOTAL', { tamano: 12, negrita: true })
  p.texto(DERECHA, yt, euros(f.total), { tamano: 12, negrita: true, alinear: 'der' })

  let yi = y + 8
  if (qr?.n && qr.trazos?.length) {
    p.qr(MARGEN, yi, 78, qr)
    p.texto(MARGEN + 88, yi - 30, 'VERI*FACTU', { tamano: 9, negrita: true })
    p.texto(MARGEN + 88, yi - 42, 'Factura verificable en la sede', { tamano: 7.5, color: GRIS })
    p.texto(MARGEN + 88, yi - 52, 'electrónica de la AEAT', { tamano: 7.5, color: GRIS })
    yi -= 90
  }
  lineasSust.forEach((l, i) => p.texto(MARGEN, yi - 8 - i * 11, l, { tamano: 8, color: GRIS }))

  // ── Pie de cada página ───────────────────────────────────────────────────
  paginas.forEach((pg, i) => {
    pg.texto(DERECHA, MARGEN - 18, `${titulo} · Página ${i + 1} de ${paginas.length}`, { tamano: 7.5, color: GRIS, alinear: 'der' })
  })

  return ensamblar(paginas, titulo)
}

// Objetos, tabla de referencias y cola: la estructura mínima de un PDF 1.4.
function ensamblar(paginas, titulo) {
  const objetos = []
  const nPag = paginas.length
  const idPagina = (i) => 6 + i * 2
  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objetos[2] = `<< /Type /Pages /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] /Count ${nPag} >>`
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  objetos[5] = `<< /Title (${textoPdf(titulo)}) /Producer (Marchando TPV) >>`
  paginas.forEach((pg, i) => {
    const contenido = pg.ops.join('\n')
    objetos[idPagina(i)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idPagina(i) + 1} 0 R >>`
    objetos[idPagina(i) + 1] = `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`
  })

  // «%âãÏÓ» en la segunda línea: le dice a quien lo transporte que es binario.
  let salida = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets = []
  for (let i = 1; i < objetos.length; i++) {
    offsets[i] = salida.length
    salida += `${i} 0 obj\n${objetos[i]}\nendobj\n`
  }
  const inicioXref = salida.length
  salida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objetos.length; i++) salida += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  salida += `trailer\n<< /Size ${objetos.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`

  // Todo lo escrito son caracteres de un byte (WinAnsi): la longitud de la
  // cadena ES la longitud en bytes, y por eso los offsets de arriba valen.
  const bytes = new Uint8Array(salida.length)
  for (let i = 0; i < salida.length; i++) bytes[i] = salida.charCodeAt(i) & 0xff
  return bytes
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Bytes a base64, sin `btoa` ni `Buffer`: vale igual en el navegador y en Node. */
export function bytesABase64(bytes) {
  let s = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]
  }
  const resto = bytes.length - i
  if (resto === 1) {
    const n = bytes[i] << 16
    s += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}==`
  } else if (resto === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    s += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}${B64[(n >> 6) & 63]}=`
  }
  return s
}

/** «Factura-F-12.pdf». */
export const nombreArchivoFactura = (f) => `Factura-${numeroDeFactura(f).replace(/[^\w-]/g, '')}.pdf`
