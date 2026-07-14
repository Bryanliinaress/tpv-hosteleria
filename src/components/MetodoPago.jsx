import { METODOS_PAGO } from '../store/useStore'

// Modal para elegir el método de pago al cobrar. Llama a onElegir(metodoId).
export default function MetodoPago({ titulo = 'Método de pago', importe, onElegir, onCerrar }) {
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', width: '100%', maxWidth: '360px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)', animation: 'pop 0.18s ease both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>{titulo}</h3>
          <button onClick={onCerrar} style={btn('var(--color-surface-3)', { padding: '0.25rem 0.6rem' })}>✕</button>
        </div>
        {importe != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.9rem' }}>
            <span>A cobrar</span><span style={{ color: 'var(--color-accent)' }}>{Number(importe).toFixed(2)} €</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {METODOS_PAGO.map(m => (
            <button key={m.id} onClick={() => onElegir(m.id)} style={btn('var(--color-surface-2)', { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.9rem 1rem', fontSize: '1rem', justifyContent: 'flex-start', border: '1px solid var(--color-border)' })}>
              <span style={{ fontSize: '1.3rem' }}>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const btn = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
