import { describe, it, expect } from 'vitest'
import { pdfDeFactura, bytesABase64, trazosQr, textoPdf, anchoTexto, partir, euros, nombreArchivoFactura } from './facturaPdf.js'

const latin1 = (bytes) => Array.from(bytes, b => String.fromCharCode(b)).join('')

const factura = (over = {}) => ({
  serie: 'F', numero: 12, expedidaEn: '2026-09-11T12:00:00Z', total: 27.2,
  emisor: { razonSocial: 'Hostelería Marchando S.L.', nombre: 'Marchando', cif: 'B12345674', direccion: 'C/ Mayor 12, Madrid', serieTickets: 'TPV', ticketNumero: 141, ticketFecha: '2026-09-11T11:00:00Z' },
  cliente: { nombre: 'Talleres Pérez S.L.', nif: 'B12345674', direccion: 'C/ Alcalá 45, 28014 Madrid' },
  lineas: [
    { nombre: 'Menú del día', cantidad: 2, precio: 12, ivaPct: 10, importe: 24 },
    { nombre: 'Café con leche', cantidad: 2, precio: 1.6, ivaPct: 10, importe: 3.2 },
  ],
  desglose: [{ ivaPct: 10, base: 24.73, cuota: 2.47, total: 27.2 }],
  ...over,
})

describe('pdfDeFactura', () => {
  it('es un PDF: cabecera y final correctos', () => {
    const t = latin1(pdfDeFactura(factura()))
    expect(t.startsWith('%PDF-1.4\n')).toBe(true)
    expect(t.endsWith('%%EOF\n')).toBe(true)
  })

  it('la tabla de referencias apunta al byte exacto de cada objeto (si no, el lector lo da por roto)', () => {
    const t = latin1(pdfDeFactura(factura()))
    const inicio = Number(t.match(/startxref\n(\d+)\n/)[1])
    expect(t.slice(inicio, inicio + 4)).toBe('xref')
    const filas = t.slice(inicio).split('\n').slice(3).filter(l => / 00000 n $/.test(l))
    filas.forEach((fila, i) => {
      const off = Number(fila.slice(0, 10))
      expect(t.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`)
    })
  })

  it('cada stream declara su longitud real', () => {
    const t = latin1(pdfDeFactura(factura()))
    for (const m of t.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const desde = m.index + m[0].length
      expect(t.slice(desde + Number(m[1]), desde + Number(m[1]) + 10)).toBe('\nendstream')
    }
  })

  it('lleva lo que exige una factura, con € y tildes en WinAnsi', () => {
    const t = latin1(pdfDeFactura(factura()))
    expect(t).toContain('(FACTURA)')
    expect(t).toContain('(N\xba F-12)')
    expect(t).toContain('(Talleres P\xe9rez S.L.)')
    expect(t).toContain('(NIF B12345674)')
    expect(t).toContain('(27,20 \x80)')
    expect(t).toContain('(Base imponible al 10 %)')
    expect(t).toContain('TPV-141')
  })

  it('un paréntesis en un nombre no rompe el PDF', () => {
    const t = latin1(pdfDeFactura(factura({ cliente: { nombre: 'Bar (el de enfrente)', nif: 'B12345674', direccion: 'C/ A' } })))
    expect(t).toContain('(Bar \\(el de enfrente\\))')
  })

  it('con muchas líneas pasa a otra página y lo dice en el pie', () => {
    const lineas = Array.from({ length: 70 }, (_, i) => ({ nombre: `Plato ${i}`, cantidad: 1, precio: 1, ivaPct: 10, importe: 1 }))
    const t = latin1(pdfDeFactura(factura({ lineas })))
    expect(t).toMatch(/\/Count [2-9]/)
    expect(t).toContain('P\xe1gina 2 de')
    expect(t).toContain('\\(continuaci\xf3n\\)')   // los paréntesis van escapados dentro de la cadena PDF
  })

  it('el QR de Verifactu solo va si la factura consta en Hacienda', () => {
    const sin = latin1(pdfDeFactura(factura()))
    expect(sin).not.toContain('VERI*FACTU')
    const con = latin1(pdfDeFactura(factura(), { qr: { n: 25, trazos: [[4, 4, 7], [4, 5, 1]] } }))
    expect(con).toContain('(VERI*FACTU)')
    expect(con).toMatch(/ re .* f/)
  })
})

describe('trazosQr', () => {
  it('lee los dos formatos de ruta de qrcode.react', () => {
    expect(trazosQr('M4 4h7v1H4zM10,5 h1v1H10z')).toEqual([[4, 4, 7], [10, 5, 1]])
  })
})

describe('textoPdf', () => {
  it('€, ñ y comillas españolas en sus bytes; lo que no existe, «?»', () => {
    expect(textoPdf('€ñ«»')).toBe('\x80\xf1\xab\xbb')
    expect(textoPdf('✓')).toBe('?')
    expect(textoPdf('a\\b')).toBe('a\\\\b')
  })
})

describe('medidas y cifras', () => {
  it('las cifras miden lo mismo: se pueden alinear a la derecha', () => {
    expect(anchoTexto('11,11 €', 10)).toBe(anchoTexto('99,99 €', 10))
    expect(anchoTexto('á', 10)).toBe(anchoTexto('a', 10))
  })

  it('parte un concepto largo sin pasarse del ancho', () => {
    const l = partir('Menú degustación de temporada con maridaje de vinos de la tierra', 120, 9.5)
    expect(l.length).toBeGreaterThan(1)
    l.forEach(x => expect(anchoTexto(x, 9.5)).toBeLessThanOrEqual(120))
  })

  it('euros con punto de miles y coma decimal', () => {
    expect(euros(1234.5)).toBe('1.234,50 €')
    expect(euros(3.2)).toBe('3,20 €')
  })

  it('el nombre del archivo no lleva caracteres raros', () => {
    expect(nombreArchivoFactura({ serie: 'F', numero: 12 })).toBe('Factura-F-12.pdf')
  })
})

describe('bytesABase64', () => {
  it('coincide con el base64 de Node para cualquier longitud', () => {
    for (const n of [0, 1, 2, 3, 10, 255]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37) % 256)
      expect(bytesABase64(b)).toBe(Buffer.from(b).toString('base64'))
    }
  })
})
