import { describe, it, expect } from 'vitest'
import { contarSala, resumenSala, estaOcupada, estaReservada, estaLibre } from './sala'

// ────────────────────────────────────────────────────────────────────────────
// Contar la sala. Una mesa RESERVADA no está ocupada: no hay nadie sentado.
// Contarlas juntas engañaba en las dos direcciones —el bar parecía más lleno de
// lo que estaba, y no se veía cuántas reservas había encima— y lo que se leía
// en pantalla era, literalmente, «ocupadas».
// ────────────────────────────────────────────────────────────────────────────

const m = (estado) => ({ estado })
const SALA = [m('libre'), m('ocupada'), m('esperando_cobro'), m('reservada'), m('libre')]

describe('en qué estado está una mesa', () => {
  it('con gente sentada: pidiendo o esperando a que le cobren', () => {
    expect(estaOcupada(m('ocupada'))).toBe(true)
    expect(estaOcupada(m('esperando_cobro'))).toBe(true)
  })

  it('una reservada no está ocupada: no hay nadie', () => {
    expect(estaOcupada(m('reservada'))).toBe(false)
    expect(estaReservada(m('reservada'))).toBe(true)
  })

  it('libre es libre, y nada más', () => {
    expect(estaLibre(m('libre'))).toBe(true)
    expect(estaLibre(m('reservada'))).toBe(false)
    expect(estaLibre(m('ocupada'))).toBe(false)
  })

  it('no revienta con una mesa a medias', () => {
    expect(estaOcupada(undefined)).toBe(false)
    expect(estaOcupada({})).toBe(false)
  })
})

describe('contarSala', () => {
  it('separa ocupadas, reservadas y libres', () => {
    expect(contarSala(SALA)).toEqual({ total: 5, ocupadas: 2, reservadas: 1, libres: 2 })
  })

  it('una sala vacía no se rompe', () => {
    expect(contarSala([])).toEqual({ total: 0, ocupadas: 0, reservadas: 0, libres: 0 })
    expect(contarSala()).toEqual({ total: 0, ocupadas: 0, reservadas: 0, libres: 0 })
  })

  // Se cuenta por estado y no por descarte a propósito: si aparece un estado
  // nuevo preferimos que la suma no cuadre —y se vea— a que se cuele en
  // «libres» y alguien siente ahí a un cliente.
  it('un estado desconocido NO se cuela como libre', () => {
    const c = contarSala([m('libre'), m('fuera_de_servicio')])
    expect(c.libres).toBe(1)
    expect(c.ocupadas + c.reservadas + c.libres).toBeLessThan(c.total)
  })
})

describe('resumenSala', () => {
  it('dice las ocupadas sobre el total', () => {
    expect(resumenSala([m('ocupada'), m('libre'), m('libre')])).toBe('1 ocupadas de 3')
  })

  it('las reservadas van aparte, no sumadas', () => {
    expect(resumenSala(SALA)).toBe('2 ocupadas de 5 · 1 reservada')
  })

  it('en plural cuando son varias', () => {
    expect(resumenSala([m('reservada'), m('reservada'), m('ocupada')]))
      .toBe('1 ocupadas de 3 · 2 reservadas')
  })

  it('sin reservas no se enseña un «0 reservadas» que es ruido', () => {
    expect(resumenSala([m('ocupada'), m('libre')])).toBe('1 ocupadas de 2')
  })

  it('la forma corta, para el encabezado de una zona', () => {
    expect(resumenSala(SALA, { conTotal: false })).toBe('2/5 ocupadas · 1 reservada')
  })
})
