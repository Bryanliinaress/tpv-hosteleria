import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, owedPorPersona } from './useStore'
import { mergeLog } from '../lib/sync'

// ────────────────────────────────────────────────────────────────────────────
// Pruebas del dinero: lo que acaba en el arqueo y en los informes.
// Un error aquí no se ve en pantalla — se ve al cuadrar la caja por la noche.
// ────────────────────────────────────────────────────────────────────────────

const st = () => useStore.getState()
const mesaDe = (n) => st().mesas.find(m => m.numero === n)

beforeEach(() => {
  // sala limpia: liberamos todas las mesas y vaciamos historial y cierres
  useStore.setState(s => ({
    mesas: s.mesas.map(m => ({ ...m, estado: 'libre', personas: [], camarero: null, unidaA: null, unidas: [] })),
    historial: [], cierres: [], pedidosCocina: [], pedidosBarra: [], avisos: [],
  }))
})

// Abre una mesa con un solo comensal (así al pagarle, la mesa cierra y se
// genera el ticket, que es lo que mira el arqueo)
function mesaConUno(numero) {
  const mesa = mesaDe(numero)
  return { mesaId: mesa.id, ana: st().unirseAMesa(mesa.id, 'Ana') }
}

// Abre una mesa con dos comensales y devuelve sus ids
function mesaConDos(numero) {
  const mesa = mesaDe(numero)
  const ana = st().unirseAMesa(mesa.id, 'Ana')
  const luis = st().unirseAMesa(mesa.id, 'Luis')
  return { mesaId: mesa.id, ana, luis }
}

describe('platos compartidos y métodos de pago', () => {
  it('reparte el importe entre quienes comparten', () => {
    const { mesaId, ana, luis } = mesaConDos(5)
    st().agregarItem(mesaId, ana, { productoId: 'paella', nombre: 'Paella', precio: 20, tipo: 'comida' })
    const uid = mesaDe(5).personas.find(p => p.id === ana).items[0].uid
    st().toggleCompartir(mesaId, ana, uid, luis)

    const owed = owedPorPersona(mesaDe(5))
    expect(owed[ana]).toBe(10)
    expect(owed[luis]).toBe(10)
  })

  it('el ticket reparte el cobro por método como se cobró de verdad', () => {
    const { mesaId, ana, luis } = mesaConDos(6)
    // Una paella de 20 € que se parten los dos: 10 € cada uno
    st().agregarItem(mesaId, ana, { productoId: 'paella', nombre: 'Paella', precio: 20, tipo: 'comida' })
    const uid = mesaDe(6).personas.find(p => p.id === ana).items[0].uid
    st().toggleCompartir(mesaId, ana, uid, luis)

    st().pagarParte(mesaId, ana, { metodo: 'tarjeta' })
    st().pagarParte(mesaId, luis, { metodo: 'efectivo' })

    const ticket = st().historial.at(-1)
    expect(ticket.total).toBe(20)
    // Ana pagó 10 con tarjeta y Luis 10 en efectivo: el cajón lleva 10 €
    expect(ticket.pagos.efectivo).toBe(10)
    expect(ticket.pagos.tarjeta).toBe(10)
  })

  it('quien solo consume compartido también aparece en el desglose', () => {
    const { mesaId, ana, luis } = mesaConDos(7)
    st().agregarItem(mesaId, ana, { productoId: 'vino', nombre: 'Botella de vino', precio: 12, tipo: 'bebida' })
    const uid = mesaDe(7).personas.find(p => p.id === ana).items[0].uid
    st().toggleCompartir(mesaId, ana, uid, luis)

    st().pagarParte(mesaId, luis, { metodo: 'bizum' })
    st().pagarParte(mesaId, ana, { metodo: 'efectivo' })

    const ticket = st().historial.at(-1)
    expect(ticket.pagos.bizum).toBe(6)     // Luis no tiene líneas propias, pero pagó 6
    expect(ticket.pagos.efectivo).toBe(6)
  })
})

