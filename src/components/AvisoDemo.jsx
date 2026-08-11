import { esDemo } from '../lib/perfil'

// ────────────────────────────────────────────────────────────────────────────
// «Esto es una demostración».
//
// La demo y un bar real salen del mismo código y sus direcciones se parecen
// demasiado (`/tpv-hosteleria/` y `/tpv-hosteleria/app/`). Pedir en la demo
// creyendo que es el bar significa que ese pedido **no existe para nadie**: ni
// llega a cocina, ni se cobra, ni aparece en la caja. Ya ha pasado.
//
// Por eso el aviso va arriba del todo, en todas las pantallas, y no se puede
// cerrar: es información, no publicidad.
// ────────────────────────────────────────────────────────────────────────────
export default function AvisoDemo() {
  if (!esDemo()) return null
  return (
    <div
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
      🎭 DEMOSTRACIÓN · los pedidos y cobros de aquí <u>no son reales</u>
    </div>
  )
}
