import { esDemo } from '../lib/perfil'
import { useAltoCSS } from './useAltoCSS'

// ────────────────────────────────────────────────────────────────────────────
// «Esto es una demostración».
//
// Nació cuando había dos enlaces parecidos y se pedía en el equivocado. Hoy
// hay uno solo, pero sigue haciendo falta por otro motivo: es el escaparate
// con el que se enseña el producto, y quien lo abre tiene que saber que lo que
// pida ahí no llega a ninguna cocina ni se cobra a nadie.
//
// Va arriba del todo, en todas las pantallas, y no se puede cerrar: es
// información, no publicidad.
//
// En pantalla estrecha se acorta. Con el texto entero ocupaba DOS líneas en un
// móvil y empujaba hacia abajo la cabecera y la carta: el aviso se comía la
// primera pantalla de lo que se quiere enseñar.
// ────────────────────────────────────────────────────────────────────────────
export default function AvisoDemo() {
  // El hook va SIEMPRE, también cuando no hay banda: si se llamara después del
  // `return null` React se quedaría sin su orden de hooks. Con la ref vacía
  // deja `--alto-aviso` en 0px, que es lo que corresponde sin banda.
  const ref = useAltoCSS('--alto-aviso')
  if (!esDemo()) return null
  return (
    <div
      ref={ref}
      role="status"
      className="no-print"
      style={{
        position: 'sticky', top: 0, zIndex: 9999,
        background: 'repeating-linear-gradient(45deg, #7c2d12, #7c2d12 12px, #9a3412 12px, #9a3412 24px)',
        color: '#fff7ed',
        fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.02em',
        padding: '0.35rem 0.75rem', textAlign: 'center',
        borderBottom: '2px solid #fdba74',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      🎭 DEMOSTRACIÓN · los pedidos<span className="solo-ancho"> y cobros</span> de
      aquí <u>no son reales</u>
    </div>
  )
}
