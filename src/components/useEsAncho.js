import { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────────────────────────────
// ¿Hay pantalla de sobra?
//
// El Mostrador es un monitor o una tablet apaisada, pero la misma pantalla se
// abre también en un móvil. Lo que sirve en uno desperdicia el otro: la toma de
// pedido de la PDA, en un monitor, era una columna de 520 px con la sala
// asomando por los lados.
//
// Escucha el cambio (girar la tablet, estrechar la ventana) en vez de mirar el
// ancho una vez al montar.
// ────────────────────────────────────────────────────────────────────────────
export function useEsAncho(minimo = 900) {
  const consulta = `(min-width: ${minimo}px)`
  const [ancho, setAncho] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches)

  useEffect(() => {
    const mq = window.matchMedia?.(consulta)
    if (!mq) return
    const cambio = () => setAncho(mq.matches)
    cambio()
    mq.addEventListener?.('change', cambio)
    return () => mq.removeEventListener?.('change', cambio)
  }, [consulta])

  return ancho
}
