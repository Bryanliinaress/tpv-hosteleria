import { describe, it, expect } from 'vitest'
import { codificar, crearTicket, comandaESCPOS, ticketESCPOS, abrirCajonESCPOS } from './escpos'

const bytesDe = (u8) => Array.from(u8)
const texto = (u8) => bytesDe(u8).map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('')

describe('codificación para impresora térmica', () => {
  it('el ASCII pasa tal cual', () => {
    expect(codificar('Mesa 3')).toEqual([77, 101, 115, 97, 32, 51])
  })

  it('los acentos y la ñ usan la página CP858 (no UTF-8)', () => {
    // á=160, é=130, í=161, ó=162, ú=163, ñ=164
    expect(codificar('áéíóúñ')).toEqual([160, 130, 161, 162, 163, 164])
    expect(codificar('¿Café?')).toEqual([168, 67, 97, 102, 130, 63])
  })

  it('el euro tiene su código y no se pierde', () => {
    expect(codificar('12€')).toEqual([49, 50, 213])
  })

  it('un carácter sin equivalente se transcribe sin tilde en vez de romper', () => {
    // ǎ no está en CP858: debe salir 'a', nunca un byte inválido
    expect(codificar('ǎ')).toEqual([97])
  })

  it('cada byte cabe en 8 bits (o la impresora imprime basura)', () => {
    const b = codificar('Señor Ñuño áéíóú €·«»¡¿')
    expect(b.every(x => Number.isInteger(x) && x >= 0 && x <= 255)).toBe(true)
  })
})

describe('comandos de la impresora', () => {
  it('init deja la impresora lista y fija la página de códigos', () => {
    const b = bytesDe(crearTicket().init().bytes())
    expect(b.slice(0, 2)).toEqual([0x1b, 0x40])      // ESC @
    expect(b.slice(2)).toEqual([0x1b, 0x74, 19])     // ESC t 19 (CP858)
  })

  it('corta el papel al final', () => {
    const b = bytesDe(crearTicket().cortar().bytes())
    expect(b.slice(-4)).toEqual([0x1d, 0x56, 66, 0]) // GS V 66 (corte parcial)
  })

  it('abre el cajón portamonedas', () => {
    expect(bytesDe(crearTicket().abrirCajon().bytes())).toEqual([0x1b, 0x70, 0, 0x19, 0xfa])
  })

  it('las filas alinean el importe a la derecha', () => {
    const t = texto(crearTicket({ ancho: 20 }).fila('TOTAL', '7,00').bytes())
    expect(t).toBe('TOTAL           7,00·')   // 20 columnas + salto
  })

  it('el QR se envía como comando nativo, no como imagen', () => {
    const b = bytesDe(crearTicket().qr('https://x.test').bytes())
    expect(b.slice(0, 3)).toEqual([0x1d, 0x28, 0x6b])   // GS ( k
    expect(b.length).toBeLessThan(120)                   // una imagen ocuparía miles
  })
})

describe('documentos del TPV', () => {
  it('la comanda lleva mesa, cantidades y no lleva precios', () => {
    const t = texto(comandaESCPOS({
      mesa: 5, destino: 'cocina',
      lineas: [{ cantidad: 2, nombre: 'Mixto', nota: 'SIN tomate', persona: 'Ana' }],
    }))
    expect(t).toContain('COCINA')
    expect(t).toContain('Mesa 5')
    expect(t).toContain('2x Mixto')
    expect(t).toContain('SIN tomate')
    expect(t).toContain('[Ana]')
    expect(t).not.toMatch(/\d+[.,]\d{2}/)   // ningún importe
  })

  it('el ticket desglosa base e IVA y marca el estado de pago', () => {
    const t = texto(ticketESCPOS({
      local: { nombre: 'Casa Loli', cif: 'B75777847', ivaPct: 10, moneda: 'EUR' },
      mesa: { numero: 3, zona: 'Terraza' },
      lineas: [{ nombre: 'Cafe', cantidad: 2, precio: 1.5 }],
      total: 3, comensales: 2, pagado: true,
    }))
    expect(t).toContain('Casa Loli')
    expect(t).toContain('B75777847')
    expect(t).toContain('Base imponible')
    expect(t).toContain('2.73')            // 3 / 1.10
    expect(t).toContain('IVA (10%)')
    expect(t).toContain('TOTAL')
    expect(t).toContain('PAGADO')
    expect(t).toContain('Mesa 3')
    expect(t).toContain('Por comensal')
  })

  it('si el ticket está registrado en la AEAT, imprime su QR y el sello', () => {
    const b = ticketESCPOS({
      local: { nombre: 'X' }, mesa: { numero: 1 }, lineas: [], total: 10,
      fiscal: { url: 'https://prewww2.aeat.es/ValidarQR?x=1' },
    })
    const t = texto(b)
    expect(t).toContain('VERI*FACTU')
    expect(bytesDe(b).join(',')).toContain('29,40,107')   // GS ( k → QR nativo
  })

  it('sin registro fiscal no se inventa ningún QR de la AEAT', () => {
    const t = texto(ticketESCPOS({ local: {}, mesa: { numero: 1 }, lineas: [], total: 5 }))
    expect(t).not.toContain('VERI*FACTU')
  })
})

