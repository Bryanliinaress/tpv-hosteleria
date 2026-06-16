import { useState } from 'react'
import { useStore } from '../../store/useStore'

export default function PanelAdmin() {
  const { carta, mesas } = useStore()
  const [tab, setTab] = useState('carta')

  const totalVentas = mesas.reduce((s, m) =>
    s + m.personas.reduce((ss, p) =>
      ss + p.items.reduce((sss, i) => sss + i.precio * i.cantidad, 0), 0), 0)
  const mesasOcupadas = mesas.filter(m => m.estado !== 'libre').length

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '1rem 1.5rem' }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.25rem' }}>🛠 Panel Administración</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>Gestión del local</p>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        {[
          { label: 'Mesas ocupadas', value: `${mesasOcupadas}/${mesas.length}`, color: '#f59e0b' },
          { label: 'Productos en carta', value: carta.productos.length, color: '#3b82f6' },
          { label: 'Categorías', value: carta.categorias.length, color: '#8b5cf6' },
          { label: 'Consumo activo', value: `${totalVentas.toFixed(2)} €`, color: '#f97316' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        {[
          { id: 'carta', label: '📋 Carta' },
          { id: 'mesas', label: '🍽 Mesas' },
          { id: 'qr', label: '📱 QR Codes' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', padding: '0.875rem 1.5rem', cursor: 'pointer',
            color: tab === t.id ? '#f97316' : 'var(--color-muted)',
            borderBottom: tab === t.id ? '2px solid #f97316' : '2px solid transparent',
            fontWeight: tab === t.id ? 700 : 400, fontSize: '0.875rem',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        {/* Tab Carta */}
        {tab === 'carta' && (
          <div>
            {carta.categorias.map(cat => (
              <div key={cat.id} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{cat.emoji}</span>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{cat.nombre}</h3>
                  <span style={{ fontSize: '0.75rem', background: cat.tipo === 'comida' ? '#052e16' : '#2d0a14', color: cat.tipo === 'comida' ? '#10b981' : '#f43f5e', borderRadius: '9999px', padding: '0.15rem 0.5rem' }}>{cat.tipo}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.625rem' }}>
                  {carta.productos.filter(p => p.categoria === cat.id).map(prod => (
                    <div key={prod.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.625rem', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{prod.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{prod.descripcion}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#f97316', fontSize: '0.9rem', marginLeft: '1rem', whiteSpace: 'nowrap' }}>{prod.precio.toFixed(2)} €</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-muted)', fontSize: '0.85rem', background: 'var(--color-surface)', borderRadius: '0.75rem', border: '1px dashed var(--color-border)' }}>
              ✏️ La edición completa de la carta estará disponible en la siguiente versión con backend conectado
            </div>
          </div>
        )}

        {/* Tab Mesas */}
        {tab === 'mesas' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem' }}>
            {mesas.map(m => {
              const total = m.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
              return (
                <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.875rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mesa {m.numero}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: m.estado === 'libre' ? '#10b981' : m.estado === 'esperando_cobro' ? '#f43f5e' : '#f59e0b' }}>
                      {m.estado === 'libre' ? 'Libre' : m.estado === 'esperando_cobro' ? 'Pide cuenta' : 'Ocupada'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Capacidad: {m.capacidad} personas</div>
                  {m.estado !== 'libre' && (
                    <>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{m.personas.length} comensales</div>
                      <div style={{ fontWeight: 700, color: '#f97316', fontSize: '0.9rem', marginTop: '0.25rem' }}>{total.toFixed(2)} €</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tab QR */}
        {tab === 'qr' && (
          <div>
            <p style={{ color: 'var(--color-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Cada mesa tiene su URL única. En producción, genera el QR con estas URLs y colócalo en cada mesa.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {mesas.map(m => (
                <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Mesa {m.numero}</div>
                  <code style={{ fontSize: '0.75rem', color: '#a78bfa', background: '#0f172a', padding: '0.375rem 0.5rem', borderRadius: '0.375rem', display: 'block', wordBreak: 'break-all' }}>
                    {window.location.origin}/mesa/{m.id}
                  </code>
                  <button
                    onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/mesa/${m.id}`)}
                    style={{ marginTop: '0.625rem', background: '#1e293b', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '0.375rem', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem', width: '100%' }}
                  >
                    Copiar URL
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
