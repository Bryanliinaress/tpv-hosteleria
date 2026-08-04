// ────────────────────────────────────────────────────────────────────────────
// Generador de comandos ESC/POS para impresoras térmicas de 80 mm.
//
// Sustituye a `window.print()`: en vez de mandar HTML al driver, se generan
// los bytes que la impresora entiende. Así se imprime sin diálogo, con corte
// automático, cajón portamonedas y QR nativo (más nítido y rápido).
//
// El transporte (USB, red o puente) está en lib/impresora.js.
// ────────────────────────────────────────────────────────────────────────────

const ESC = 0x1b, GS = 0x1d

// Las térmicas no hablan UTF-8: usan páginas de códigos de un byte. CP858 es
// la habitual en España (acentos, ñ, ¿¡ y €).
const CP858 = {
  'Ç': 128, 'ü': 129, 'é': 130, 'â': 131, 'ä': 132, 'à': 133, 'ç': 135,
  'ê': 136, 'ë': 137, 'è': 138, 'ï': 139, 'î': 140, 'ì': 141, 'Ä': 142,
  'É': 144, 'ô': 147, 'ö': 148, 'ò': 149, 'û': 150, 'ù': 151, 'Ö': 153, 'Ü': 154,
  'á': 160, 'í': 161, 'ó': 162, 'ú': 163, 'ñ': 164, 'Ñ': 165, 'ª': 166, 'º': 167,
  '¿': 168, '¡': 173, '«': 174, '»': 175,
  'Á': 181, 'Â': 182, 'À': 183, '©': 184, 'ã': 198, 'Ã': 199,
  'È': 212, 'Ê': 210, 'Í': 214, 'Î': 215, 'Ï': 216,
  'Ó': 224, 'ß': 225, 'Ô': 226, 'Ò': 227, 'õ': 228, 'Õ': 229, 'µ': 230,
  'Ú': 233, 'Û': 234, 'Ù': 235, 'ý': 236, 'Ý': 237, '€': 213,
  '·': 250, '²': 253, '–': 45, '—': 45, '’': 39, '‘': 39, '“': 34, '”': 34,
}

// Texto → bytes CP858. Lo que no exista se transcribe a su equivalente ASCII
// (mejor una letra sin tilde que un símbolo raro en el ticket del cliente).
export function codificar(texto) {
  const out = []
  for (const ch of String(texto)) {
    const cp = CP858[ch]
    if (cp !== undefined) { out.push(cp); continue }
    const c = ch.charCodeAt(0)
    if (c < 128) { out.push(c); continue }
    const plano = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    out.push(plano.charCodeAt(0) < 128 ? plano.charCodeAt(0) : 63) // '?'
  }
  return out
}

// Constructor de tiras de bytes con una API cómoda y encadenable.
export function crearTicket({ ancho = 48 } = {}) {
  const bytes = []
  const push = (...b) => { bytes.push(...b.flat()) }
  const api = {
    // ESC @ — deja la impresora en un estado conocido y fija la página CP858
    init() { push(ESC, 0x40, ESC, 0x74, 19); return api },
    texto(t = '') { push(codificar(t)); return api },
    linea(t = '') { push(codificar(t), 0x0a); return api },
    salto(n = 1) { push(...Array(n).fill(0x0a)); return api },
    // 0 izquierda · 1 centro · 2 derecha
    alinear(n) { push(ESC, 0x61, n); return api },
    negrita(on = true) { push(ESC, 0x45, on ? 1 : 0); return api },
    subrayado(on = true) { push(ESC, 0x2d, on ? 1 : 0); return api },
    // 1 = normal, 2 = doble, 3 = triple…
    tamano(anchoX = 1, altoX = 1) {
      const n = ((Math.min(anchoX, 8) - 1) << 4) | (Math.min(altoX, 8) - 1)
      push(GS, 0x21, n); return api
    },
    separador(ch = '-') { return api.linea(ch.repeat(ancho)) },
    // Fila con etiqueta a la izquierda e importe a la derecha, alineado
    fila(izq, der) {
      const i = String(izq), d = String(der)
      const hueco = Math.max(1, ancho - i.length - d.length)
      return api.linea(i + ' '.repeat(hueco) + d)
    },
    // Fila de 4 columnas (descripción, uds, precio, importe)
    columnas(desc, uds, precio, importe) {
      const c4 = String(importe).padStart(8)
      const c3 = String(precio).padStart(8)
      const c2 = String(uds).padStart(4)
      const restante = ancho - 20
      const d = String(desc).slice(0, restante).padEnd(restante)
      return api.linea(d + c2 + c3 + c4)
    },
    // QR nativo de la impresora (mucho más rápido que mandar una imagen)
    qr(datos, tamano = 6) {
      const d = codificar(datos)
      const len = d.length + 3
      push(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00)          // modelo 2
      push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, tamano)               // tamaño
      push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31)                 // corrección M
      push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...d)
      push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30)                 // imprimir
      return api
    },
    // Abre el cajón portamonedas (pin 2, el habitual)
    abrirCajon() { push(ESC, 0x70, 0x00, 0x19, 0xfa); return api },
    // Avanza y corta el papel
    cortar(parcial = true) { push(0x0a, 0x0a, 0x0a, GS, 0x56, parcial ? 66 : 65, 0x00); return api },
    bytes() { return new Uint8Array(bytes) },
  }
  return api
}

