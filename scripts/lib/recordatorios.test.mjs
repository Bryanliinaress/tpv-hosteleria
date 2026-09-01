import { describe, it, expect, vi } from 'vitest'
import { cuandoEs, paraRecordar, pasadaRecordatorios } from './recordatorios.mjs'

// ────────────────────────────────────────────────────────────────────────────
// El recordatorio existía pero había que pulsarlo reserva por reserva, así que
// no se mandaba. Y la nota de privacidad que firma el cliente promete
// «(confirmación, cambios y recordatorio)»: prometerle un correo que no llega
// es decirle algo que no es verdad.
// ────────────────────────────────────────────────────────────────────────────

const AHORA = new Date(2026, 8, 1, 12, 0)          // 1/9/2026 a las 12:00
const r = (extra = {}) => ({
  id: 'r1', nombre: 'Ana', email: 'ana@ejemplo.com', personas: 2,
  fecha: '2026-09-01', hora: '15:00', estado: 'confirmada',
  recordatorio_en: null, creada_en: new Date(2026, 7, 30, 10, 0).toISOString(),
  ...extra,
})

describe('cuándo es una reserva', () => {
  it('se calcula en la hora del bar, no en UTC', () => {
    expect(cuandoEs({ fecha: '2026-09-01', hora: '15:00' })).toEqual(new Date(2026, 8, 1, 15, 0))
  })

  it('con datos a medias no inventa una fecha', () => {
    expect(cuandoEs({})).toBeNull()
    expect(cuandoEs({ fecha: '2026-09-01' })).toBeNull()
  })
})

describe('a quién toca recordar', () => {
  const filtra = (extra, opts) => paraRecordar([r(extra)], { ahora: AHORA, horas: 4, ...opts })

  it('sí: faltan 3 horas y está confirmada', () => {
    expect(filtra()).toHaveLength(1)
  })

  it('no, si todavía es pronto', () => {
    expect(filtra({ hora: '22:00' })).toHaveLength(0)
  })

  it('no, si ya pasó: recordar una cena de ayer es peor que no recordar', () => {
    expect(filtra({ hora: '10:00' })).toHaveLength(0)
  })

  it('no, si ya se le mandó: el vigilante pasa cada pocos minutos', () => {
    expect(filtra({ recordatorio_en: new Date().toISOString() })).toHaveLength(0)
  })

  it('no, si está cancelada', () => {
    expect(filtra({ estado: 'cancelada' })).toHaveLength(0)
  })

  it('no, si ya está sentada en la mesa', () => {
    expect(filtra({ estado: 'sentada' })).toHaveLength(0)
  })

  it('no, si no dejó email: no hay dónde mandarlo', () => {
    expect(filtra({ email: null })).toHaveLength(0)
  })

  // Reservar a la una para las tres y recibir a la una y media un «te
  // recordamos tu próxima reserva» es recordarle lo que acaba de hacer.
  it('no, si reservó YA DENTRO de la ventana', () => {
    expect(filtra({ creada_en: new Date(2026, 8, 1, 11, 30).toISOString() })).toHaveLength(0)
  })

  it('sí, si reservó bastante antes', () => {
    expect(filtra({ creada_en: new Date(2026, 8, 1, 7, 0).toISOString() })).toHaveLength(1)
  })

  it('la ventana se puede ajustar', () => {
    expect(filtra({ hora: '20:00' })).toHaveLength(0)
    expect(filtra({ hora: '20:00' }, { horas: 12 })).toHaveLength(1)
  })

  it('no se atraganta con una lista vacía o con basura', () => {
    expect(paraRecordar([], { ahora: AHORA })).toHaveLength(0)
    expect(paraRecordar([null, {}], { ahora: AHORA })).toHaveLength(0)
    expect(paraRecordar(undefined, { ahora: AHORA })).toHaveLength(0)
  })
})

describe('una pasada de recordatorios', () => {
  const deps = (reservas) => ({
    listar: vi.fn(async () => reservas),
    enviar: vi.fn(async () => {}),
    marcar: vi.fn(async () => {}),
    ahora: AHORA, horas: 4,
  })

  it('manda y deja marcado, para no repetir', async () => {
    const d = deps([r()])
    expect(await pasadaRecordatorios(d)).toEqual({ enviados: 1, fallidos: 0 })
    expect(d.enviar).toHaveBeenCalled()
    expect(d.marcar).toHaveBeenCalled()
  })

  // Marcar un correo que no salió es perderlo para siempre.
  it('si el envío falla NO lo marca: se reintenta en la siguiente pasada', async () => {
    const d = deps([r()])
    d.enviar = vi.fn(async () => { throw new Error('EmailJS 400') })
    expect(await pasadaRecordatorios(d)).toEqual({ enviados: 0, fallidos: 1 })
    expect(d.marcar).not.toHaveBeenCalled()
  })

  it('que falle uno no impide mandar el siguiente', async () => {
    const d = deps([r({ id: 'a' }), r({ id: 'b' })])
    d.enviar = vi.fn(async (x) => { if (x.id === 'a') throw new Error('falló') })
    expect(await pasadaRecordatorios(d)).toEqual({ enviados: 1, fallidos: 1 })
  })

  it('sin nadie a quien recordar, no molesta', async () => {
    const d = deps([r({ hora: '23:00' })])
    expect(await pasadaRecordatorios(d)).toEqual({ enviados: 0, fallidos: 0 })
    expect(d.enviar).not.toHaveBeenCalled()
  })
})
