import { describe, it, expect, beforeEach } from 'vitest'
import { construirRecibo, reciboHTML, nombreFichero, guardarRecibo, leerRecibo, olvidarRecibo, descargarRecibo, lineasDeConsumo, reciboReciente } from './recibo'

const LOCAL = { nombre: 'Bar Manolo', cif: 'B12345678', direccion: 'C/ Mayor 1', ivaPct: 10, moneda: '€', pieTicket: '¡Hasta pronto!' }
const LINEAS = [
  { nombre: 'Mixto', uds: 2, importe: 4.0 },
  { nombre: 'Café solo', uds: 1, importe: 1.3, extra: 'sin azúcar' },
]
const base = { local: LOCAL, mesa: { numero: 3, zona: 'Terraza' }, nombre: 'Ana', lineas: LINEAS, fecha: new Date('2026-08-05T14:30:00Z') }

describe('construirRecibo', () => {
  it('suma el consumo y desglosa el IVA incluido', () => {
    const r = construirRecibo(base)
    expect(r.total).toBeCloseTo(5.3, 2)
    expect(r.base).toBeCloseTo(4.818, 2)
    expect(r.iva).toBeCloseTo(0.482, 2)
    expect(r.ivaPct).toBe(10)
  })

  it('la propina va aparte de la base imponible', () => {
    const r = construirRecibo({ ...base, propina: 1 })
    expect(r.total).toBeCloseTo(5.3, 2)   // el total del consumo no la incluye
    expect(r.propina).toBe(1)
  })

  it('aguanta un local a medio configurar', () => {
    const r = construirRecibo({ local: {}, mesa: {}, lineas: [] })
    expect(r.local.nombre).toBe('Mi Local')
    expect(r.moneda).toBe('€')
    expect(r.total).toBe(0)
    expect(r.ivaPct).toBe(10)
  })
})

describe('nombreFichero', () => {
  it('sale legible y sin acentos', () => {
    expect(nombreFichero(construirRecibo(base))).toBe('recibo-bar-manolo-mesa3-2026-08-05.html')
  })

  it('sin mesa no deja huecos raros', () => {
    const r = construirRecibo({ ...base, mesa: {} })
    expect(nombreFichero(r)).toBe('recibo-bar-manolo-2026-08-05.html')
  })
})

describe('reciboHTML', () => {
  const html = reciboHTML(construirRecibo({ ...base, propina: 0.5, metodo: 'Tarjeta' }))

  it('lleva lo que el cliente necesita', () => {
    expect(html).toContain('Bar Manolo')
    expect(html).toContain('B12345678')
    expect(html).toContain('Mixto')
    expect(html).toContain('sin azúcar')
    expect(html).toContain('5.80')          // 5,30 + 0,50 de propina
    expect(html).toContain('Tarjeta')
  })

  it('deja claro que no es la factura del local', () => {
    expect(html).toContain('No sustituye a la factura simplificada')
  })

  it('es una página independiente, sin recursos externos', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).not.toMatch(/src="http|href="http/)
  })

  it('escapa el HTML de los nombres (una carta la escribe el dueño)', () => {
    const malicioso = reciboHTML(construirRecibo({ ...base, local: { ...LOCAL, nombre: '<script>alert(1)</script>' } }))
    expect(malicioso).not.toContain('<script>alert(1)</script>')
    expect(malicioso).toContain('&lt;script&gt;')
  })
})

describe('guardar y leer', () => {
  let almacen
  beforeEach(() => {
    const datos = new Map()
    almacen = {
      getItem: k => datos.get(k) ?? null,
      setItem: (k, v) => datos.set(k, v),
      removeItem: k => datos.delete(k),
    }
  })

  it('sobrevive al cierre de la mesa', () => {
    const r = construirRecibo(base)
    guardarRecibo('mesa-3', r, almacen)
    expect(leerRecibo('mesa-3', almacen).total).toBeCloseTo(5.3, 2)
  })

  it('cada mesa guarda el suyo', () => {
    guardarRecibo('mesa-3', construirRecibo(base), almacen)
    expect(leerRecibo('mesa-9', almacen)).toBeNull()
  })

  it('olvidar lo borra', () => {
    guardarRecibo('mesa-3', construirRecibo(base), almacen)
    olvidarRecibo('mesa-3', almacen)
    expect(leerRecibo('mesa-3', almacen)).toBeNull()
  })

  it('un guardado corrupto no rompe la pantalla', () => {
    almacen.setItem('tpv-recibo-mesa-3', '{roto')
    expect(leerRecibo('mesa-3', almacen)).toBeNull()
  })

  it('si el almacenamiento falla (modo privado), no revienta', () => {
    const roto = { setItem: () => { throw new Error('lleno') }, getItem: () => { throw new Error('no') }, removeItem: () => {} }
    expect(() => guardarRecibo('mesa-3', construirRecibo(base), roto)).not.toThrow()
    expect(leerRecibo('mesa-3', roto)).toBeNull()
  })
})

