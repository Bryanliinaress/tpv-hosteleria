import { useState, useEffect, useRef } from 'react'
import { useUI } from '../store/useUI'

const TIPO = {
  info: { color: '#3b82f6', emoji: 'ℹ️' },
  success: { color: '#10b981', emoji: '✅' },
  error: { color: '#f43f5e', emoji: '⚠️' },
  warning: { color: '#f59e0b', emoji: '⏳' },
}

// Renderiza avisos (toasts) y el diálogo activo (confirmar / pedir texto).
// Se monta una sola vez en App.
export default function UIHost() {
  const { toasts, cerrarToast, dialogo, responder } = useUI()
  return (
    <>
      {/* Toasts */}
      <div className="no-print" style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 200, display: 'flex', flexDirection: 'column', gap: '0.5rem', width: 'min(92vw, 420px)', pointerEvents: 'none' }}>
        {toasts.map(t => {
          const c = TIPO[t.tipo] || TIPO.info
          return (
            <div key={t.id} className="anim-fade" onClick={() => cerrarToast(t.id)} style={{
              pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem',
              background: 'var(--color-surface)', border: `1px solid ${c.color}66`, borderLeft: `4px solid ${c.color}`,
              borderRadius: 'var(--radius)', padding: '0.7rem 0.9rem', boxShadow: 'var(--shadow-lg)', color: 'var(--color-text)',
            }}>
              <span style={{ fontSize: '1.1rem' }}>{c.emoji}</span>
              <span style={{ fontSize: '0.88rem', flex: 1 }}>{t.mensaje}</span>
            </div>
          )
        })}
      </div>

      {/* Diálogo */}
      {dialogo && <Dialogo dialogo={dialogo} responder={responder} />}
    </>
  )
}

function Dialogo({ dialogo, responder }) {
  const esPrompt = dialogo.tipo === 'prompt'
  const [valor, setValor] = useState(dialogo.valor || '')
  const inputRef = useRef(null)
  useEffect(() => { if (esPrompt) inputRef.current?.focus() }, [esPrompt])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') responder(esPrompt ? null : false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [esPrompt, responder])

  const aceptar = () => responder(esPrompt ? valor : true)
  const cancelar = () => responder(esPrompt ? null : false)
  const colorOk = dialogo.peligro ? '#f43f5e' : 'var(--color-accent)'

  return (
    <div className="no-print" onClick={cancelar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.3rem', width: '100%', maxWidth: '380px' }}>
        {dialogo.titulo && <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: dialogo.mensaje ? '0.4rem' : '0.9rem' }}>{dialogo.titulo}</h3>}
        {dialogo.mensaje && <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.45 }}>{dialogo.mensaje}</p>}
        {esPrompt && (
          <input
            ref={inputRef} value={valor} onChange={e => setValor(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') aceptar() }}
            placeholder={dialogo.placeholder}
            style={{ width: '100%', background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.7rem 0.85rem', color: 'var(--color-text)', fontSize: '0.95rem', marginBottom: '1rem' }}
          />
        )}
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button onClick={cancelar} style={btn('var(--color-surface-2)', { border: '1px solid var(--color-border)' })}>{dialogo.cancelar}</button>
          <button onClick={aceptar} style={btn(colorOk)}>{dialogo.confirmar}</button>
        </div>
      </div>
    </div>
  )
}

const btn = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.55rem', padding: '0.6rem 1.1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', ...extra })
