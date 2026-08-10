import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, owedPorPersona, metodosDe, propinasPorMetodoDe, METODO_LABEL, METODO_EMOJI } from './useStore'
import { mergeLog } from '../lib/sync'
import { lineasDeConsumo } from '../lib/recibo'

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

describe('céntimos al repartir', () => {
  it('lo que suma el desglose es exactamente el total del ticket', () => {
    // 20 € entre tres: 6,666… cada uno. Redondeando por separado sale 20,01 y
    // el arqueo se va un céntimo en cada mesa compartida.
    const mesa = mesaDe(1)
    const a = st().unirseAMesa(mesa.id, 'Ana')
    const b = st().unirseAMesa(mesa.id, 'Luis')
    const c = st().unirseAMesa(mesa.id, 'Eva')
    st().agregarItem(mesa.id, a, { productoId: 'paella', nombre: 'Paella', precio: 20, tipo: 'comida' })
    const uid = mesaDe(1).personas.find(p => p.id === a).items[0].uid
    st().toggleCompartir(mesa.id, a, uid, b)
    st().toggleCompartir(mesa.id, a, uid, c)

    st().pagarParte(mesa.id, a, { metodo: 'efectivo' })
    st().pagarParte(mesa.id, b, { metodo: 'efectivo' })
    st().pagarParte(mesa.id, c, { metodo: 'tarjeta' })

    const t = st().historial.at(-1)
    const suma = Object.values(t.pagos).reduce((s, v) => s + v, 0)
    expect(Math.round(suma * 100)).toBe(Math.round(t.total * 100))
  })
})

describe('reparto exacto en más casos', () => {
  const reparteBien = (numero, precio, cuantos) => {
    const mesa = mesaDe(numero)
    const ids = []
    for (let i = 0; i < cuantos; i++) ids.push(st().unirseAMesa(mesa.id, `C${i}`))
    st().agregarItem(mesa.id, ids[0], { productoId: 'p', nombre: 'Plato', precio, tipo: 'comida' })
    const uid = mesaDe(numero).personas.find(p => p.id === ids[0]).items[0].uid
    ids.slice(1).forEach(id => st().toggleCompartir(mesa.id, ids[0], uid, id))
    const owed = owedPorPersona(mesaDe(numero))
    const suma = Object.values(owed).reduce((s, v) => s + v, 0)
    return { suma: Math.round(suma * 100), esperado: Math.round(precio * 100), partes: Object.values(owed) }
  }

  it('10 € entre 3', () => {
    const r = reparteBien(2, 10, 3)
    expect(r.suma).toBe(r.esperado)
  })

  it('0,01 € entre 2 (el caso imposible)', () => {
    const r = reparteBien(3, 0.01, 2)
    expect(r.suma).toBe(1)
    expect(r.partes.filter(v => v > 0)).toHaveLength(1)   // uno paga el céntimo
  })

  it('7,77 € entre 6', () => {
    const r = reparteBien(4, 7.77, 6)
    expect(r.suma).toBe(r.esperado)
  })

  it('ninguna parte sale negativa', () => {
    const r = reparteBien(5, 13.33, 7)
    expect(r.partes.every(v => v >= 0)).toBe(true)
  })
})

describe('descuentos e invitaciones', () => {
  it('una invitación deja el ticket a 0 y no mete dinero en caja', () => {
    const { mesaId, ana } = mesaConUno(6)
    st().agregarItem(mesaId, ana, { productoId: 'x', nombre: 'Ronda', precio: 12, tipo: 'bebida' })
    st().cobrarMesa(mesaId, { descuento: 12, metodo: 'efectivo' })
    const t = st().historial.at(-1)
    expect(t.total).toBe(0)
    expect(t.descuento).toBe(12)
    expect(Object.values(t.pagos).reduce((s, v) => s + v, 0)).toBe(0)
  })

  it('un descuento mayor que la cuenta no genera dinero negativo', () => {
    const { mesaId, ana } = mesaConUno(7)
    st().agregarItem(mesaId, ana, { productoId: 'x', nombre: 'Café', precio: 2, tipo: 'bebida' })
    st().cobrarMesa(mesaId, { descuento: 50, metodo: 'efectivo' })
    const t = st().historial.at(-1)
    expect(t.total).toBeGreaterThanOrEqual(0)
    expect(Object.values(t.pagos).every(v => v >= 0)).toBe(true)
  })

  it('el desglose de un pago mixto suma lo cobrado', () => {
    const { mesaId, ana } = mesaConUno(8)
    st().agregarItem(mesaId, ana, { productoId: 'x', nombre: 'Cena', precio: 47.5, tipo: 'comida' })
    st().cobrarMesa(mesaId, { desglose: { efectivo: 20, tarjeta: 27.5 } })
    const t = st().historial.at(-1)
    expect(t.pagos.efectivo).toBe(20)
    expect(t.pagos.tarjeta).toBe(27.5)
    expect(Object.values(t.pagos).reduce((s, v) => s + v, 0)).toBe(47.5)
  })
})

