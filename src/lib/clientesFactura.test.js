import { describe, it, expect } from 'vitest'
import { buscarClientes, clientePorNif, guardarCliente } from './clientesFactura.js'

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
