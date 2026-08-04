import { useRef, useState, useCallback } from 'react'

// ────────────────────────────────────────────────────────────────────────────
// Evita que una acción crítica se dispare dos veces.
//
// En un servicio con prisa el camarero pulsa dos veces "enviar" o "cobrar":
// sin protección eso son dos comandas iguales en cocina o dos tickets del
// mismo importe. El botón queda bloqueado mientras la acción está en curso
// (y un instante después, por el doble toque en pantallas táctiles).
// ────────────────────────────────────────────────────────────────────────────

export function useUnaVez(accion, { enfriamiento = 800 } = {}) {
  const ocupadoRef = useRef(false)
  const [ocupado, setOcupado] = useState(false)

  const ejecutar = useCallback(async (...args) => {
    if (ocupadoRef.current) return          // ya se está ejecutando: se ignora
    ocupadoRef.current = true
    setOcupado(true)
    try {
      return await accion(...args)
    } finally {
      setTimeout(() => { ocupadoRef.current = false; setOcupado(false) }, enfriamiento)
    }
  }, [accion, enfriamiento])

  return [ejecutar, ocupado]
}
