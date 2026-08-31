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
