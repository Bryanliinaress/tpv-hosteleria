import { useStore } from '../../store/useStore'
import BotonSalir from '../../components/BotonSalir'

const ESTADO = {
  espera: { label: '⏸ En espera', color: '#64748b', next: 'recibido', nextLabel: '▶ Marchar ya' },
  recibido: { label: 'Recibido', color: '#f59e0b', next: 'preparando', nextLabel: 'Preparar' },
  preparando: { label: 'Preparando...', color: '#3b82f6', next: 'listo', nextLabel: '✅ Listo' },
  listo: { label: 'Listo ✅', color: '#10b981', next: null, nextLabel: null },
}

function tiempoTranscurrido(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return `${diff}s`
  return `${Math.floor(diff / 60)}min`
}

export default function PantallaKDS() {
  const { pedidosCocina, actualizarEstadoCocina } = useStore()
  const activos = pedidosCocina.filter(p => p.estado !== 'listo')
  const listos = pedidosCocina.filter(p => p.estado === 'listo')

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(180deg, #06351a, #052e16)', borderBottom: '1px solid #14532d', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.7)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '4px', height: '2.5rem', borderRadius: '9999px', background: '#10b981', boxShadow: '0 0 14px #10b981' }} />
          <div>
            <h1 style={{ fontWeight: 900, fontSize: '1.5rem', color: '#10b981', letterSpacing: '0.02em' }}>🍳 COCINA</h1>
            <p style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>{activos.length} en cola · {listos.length} listos</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <BotonSalir oscuro />
        </div>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
        {/* Columna pendientes */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
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
                const urgente = p.estado !== 'espera' && (Date.now() - new Date(p.horaEntrada)) > 10 * 60 * 1000
                return (
                  <div key={p.id} className={urgente ? 'anim-fade pulse-attn' : 'anim-fade'} style={{
                    background: 'linear-gradient(180deg, #131c2e, #0f172a)',
                    border: `2px solid ${urgente ? '#f43f5e' : est.color + '44'}`,
                    borderRadius: 'var(--radius)',
                    padding: '1rem',
                    borderLeft: `5px solid ${est.color}`,
                    boxShadow: 'var(--shadow)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#10b981' }}>M{p.mesaNumero}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#6ee7b7' }}>{p.personaNombre}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: urgente ? '#f43f5e' : '#6b7280', fontWeight: urgente ? 700 : 400 }}>
                          {urgente ? '⚠️ ' : ''}{tiempoTranscurrido(p.horaEntrada)}
                        </span>
                        <span style={{ fontSize: '0.7rem', background: est.color + '22', color: est.color, borderRadius: '4px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>{est.label}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: p.nota ? '0.4rem' : '0.75rem', opacity: p.estado === 'espera' ? 0.65 : 1 }}>
                      <span style={{ color: '#f59e0b' }}>{p.cantidad}×</span> {p.nombre}
                      {(p.tiempo || 1) > 1 && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', background: '#3b0764', color: '#c4b5fd', borderRadius: '9999px', padding: '0.12rem 0.5rem', fontWeight: 700, verticalAlign: 'middle' }}>{p.tiempo === 3 ? '🍰 Postre' : '2º plato'}{p.estado === 'espera' ? ' · sin marchar' : ''}</span>}
                    </div>
                    {p.nota && (
                      <div style={{ fontSize: '0.85rem', color: '#fde68a', background: '#3f2d00', border: '1px solid #78531a', borderRadius: '0.375rem', padding: '0.3rem 0.55rem', marginBottom: '0.75rem' }}>
                        📝 {p.nota}
                      </div>
                    )}
                    {est.next && (
                      <button
                        onClick={() => actualizarEstadoCocina(p.id, est.next)}
                        style={{ background: est.next === 'listo' ? '#10b981' : '#1d4ed8', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', width: '100%' }}
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

        {/* Columna listos */}
        {listos.length > 0 && (
          <div style={{ width: '240px' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Listos ({listos.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {listos.map(p => (
                <div key={p.id} style={{ background: '#052e16', border: '1px solid #14532d', borderRadius: '0.625rem', padding: '0.75rem', opacity: 0.85 }}>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>M{p.mesaNumero} — {p.personaNombre}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>{p.cantidad}× {p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
