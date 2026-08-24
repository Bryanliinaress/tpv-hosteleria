import { describe, it, expect } from 'vitest'
import { huella, numeroDe, planificar, huerfanas, registrar } from './migraciones.mjs'

// ────────────────────────────────────────────────────────────────────────────
// El registro de migraciones. Existe para responder a una pregunta que hoy no
// se puede responder: ¿en qué esquema está el bar número 7?
// ────────────────────────────────────────────────────────────────────────────

describe('huella', () => {
  it('el mismo SQL da la misma huella', () => {
    expect(huella('select 1;')).toBe(huella('select 1;'))
  })

  it('CRLF y LF NO son un cambio: el repo se clona en Windows y en Linux', () => {
    expect(huella('a\r\nb\r\n')).toBe(huella('a\nb\n'))
  })

  it('cambiar una letra sí cambia la huella', () => {
    expect(huella('select 1;')).not.toBe(huella('select 2;'))
  })
})

describe('numeroDe', () => {
  it('saca el número del nombre', () => {
    expect(numeroDe('20260819T27_numero_ticket.sql')).toBe('27')
  })
  it('sin número, null (y no revienta)', () => {
    expect(numeroDe('suelta.sql')).toBeNull()
  })
})

describe('planificar', () => {
  const ficheros = [
    { fichero: 'T01_base.sql', sql: 'create table a();' },
    { fichero: 'T02_extra.sql', sql: 'create table b();' },
  ]

  it('en una base virgen, todas son nuevas', () => {
    expect(planificar(ficheros, []).map(p => p.estado)).toEqual(['nueva', 'nueva'])
  })

  it('lo ya aplicado con el mismo contenido no se vuelve a tocar', () => {
    const aplicadas = [{ fichero: 'T01_base.sql', huella: huella('create table a();') }]
    expect(planificar(ficheros, aplicadas).map(p => p.estado)).toEqual(['aplicada', 'nueva'])
  })

  it('una migración EDITADA después de aplicarse se marca como cambiada', () => {
    // Este es el caso peligroso: el bar tiene un esquema que ya no es el que
    // dice el repo, y sin la huella nadie se enteraría nunca.
    const aplicadas = [{ fichero: 'T01_base.sql', huella: huella('create table VIEJO();') }]
    expect(planificar(ficheros, aplicadas)[0].estado).toBe('cambiada')
  })
})

describe('huerfanas', () => {
  it('avisa de lo que está en la base y ya no está en el repo', () => {
    const aplicadas = [{ fichero: 'T99_borrada.sql', huella: 'x' }]
    expect(huerfanas([{ fichero: 'T01_base.sql', sql: '' }], aplicadas)).toEqual(['T99_borrada.sql'])
  })
})

describe('registrar', () => {
  it('escapa las comillas del nombre en lugar de inyectarlas', () => {
    const sql = registrar("raro'; drop table x; --.sql", 'abc')
    expect(sql).toContain("'raro''; drop table x; --.sql'")
    expect(sql).not.toMatch(/values \('raro'; drop/)
  })
})
