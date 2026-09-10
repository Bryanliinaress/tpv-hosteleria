import { useState } from 'react'
import { useStore } from '../store/useStore'
import { toast } from '../store/useUI'

const euros = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`

/**
 * Cambiarle el precio a una línea que ya tenía uno.
 *
 * El menú del día cobrado a precio de menú aunque los platos vengan de la
 * carta, el precio que se le hace a la mesa grande, el plato que salió tarde,
 * el de la pizarra que se tecleó mal. La otra salida —anular y volver a
 * meterlo— deja una anulación falsa en la auditoría y una comanda repetida en
 * cocina.
 *
 * Pide **motivo** como al anular, y por lo mismo: cambiar un precio es la
 * forma en que el dinero se va de un bar sin que nadie robe nada, y lo que no
 * queda escrito no se puede mirar después.
 */
export default function CambiarPrecio({ mesa, personaId, item, por, onCerrar }) {
  const cambiarPrecio = useStore(s => s.cambiarPrecio)
  const [precio, setPrecio] = useState(String(item.precio).replace('.', ','))
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState(null)

  const guardar = () => {
    const r = cambiarPrecio(mesa.id, personaId, item.uid, precio, { motivo, por })
    if (!r?.ok) { setError(r?.error || 'No se pudo cambiar'); return }
    const d = r.valor?.diferencia || 0
    toast(`${item.nombre}: ${euros(r.valor.antes)} → ${euros(r.valor.despues)} (${d > 0 ? '+' : ''}${euros(d)})`, 'success')
    onCerrar()
  }

  return (
    <div onClick={onCerrar} style={fondo}>
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={caja}>
        <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.2rem' }}>💶 Cambiar el precio</h3>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginBottom: '0.9rem' }}>
          {item.cantidad}× <b style={{ color: 'var(--color-text)' }}>{item.nombre}</b> · ahora {euros(item.precio)} la unidad
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <label style={campo}>
            <span style={etiqueta}>Precio nuevo (€ por unidad)</span>
            {/* `text` y no `number`: en un `number` la coma se PIERDE y
                «15,50» llega como «1550». */}
            <input value={precio} onChange={e => { setPrecio(e.target.value); setError(null) }}
              inputMode="decimal" autoFocus style={inp} />
          </label>

          <label style={campo}>
            <span style={etiqueta}>Motivo</span>
            <input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Menú del día, precio a la mesa, salió tarde…" maxLength={200} style={inp} />
          </label>

          <p style={{ fontSize: '0.72rem', color: 'var(--color-faint)' }}>
            Queda registrado: cuánto valía, cuánto vale, quién lo cambió y por qué.
          </p>

          {error && (
            <div role="alert" style={{ background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', fontSize: '0.8rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
            <button onClick={onCerrar} style={{ ...boton, background: 'var(--color-surface-3)', color: 'var(--color-text)', flex: 1 }}>Cancelar</button>
            <button onClick={guardar} style={{ ...boton, background: '#10b981', color: '#fff', flex: 2 }}>Cambiar el precio</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const fondo = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem', animation: 'fadeIn 0.2s ease both' }
const caja = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.25rem', width: '100%', maxWidth: '360px', maxHeight: '90vh', overflowY: 'auto' }
const campo = { display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const etiqueta = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }
const inp = { background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', color: 'var(--color-text)', fontSize: '0.9rem', width: '100%' }
const boton = { border: 'none', borderRadius: '0.5rem', padding: '0.7rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }
