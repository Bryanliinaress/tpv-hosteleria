import { describe, it, expect } from 'vitest'
import { useStore, recientes, compactarTicket } from './useStore'

// ────────────────────────────────────────────────────────────────────────────
// Cuánto ocupa el estado que se guarda en el navegador. localStorage tiene un
// límite duro (~5 MB por origen) y, al pasarse, dejar de guardar es SILENCIOSO:
// se sigue trabajando y al recargar falta el día entero.
// ────────────────────────────────────────────────────────────────────────────

const st = () => useStore.getState()
const DIA = 86400000

// Ticket medio de bar: 3 comensales, 6 líneas personalizadas. Se construye a
// mano (sin pasar por el store) para que la prueba sea rápida.
const ticketFalso = (i, fecha) => ({
  id: `t${i}`,
  _ts: fecha,
  mesaNumero: (i % 12) + 1,
  cerradaEn: new Date(fecha).toISOString(),
  total: 34.5, propina: 2, pagos: { efectivo: 20, tarjeta: 14.5 }, propinas: { efectivo: 2 },
  camarero: 'María', cobradoPor: 'María',
  personas: ['Ana', 'Luis', 'Eva'].map((nombre, p) => ({
    id: `p${i}-${p}`, nombre, pagado: true, metodoPago: 'efectivo', propina: 0,
    items: Array.from({ length: 2 }, (_, k) => ({
      uid: `it${i}-${p}-${k}`, productoId: 'prod-x', nombre: 'Catalana con queso manchego',
      precio: 2.8, cantidad: 1, tipo: 'comida', estado: 'enviado',
      pan: { formato: 'pitufo', tipo: 'normal', nombreFormato: 'Pitufo', nombreTipo: 'Normal' },
      anadidos: ['Queso'], quitados: [], nota: 'sin sal',
    })),
  })),
})

// Lo que de verdad se escribe: el estado con las ventanas de `partialize`.
const kbGuardados = (historial) => {
  const s = st()
  const persistido = {
    local: s.local, empleados: s.empleados, carta: s.carta, mesas: s.mesas,
    pedidosCocina: [], pedidosBarra: [], avisos: [],
    historial: recientes(historial, 'cerradaEn', 45, 8000)
      .map(t => (Date.now() - new Date(t.cerradaEn).getTime() > 7 * 86400000 ? compactarTicket(t) : t)),
    cierres: [], anulaciones: [], fichajes: [], reservas: [], reservasConfig: s.reservasConfig,
  }
  return JSON.stringify(persistido).length / 1024
}

const servicio = (tickets, dias) => Array.from({ length: tickets }, (_, i) =>
  ticketFalso(i, Date.now() - (dias - Math.floor(i / (tickets / dias))) * DIA))

describe('peso de lo que se guarda en el navegador', () => {
  it('un mes de servicio cabe de sobra', () => {
    const kb = kbGuardados(servicio(1800, 30))
    console.log(`   1.800 tickets (1 mes):  ${Math.round(kb)} KB`)
    expect(kb).toBeLessThan(5 * 1024)
  })

  it('un año de servicio ya NO revienta el navegador', () => {
    // Sin poda esto ocupaba 13,5 MB y el guardado fallaba en silencio.
    const kb = kbGuardados(servicio(21000, 365))
    console.log(`   21.000 tickets (1 año): ${Math.round(kb)} KB`)
    expect(kb).toBeLessThan(5 * 1024)
  })

  it('deja colchón para el resto (cola offline, recibos, sesión…)', () => {
    // El límite es del ORIGEN entero, no solo de esta clave.
    expect(kbGuardados(servicio(21000, 365))).toBeLessThan(3 * 1024)
  })

  it('el mes completo se conserva para los informes', () => {
    const historial = servicio(1800, 30)
    const guardado = recientes(historial, 'cerradaEn', 45, 8000)
    expect(guardado).toHaveLength(1800)      // no se pierde ningún ticket del mes
  })

  it('los tickets de esta semana conservan TODO el detalle', () => {
    const hoy = servicio(10, 1)
    const guardado = recientes(hoy, 'cerradaEn', 45, 8000)
      .map(t => (Date.now() - new Date(t.cerradaEn).getTime() > 7 * 86400000 ? compactarTicket(t) : t))
    expect(guardado[0].personas[0].items[0].pan).toBeTruthy()
    expect(guardado[0].compacto).toBeUndefined()
  })

  it('los viejos se adelgazan pero mantienen lo que miran los informes', () => {
    const t = compactarTicket(servicio(1, 1)[0])
    expect(t.compacto).toBe(true)
    expect(t.total).toBe(34.5)
    expect(t.pagos.efectivo).toBe(20)
    const item = t.personas[0].items[0]
    expect(item.nombre).toBeTruthy()
    expect(item.cantidad).toBe(1)
    expect(item.precio).toBe(2.8)
    expect(item.pan).toBeUndefined()        // el detalle del servicio, fuera
  })
})

describe('recientes', () => {
  const hace = (dias) => new Date(Date.now() - dias * DIA).toISOString()

  it('se queda con lo de la ventana y tira lo viejo', () => {
    const arr = [{ f: hace(100) }, { f: hace(10) }, { f: hace(1) }]
    expect(recientes(arr, 'f', 60, 999)).toHaveLength(2)
  })

  it('respeta el techo de registros aunque quepan por fecha', () => {
    const arr = Array.from({ length: 50 }, (_, i) => ({ f: hace(1), i }))
    const r = recientes(arr, 'f', 60, 10)
    expect(r).toHaveLength(10)
    expect(r.at(-1).i).toBe(49)          // conserva los ÚLTIMOS, no los primeros
  })

  it('un registro sin fecha válida se conserva (mejor de más que perderlo)', () => {
    const arr = [{ f: 'vete a saber' }, { f: hace(1) }]
    expect(recientes(arr, 'f', 60, 999)).toHaveLength(2)
  })

  it('aguanta listas vacías o inexistentes', () => {
    expect(recientes([], 'f', 60, 10)).toEqual([])
    expect(recientes(undefined, 'f', 60, 10)).toEqual([])
  })

  it('los fichajes (nómina) se guardan mucho más tiempo', () => {
    const fichajes = [{ entrada: hace(300) }, { entrada: hace(400) }, { entrada: hace(600) }]
    expect(recientes(fichajes, 'entrada', 550, 5000)).toHaveLength(2)
  })
})
