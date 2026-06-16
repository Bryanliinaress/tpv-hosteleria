import { useStore } from '../../store/useStore'

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
    <div style={{ minHeight: '100vh', background: '#0c0a0e', color: '#f8fafc' }}>
      <div style={{ background: '#2d0a14', borderBottom: '1px solid #450a1b', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: '1.5rem', color: '#f43f5e' }}>🍺 BARRA</h1>
          <p style={{ fontSize: '0.8rem', color: '#fda4af' }}>{activos.length} en cola · {listos.length} listos</p>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f43f5e' }}>
          {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fda4af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
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
                  <div key={p.id} style={{
                    background: '#0f172a',
                    border: `2px solid ${urgente ? '#ef4444' : est.color + '44'}`,
                    borderRadius: '0.875rem',
                    padding: '1rem',
                    borderLeft: `4px solid ${est.color}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#f43f5e' }}>M{p.mesaNumero}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#fda4af' }}>{p.personaNombre}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: urgente ? '#f43f5e' : '#6b7280', fontWeight: urgente ? 700 : 400 }}>
                        {urgente ? '⚠️ ' : ''}{tiempoTranscurrido(p.horaEntrada)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#f59e0b' }}>{p.cantidad}×</span> {p.nombre}
                    </div>
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
                <div key={p.id} style={{ background: '#2d0a14', border: '1px solid #450a1b', borderRadius: '0.625rem', padding: '0.75rem', opacity: 0.85 }}>
                  <div style={{ fontWeight: 700, color: '#f43f5e', fontSize: '0.9rem' }}>M{p.mesaNumero} — {p.personaNombre}</div>
                  <div style={{ fontSize: '0.8rem', color: '#fda4af' }}>{p.cantidad}× {p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