describe('pagar toda la cuenta (uno invita al resto)', () => {
  it('cierra la mesa y registra una sola propina', () => {
    const mesa = mesaDe(9)
    const a = st().unirseAMesa(mesa.id, 'Ana')
    const b = st().unirseAMesa(mesa.id, 'Luis')
    st().agregarItem(mesa.id, a, { productoId: 'x', nombre: 'Menú', precio: 12, tipo: 'comida' })
    st().agregarItem(mesa.id, b, { productoId: 'y', nombre: 'Menú', precio: 12, tipo: 'comida' })
    st().pagarTodo(mesa.id, { propina: 3, metodo: 'tarjeta', cobradoPor: 'Cliente' })

    const t = st().historial.at(-1)
    expect(t.total).toBe(24)
    expect(t.propina).toBe(3)
    expect(t.pagos.tarjeta).toBe(24)
    expect(mesaDe(9).estado).toBe('libre')
  })

  it('respeta a quien ya había pagado su parte con otro método', () => {
    const mesa = mesaDe(10)
    const a = st().unirseAMesa(mesa.id, 'Ana')
    const b = st().unirseAMesa(mesa.id, 'Luis')
    st().agregarItem(mesa.id, a, { productoId: 'x', nombre: 'Menú', precio: 10, tipo: 'comida' })
    st().agregarItem(mesa.id, b, { productoId: 'y', nombre: 'Menú', precio: 10, tipo: 'comida' })
    st().pagarParte(mesa.id, a, { metodo: 'efectivo' })
    st().pagarTodo(mesa.id, { metodo: 'tarjeta' })

    const t = st().historial.at(-1)
    expect(t.pagos.efectivo).toBe(10)
    expect(t.pagos.tarjeta).toBe(10)
  })
})

describe('descuentos con decimales sucios', () => {
  it('un 5% sobre 13,70 € deja el ticket cuadrado al céntimo', () => {
    const { mesaId, ana } = mesaConUno(11)
    st().agregarItem(mesaId, ana, { productoId: 'x', nombre: 'Comida', precio: 13.7, tipo: 'comida' })
    // 5% de 13,70 = 0,685 € → ni el descuento ni el total pueden quedar en medio céntimo
    st().cobrarMesa(mesaId, { descuento: 13.7 * 0.05, metodo: 'efectivo' })

    const t = st().historial.at(-1)
    const suma = Object.values(t.pagos).reduce((s, v) => s + v, 0)
    expect(Math.round(t.total * 100)).toBe(Math.round(suma * 100))
    expect(t.total).toBe(Math.round(t.total * 100) / 100)      // sin colas decimales
    expect(t.descuento).toBe(Math.round(t.descuento * 100) / 100)
  })

  it('el pago mixto con decimales también cuadra', () => {
    const { mesaId, ana } = mesaConUno(12)
    st().agregarItem(mesaId, ana, { productoId: 'x', nombre: 'Cena', precio: 33.33, tipo: 'comida' })
    st().cobrarMesa(mesaId, { desglose: { efectivo: 11.11, tarjeta: 22.22 } })
    const t = st().historial.at(-1)
    const suma = Object.values(t.pagos).reduce((s, v) => s + v, 0)
    expect(Math.round(suma * 100)).toBe(Math.round(t.total * 100))
  })
})

// El desglose por método de la caja llevaba la lista escrita a mano
// (efectivo/tarjeta/bizum/sincobrar). Un cobro por QR se guarda como `online`,
// así que ese dinero NO aparecía en el desglose: el dueño veía un reparto que
// no sumaba lo cobrado. Y con un método nuevo pasaría lo mismo.
describe('desglose por método de pago', () => {
  it('no se deja fuera ningún método cobrado', () => {
    expect(metodosDe({ efectivo: 10, online: 12.5 })).toEqual(['efectivo', 'online'])
  })

  it('mantiene un orden estable y conocido', () => {
    expect(metodosDe({ sincobrar: 3, bizum: 2, efectivo: 1 })).toEqual(['efectivo', 'bizum', 'sincobrar'])
  })

  it('un método futuro que nadie previó también sale', () => {
    expect(metodosDe({ efectivo: 5, cripto: 1 })).toEqual(['efectivo', 'cripto'])
  })

  it('los importes a cero no ensucian el desglose', () => {
    expect(metodosDe({ efectivo: 0, tarjeta: 4 })).toEqual(['tarjeta'])
    expect(metodosDe()).toEqual([])
  })

  it('el pago online sabe pintarse (antes salía «undefined»)', () => {
    expect(METODO_LABEL.online).toBe('Pago online')
    expect(METODO_EMOJI.online).toBeTruthy()
  })
})

