import { describe, it, expect } from 'vitest'
import { codificar, crearTicket, comandaESCPOS, ticketESCPOS } from './escpos'

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
