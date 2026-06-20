import { useState } from 'react'
import { useStore, owedPorPersona } from '../../store/useStore'
import Ticket from '../../components/Ticket'

const ESTADO = {
  libre: { label: 'Libre', color: '#10b981', bg: '#052e16' },
  ocupada: { label: 'Ocupada', color: '#f59e0b', bg: '#2d1900' },
  esperando_cobro: { label: 'Pide cuenta', color: '#f43f5e', bg: '#2d0a14' },
}

export default function PanelCamarero() {
  const { mesas, carta, pedidosCocina, pedidosBarra, avisos, liberarMesa, confirmarPedido, atenderAviso, pagarParte } = useStore()
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [ticket, setTicket] = useState(null) // { tipo, persona }

  const mesa = mesas.find(m => m.id === mesaSeleccionada)
  const owed = mesa && mesa.estado !== 'libre' ? owedPorPersona(mesa) : {}

  const totalCocina = pedidosCocina.filter(p => p.estado === 'listo').length
  const totalBarra = pedidosBarra.filter(p => p.estado === 'listo').length

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem' }}>👨‍🍳 Panel Camarero</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{mesas.filter(m => m.estado !== 'libre').length} mesas ocupadas de {mesas.length}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {totalCocina > 0 && <div style={{ background: '#052e16', color: '#10b981', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>🍳 {totalCocina} listo(s)</div>}
          {totalBarra > 0 && <div style={{ background: '#2d0a14', color: '#f43f5e', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>🍺 {totalBarra} listo(s)</div>}
        </div>
      </div>

      {/* Avisos de clientes (llamadas al camarero) */}
      {avisos.length > 0 && (
        <div style={{ background: '#3b1d00', borderBottom: '1px solid #7c3a00', padding: '0.75rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.625rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: '#fbbf24', fontSize: '0.85rem' }}>🔔 Te llaman:</span>
          {avisos.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', border: '1px solid #f59e0b', borderRadius: '9999px', padding: '0.25rem 0.4rem 0.25rem 0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Mesa {a.mesaNumero}</span>
              {a.personaNombre && <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>· {a.personaNombre}</span>}
              <button onClick={() => atenderAviso(a.id)} title="Marcar atendido" style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '9999px', width: '1.5rem', height: '1.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>✓</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Grid mesas */}
        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.875rem' }}>
            {mesas.map(m => {
              const est = ESTADO[m.estado]
              const listoCocina = pedidosCocina.filter(p => p.mesaId === m.id && p.estado === 'listo').length
              const listoBarra = pedidosBarra.filter(p => p.mesaId === m.id && p.estado === 'listo').length
              const totalMesa = m.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
              return (
                <button
                  key={m.id}
                  onClick={() => setMesaSeleccionada(mesaSeleccionada === m.id ? null : m.id)}
                  style={{
                    background: mesaSeleccionada === m.id ? est.bg : 'var(--color-surface)',
                    border: `2px solid ${mesaSeleccionada === m.id ? est.color : m.estado === 'libre' ? 'var(--color-border)' : est.color + '66'}`,
                    borderRadius: '0.875rem',
                    padding: '1rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>M{m.numero}</span>
                    <span style={{ fontSize: '0.7rem', background: est.bg, color: est.color, borderRadius: '9999px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>{est.label}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{m.capacidad} plazas</div>
                  {m.estado !== 'libre' && (
                    <>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{m.personas.length} personas</div>
                      <div style={{ fontWeight: 700, color: '#f97316', fontSize: '0.875rem', marginTop: '0.25rem' }}>{totalMesa.toFixed(2)} €</div>
                    </>
                  )}
                  {(listoCocina > 0 || listoBarra > 0) && (
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.375rem' }}>
                      {listoCocina > 0 && <span style={{ fontSize: '0.7rem', background: '#052e16', color: '#10b981', borderRadius: '4px', padding: '0 4px', fontWeight: 700 }}>🍳{listoCocina}</span>}
                      {listoBarra > 0 && <span style={{ fontSize: '0.7rem', background: '#2d0a14', color: '#f43f5e', borderRadius: '4px', padding: '0 4px', fontWeight: 700 }}>🍺{listoBarra}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Panel derecho - detalle mesa */}
        {mesa && (
          <div style={{ width: '340px', background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mesa {mesa.numero}</h2>
              <button onClick={() => setMesaSeleccionada(null)} style={btn('#1e293b')}>✕</button>
            </div>

            {mesa.estado === 'libre' ? (
              <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Mesa libre — sin pedidos</p>
            ) : (
              <>
                {/* Pedidos por persona */}
                {mesa.personas.map(p => {
                  const aPagar = owed[p.id] ?? p.items.reduce((s, i) => s + i.precio * i.cantidad, 0)
                  return (
                    <div key={p.id} style={{ background: '#0f172a', borderRadius: '0.625rem', padding: '0.875rem', border: p.pagado ? '1px solid #10b981' : '1px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#f97316', fontSize: '0.9rem' }}>{p.nombre}</span>
                        {p.pagado && <span style={{ fontSize: '0.7rem', background: '#052e16', color: '#10b981', borderRadius: '9999px', padding: '0.15rem 0.6rem', fontWeight: 700 }}>✓ Pagado{p.propina > 0 ? ` · +${p.propina.toFixed(2)} €` : ''}</span>}
                      </div>
                      {p.items.length === 0
                        ? <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>Sin pedidos aún</p>
                        : p.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ color: item.estado === 'pendiente' ? '#f59e0b' : 'var(--color-muted)' }}>
                              {item.cantidad}× {item.nombre}
                              {item.estado === 'pendiente' && <span style={{ marginLeft: '4px', fontSize: '0.7rem' }}>●</span>}
                            </span>
                            <span style={{ fontWeight: 600 }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                          </div>
                        ))
                      }
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f97316' }}>{aPagar.toFixed(2)} €</span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => setTicket({ tipo: 'persona', persona: p })} title="Ticket de este cliente" style={btn('#1e293b', { fontSize: '0.78rem', padding: '0.35rem 0.6rem' })}>🧾</button>
                          {!p.pagado && (
                            <button onClick={() => pagarParte(mesa.id, p.id)} style={btn('#10b981', { fontSize: '0.78rem', padding: '0.35rem 0.75rem' })}>Cobrar</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Total mesa */}
                <div style={{ background: '#0f172a', borderRadius: '0.625rem', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                  <span>Total mesa</span>
                  <span style={{ color: '#f97316' }}>{mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0).toFixed(2)} €</span>
                </div>

                {/* Listos para servir */}
                {(pedidosCocina.some(p => p.mesaId === mesa.id && p.estado === 'listo') || pedidosBarra.some(p => p.mesaId === mesa.id && p.estado === 'listo')) && (
                  <div style={{ background: '#052e16', borderRadius: '0.625rem', padding: '0.875rem' }}>
                    <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '0.5rem', fontSize: '0.875rem' }}>✅ Listos para servir</div>
                    {[...pedidosCocina, ...pedidosBarra].filter(p => p.mesaId === mesa.id && p.estado === 'listo').map(p => (
                      <div key={p.id} style={{ fontSize: '0.8rem', color: '#86efac', padding: '0.2rem 0' }}>
                        {p.cantidad}× {p.nombre} → {p.personaNombre}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tickets de mesa */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setTicket({ tipo: 'comanda' })} style={btn('#1e293b', { flex: 1, fontSize: '0.85rem' })}>🧾 Comanda</button>
                  <button onClick={() => setTicket({ tipo: 'cuenta' })} style={btn('#1e293b', { flex: 1, fontSize: '0.85rem' })}>💶 Cuenta</button>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {mesa.estado === 'esperando_cobro' && (
                    <button onClick={() => liberarMesa(mesa.id)} style={btn('#10b981', { width: '100%' })}>
                      ✅ Cobrado — liberar mesa
                    </button>
                  )}
                  <button onClick={() => liberarMesa(mesa.id)} style={btn('#334155', { width: '100%', fontSize: '0.8rem' })}>
                    Cerrar mesa sin cobrar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {ticket && mesa && (
        <Ticket tipo={ticket.tipo} mesa={mesa} persona={ticket.persona} onClose={() => setTicket(null)} />
      )}
    </div>
  )
}

const btn = (bg, extra = {}) => ({
  background: bg,
  color: 'white',
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.5rem 1rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.875rem',
  ...extra,
})
