// ────────────────────────────────────────────────────────────────────────────
// Lo que no está en la carta.
//
// En un bar se cobran cosas que no tienen ficha: la sugerencia del día que se
// escribió en la pizarra esta mañana, el descorche de una botella que trajo el
// cliente, una tarta de cumpleaños, el suplemento de una terraza. Sin esto, o
// se cobra «a mano» por fuera del TPV —dinero que no sale en ningún ticket ni
// en ningún arqueo— o se da de alta un producto de la carta que el cliente del
// QR va a ver esta noche.
//
// ⚠️ Aquí el precio lo pone UNA PERSONA, no el catálogo. Es lo contrario de lo
// que hace el cliente del QR, donde el precio lo resuelve siempre el servidor
// (`qr_agregar_linea`) precisamente para que nadie pueda ponerle precio a lo
// que pide. Por eso esto vive detrás del PIN, en una RPC que **no** se le
// concede a `anon`, y por eso las reglas están escritas aquí una sola vez: las
// comprueba la pantalla para poder avisar mientras se teclea, y las vuelve a
// comprobar el servidor, que es quien manda.
// ────────────────────────────────────────────────────────────────────────────

import { importeDesdeTexto } from './dinero.js'

/** Un nombre más largo no cabe en el papel de 58 mm ni en el KDS. */
export const MAX_NOMBRE = 60

/**
 * Techo del precio. No es una regla fiscal: es una red contra el dedo gordo.
 * «Sidra 350» en vez de «3,50» son 350 € en la cuenta de alguien, y a esa
 * altura ya se ha impreso la comanda.
 */
export const MAX_PRECIO = 999.99

/** Tantas unidades como acepta el cliente del QR: la regla es la misma. */
export const MAX_CANTIDAD = 50

/** A dónde va la comanda. Sin esto no se sabe si lo hace la cocina o la barra. */
export const TIPOS = ['comida', 'bebida']

const mal = (error) => ({ ok: false, error })

// En español se escribe «999,99 €». Un aviso que sale con punto le está
// enseñando a quien lo lee justo lo que NO tiene que teclear.
const euros = (n) => `${n.toFixed(2).replace('.', ',')} €`

/**
 * Revisa un plato fuera de carta tecleado en el mostrador.
 *
 * Devuelve `{ ok:true, valor }` con los datos ya limpios y en número, o
 * `{ ok:false, error }` con un texto que se le puede enseñar tal cual a quien
 * está detrás de la barra con la comanda en la mano.
 *
 * El precio pasa por `importeDesdeTexto` a propósito: en España se teclea
 * «3,50», y `Number('3,50')` es NaN — que acaba en 0 y en una ronda regalada.
 */
export function revisarPlatoLibre({ nombre, precio, cantidad = 1, tipo = 'comida' } = {}) {
  const n = String(nombre ?? '').trim().replace(/\s+/g, ' ')
  if (!n) return mal('Ponle nombre: es lo que va a ver el cliente en su ticket')
  if (n.length > MAX_NOMBRE) return mal(`El nombre no puede pasar de ${MAX_NOMBRE} caracteres`)

  const p = importeDesdeTexto(precio)
  if (p === null) return mal('Falta el precio')
  if (p < 0) return mal('El precio no puede ser negativo')
  if (p > MAX_PRECIO) return mal(`¿Seguro que son ${euros(p)}? El máximo es ${euros(MAX_PRECIO)}`)

  // A cero SÍ se puede: la invitación de la casa es una línea de 0 € que tiene
  // que salir en la comanda —alguien la prepara— y en el ticket, para que se
  // vea que se invitó y no que se olvidó cobrarla.

  const c = Number(cantidad)
  if (!Number.isInteger(c) || c < 1) return mal('La cantidad tiene que ser 1 o más')
  if (c > MAX_CANTIDAD) return mal(`Como mucho ${MAX_CANTIDAD} unidades de golpe`)

  if (!TIPOS.includes(tipo)) return mal('Di si lo hace la cocina o la barra')

  return { ok: true, valor: { nombre: n, precio: p, cantidad: c, tipo } }
}
