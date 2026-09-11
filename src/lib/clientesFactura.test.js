import { describe, it, expect } from 'vitest'
import { buscarClientes, clientePorNif, guardarCliente, resumenCliente, clientesSinGuardar, csvFacturasCliente } from './clientesFactura.js'

const lista = [
  { id: 1, nombre: 'Talleres Pérez S.L.', nif: 'B12345674', direccion: 'C/ Mayor 3', usadoEn: '2026-09-01T10:00:00Z' },
  { id: 2, nombre: 'Construcciones Ávila', nif: 'A58818501', direccion: 'Av. Sol 1', usadoEn: '2026-09-10T10:00:00Z' },
  { id: 3, nombre: 'María López', nif: '12345678Z', direccion: 'C/ Luna 5', usadoEn: '2026-08-01T10:00:00Z' },
]

describe('buscarClientes', () => {
  it('sin texto, los últimos usados primero', () => {
    expect(buscarClientes(lista).map(c => c.id)).toEqual([2, 1, 3])
  })

  it('por nombre, sin mirar tildes ni mayúsculas', () => {
    expect(buscarClientes(lista, 'perez').map(c => c.id)).toEqual([1])
    expect(buscarClientes(lista, 'AVILA').map(c => c.id)).toEqual([2])
  })

  it('por un trozo de NIF, escrito como sea', () => {
    expect(buscarClientes(lista, 'b-123').map(c => c.id)).toEqual([1])
  })

  it('el NIF que empieza por lo tecleado va antes que un nombre que lo contiene', () => {
    const l = [...lista, { id: 4, nombre: 'Bar 1234', nif: 'B87654321', usadoEn: '2026-09-11T00:00:00Z' }]
    expect(buscarClientes(l, '1234')[0].id).toBe(3)
  })

  it('sin coincidencias, lista vacía', () => {
    expect(buscarClientes(lista, 'zzz')).toEqual([])
  })

  it('respeta el máximo', () => {
    expect(buscarClientes(lista, '', 2)).toHaveLength(2)
  })
})

describe('clientePorNif', () => {
  it('encuentra al cliente aunque el NIF venga con puntos y minúsculas', () => {
    expect(clientePorNif(lista, 'b-12.345.674')?.id).toBe(1)
    expect(clientePorNif(lista, '')).toBeNull()
  })
})

describe('guardarCliente', () => {
  it('uno nuevo entra con su primera factura', () => {
    const l = guardarCliente([], { nombre: 'Ana', nif: '12345678z', direccion: 'C/ A 1', email: '' }, { id: 'x', ahora: 'T' })
    expect(l).toEqual([{ id: 'x', nombre: 'Ana', nif: '12345678Z', direccion: 'C/ A 1', email: null, facturas: 1, usadoEn: 'T' }])
  })

  it('el mismo NIF no duplica: pone al día domicilio y cuenta la factura', () => {
    const l = guardarCliente([{ ...lista[0], email: 'a@b.es', facturas: 3 }], { nombre: 'Talleres Pérez S.L.', nif: 'B12345674', direccion: 'C/ Nueva 9', email: '' }, { ahora: 'T' })
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ direccion: 'C/ Nueva 9', email: 'a@b.es', facturas: 4, usadoEn: 'T' })
  })
})

describe('resumenCliente', () => {
  const facturas = [
    { id: 'f1', serie: 'F', numero: 1, total: 20, expedidaEn: '2026-09-01T10:00:00Z', fiscalEstado: 'enviado', cliente: { nif: 'B12345674' } },
    { id: 'f2', serie: 'F', numero: 5, total: 12.5, expedidaEn: '2026-09-10T10:00:00Z', fiscalEstado: 'enviado', cliente: { nif: 'b-12345674' } },
    { id: 'f3', serie: 'F', numero: 7, total: 99, expedidaEn: '2026-09-11T10:00:00Z', fiscalEstado: 'error', cliente: { nif: 'B12345674' } },
    { id: 'f4', serie: 'F', numero: 2, total: 50, expedidaEn: '2026-09-02T10:00:00Z', fiscalEstado: 'enviado', cliente: { nif: 'A58818501' } },
  ]

  it('sus facturas, por NIF escrito como sea, la última primero', () => {
    const r = resumenCliente({ nif: 'B12345674' }, facturas)
    expect(r.facturas.map(f => f.id)).toEqual(['f3', 'f2', 'f1'])
    expect(r.numero).toBe(3)
    expect(r.ultima).toBe('2026-09-11T10:00:00Z')
  })

  it('el total no suma las rechazadas por Hacienda, pero las cuenta aparte', () => {
    const r = resumenCliente({ nif: 'B12345674' }, facturas)
    expect(r.total).toBe(32.5)
    expect(r.rechazadas).toBe(1)
  })

  it('sin facturas, todo a cero', () => {
    expect(resumenCliente({ nif: '12345678Z' }, facturas)).toEqual({ facturas: [], numero: 0, total: 0, ultima: null, rechazadas: 0 })
  })
})

describe('clientesSinGuardar', () => {
  it('los que tienen facturas y no están guardados, con los datos de su última factura', () => {
    const facturas = [
      { expedidaEn: '2026-09-01', cliente: { nombre: 'Viejo', nif: 'A58818501', direccion: 'C/ Vieja' } },
      { expedidaEn: '2026-09-09', cliente: { nombre: 'Nuevo S.A.', nif: 'a-58818501', direccion: 'C/ Nueva', email: 'x@y.es' } },
      { expedidaEn: '2026-09-05', cliente: { nombre: 'Guardado', nif: 'B12345674', direccion: 'C/ A' } },
    ]
    expect(clientesSinGuardar([{ nif: 'B12345674' }], facturas)).toEqual([
      { nombre: 'Nuevo S.A.', nif: 'A58818501', direccion: 'C/ Nueva', email: 'x@y.es', ultima: '2026-09-09' },
    ])
  })
})

describe('csvFacturasCliente', () => {
  it('con ; y coma decimal, como lo abre Excel en español', () => {
    const csv = csvFacturasCliente({ nombre: 'Talleres "El Pino"; S.L.', nif: 'B12345674' }, [
      { serie: 'F', numero: 3, expedidaEn: '2026-09-11T10:00:00', total: 27.2, fiscalEstado: 'enviado',
        desglose: [{ base: 20.91, cuota: 2.09 }, { base: 3.47, cuota: 0.73 }] },
    ])
    const [cabecera, fila] = csv.split('\n')
    expect(cabecera).toBe('"Factura";"Fecha";"Cliente";"NIF";"Base imponible";"IVA";"Total";"Estado en Hacienda"')
    expect(fila).toBe('"F-3";"11/09/2026";"Talleres ""El Pino""; S.L.";"B12345674";"24,38";"2,82";"27,20";"Registrada"')
  })
})
