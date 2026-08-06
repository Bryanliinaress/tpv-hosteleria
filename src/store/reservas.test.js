import { describe, it, expect } from 'vitest'
import { aforoTotal, aforoZona, ocupacionEn, slotDisponible, generarSlots, diaCerrado } from './useStore'

// ────────────────────────────────────────────────────────────────────────────
// Reservas: aquí un fallo se paga con gente de pie en la puerta un sábado.
// ────────────────────────────────────────────────────────────────────────────

const CONFIG = { duracionMin: 90, intervaloMin: 30, turnos: [{ id: 'c', nombre: 'Comidas', inicio: '13:00', fin: '15:00' }], diasCerrados: [1] }
// Sala pequeña: 12 plazas en terraza, 8 dentro → 20 en total
const MESAS = [
  { zona: 'Terraza', capacidad: 4 }, { zona: 'Terraza', capacidad: 4 }, { zona: 'Terraza', capacidad: 4 },
  { zona: 'Interior', capacidad: 4 }, { zona: 'Interior', capacidad: 4 },
]
const HOY = '2026-08-08'
const rv = (o) => ({ id: Math.random().toString(36), fecha: HOY, estado: 'confirmada', zona: '', ...o })

describe('aforo', () => {
  it('suma las plazas de la sala y de cada zona', () => {
    expect(aforoTotal(CONFIG, MESAS)).toBe(20)
    expect(aforoZona(CONFIG, MESAS, 'Terraza')).toBe(12)
    expect(aforoZona(CONFIG, MESAS, 'Interior')).toBe(8)
  })

  it('el aforo configurado a mano manda sobre las plazas', () => {
    expect(aforoTotal({ ...CONFIG, aforo: 15 }, MESAS)).toBe(15)
  })
})

describe('ocupación', () => {
  it('cuenta solo lo que solapa la franja', () => {
    const reservas = [rv({ hora: '13:00', personas: 4 }), rv({ hora: '16:00', personas: 6 })]
    expect(ocupacionEn(reservas, CONFIG, HOY, '13:30')).toBe(4)   // la de las 16:00 no solapa
  })

  it('no cuenta las canceladas', () => {
    const reservas = [rv({ hora: '13:00', personas: 4, estado: 'cancelada' })]
    expect(ocupacionEn(reservas, CONFIG, HOY, '13:00')).toBe(0)
  })
})

describe('disponibilidad', () => {
  it('no deja pasar del aforo total', () => {
    const reservas = [rv({ hora: '13:00', personas: 18 })]
    expect(slotDisponible(CONFIG, MESAS, reservas, HOY, '13:00', 2)).toBe(true)   // 18+2 = 20
    expect(slotDisponible(CONFIG, MESAS, reservas, HOY, '13:00', 3)).toBe(false)  // 18+3 = 21
  })

  it('respeta el aforo de la zona pedida', () => {
    const reservas = [rv({ hora: '13:00', personas: 10, zona: 'Terraza' })]
    expect(slotDisponible(CONFIG, MESAS, reservas, HOY, '13:00', 2, 'Terraza')).toBe(true)
    expect(slotDisponible(CONFIG, MESAS, reservas, HOY, '13:00', 4, 'Terraza')).toBe(false) // terraza son 12
  })

  it('las reservas SIN preferencia de zona también llenan el local', () => {
    // 18 personas ya reservadas sin preferencia: quedan 2 plazas en todo el bar,
    // así que no puede entrar una mesa de 4 «en terraza» aunque la terraza
    // parezca vacía — esas 18 personas se van a sentar en algún sitio.
    const reservas = [rv({ hora: '13:00', personas: 18, zona: '' })]
    expect(slotDisponible(CONFIG, MESAS, reservas, HOY, '13:00', 4, 'Terraza')).toBe(false)
  })

  it('una reserva de otra zona no bloquea la mía si cabe en el total', () => {
    const reservas = [rv({ hora: '13:00', personas: 6, zona: 'Interior' })]
    expect(slotDisponible(CONFIG, MESAS, reservas, HOY, '13:00', 4, 'Terraza')).toBe(true)
  })
})

describe('agenda', () => {
  it('genera los slots del turno cada intervalo', () => {
    expect(generarSlots(CONFIG).map(s => s.hora)).toEqual(['13:00', '13:30', '14:00', '14:30'])
  })

  it('sabe qué días cierra el local', () => {
    expect(diaCerrado(CONFIG, '2026-08-10')).toBe(true)   // lunes
    expect(diaCerrado(CONFIG, '2026-08-11')).toBe(false)  // martes
  })
})