// ── Documentos del TPV ──────────────────────────────────────────────────────

const dec = (n) => Number(n).toFixed(2)

// Comanda para cocina/barra: grande, sin precios, lo que hay que preparar.
export function comandaESCPOS({ mesa, destino = 'COCINA', lineas = [], hora = new Date() }) {
  const t = crearTicket().init().alinear(1).tamano(2, 2).negrita(true)
    .linea(destino.toUpperCase()).negrita(false).tamano(1, 1)
    .linea(`Mesa ${mesa} · ${hora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
    .alinear(0).separador()
  lineas.forEach(l => {
    t.tamano(1, 2).negrita(true).linea(`${l.cantidad}x ${l.nombre}`).negrita(false).tamano(1, 1)
    if (l.nota) t.linea(`   ${l.nota}`)
    if (l.persona) t.linea(`   [${l.persona}]`)
  })
  if (!lineas.length) t.linea('(sin lineas)')
  return t.separador().cortar().bytes()
}

// Ticket de cuenta con todos los datos fiscales y el QR de Veri*Factu.
export function ticketESCPOS({ local = {}, mesa, lineas = [], total, propina = 0,
  comensales = 1, pagado = false, fiscal = null, fecha = new Date() }) {
  const ivaPct = Number(local.ivaPct ?? 10)
  const base = Number(total) / (1 + ivaPct / 100)
  const t = crearTicket().init()

  t.alinear(1).tamano(2, 2).negrita(true).linea(local.nombre || 'Mi Local')
    .negrita(false).tamano(1, 1)
  if (local.razonSocial) t.linea(`Razon Social: ${local.razonSocial}`)
  if (local.cif) t.linea(`N.I.F.: ${local.cif}`)
  if (local.direccion) t.linea(local.direccion)
  if (local.telefono) t.linea(`Tel: ${local.telefono}`)

  t.alinear(0).salto()
  t.linea(`Fecha: ${fecha.toLocaleString('es-ES')}`)
  if (mesa?.camarero) t.linea(`Atendido por: ${mesa.camarero}`)
  t.separador('=')
  t.columnas('DESCRIPCION', 'UDS', 'PRECIO', 'IMPORTE').separador()
  lineas.forEach(l => {
    t.columnas(l.nombre.toUpperCase(), l.cantidad, dec(l.precio), dec(l.precio * l.cantidad))
    if (l.nota) t.linea(`  ${l.nota}`)
  })

  t.separador()
    .fila('Base imponible', dec(base))
    .fila(`IVA (${ivaPct}%)`, dec(Number(total) - base))
  t.tamano(2, 2).negrita(true).fila('TOTAL', `${dec(total)} ${local.moneda || 'EUR'}`)
    .negrita(false).tamano(1, 1)
  t.fila('Comensales', String(comensales))
  if (comensales > 1) t.fila('Por comensal', dec(Number(total) / comensales))
  if (propina > 0) t.fila('Propina', dec(propina))

  t.separador('=').alinear(1).negrita(true)
    .linea(pagado ? 'PAGADO' : 'PENDIENTE DE PAGO').negrita(false).separador('=')
  t.tamano(1, 2).linea(`Mesa ${mesa?.numero ?? ''}`).tamano(1, 1)
  if (mesa?.zona) t.linea(mesa.zona)

  // QR fiscal (obligatorio con Veri*Factu) y sello
  if (fiscal?.url) {
    t.salto().linea('Factura verificable en la AEAT').qr(fiscal.url, 5).linea('VERI*FACTU')
  }
  if (local.urlResena) {
    t.salto().linea('Valora nuestro servicio').qr(local.urlResena, 5)
  }

  t.salto().linea(local.pieTicket || 'Gracias por su visita!')
  return t.cortar().bytes()
}