describe('arqueo de caja', () => {
  it('el efectivo esperado incluye las propinas cobradas en efectivo', () => {
    const { mesaId, ana } = mesaConUno(2)
    st().agregarItem(mesaId, ana, { productoId: 'cafe', nombre: 'Café', precio: 10, tipo: 'bebida' })
    st().pagarParte(mesaId, ana, { metodo: 'efectivo', propina: 2 })

    // En el cajón hay 12 €: 10 de la consumición y 2 de propina
    st().cerrarCaja(12)
    const cierre = st().cierres.at(-1)
    expect(cierre.descuadre).toBe(0)
  })

  it('una propina en tarjeta no se espera en el cajón', () => {
    const { mesaId, ana } = mesaConUno(3)
    st().agregarItem(mesaId, ana, { productoId: 'cafe', nombre: 'Café', precio: 10, tipo: 'bebida' })
    st().pagarParte(mesaId, ana, { metodo: 'tarjeta', propina: 2 })

    st().cerrarCaja(0)
    expect(st().cierres.at(-1).descuadre).toBe(0)
  })

  it('detecta el descuadre real', () => {
    const { mesaId, ana } = mesaConUno(4)
    st().agregarItem(mesaId, ana, { productoId: 'cafe', nombre: 'Café', precio: 10, tipo: 'bebida' })
    st().pagarParte(mesaId, ana, { metodo: 'efectivo' })

    st().cerrarCaja(7)                     // faltan 3 €
    expect(st().cierres.at(-1).descuadre).toBe(-3)
  })
})

describe('identificadores', () => {
  it('dos comensales que entran a la vez NO comparten id', () => {
    const mesa = mesaDe(8)
    const ids = new Set()
    for (let i = 0; i < 50; i++) ids.add(st().unirseAMesa(mesa.id, `C${i}`))
    expect(ids.size).toBe(50)
  })

  it('lo que pide uno no se le carga al otro', () => {
    const { mesaId, ana, luis } = mesaConDos(9)
    st().agregarItem(mesaId, ana, { productoId: 'cafe', nombre: 'Café', precio: 1.3, tipo: 'bebida' })
    const mesa = mesaDe(9)
    expect(mesa.personas.find(p => p.id === ana).items).toHaveLength(1)
    expect(mesa.personas.find(p => p.id === luis).items).toHaveLength(0)
  })
})

describe('no perder registros al sincronizar', () => {
  it('un ticket recién cobrado sobrevive al estado que llega de otro dispositivo', () => {
    const { mesaId, ana } = mesaConUno(10)
    st().agregarItem(mesaId, ana, { productoId: 'cafe', nombre: 'Café', precio: 1.3, tipo: 'bebida' })
    st().pagarParte(mesaId, ana, { metodo: 'efectivo' })
    const ticket = st().historial.at(-1)

    // El otro dispositivo aún no lo tiene: la fusión debe conservarlo.
    expect(mergeLog([ticket], []).map(t => t.id)).toEqual([ticket.id])
  })

  it('un fichaje recién abierto tampoco se pierde', () => {
    const emp = st().empleados[0]
    st().ficharEmpleado(emp.id)
    const fichaje = st().fichajes.at(-1)
    expect(mergeLog([fichaje], [])).toHaveLength(1)
  })
})

describe('pago online', () => {
  it('el cobro por Stripe NO cuenta como efectivo en el cajón', () => {
    const { mesaId, ana } = mesaConUno(11)
    st().agregarItem(mesaId, ana, { productoId: 'menu', nombre: 'Menú', precio: 14, tipo: 'comida' })
    // así lo registra la vuelta de Stripe
    st().pagarParte(mesaId, ana, { propina: 1, metodo: 'tarjeta', cobradoPor: 'Cliente' })

    const t = st().historial.at(-1)
    expect(t.pagos.tarjeta).toBe(14)
    expect(t.pagos.efectivo).toBeUndefined()
    expect(t.propinas.tarjeta).toBe(1)

    st().cerrarCaja(0)                       // cajón vacío: es correcto
    expect(st().cierres.at(-1).descuadre).toBe(0)
  })

  it('pasar solo un número deja el pago en efectivo (compatibilidad antigua)', () => {
    const { mesaId, ana } = mesaConUno(12)
    st().agregarItem(mesaId, ana, { productoId: 'cafe', nombre: 'Café', precio: 2, tipo: 'bebida' })
    st().pagarParte(mesaId, ana, 0.5)
    expect(st().historial.at(-1).pagos.efectivo).toBe(2)
  })
})