// El arqueo tiene que esperar en el cajón las propinas dejadas EN METÁLICO.
// En la demo el ticket las trae ya agrupadas; en el backend real la tabla solo
// guarda el TOTAL de propina, así que hay que derivarlas del detalle de
// comensales. Sin esto, el arqueo de la app real cantaba un sobrante falso
// cada día que alguien dejara propina en efectivo.
describe('propinas por método (arqueo)', () => {
  it('las usa tal cual si el ticket ya las trae agrupadas (demo)', () => {
    expect(propinasPorMetodoDe({ propinas: { efectivo: 2, tarjeta: 1 } })).toEqual({ efectivo: 2, tarjeta: 1 })
  })

  it('las deriva del detalle de comensales (backend real)', () => {
    const ticket = {
      personas: [
        { nombre: 'Ana', propina: 2, metodoPago: 'efectivo' },
        { nombre: 'Luis', propina: 1.5, metodoPago: 'tarjeta' },
        { nombre: 'Sole', propina: 0.5, metodoPago: 'efectivo' },
      ],
    }
    expect(propinasPorMetodoDe(ticket)).toEqual({ efectivo: 2.5, tarjeta: 1.5 })
  })

  it('sin método apuntado, la propina se cuenta como efectivo (es lo que hay en el cajón)', () => {
    expect(propinasPorMetodoDe({ personas: [{ propina: 3 }] })).toEqual({ efectivo: 3 })
  })

  it('un ticket sin propinas no inventa métodos', () => {
    expect(propinasPorMetodoDe({ personas: [{ propina: 0, metodoPago: 'tarjeta' }] })).toEqual({})
    expect(propinasPorMetodoDe({})).toEqual({})
    expect(propinasPorMetodoDe(null)).toEqual({})
  })

  it('el cierre de caja espera esas propinas en el cajón', () => {
    useStore.setState({ cierres: [], historial: [{
      id: 't1', cerradaEn: new Date().toISOString(), total: 20, propina: 3, pagos: { efectivo: 20 },
      personas: [{ nombre: 'Ana', propina: 3, metodoPago: 'efectivo' }],
    }] })
    useStore.getState().cerrarCaja(23)          // 20 de venta + 3 de propina
    const z = useStore.getState().cierres.at(-1)
    expect(z.efectivoEsperado).toBe(23)
    expect(z.descuadre).toBe(0)                 // antes cantaba +3 de sobrante
  })
})

// El ticket impreso de UNA persona tiene que decir lo mismo que se le cobra.
// Con un plato compartido, sumar sus líneas propias carga el plato entero a
// quien lo pidió: el papel decía 15 € y la caja cobraba 12,50.
describe('el papel cuadra con el cobro', () => {
  const mesaCompartida = () => ({
    id: 'm1', numero: 1,
    personas: [
      { id: 'ana', nombre: 'Ana', items: [{ uid: 'i1', nombre: 'Bravas', precio: 5, cantidad: 1, compartidoCon: ['luis'] }, { uid: 'i2', nombre: 'Caña', precio: 2.5, cantidad: 2 }] },
      { id: 'luis', nombre: 'Luis', items: [{ uid: 'i3', nombre: 'Tortilla', precio: 6, cantidad: 1 }] },
    ],
  })

  it('lo que debe Ana no incluye las bravas enteras', () => {
    const deben = owedPorPersona(mesaCompartida())
    expect(deben.ana).toBe(7.5)      // 2,50 de su mitad de bravas + 5 de cañas
    expect(deben.luis).toBe(8.5)     // 6 de tortilla + 2,50 de su mitad
  })

  it('las partes suman exactamente el total de la mesa', () => {
    const mesa = mesaCompartida()
    const deben = owedPorPersona(mesa)
    const total = mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
    expect(Math.round(Object.values(deben).reduce((s, v) => s + v, 0) * 100)).toBe(Math.round(total * 100))
  })

  it('las líneas del recibo de Ana llevan su parte, no el plato entero', () => {
    const lineas = lineasDeConsumo(mesaCompartida(), 'ana')
    const bravas = lineas.find(l => l.nombre === 'Bravas')
    expect(bravas.importe).toBe(2.5)
    expect(bravas.compartido).toBe(true)
    // y el total de sus líneas coincide con lo que se le cobra
    expect(lineas.reduce((s, l) => s + l.importe, 0)).toBe(owedPorPersona(mesaCompartida()).ana)
  })
})
