import { useState } from 'react'
import { useStore, owedPorPersona } from '../../store/useStore'
import Ticket from '../../components/Ticket'
import MetodoPago from '../../components/MetodoPago'
import ReservasManager from '../../components/ReservasManager'

const ESTADO = {
  libre: { label: 'Libre', color: '#10b981', bg: '#052e16' },
  ocupada: { label: 'Ocupada', color: '#f59e0b', bg: '#2d1900' },
  esperando_cobro: { label: 'Pide cuenta', color: '#f43f5e', bg: '#2d0a14' },
  reservada: { label: 'Reservada', color: '#3b82f6', bg: '#0c1e3a' },
}

export default function PanelCamarero() {
  const { mesas, carta, pedidosCocina, pedidosBarra, avisos, historial, reservas, liberarMesa, confirmarPedido, atenderAviso, pagarParte, cobrarMesa, reservarMesa, cancelarReserva, sentarReserva } = useStore()
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [ticket, setTicket] = useState(null) // { tipo, persona, mesa? }
  const [verHistorial, setVerHistorial] = useState(false)
  const [verReservas, setVerReservas] = useState(false)
  const [cobro, setCobro] = useState(null) // { tipo:'persona'|'mesa', personaId?, importe }
  const [reservando, setReservando] = useState(false)
  const [reservaForm, setReservaForm] = useState({ nombre: '', hora: '', personas: 2 })

  const hoy = new Date().toDateString()
  const cerradasHoy = historial.filter(r => new Date(r.cerradaEn).toDateString() === hoy).slice().reverse()
  const hoyISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const reservasHoyN = reservas.filter(r => r.fecha === hoyISO && r.estado === 'confirmada').length

  const mesa = mesas.find(m => m.id === mesaSeleccionada)
  const owed = mesa && mesa.estado !== 'libre' ? owedPorPersona(mesa) : {}

  const totalCocina = pedidosCocina.filter(p => p.estado === 'listo').length
  const totalBarra = pedidosBarra.filter(p => p.estado === 'listo').length

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(180deg, var(--color-surface), var(--color-surface-2))', borderBottom: '1px solid var(--color-border)', boxShadow: '0 6px 18px -10px rgba(0,0,0,0.6)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem' }}>👨‍🍳 Panel Camarero</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{mesas.filter(m => m.estado !== 'libre').length} mesas ocupadas de {mesas.length}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {totalCocina > 0 && <div style={{ background: '#052e16', color: '#10b981', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>🍳 {totalCocina} listo(s)</div>}
          {totalBarra > 0 && <div style={{ background: '#2d0a14', color: '#f43f5e', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>🍺 {totalBarra} listo(s)</div>}
          <button onClick={() => setVerReservas(true)} style={{ background: reservasHoyN ? '#0c1e3a' : '#1e293b', color: reservasHoyN ? '#60a5fa' : 'var(--color-text)', border: `1px solid ${reservasHoyN ? '#3b82f6' : 'var(--color-border)'}`, borderRadius: '0.5rem', padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            📅 Reservas{reservasHoyN > 0 ? ` (${reservasHoyN})` : ''}
          </button>
          <button onClick={() => setVerHistorial(true)} style={{ background: '#1e293b', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            🧾 Cerradas hoy{cerradasHoy.length > 0 ? ` (${cerradasHoy.length})` : ''}
          </button>
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
                  onClick={() => { setReservando(false); setMesaSeleccionada(mesaSeleccionada === m.id ? null : m.id) }}
                  style={{
                    background: mesaSeleccionada === m.id ? est.bg : 'var(--color-surface)',
                    border: `2px solid ${mesaSeleccionada === m.id ? est.color : m.estado === 'libre' ? 'var(--color-border)' : est.color + '66'}`,
                    borderRadius: 'var(--radius)',
                    padding: '1rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 14px 28px -14px ${est.color}aa` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
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

            {mesa.estado === 'reservada' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: '#0c1e3a', border: '1px solid #3b82f6', borderRadius: '0.625rem', padding: '0.875rem' }}>
                  <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: '0.35rem' }}>📅 Reservada</div>
                  <div style={{ fontSize: '0.9rem' }}>{mesa.reserva?.nombre}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    {mesa.reserva?.hora && `🕐 ${mesa.reserva.hora} · `}{mesa.reserva?.personas} pers.
                    {mesa.reserva?.telefono && ` · ☎ ${mesa.reserva.telefono}`}
                  </div>
                </div>
                <button onClick={() => { sentarReserva(mesa.id, mesa.reserva?.nombre || '') }} style={btn('#10b981', { width: '100%' })}>▶ Sentar (abrir mesa)</button>
                <button onClick={() => cancelarReserva(mesa.id)} style={btn('#334155', { width: '100%', fontSize: '0.8rem' })}>Cancelar reserva</button>
              </div>
            ) : mesa.estado === 'libre' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Mesa libre — sin pedidos</p>
                {!reservando ? (
                  <button onClick={() => { setReservaForm({ nombre: '', hora: '', personas: mesa.capacidad }); setReservando(true) }} style={btn('#3b82f6', { width: '100%' })}>📅 Reservar mesa</button>
                ) : (
                  <div style={{ background: '#0f172a', borderRadius: '0.625rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #3b82f6' }}>
                    <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.9rem' }}>Nueva reserva</div>
                    <input value={reservaForm.nombre} onChange={e => setReservaForm(s => ({ ...s, nombre: e.target.value }))} placeholder="Nombre" style={inp} autoFocus />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input value={reservaForm.hora} onChange={e => setReservaForm(s => ({ ...s, hora: e.target.value }))} type="time" style={{ ...inp, flex: 1 }} />
                      <input value={reservaForm.personas} onChange={e => setReservaForm(s => ({ ...s, personas: e.target.value }))} type="number" min="1" placeholder="Pers." style={{ ...inp, width: '80px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setReservando(false)} style={btn('#334155', { flex: 1, fontSize: '0.8rem' })}>Cancelar</button>
                      <button onClick={() => { reservarMesa(mesa.id, reservaForm); setReservando(false) }} disabled={!reservaForm.nombre.trim()} style={btn(reservaForm.nombre.trim() ? '#3b82f6' : '#334155', { flex: 1, fontSize: '0.8rem' })}>Guardar</button>
                    </div>
                  </div>
                )}
              </div>
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
                            <button onClick={() => setCobro({ tipo: 'persona', personaId: p.id, importe: aPagar })} style={btn('#10b981', { fontSize: '0.78rem', padding: '0.35rem 0.75rem' })}>Cobrar</button>
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
                  {mesa.personas.some(p => !p.pagado) && (
                    <button onClick={() => setCobro({ tipo: 'mesa', importe: mesa.personas.filter(p => !p.pagado).reduce((s, p) => s + (owed[p.id] || 0), 0) })} style={btn('#10b981', { width: '100%' })}>
                      💶 Cobrar mesa — elegir método
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

      {ticket && (ticket.mesa || mesa) && (
        <Ticket tipo={ticket.tipo} mesa={ticket.mesa || mesa} persona={ticket.persona} onClose={() => setTicket(null)} />
      )}

      {cobro && mesa && (
        <MetodoPago
          titulo={cobro.tipo === 'mesa' ? `Cobrar Mesa ${mesa.numero}` : 'Cobrar cliente'}
          importe={cobro.importe}
          onCerrar={() => setCobro(null)}
          onElegir={(metodo) => {
            if (cobro.tipo === 'mesa') cobrarMesa(mesa.id, { metodo, cobradoPor: 'Mostrador' })
            else pagarParte(mesa.id, cobro.personaId, { metodo, cobradoPor: 'Mostrador' })
            setCobro(null)
          }}
        />
      )}

      {verReservas && (
        <div onClick={() => setVerReservas(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '420px', maxWidth: '94vw', background: 'var(--color-surface)', height: '100%', overflowY: 'auto', padding: '1.25rem', borderLeft: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>📅 Reservas</h2>
              <button onClick={() => setVerReservas(false)} style={btn('#1e293b')}>✕</button>
            </div>
            <ReservasManager onSentada={(mesaId) => { setVerReservas(false); if (mesaId) setMesaSeleccionada(mesaId) }} />
          </div>
        </div>
      )}

      {verHistorial && (
        <div onClick={() => setVerHistorial(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '380px', maxWidth: '92vw', background: 'var(--color-surface)', height: '100%', overflowY: 'auto', padding: '1.25rem', borderLeft: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>🧾 Cerradas hoy</h2>
              <button onClick={() => setVerHistorial(false)} style={btn('#1e293b')}>✕</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--color-muted)' }}>
              <span>{cerradasHoy.length} ticket(s)</span>
              <span>Total: <strong style={{ color: '#f97316' }}>{cerradasHoy.reduce((s, r) => s + r.total, 0).toFixed(2)} €</strong></span>
            </div>
            {cerradasHoy.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Aún no se ha cerrado ninguna mesa hoy.</p>}
            {cerradasHoy.map(r => (
              <div key={r.id} style={{ background: '#0f172a', borderRadius: '0.625rem', padding: '0.75rem 0.875rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Mesa {r.mesaNumero}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{new Date(r.cerradaEn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {r.total.toFixed(2)} €</div>
                </div>
                <button onClick={() => setTicket({ tipo: 'cuenta', mesa: { numero: r.mesaNumero, personas: r.personas } })} style={btn('#f97316', { fontSize: '0.78rem', padding: '0.4rem 0.7rem' })}>Ver ticket</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const btn = (bg, extra = {}) => ({
  background: bg,
  color: 'white',
  border: 'none',
  borderRadius: '0.55rem',
  padding: '0.5rem 1rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.875rem',
  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  ...extra,
})

const inp = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.7rem', color: 'var(--color-text)', fontSize: '0.85rem', width: '100%' }
