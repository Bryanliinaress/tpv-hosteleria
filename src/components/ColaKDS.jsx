import { agruparPorMesa, itemsDelPaso, esUrgente, estadoVisible } from '../lib/kds'

// Cola de comandas agrupada POR MESA, compartida por cocina y barra: los platos
// de una mesa salen juntos, así que se leen juntos. La mesa que lleva más
// esperando va arriba del todo.

const tiempo = (iso) => {
  if (!iso) return '—'          // comanda sin hora: mejor un guion que «29000000 min»
  const seg = Math.floor((Date.now() - new Date(iso)) / 1000)
  return seg < 60 ? `${seg}s` : `${Math.floor(seg / 60)} min`
}

export default function ColaKDS({ pedidos, estados, acento, onAvanzar }) {
  const grupos = agruparPorMesa(pedidos)
  if (grupos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#374151', fontSize: '1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>😴</div>
        Sin pedidos pendientes
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {grupos.map(g => {
        const est = estadoVisible(estados, g.estado)
        const urgente = esUrgente(g)
        const delPaso = itemsDelPaso(g)
        return (
          <div key={g.mesaId} className={urgente ? 'anim-fade pulse-attn' : 'anim-fade'} style={{
            background: 'var(--color-surface)',
            border: `2px solid ${urgente ? '#f43f5e' : est.color + '44'}`,
            borderLeft: `5px solid ${est.color}`,
            borderRadius: 'var(--radius)', padding: '1rem', boxShadow: 'var(--shadow)',
          }}>
            {/* Cabecera de la mesa */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontWeight: 900, fontSize: '1.5rem', color: acento }}>Mesa {g.mesaNumero}</span>
                <span style={{ marginLeft: '0.6rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                  {g.uds} {g.uds === 1 ? 'plato' : 'platos'}{g.comensales.length > 1 ? ` · ${g.comensales.length} comensales` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.85rem', color: urgente ? '#f43f5e' : 'var(--color-faint)', fontWeight: urgente ? 800 : 400 }}>
                  {urgente ? '⚠️ ' : ''}{tiempo(g.desde)}
                </span>
                <span style={{ fontSize: '0.7rem', background: est.color + '22', color: est.color, borderRadius: '4px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>{est.label}</span>
              </div>
            </div>

            {/* Platos de la mesa */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
              {g.items.map(p => {
                const e = estadoVisible(estados, p.estado)
                const hecho = p.estado === 'listo'
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                    padding: '0.5rem 0.65rem', borderRadius: '0.5rem',
                    background: 'var(--color-inset)', opacity: p.estado === 'espera' ? 0.6 : hecho ? 0.5 : 1,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', textDecoration: hecho ? 'line-through' : 'none' }}>
                        <span style={{ color: '#f59e0b' }}>{p.cantidad}×</span> {p.nombre}
                        {(p.tiempo || 1) > 1 && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', background: '#3b0764', color: '#c4b5fd', borderRadius: '9999px', padding: '0.12rem 0.5rem', fontWeight: 700, verticalAlign: 'middle' }}>
                            {p.tiempo === 3 ? '🍰 Postre' : '2º plato'}{p.estado === 'espera' ? ' · sin marchar' : ''}
                          </span>
                        )}
                      </div>
                      {p.nota && (
                        <div style={{ fontSize: '0.85rem', color: '#fde68a', background: '#3f2d00', border: '1px solid #78531a', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', marginTop: '0.3rem' }}>
                          📝 {p.nota}
                        </div>
                      )}
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-faint)', marginTop: '0.15rem' }}>{p.personaNombre}</div>
                    </div>
                    {/* avanzar solo este plato, cuando uno va antes que la mesa */}
                    {e?.next && (
                      <button onClick={() => onAvanzar(p.id, e.next)} title={e.nextLabel} aria-label={`${e.nextLabel} · ${p.nombre}`}
                        style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: 'none', borderRadius: '0.5rem', width: '2.75rem', height: '2.75rem', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>
                        {e.next === 'listo' ? '✅' : '▶'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Un botón para toda la mesa: es como sale la comida */}
            {est.next && (
              <button
                onClick={() => delPaso.forEach(p => onAvanzar(p.id, est.next))}
                style={{ background: est.next === 'listo' ? '#10b981' : '#1d4ed8', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.85rem 1rem', minHeight: '56px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', width: '100%' }}
              >
                {est.nextLabel}{delPaso.length > 1 ? ` · ${delPaso.length} platos` : ''}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
