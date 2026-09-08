// ────────────────────────────────────────────────────────────────────────────
// Cómo se cuenta una sala.
//
// «Ocupada» significa que hay gente sentada. Una mesa RESERVADA no lo está:
// está comprometida para más tarde y ahora mismo se puede limpiar, montar o
// darle el aperitivo a nadie. Contarlas juntas engañaba en las dos direcciones
// —parecía que el bar estaba más lleno de lo que estaba, y no se veía cuántas
// reservas hay encima— y la palabra que se leía en pantalla era «ocupadas».
//
// Se cuenta AQUÍ y no en cada pantalla porque el Mostrador y la PDA enseñan el
// mismo número con las mismas palabras: escrito dos veces, una de las dos
// acaba diciendo otra cosa.
// ────────────────────────────────────────────────────────────────────────────

// Hay gente sentada: pidiendo, comiendo o esperando a que le cobren.
export const ESTADOS_OCUPADA = ['ocupada', 'esperando_cobro']

export const estaOcupada = (m) => ESTADOS_OCUPADA.includes(m?.estado)
export const estaReservada = (m) => m?.estado === 'reservada'
export const estaLibre = (m) => m?.estado === 'libre'

/**
 * Reparto de una sala (o de una zona) en los tres grupos que se enseñan.
 *
 * Los tres se cuentan por su estado, no por descarte: si algún día aparece un
 * estado nuevo, preferimos que no cuadre la suma —y se vea— a que se cuele
 * silenciosamente en «libres» y alguien siente ahí a un cliente.
 */
export function contarSala(mesas = []) {
  const lista = mesas || []
  return {
    total: lista.length,
    ocupadas: lista.filter(estaOcupada).length,
    reservadas: lista.filter(estaReservada).length,
    libres: lista.filter(estaLibre).length,
  }
}

/**
 * «2 ocupadas de 12 · 1 reservada» — el segundo trozo solo si lo hay, que si
 * no es ruido en una pantalla que se lee de un vistazo.
 */
export function resumenSala(mesas = [], { conTotal = true } = {}) {
  const { total, ocupadas, reservadas } = contarSala(mesas)
  const base = conTotal ? `${ocupadas} ocupadas de ${total}` : `${ocupadas}/${total} ocupadas`
  return reservadas > 0
    ? `${base} · ${reservadas} ${reservadas === 1 ? 'reservada' : 'reservadas'}`
    : base
}

// ────────────────────────────────────────────────────────────────────────────
// Numerar la sala y ponerle nombre a las zonas.
//
// El número de la mesa no es un adorno: sale en el ticket, en la comanda que
// imprime la cocina y en el QR de la pegatina. Dos mesas con el mismo número
// significan un plato en la mesa equivocada, así que renumerar tiene que poder
// hacerse —un bar cambia la sala de sitio— pero comprobándolo.
//
// La zona era texto libre en cada mesa: escribir «Terazza» en una de doce crea
// una zona fantasma con una sola mesa, y como la reserva online ofrece elegir
// zona, el cliente puede acabar reservando en ella. Por eso se elige de la
// lista, y renombrarla las cambia todas de una vez.
// ────────────────────────────────────────────────────────────────────────────

/** Las zonas que existen, con cuántas mesas tiene cada una. */
export function zonasDe(mesas = []) {
  const cuenta = new Map()
  for (const m of (mesas || [])) {
    const z = (m?.zona || '').trim()
    if (z) cuenta.set(z, (cuenta.get(z) || 0) + 1)
  }
  return [...cuenta.entries()]
    .map(([nombre, mesas]) => ({ nombre, mesas }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Comprueba un número de mesa nuevo. Devuelve { ok, numero } o { ok, error }. */
export function revisarNumeroMesa(mesas = [], id, numero) {
  const n = Number(String(numero ?? '').trim())
  if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'El número de mesa es un entero mayor que cero' }
  const otra = (mesas || []).find(m => m.id !== id && Number(m.numero) === n)
  if (otra) return { ok: false, error: `La mesa ${n} ya existe: dos mesas con el mismo número mandan platos a la mesa equivocada` }
  return { ok: true, numero: n }
}

/** Comprueba el nombre nuevo de una zona. Devuelve { ok, nombre } o { ok, error }. */
export function revisarNombreZona(mesas = [], anterior, nueva) {
  const n = String(nueva ?? '').trim()
  if (!n) return { ok: false, error: 'La zona necesita un nombre' }
  if (n === anterior) return { ok: true, nombre: n }
  const existe = zonasDe(mesas).some(z => z.nombre.toLowerCase() === n.toLowerCase())
  if (existe) return { ok: false, error: `Ya hay una zona «${n}»` }
  return { ok: true, nombre: n }
}
