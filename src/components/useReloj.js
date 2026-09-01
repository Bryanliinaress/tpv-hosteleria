import { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────────────────────────────
// Hace que la pantalla se repinte sola cada pocos segundos.
//
// El reloj del KDS y los «hace 4 min» de cada comanda se calculan al pintar. En
// una pantalla que se toca —la PDA— eso basta, porque cualquier gesto repinta.
// Pero el KDS cuelga de una pared y puede estar veinte minutos sin que llegue
// nada ni nadie lo roce: sin esto se queda **congelado en la hora del último
// cambio**. Medido el 31/08: con el KDS abierto y sin actividad, el reloj marcó
// 11:48 durante 1 min 41 s de reloj real.
//
// Un cocinero usa ese número para decidir a qué mesa atiende primero. Que diga
// «2 min» en un plato que lleva veinte es peor que no ponerlo.
//
// Cada 10 s sobra para minutos, y repintar estas pantallas es barato.
// ────────────────────────────────────────────────────────────────────────────
export function useReloj(ms = 10000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return ahora
}
