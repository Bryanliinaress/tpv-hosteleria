import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: null }))

const { rangoDelMes } = await import('./estado')

// ────────────────────────────────────────────────────────────────────────────
// Qué mes de fichajes se baja.
//
// El registro de jornada se conserva CUATRO años (RD-ley 8/2019), así que
// bajarlo entero para enseñar un mes es insostenible. Se pide el mes que se
// está mirando — con un día de margen a cada lado, y ese margen no es un
// capricho: un turno que entra a la 01:00 del día 1 se guarda como las 23:00
// del último día del mes anterior en UTC. Sin margen, ese fichaje desaparece
// del mes al que pertenece, y es la nómina de alguien.
// ────────────────────────────────────────────────────────────────────────────
describe('rango del mes de fichajes', () => {
  it('empieza ANTES del día 1, para no perder el turno de madrugada', () => {
    const { desde } = rangoDelMes('2026-08')
    expect(new Date(desde).getTime()).toBeLessThan(Date.UTC(2026, 7, 1))
  })

  it('termina DESPUÉS del último día, por lo mismo', () => {
    const { hasta } = rangoDelMes('2026-08')
    expect(new Date(hasta).getTime()).toBeGreaterThan(Date.UTC(2026, 8, 1))
  })

  it('cubre el mes entero', () => {
    const { desde, hasta } = rangoDelMes('2026-08')
    expect(new Date(desde).getTime()).toBeLessThanOrEqual(Date.UTC(2026, 7, 1))
    expect(new Date(hasta).getTime()).toBeGreaterThanOrEqual(Date.UTC(2026, 7, 31, 23, 59))
  })

  it('cruza bien el cambio de año', () => {
    const { desde } = rangoDelMes('2026-01')
    expect(new Date(desde).getUTCFullYear()).toBe(2025)
    expect(new Date(desde).getUTCMonth()).toBe(11) // diciembre
  })

  it('febrero bisiesto no se corta', () => {
    const { hasta } = rangoDelMes('2024-02')
    expect(new Date(hasta).getTime()).toBeGreaterThan(Date.UTC(2024, 1, 29, 23, 59))
  })

  it('un mes ilegible devuelve null y NO un rango a medias', () => {
    // Devolver un rango raro sería peor: enseñaría fichajes de otro mes como si
    // fueran de este. Sin rango, se cargan todos y al menos no engaña.
    expect(rangoDelMes('')).toBeNull()
    expect(rangoDelMes('agosto')).toBeNull()
    expect(rangoDelMes(undefined)).toBeNull()
  })
})
