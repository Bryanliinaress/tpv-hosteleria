import { useStore } from '../../store/useStore'
import BotonSalir from '../../components/BotonSalir'

const ESTADO = {
  recibido: { label: 'Recibido', color: '#f59e0b', next: 'preparando', nextLabel: 'Preparar' },
  preparando: { label: 'Preparando...', color: '#a78bfa', next: 'listo', nextLabel: '✅ Listo' },
  listo: { label: 'Listo ✅', color: '#f43f5e', next: null, nextLabel: null },
}

function tiempoTranscurrido(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return `${diff}s`
  return `${Math.floor(diff / 60)}min`
}

export default function PantallaBarra() {
  const { pedidosBarra, actualizarEstadoBarra } = useStore()
  const activos = pedidosBarra.filter(p => p.estado !== 'listo')
  const listos = pedidosBarra.filter(p => p.estado === 'listo')

  return (
    <div className="force-dark" style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(180deg, var(--tint-danger-bg), var(--tint-danger-bg))', borderBottom: '1px solid var(--tint-danger-bd)', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.7)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '4px', height: '2.5rem', borderRadius: '9999px', background: '#f43f5e', boxShadow: '0 0 14px #f43f5e' }} />
          <div>
            <h1 style={{ fontWeight: 900, fontSize: '1.5rem', color: '#f43f5e', letterSpacing: '0.02em' }}>🍺 BARRA</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--tint-danger-fg)' }}>{activos.length} en cola · {listos.length} listos</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f43f5e', fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <BotonSalir oscuro />
        </div>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--tint-danger-fg)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
            En cola ({activos.length})
          </h2>
          {activos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#374151', fontSize: '1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>😴</div>
              Sin pedidos pendientes
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activos.map(p => {
                const est = ESTADO[p.estado]
                const urgente = (Date.now() - new Date(p.horaEntrada)) > 5 * 60 * 1000
                return (
                  <div key={p.id} className={urgente ? 'anim-fade pulse-attn' : 'anim-fade'} style={{
                    background: 'linear-gradient(180deg, #131c2e, var(--color-inset))',
                    border: `2px solid ${urgente ? '#ef4444' : est.color + '44'}`,
                    borderRadius: 'var(--radius)',
                    padding: '1rem',
                    borderLeft: `5px solid ${est.color}`,
                    boxShadow: 'var(--shadow)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#f43f5e' }}>M{p.mesaNumero}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--tint-danger-fg)' }}>{p.personaNombre}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: urgente ? '#f43f5e' : '#6b7280', fontWeight: urgente ? 700 : 400 }}>
                        {urgente ? '⚠️ ' : ''}{tiempoTranscurrido(p.horaEntrada)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: p.nota ? '0.4rem' : '0.75rem' }}>
                      <span style={{ color: '#f59e0b' }}>{p.cantidad}×</span> {p.nombre}
                    </div>
                    {p.nota && (
                      <div style={{ fontSize: '0.85rem', color: '#fecdd3', background: '#3f0d1a', border: '1px solid #7a1f33', borderRadius: '0.375rem', padding: '0.3rem 0.55rem', marginBottom: '0.75rem' }}>
                        📝 {p.nota}
                      </div>
                    )}
                    {est.next && (
                      <button
                        onClick={() => actualizarEstadoBarra(p.id, est.next)}
                        style={{ background: est.next === 'listo' ? '#f43f5e' : '#7c3aed', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', width: '100%' }}
                      >
                        {est.nextLabel}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {listos.length > 0 && (
          <div style={{ width: '240px' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Listos ({listos.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {listos.map(p => (
                <div key={p.id} style={{ background: 'var(--tint-danger-bg)', border: '1px solid var(--tint-danger-bd)', borderRadius: '0.625rem', padding: '0.75rem', opacity: 0.85 }}>
                  <div style={{ fontWeight: 700, color: '#f43f5e', fontSize: '0.9rem' }}>M{p.mesaNumero} — {p.personaNombre}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--tint-danger-fg)' }}>{p.cantidad}× {p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
