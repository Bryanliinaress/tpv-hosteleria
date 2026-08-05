import { useStore } from '../../store/useStore'
import BotonSalir from '../../components/BotonSalir'
import ColaKDS from '../../components/ColaKDS'

const ESTADO = {
  recibido: { label: 'Recibido', color: '#f59e0b', next: 'preparando', nextLabel: 'Preparar' },
  preparando: { label: 'Preparando...', color: '#a78bfa', next: 'listo', nextLabel: '✅ Listo' },
  listo: { label: 'Listo ✅', color: '#f43f5e', next: null, nextLabel: null },
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
          <ColaKDS pedidos={activos} estados={ESTADO} acento="#f43f5e" onAvanzar={actualizarEstadoBarra} />
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
