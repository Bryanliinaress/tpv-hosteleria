import { describe, it, expect } from 'vitest'
import { validarNif, normalizarNif, revisarDatosFactura, porQueNoSeFactura, faltaParaFacturar, numeroDeFactura, correoDeFactura, lineasParaFactura, desgloseParaFactura, enlaceFactura } from './factura.js'

describe('validarNif', () => {
  it('acepta un DNI con su letra y lo deja limpio', () => {
    expect(validarNif('12345678z')).toEqual({ ok: true, nif: '12345678Z', tipo: 'DNI' })
    expect(validarNif('12.345.678-Z').nif).toBe('12345678Z')
  })

  it('rechaza un DNI con la letra cambiada: la AEAT lo rechazaría después', () => {
    expect(validarNif('12345678A').ok).toBe(false)
  })

  it('acepta NIE (X, Y, Z) con su letra', () => {
    expect(validarNif('X1234567L')).toMatchObject({ ok: true, tipo: 'NIE' })
    expect(validarNif('Y1234567X')).toMatchObject({ ok: true, tipo: 'NIE' })
    expect(validarNif('X1234567A').ok).toBe(false)
  })

  it('acepta CIF con dígito o letra de control según la sociedad', () => {
    expect(validarNif('B12345674')).toMatchObject({ ok: true, tipo: 'CIF' })   // S.L.: dígito
    expect(validarNif('A58818501')).toMatchObject({ ok: true, tipo: 'CIF' })
    expect(validarNif('Q2826000H')).toMatchObject({ ok: true, tipo: 'CIF' })   // organismo: letra
  })

  it('rechaza un CIF con el control mal', () => {
    expect(validarNif('B12345670').ok).toBe(false)
    expect(validarNif('Q2826000A').ok).toBe(false)
  })

  it('rechaza lo que no tiene forma de NIF', () => {
    expect(validarNif('').ok).toBe(false)
    expect(validarNif('hola').ok).toBe(false)
    expect(validarNif('1234567Z').ok).toBe(false)
  })
})

describe('normalizarNif', () => {
  it('quita espacios, puntos y guiones', () => {
    expect(normalizarNif(' b-12.345 674 ')).toBe('B12345674')
  })
})