describe('descargarRecibo', () => {
  it('pide la descarga con el nombre correcto', () => {
    const pulsado = []
    const enlace = { click: () => pulsado.push('click'), remove: () => {}, set href(v) { this._h = v }, get href() { return this._h } }
    const doc = { createElement: () => enlace, body: { appendChild: () => {} } }
    globalThis.URL.createObjectURL = () => 'blob:x'
    globalThis.URL.revokeObjectURL = () => {}
    const nombre = descargarRecibo(construirRecibo(base), doc)
    expect(nombre).toBe('recibo-bar-manolo-mesa3-2026-08-05.html')
    expect(pulsado).toEqual(['click'])
  })
})

describe('lineasDeConsumo', () => {
  const mesa = {
    personas: [
      { id: 'p1', nombre: 'Ana', items: [
        { nombre: 'Mixto', cantidad: 2, precio: 2, pan: { nombreFormato: 'Pitufo', nombreTipo: 'Normal' } },
        { nombre: 'Paella', cantidad: 1, precio: 20, compartidoCon: ['p2'] },
      ] },
      { id: 'p2', nombre: 'Luis', items: [{ nombre: 'Caña', cantidad: 1, precio: 1.8, quitados: [], nota: 'muy fría' }] },
    ],
  }

  it('cobra a cada uno lo suyo', () => {
    const l = lineasDeConsumo(mesa, 'p2')
    expect(l.map(x => x.nombre)).toEqual(['Paella', 'Caña'])
  })

  it('reparte el plato compartido', () => {
    const paellaAna = lineasDeConsumo(mesa, 'p1').find(l => l.nombre === 'Paella')
    expect(paellaAna.importe).toBe(10)
    expect(paellaAna.compartido).toBe(true)
  })

  it('describe la línea como en el ticket', () => {
    expect(lineasDeConsumo(mesa, 'p1')[0].extra).toBe('Pitufo · Normal')
    expect(lineasDeConsumo(mesa, 'p2')[1].extra).toBe('“muy fría”')
  })

  it('en lo compartido de otro, dice de quién es', () => {
    expect(lineasDeConsumo(mesa, 'p2')[0].extra).toBe('de Ana')
  })

  it('una mesa vacía no da líneas', () => {
    expect(lineasDeConsumo({ personas: [] }, 'p1')).toEqual([])
    expect(lineasDeConsumo(undefined, 'p1')).toEqual([])
  })
})

describe('reciboReciente', () => {
  const almacenCon = (fecha) => {
    const datos = new Map([['tpv-recibo-mesa-3', JSON.stringify({ ...construirRecibo(base), fecha })]])
    return { getItem: k => datos.get(k) ?? null, setItem: () => {}, removeItem: () => {} }
  }
  const ahora = new Date('2026-08-05T20:00:00Z').getTime()

  it('el de este servicio sí', () => {
    const store = almacenCon('2026-08-05T18:30:00Z')
    expect(reciboReciente('mesa-3', { ahora, store })).not.toBeNull()
  })

  it('el de ayer no: quien escanea hoy viene a comer', () => {
    const store = almacenCon('2026-08-04T14:00:00Z')
    expect(reciboReciente('mesa-3', { ahora, store })).toBeNull()
  })

  it('sin recibo, nada', () => {
    const vacio = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    expect(reciboReciente('mesa-3', { ahora, store: vacio })).toBeNull()
  })
})

// El desglose fiscal tiene que cuadrar al céntimo: si «base + IVA» no suma
// exactamente el total impreso, el papel se contradice a sí mismo. Se consigue
// redondeando la base y sacando la cuota DE ESA base ya redondeada.
describe('base imponible e IVA cuadran siempre', () => {
  const tiposDeIva = [4, 10, 21]   // pan, hostelería, alcohol
  const dosDecimales = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9

  it('los dos importes vienen ya en céntimos exactos, y suman el total', () => {
    const fallos = []
    for (const ivaPct of tiposDeIva) {
      for (let cent = 1; cent <= 6000; cent++) {
        const total = cent / 100
        const r = construirRecibo({ local: { ivaPct }, mesa: {}, lineas: [{ importe: total }] })
        if (!dosDecimales(r.base) || !dosDecimales(r.iva)) fallos.push(`${total} € al ${ivaPct}%: base ${r.base}, iva ${r.iva}`)
        else if (Math.round((r.base + r.iva) * 100) !== cent) fallos.push(`${total} € al ${ivaPct}% no suma`)
      }
    }
    expect(fallos.slice(0, 5)).toEqual([])
  })

  it('lo que se imprime cuadra con el total', () => {
    const r = construirRecibo({ local: { ivaPct: 10 }, mesa: {}, lineas: [{ importe: 13.7 }] })
    expect(Number(r.base.toFixed(2)) + Number(r.iva.toFixed(2))).toBeCloseTo(13.7, 10)
  })
})
