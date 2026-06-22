import { useNavigate } from 'react-router-dom'

const roles = [
  { label: 'Mesa 1 (cliente demo)', path: '/mesa/mesa-1', emoji: '📱', color: '#3b82f6', desc: 'Vista del cliente con QR' },
  { label: 'Panel Camarero', path: '/camarero', emoji: '👨‍🍳', color: '#f59e0b', desc: 'Gestión de mesas y cobros' },
  { label: 'PDA Camarero', path: '/pda', emoji: '📟', color: '#06b6d4', desc: 'Móvil de mano: avisos y mesas' },
  { label: 'Pantalla Cocina', path: '/cocina', emoji: '🍳', color: '#10b981', desc: 'KDS — pedidos de comida' },
  { label: 'Pantalla Barra', path: '/barra', emoji: '🍺', color: '#f43f5e', desc: 'KDS — pedidos de bebida' },
  { label: 'Panel Admin', path: '/admin', emoji: '🛠', color: '#8b5cf6', desc: 'Carta, mesas y estadísticas' },
  { label: 'Estación de impresión', path: '/print', emoji: '🖨️', color: '#64748b', desc: 'Imprime comandas automáticamente' },
]

export default function Home() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--color-bg)' }}>
      <div style={{ marginBottom: '0.5rem', fontSize: '2.5rem' }}>🍽</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.25rem' }}>TPV Hostelería</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: '3rem', fontSize: '0.95rem' }}>Selecciona un rol para acceder</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', width: '100%', maxWidth: '900px' }}>
        {roles.map(r => (
          <button
            key={r.path}
            onClick={() => navigate(r.path)}
            style={{
              background: 'var(--color-surface)',
              border: `1.5px solid ${r.color}33`,
              borderRadius: '0.875rem',
              padding: '1.5rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.background = `${r.color}11` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${r.color}33`; e.currentTarget.style.background = 'var(--color-surface)' }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{r.emoji}</div>
            <div style={{ fontWeight: 700, color: r.color, marginBottom: '0.25rem' }}>{r.label}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{r.desc}</div>
          </button>
        ))}
      </div>
      <p style={{ marginTop: '3rem', fontSize: '0.75rem', color: '#475569' }}>v0.1.0 · En desarrollo</p>
    </div>
  )
}