// Quita las secuencias de control ESC/POS y deja solo lo que se imprime en el
// papel, que es lo que queremos medir.
const soloTexto = (bytes) => {
  const a = [...bytes]
  const out = []
  for (let i = 0; i < a.length; i++) {
    const b = a[i]
    if (b === 0x1b) {                        // ESC …
      const c = a[i + 1]
      if (c === 0x40) { i += 1; continue }                     // ESC @
      if ([0x74, 0x45, 0x61, 0x2d, 0x70].includes(c)) { i += (c === 0x70 ? 4 : 2); continue }
      i += 1; continue
    }
    if (b === 0x1d) {                        // GS …
      const c = a[i + 1]
      if (c === 0x21) { i += 2; continue }                     // GS ! n
      if (c === 0x56) { i += 3; continue }                     // GS V m n
      i += 1; continue
    }
    out.push(b)
  }
  return Buffer.from(out).toString('latin1')
}

describe('anchura según el tamaño de letra', () => {
  const texto = soloTexto

  it('en tamaño doble, la fila se ajusta a la mitad de columnas', () => {
    // 48 columnas normales → 24 en doble ancho. Si no se tiene en cuenta, la
    // línea del TOTAL se parte en dos en el papel.
    const t = crearTicket().tamano(2, 2).fila('TOTAL', '12.50 EUR')
    const linea = texto(t.bytes()).split('\n')[0]
    expect(linea.length).toBe(24)
    expect(linea.startsWith('TOTAL')).toBe(true)
    expect(linea.endsWith('12.50 EUR')).toBe(true)
  })

  it('en tamaño normal sigue usando las 48', () => {
    const t = crearTicket().fila('Base imponible', '10.00')
    const linea = texto(t.bytes()).split('\n')[0]
    expect(linea.length).toBe(48)
  })

  it('el separador también se adapta', () => {
    const doble = texto(crearTicket().tamano(2, 1).separador().bytes()).split('\n')[0]
    expect(doble.length).toBe(24)
  })

  it('volver a tamaño normal restaura el ancho', () => {
    const t = crearTicket().tamano(2, 2).fila('A', 'B').tamano(1, 1).fila('C', 'D')
    const lineas = texto(t.bytes()).split('\n').map(l => l)
    expect(lineas[0].length).toBe(24)
    expect(lineas[1].length).toBe(48)
  })

  it('el TOTAL del ticket real cabe en su línea', () => {
    const bytes = ticketESCPOS({
      local: { nombre: 'Bar Manolo', ivaPct: 10, moneda: 'EUR' },
      mesa: { numero: 3 }, total: 12.5, comensales: 1,
      lineas: [{ nombre: 'Mixto', cantidad: 2, precio: 2.5 }],
    })
    const linea = texto(bytes).split('\n').find(l => l.includes('TOTAL'))
    expect(linea.length).toBeLessThanOrEqual(24)
  })
})

describe('cajón portamonedas', () => {
  const CAJON = [0x1b, 0x70, 0x00, 0x19, 0xfa]
  const contiene = (bytes, seq) => {
    const a = [...bytes]
    return a.some((_, i) => seq.every((v, j) => a[i + j] === v))
  }

  it('cobrando en EFECTIVO, el ticket abre el cajón', () => {
    const bytes = ticketESCPOS({ local: {}, mesa: { numero: 1 }, total: 5, lineas: [], abrirCajon: true })
    expect(contiene(bytes, CAJON)).toBe(true)
  })

  it('cobrando con tarjeta NO se abre (no entra dinero físico)', () => {
    const bytes = ticketESCPOS({ local: {}, mesa: { numero: 1 }, total: 5, lineas: [], abrirCajon: false })
    expect(contiene(bytes, CAJON)).toBe(false)
  })

  it('se abre DESPUÉS de cortar: primero sale el ticket', () => {
    const bytes = [...ticketESCPOS({ local: {}, mesa: { numero: 1 }, total: 5, lineas: [], abrirCajon: true })]
    const corte = bytes.findIndex((b, i) => b === 0x1d && bytes[i + 1] === 0x56)
    const cajon = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x70)
    expect(corte).toBeGreaterThan(-1)
    expect(cajon).toBeGreaterThan(corte)
  })

  it('el botón manual manda solo la apertura', () => {
    expect(contiene(abrirCajonESCPOS(), CAJON)).toBe(true)
  })
})

describe('acentos y alineación', () => {
  it('cada carácter acentuado ocupa UN byte (si no, se descuadran las columnas)', () => {
    expect(codificar('Café')).toEqual([67, 97, 102, 130])
    expect(codificar('ñ')).toEqual([164])
    expect(codificar('€')).toEqual([213])
    expect(codificar('¿Qué?')).toHaveLength(5)
  })

  it('una línea con acentos mide lo mismo que una sin ellos', () => {
    const con = crearTicket().columnas('CAFÉ CON LECHE', 3, '1.40', '4.20').bytes()
    const sin = crearTicket().columnas('CAFE CON LECHE', 3, '1.40', '4.20').bytes()
    expect(con.length).toBe(sin.length)
    expect(con.length).toBe(49)                  // 48 columnas + salto de línea
  })

  it('lo que no está en la tabla se transcribe sin tilde, no a basura', () => {
    expect(codificar('Ŵ')).toEqual([87])         // W
    expect(String.fromCharCode(...codificar('piñón'))).toHaveLength(5)
  })

  it('un emoji en el nombre no rompe el ticket', () => {
    const bytes = codificar('Café 🍺')
    expect(bytes.every(b => b >= 0 && b <= 255)).toBe(true)
  })

  it('la página de códigos es CP858 (la que trae € y ñ)', () => {
    const init = [...crearTicket().init().bytes()]
    expect(init).toEqual([0x1b, 0x40, 0x1b, 0x74, 19])
  })
})
