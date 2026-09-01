import { useEffect, useRef, useState } from 'react'
import { avisar, hayNuevos, claveDe } from '../lib/aviso'

const LLAVE = 'tpv-aviso-sonido'

/**
 * Avisa —con sonido y con un destello en pantalla— cuando entra algo nuevo.
 *
 * Lo usan la PDA y los dos KDS. El destello va aparte del sonido a propósito:
 * el navegador puede bloquear el audio hasta que alguien toque la pantalla, y
 * en una cocina la tablet lleva horas sin que nadie la roce. Si el sonido no
 * suena, al menos la pantalla cambia.
 *
 * `sonido` se recuerda por aparato: la tablet de la cocina puede tenerlo puesto
 * y la de la barra no, sin pelearse.
 */
export function useAvisoNuevos(pedidos, { segundos = 8 } = {}) {
  const [sonido, setSonido] = useState(() => {
    try { return localStorage.getItem(LLAVE) !== 'no' } catch { return true }
  })
  const [destello, setDestello] = useState(false)
  const previa = useRef(null)
  const temporizador = useRef(null)

  const clave = claveDe(pedidos)

  useEffect(() => {
    const antes = previa.current
    previa.current = clave
    if (!hayNuevos(antes, clave)) return
    setDestello(true)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setDestello(false), segundos * 1000)
    if (sonido) avisar({ veces: 2 })
    // `sonido` a propósito fuera de las dependencias: cambiarlo no debe
    // disparar un aviso, solo afecta al siguiente que entre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, segundos])

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const alternarSonido = () => setSonido(s => {
    const v = !s
    try { localStorage.setItem(LLAVE, v ? 'si' : 'no') } catch { /* sin almacén */ }
    return v
  })

  return { sonido, alternarSonido, destello }
}