describe('revisarDatosFactura', () => {
  const buenos = { nombre: '  Talleres  Pérez S.L. ', nif: 'b12345674', direccion: 'C/ Mayor 3, 28001 Madrid', email: '' }

  it('limpia y devuelve los datos listos', () => {
    expect(revisarDatosFactura(buenos)).toEqual({
      ok: true, valor: { nombre: 'Talleres Pérez S.L.', nif: 'B12345674', direccion: 'C/ Mayor 3, 28001 Madrid', email: null },
    })
  })

  it('el domicilio es obligatorio en una factura completa', () => {
    const r = revisarDatosFactura({ ...buenos, direccion: ' ' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/domicilio/)
  })

  it('sin nombre no hay factura', () => {
    expect(revisarDatosFactura({ ...buenos, nombre: '' }).ok).toBe(false)
  })

  it('el NIF se valida con su control', () => {
    expect(revisarDatosFactura({ ...buenos, nif: 'B12345670' }).ok).toBe(false)
  })

  it('el correo es opcional, pero si se pone tiene que valer', () => {
    expect(revisarDatosFactura({ ...buenos, email: 'admin@talleres.es' }).valor.email).toBe('admin@talleres.es')
    expect(revisarDatosFactura({ ...buenos, email: 'admin@' }).ok).toBe(false)
  })
})

describe('porQueNoSeFactura', () => {
  const t = { id: 't1', numero: 40, total: 23.5 }

  it('un ticket normal se puede facturar', () => {
    expect(porQueNoSeFactura(t)).toBeNull()
  })

  it('no dos veces: dice cuál tiene ya', () => {
    expect(porQueNoSeFactura(t, { facturas: [{ ticketId: 't1', serie: 'F', numero: 7 }] })).toMatch(/F-7/)
  })

  it('una devolución no se factura', () => {
    expect(porQueNoSeFactura({ ...t, rectificaA: 'x', total: -3 })).toMatch(/devolución/)
  })

  it('un ticket con devoluciones tampoco: la AEAT pide F1, no F3', () => {
    expect(porQueNoSeFactura(t, { historial: [{ id: 'r1', rectificaA: 't1', total: -5 }] })).toMatch(/devoluciones/)
  })

  it('a cero no', () => {
    expect(porQueNoSeFactura({ ...t, total: 0 })).not.toBeNull()
  })
})

describe('faltaParaFacturar', () => {
  it('pide CIF y dirección fiscal del local', () => {
    expect(faltaParaFacturar({})).toEqual(['el CIF', 'la dirección fiscal'])
    expect(faltaParaFacturar({ cif: 'B12345674', direccion: 'C/ Sol 1' })).toEqual([])
  })
})

describe('correoDeFactura', () => {
  const f = {
    serie: 'F', numero: 12, total: 23.5,
    emisor: { razonSocial: 'Bar Loli S.L.', cif: 'B12345674' },
    cliente: { nombre: 'Talleres Pérez' },
    lineas: [{ nombre: 'Menú del día', cantidad: 2, importe: 23.5 }],
    desglose: [{ ivaPct: 10, base: 21.36, cuota: 2.14 }],
  }

  it('asunto con número y quién la emite', () => {
    expect(correoDeFactura(f).asunto).toBe('Factura F-12 de Bar Loli S.L.')
  })

  it('lleva líneas, desglose, total con coma y el enlace', () => {
    const { mensaje } = correoDeFactura(f, { enlace: 'https://x/#/factura?t=abc' })
    expect(mensaje).toContain('2× Menú del día — 23,50 €')
    expect(mensaje).toContain('IVA 10 % 2,14 €')
    expect(mensaje).toContain('TOTAL 23,50 €')
    expect(mensaje).toContain('https://x/#/factura?t=abc')
  })

  it('numeroDeFactura sin número no inventa uno', () => {
    expect(numeroDeFactura({ serie: 'F' })).toBe('sin número')
  })
})

describe('lineasParaFactura', () => {
  const personas = [
    { nombre: 'Ana', items: [{ nombre: 'Menú del día', precio: 12, cantidad: 1 }, { nombre: 'Café', precio: 1.3, cantidad: 1 }] },
    { nombre: 'Luis', items: [{ nombre: 'Menú del día', precio: 12, cantidad: 1 }, { nombre: 'Vino botella', precio: 18, cantidad: 1, ivaPct: 21 }] },
  ]

  it('agrupa lo igual de varios comensales en una sola línea', () => {
    const l = lineasParaFactura(personas, 10)
    expect(l).toHaveLength(3)
    expect(l[0]).toEqual({ nombre: 'Menú del día', precio: 12, ivaPct: 10, cantidad: 2, importe: 24 })
  })

  it('mismo nombre a distinto precio NO se junta: se comería uno', () => {
    const l = lineasParaFactura([{ items: [{ nombre: 'Tarta', precio: 4, cantidad: 1 }, { nombre: 'Tarta', precio: 5, cantidad: 1 }] }])
    expect(l).toHaveLength(2)
  })

  it('el desglose separa los tipos y cuadra con el total', () => {
    const d = desgloseParaFactura(lineasParaFactura(personas, 10))
    expect(d.map(x => x.ivaPct)).toEqual([10, 21])
    const diez = d[0]
    expect(diez.total).toBe(25.3)
    expect(Math.round((diez.base + diez.cuota) * 100) / 100).toBe(25.3)
  })
})

describe('enlaceFactura', () => {
  it('lleva a la ruta pública con el token', () => {
    expect(enlaceFactura({ token: 'abc123' }, 'https://bar.es', '/')).toBe('https://bar.es/#/factura?t=abc123')
  })
})
