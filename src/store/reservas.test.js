import { describe, it, expect, beforeEach } from 'vitest'
import { aforoTotal, aforoZona, ocupacionEn, slotDisponible, generarSlots, diaCerrado, mesasCandidatas } from './useStore'

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

// ── Ciclo de vida de una reserva, contra el store real ──────────────────────
import { useStore } from './useStore'

const st = () => useStore.getState()
const manana = () => {
  const d = new Date(Date.now() + 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('crear reserva', () => {
  beforeEach(() => {
    useStore.setState(s => ({
      reservas: [],
      mesas: s.mesas.map(m => ({ ...m, estado: 'libre', personas: [], reserva: null })),
      reservasConfig: { ...s.reservasConfig, diasCerrados: [] },
    }))
  })

  it('una reserva normal entra y queda confirmada', () => {
    const id = st().crearReserva({ fecha: manana(), hora: '13:00', personas: 4, nombre: 'Ana' })
    expect(id).toBeTruthy()
    expect(st().reservas.at(-1).estado).toBe('confirmada')
    expect(st().reservas.at(-1).token).toBeTruthy()
  })

  it('NO entra si el hueco ya está lleno (dos clientes a la vez)', () => {
    const cfg = st().reservasConfig
    const aforo = aforoTotal(cfg, st().mesas)
    // el primero se lleva casi todo el aforo
    expect(st().crearReserva({ fecha: manana(), hora: '13:00', personas: aforo - 1, nombre: 'Grupo' })).toBeTruthy()
    // el segundo ya no cabe, aunque su pantalla le ofreciera el hueco
    expect(st().crearReserva({ fecha: manana(), hora: '13:00', personas: 4, nombre: 'Tarde' })).toBeNull()
    expect(st().reservas).toHaveLength(1)
  })

  it('NO entra un día que el local cierra', () => {
    const f = manana()
    const dia = new Date(f + 'T12:00:00').getDay()
    useStore.setState(s => ({ reservasConfig: { ...s.reservasConfig, diasCerrados: [dia] } }))
    expect(st().crearReserva({ fecha: f, hora: '13:00', personas: 2, nombre: 'Ana' })).toBeNull()
  })

  it('sin hora no se crea a medias', () => {
    expect(st().crearReserva({ fecha: manana(), personas: 2, nombre: 'Ana' })).toBeNull()
  })

  it('cada reserva tiene su localizador', () => {
    const a = st().crearReserva({ fecha: manana(), hora: '13:00', personas: 2, nombre: 'A' })
    const b = st().crearReserva({ fecha: manana(), hora: '13:30', personas: 2, nombre: 'B' })
    const tokens = st().reservas.map(r => r.token)
    expect(a).not.toBe(b)
    expect(new Set(tokens).size).toBe(2)
  })
})

describe('editar y cancelar', () => {
  beforeEach(() => {
    useStore.setState(s => ({
      reservas: [],
      mesas: s.mesas.map(m => ({ ...m, estado: 'libre', personas: [], reserva: null })),
      reservasConfig: { ...s.reservasConfig, diasCerrados: [] },
    }))
  })

  it('ampliar la reserva se comprueba contra el aforo', () => {
    const cfg = st().reservasConfig
    const aforo = aforoTotal(cfg, st().mesas)
    const id = st().crearReserva({ fecha: manana(), hora: '13:00', personas: 2, nombre: 'Ana' })
    // pasar de 2 a más del aforo no puede colar
    expect(st().actualizarReserva(id, { personas: aforo + 5 })).toBeNull()
    expect(st().reservas.find(r => r.id === id).personas).toBe(2)
  })

  it('ampliar dentro del aforo sí se guarda', () => {
    const id = st().crearReserva({ fecha: manana(), hora: '13:00', personas: 2, nombre: 'Ana' })
    expect(st().actualizarReserva(id, { personas: 4 })).toBe(id)
    expect(st().reservas.find(r => r.id === id).personas).toBe(4)
  })

  it('al editar NO se cuenta a sí misma como ocupación', () => {
    const cfg = st().reservasConfig
    const aforo = aforoTotal(cfg, st().mesas)
    const id = st().crearReserva({ fecha: manana(), hora: '13:00', personas: aforo, nombre: 'Lleno' })
    // cambiar la hora de la reserva que ocupa TODO debe poder hacerse
    expect(st().actualizarReserva(id, { hora: '13:30' })).toBe(id)
  })

  it('cancelar libera el hueco', () => {
    const cfg = st().reservasConfig
    const aforo = aforoTotal(cfg, st().mesas)
    const id = st().crearReserva({ fecha: manana(), hora: '13:00', personas: aforo, nombre: 'Lleno' })
    expect(st().crearReserva({ fecha: manana(), hora: '13:00', personas: 2, nombre: 'Otro' })).toBeNull()
    st().cambiarEstadoReserva(id, 'cancelada')
    expect(st().crearReserva({ fecha: manana(), hora: '13:00', personas: 2, nombre: 'Otro' })).toBeTruthy()
  })
})

describe('sugerir mesa para una reserva', () => {
  const SALA = [
    { id: 'm1', numero: 1, capacidad: 2, zona: 'Terraza', estado: 'libre' },
    { id: 'm2', numero: 2, capacidad: 6, zona: 'Interior', estado: 'libre' },
    { id: 'm3', numero: 3, capacidad: 8, zona: 'Terraza', estado: 'libre' },
    { id: 'm4', numero: 4, capacidad: 6, zona: 'Terraza', estado: 'ocupada' },
  ]

  it('una mesa donde CABEN va antes que una de su zona donde no caben', () => {
    // 6 personas que piden terraza: la de 2 de terraza no vale, por bonita que sea
    const orden = mesasCandidatas(SALA, { personas: 6, zona: 'Terraza' }).map(m => m.numero)
    expect(orden[0]).toBe(3)          // terraza y caben
    expect(orden.indexOf(2)).toBeLessThan(orden.indexOf(1))  // interior de 6 antes que terraza de 2
  })

  it('entre las que caben, primero la de su zona', () => {
    const orden = mesasCandidatas(SALA, { personas: 2, zona: 'Interior' }).map(m => m.numero)
    expect(orden[0]).toBe(2)          // interior, aunque sobre sitio
  })

  it('entre las que caben en la zona, la más justa', () => {
    const sala = [
      { id: 'a', numero: 1, capacidad: 8, zona: 'Terraza', estado: 'libre' },
      { id: 'b', numero: 2, capacidad: 4, zona: 'Terraza', estado: 'libre' },
    ]
    expect(mesasCandidatas(sala, { personas: 3, zona: 'Terraza' })[0].numero).toBe(2)
  })

  it('no ofrece mesas ocupadas, pero sí la ya asignada', () => {
    expect(mesasCandidatas(SALA, { personas: 4 }).map(m => m.id)).not.toContain('m4')
    expect(mesasCandidatas(SALA, { personas: 4, mesaId: 'm4' }).map(m => m.id)).toContain('m4')
  })

  it('sin preferencia de zona, no penaliza a nadie por zona', () => {
    const orden = mesasCandidatas(SALA, { personas: 6, zona: '' }).map(m => m.numero)
    expect(orden[0]).toBe(2)          // la de 6, la más justa
  })

  it('aguanta una sala vacía', () => {
    expect(mesasCandidatas([], { personas: 2 })).toEqual([])
    expect(mesasCandidatas(undefined, { personas: 2 })).toEqual([])
  })
})
