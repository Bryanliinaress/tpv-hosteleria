import { describe, it, expect } from 'vitest'
import { contarSala, resumenSala, estaOcupada, estaReservada, estaLibre, zonasDe, revisarNumeroMesa, revisarNombreZona, agruparPorZona, revisarAltaMesas, SIN_ZONA } from './sala'

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

// ────────────────────────────────────────────────────────────────────────────
// Numerar la sala y nombrar las zonas.
//
// El número de mesa sale en el ticket, en la comanda de cocina y en el QR de
// la pegatina: dos mesas con el mismo número es un plato en la mesa
// equivocada. Y la zona era texto libre por mesa: una errata en una de doce
// creaba una zona fantasma que la reserva online le ofrecía al cliente.
// ────────────────────────────────────────────────────────────────────────────
const PLANO = [
  { id: 'm1', numero: 1, zona: 'Terraza', capacidad: 4 },
  { id: 'm2', numero: 2, zona: 'Terraza', capacidad: 2 },
  { id: 'm3', numero: 3, zona: 'Interior', capacidad: 6 },
]

describe('renumerar una mesa', () => {
  it('un número libre se acepta', () => {
    expect(revisarNumeroMesa(PLANO, 'm1', 7)).toEqual({ ok: true, numero: 7 })
  })

  it('un número que ya tiene otra mesa, no', () => {
    const r = revisarNumeroMesa(PLANO, 'm1', 3)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/ya existe/)
  })

  it('la mesa puede quedarse con el suyo (guardar sin cambiar nada)', () => {
    expect(revisarNumeroMesa(PLANO, 'm1', 1).ok).toBe(true)
  })

  it('ni cero, ni negativos, ni con decimales, ni vacío', () => {
    for (const v of [0, -3, 2.5, '', '  ', 'dos', null]) {
      expect(revisarNumeroMesa(PLANO, 'm1', v).ok).toBe(false)
    }
  })

  it('el número llega como texto desde el input y vale igual', () => {
    expect(revisarNumeroMesa(PLANO, 'm1', ' 9 ')).toEqual({ ok: true, numero: 9 })
  })
})

describe('zonas de la sala', () => {
  it('salen las que hay, con sus mesas, en orden', () => {
    expect(zonasDe(PLANO)).toEqual([
      { nombre: 'Interior', mesas: 1 },
      { nombre: 'Terraza', mesas: 2 },
    ])
  })

  it('una mesa sin zona no inventa una zona vacía', () => {
    expect(zonasDe([{ id: 'x', zona: '' }, { id: 'y', zona: '   ' }, { id: 'z' }])).toEqual([])
  })

  it('renombrar a un nombre nuevo vale', () => {
    expect(revisarNombreZona(PLANO, 'Terraza', ' Terraza de arriba ')).toEqual({ ok: true, nombre: 'Terraza de arriba' })
  })

  // Fundir dos zonas por descuido cambiaría de sitio mesas que nadie ha tocado.
  it('renombrar a una zona que ya existe, no', () => {
    const r = revisarNombreZona(PLANO, 'Terraza', 'interior')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Ya hay una zona/)
  })

  it('dejarle el mismo nombre no es un choque consigo misma', () => {
    expect(revisarNombreZona(PLANO, 'Terraza', 'Terraza').ok).toBe(true)
  })

  it('una zona sin nombre no se guarda', () => {
    expect(revisarNombreZona(PLANO, 'Terraza', '   ').ok).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Montar la sala. «+ Añadir mesa» creaba UNA, de cuatro plazas, en «la zona de
// la última mesa de la lista» — que es la que sea. Un bar de doce mesas eran
// doce clics y luego doce ediciones.
// ────────────────────────────────────────────────────────────────────────────
const SALON = [
  { id: 'm1', numero: 1, zona: 'Terraza', capacidad: 4 },
  { id: 'm2', numero: 2, zona: 'Terraza', capacidad: 2 },
  { id: 'm3', numero: 5, zona: 'Interior', capacidad: 6 },
  { id: 'm4', numero: 6, zona: '', capacidad: 2 },
]

describe('la sala agrupada por zonas', () => {
  // Alfabéticamente «Terraza» iría detrás de «Interior» aunque la terraza sean
  // las mesas 1 y 2, y eso no es la sala que ve el encargado.
  it('las zonas salen por su mesa más baja, no por orden alfabético', () => {
    expect(agruparPorZona(SALON).map(g => g.zona)).toEqual(['Terraza', 'Interior', SIN_ZONA])
  })

  it('cada zona sabe sus mesas y sus plazas, que es su aforo', () => {
    const terraza = agruparPorZona(SALON)[0]
    expect(terraza.mesas.map(m => m.numero)).toEqual([1, 2])
    expect(terraza.plazas).toBe(6)
  })

  // Si se escondieran, una mesa sin zona no aparecería en ninguna sección y no
  // habría forma de ponérsela.
  it('las mesas sin zona van juntas al final, no se pierden', () => {
    const ultimo = agruparPorZona(SALON).at(-1)
    expect(ultimo.sinZona).toBe(true)
    expect(ultimo.mesas.map(m => m.numero)).toEqual([6])
  })

  it('una sala vacía no inventa zonas', () => {
    expect(agruparPorZona([])).toEqual([])
  })
})

describe('alta de mesas', () => {
  it('sin número, siguen a la última', () => {
    expect(revisarAltaMesas(SALON, { cuantas: 3, capacidad: 4 }).numeros).toEqual([7, 8, 9])
  })

  it('con número de inicio, van seguidas desde ahí', () => {
    expect(revisarAltaMesas(SALON, { numero: 20, cuantas: 2, capacidad: 4 }).numeros).toEqual([20, 21])
  })

  // Crear cuatro y fallar en la quinta deja la sala a medias y al encargado sin
  // saber cuáles entraron: se comprueban todas antes de crear ninguna.
  it('si alguna del tramo ya existe, no se crea NINGUNA', () => {
    const r = revisarAltaMesas(SALON, { numero: 4, cuantas: 3, capacidad: 4 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/La mesa 5 ya existe/)
  })

  it('ni cero mesas, ni cincuenta y una', () => {
    expect(revisarAltaMesas(SALON, { cuantas: 0 }).ok).toBe(false)
    expect(revisarAltaMesas(SALON, { cuantas: 51 }).ok).toBe(false)
    expect(revisarAltaMesas(SALON, { cuantas: 50 }).ok).toBe(true)
  })

  it('la capacidad tiene que ser un entero mayor que cero', () => {
    for (const cap of [0, -2, 2.5, 'dos', '']) {
      expect(revisarAltaMesas(SALON, { cuantas: 1, capacidad: cap }).ok).toBe(false)
    }
  })

  it('los números llegan como texto desde el formulario y valen igual', () => {
    const r = revisarAltaMesas(SALON, { numero: ' 30 ', cuantas: '2', capacidad: ' 4 ' })
    expect(r).toEqual({ ok: true, numeros: [30, 31], capacidad: 4 })
  })
})
