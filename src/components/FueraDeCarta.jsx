import { useState } from 'react'
import { useStore } from '../store/useStore'
import { toast } from '../store/useUI'
import { TIPOS_APARTADO } from '../lib/carta'

/**
 * Añadir al pedido algo que no está en la carta, con el precio a mano.
 *
 * La sugerencia de la pizarra, el descorche, la tarta que trajo el cliente, el
 * suplemento de terraza. Sin esto se cobra por fuera del TPV — y lo que se
 * cobra por fuera no sale en el ticket, ni en el arqueo, ni en Hacienda.
 *
 * Las reglas (nombre, precio con coma, cantidad, tipo) están en
 * `lib/fueraDeCarta.js` y las comprueba también el servidor: esta pantalla solo
 * enseña el fallo sin cerrarse ni perder lo tecleado.
 */
export default function FueraDeCarta({ mesa, personaId, onCerrar }) {
  const agregarLibre = useStore(s => s.agregarLibre)
  const [quien, setQuien] = useState(personaId || mesa.personas[0]?.id || '')
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [tipo, setTipo] = useState('comida')
  const [error, setError] = useState(null)

  const guardar = () => {
    const r = agregarLibre(mesa.id, quien, { nombre, precio, cantidad, tipo })
    if (!r?.ok) { setError(r?.error || 'No se pudo añadir'); return }
    toast(`${cantidad}× ${nombre.trim()} añadido`, 'success')
    onCerrar()
  }

  return (
    <div onClick={onCerrar} style={fondo}>
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={caja}>
        <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.2rem' }}>✍️ Fuera de carta</h3>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.78rem', marginBottom: '0.9rem' }}>
          Algo que no tiene ficha en la carta. Va a la comanda y al ticket como una línea más.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {mesa.personas.length > 1 && (
            <label style={campo}>
              <span style={etiqueta}>Para</span>
              <select value={quien} onChange={e => setQuien(e.target.value)} style={inp}>
                {mesa.personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
          )}

          <label style={campo}>
            <span style={etiqueta}>Qué es</span>
            {/* Es lo que va a leer el cliente en su ticket y quien lo prepare
                en la comanda: «Sugerencia» a secas no lo entiende ninguno. */}
            <input value={nombre} onChange={e => { setNombre(e.target.value); setError(null) }}
              placeholder="Tarta de la abuela, Descorche…" maxLength={60} autoFocus style={inp} />
          </label>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <label style={{ ...campo, flex: 1 }}>
              <span style={etiqueta}>Precio (€)</span>
              {/* `text` y no `number`: en un `number` la coma se PIERDE y
                  «3,50» llega como «350». Ya pasó con el IVA (v0.122.0). */}
              <input value={precio} onChange={e => { setPrecio(e.target.value); setError(null) }}
                inputMode="decimal" placeholder="4,50" style={inp} />
            </label>
            <label style={{ ...campo, width: '6.5rem' }}>
              <span style={etiqueta}>Cantidad</span>
              <input value={cantidad} onChange={e => { setCantidad(e.target.value.replace(/\D/g, '') || '') ; setError(null) }}
                inputMode="numeric" style={inp} />
            </label>
          </div>

          <div style={campo}>
            <span style={etiqueta}>¿Quién lo hace?</span>
            {/* No es cosmético: decide si la comanda sale por la impresora de
                cocina o por la de barra, y en qué KDS aparece. */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {Object.entries(TIPOS_APARTADO).map(([k, v]) => (
                <button key={k} onClick={() => setTipo(k)} style={{
                  flex: 1, padding: '0.55rem', borderRadius: '0.5rem', cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: 700,
                  background: tipo === k ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: tipo === k ? '#fff' : 'var(--color-text)',
                  border: `1px solid ${tipo === k ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}>{v.emoji} {v.label}</button>
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" style={{ background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', fontSize: '0.8rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
            <button onClick={onCerrar} style={{ ...boton, background: 'var(--color-surface-3)', color: 'var(--color-text)', flex: 1 }}>Cancelar</button>
            <button onClick={guardar} style={{ ...boton, background: '#10b981', color: '#fff', flex: 2 }}>Añadir al pedido</button>
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
