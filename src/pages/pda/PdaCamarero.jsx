import { useState, useEffect, useRef } from 'react'
import { useStore, owedPorPersona, TIEMPOS } from '../../store/useStore'
import { useEmpleadoActual, clearSesion } from '../../lib/sesion'
import { confirmar, pedirTexto, toast } from '../../store/useUI'
import Ticket from '../../components/Ticket'
import MetodoPago from '../../components/MetodoPago'
import PedirPda from './PedirPda'
import CobroMesa from './CobroMesa'

// Pitido + vibración para avisar de eventos nuevos
function alerta() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = 880; g.gain.value = 0.08
    o.start(); o.stop(ctx.currentTime + 0.18)
  } catch { /* sin audio */ }
  navigator.vibrate?.([120, 60, 120])
}

function haceCuanto(iso) {
  if (!iso) return ''
  const min = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h`
}

export default function PdaCamarero() {
  const { carta, mesas, pedidosCocina, pedidosBarra, avisos, historial, atenderAviso, pagarParte, cobrarMesa, liberarMesa, unirseAMesa, servirMesa, anularItem, toggleDisponible, fusionarMesa, transferirComensal, asignarCamarero, reservarMesa, cancelarReserva, sentarReserva, marcharSiguiente } = useStore()
  const [mover, setMover] = useState(null) // { tipo:'mesa'|'comensal', personaId? }
  const empleado = useEmpleadoActual()
  const camarero = empleado?.nombre || ''
  const [soloMias, setSoloMias] = useState(false)
  const [sonido, setSonido] = useState(true)
  const prevIds = useRef(null)
  const [vista, setVista] = useState('avisos') // avisos | mesas
  const [mesaId, setMesaId] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [pidiendo, setPidiendo] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [cobroPersona, setCobroPersona] = useState(null) // { personaId, importe }
  const [reservando, setReservando] = useState(false)
  const [reservaForm, setReservaForm] = useState({ nombre: '', hora: '', personas: 2 })

  const mesa = mesas.find(m => m.id === mesaId)
  const ocupadas = mesas.filter(m => m.estado !== 'libre')
  const zonasSala = [...new Set(mesas.map(m => m.zona || 'Sala'))]

  // Resumen del turno de este camarero (tickets de hoy atendidos por él)
  const hoyStr = new Date().toDateString()
  const misTickets = historial.filter(r => r.camarero === camarero && new Date(r.cerradaEn).toDateString() === hoyStr)
  const ventasTurno = misTickets.reduce((s, r) => s + r.total, 0)
  const propinasTurno = misTickets.reduce((s, r) => s + (r.propina || 0), 0)

  // ── Feed de eventos ───────────────────────────────────
  const eventos = []
  avisos.forEach(a => eventos.push({ id: a.id, prio: 0, tipo: 'llamada', mesaId: a.mesaId, mesaNumero: a.mesaNumero, texto: `${a.personaNombre || 'Alguien'} te llama`, hora: a.hora, avisoId: a.id }))
  const listos = [...pedidosCocina, ...pedidosBarra].filter(p => p.estado === 'listo')
  const porMesa = {}
  listos.forEach(p => { (porMesa[p.mesaId] ||= []).push(p) })
  Object.entries(porMesa).forEach(([mid, arr]) => {
    const m = mesas.find(x => x.id === mid)
    const pendientes = [...pedidosCocina, ...pedidosBarra].filter(p => p.mesaId === mid && p.estado !== 'listo')
    eventos.push({ id: 'listo-' + mid, prio: 1, tipo: 'listo', mesaId: mid, mesaNumero: m?.numero ?? arr[0].mesaNumero, texto: `${arr.reduce((s, x) => s + x.cantidad, 0)} listo(s) para servir`, hora: arr[0].horaEntrada, items: arr, pendientes })
  })
  mesas.filter(m => m.estado === 'esperando_cobro').forEach(m => eventos.push({ id: 'cuenta-' + m.id, prio: 2, tipo: 'cuenta', mesaId: m.id, mesaNumero: m.numero, texto: 'Pide la cuenta', hora: m.abiertaDesde }))
  eventos.sort((a, b) => a.prio - b.prio || new Date(a.hora) - new Date(b.hora))

  // Aviso sonoro al entrar un evento nuevo
  const idsActuales = eventos.map(e => e.id).sort().join('|')
  useEffect(() => {
    if (prevIds.current !== null && sonido) {
      const antes = new Set(prevIds.current.split('|').filter(Boolean))
      if (idsActuales.split('|').filter(Boolean).some(id => !antes.has(id))) alerta()
    }
    prevIds.current = idsActuales
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsActuales])

  const EV = {
    llamada: { color: '#f59e0b', bg: '#2d1900', emoji: '🔔' },
    listo: { color: '#10b981', bg: '#052e16', emoji: '✅' },
    cuenta: { color: '#f43f5e', bg: '#2d0a14', emoji: '💶' },
  }

  // ── Detalle de mesa ───────────────────────────────────
  if (mesa) {
    const owed = owedPorPersona(mesa)
    const totalMesa = mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
    return (
      <div style={{ minHeight: '100vh', maxWidth: '520px', margin: '0 auto' }}>
        <div style={cab}>
          <button onClick={() => { setReservando(false); setMesaId(null) }} style={btn('#1e293b', { padding: '0.4rem 0.7rem' })}>←</button>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mesa {mesa.numero}</div>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#f97316' }}>{totalMesa.toFixed(2)} €</span>
        </div>

        <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mesa.estado === 'libre' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--color-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🪑</div>
              <p style={{ marginBottom: '1.25rem' }}>Mesa libre · {mesa.capacidad} plazas</p>
              <button onClick={async () => { const n = await pedirTexto({ titulo: 'Abrir mesa', mensaje: 'Nombre del primer comensal (opcional)', placeholder: 'Nombre', confirmar: 'Abrir mesa' }); if (n === null) return; unirseAMesa(mesa.id, n); asignarCamarero(mesa.id, camarero) }} style={btn('#10b981', { padding: '0.8rem 1.5rem', fontSize: '0.95rem' })}>▶ Abrir mesa</button>
              {!reservando ? (
                <button onClick={() => { setReservaForm({ nombre: '', hora: '', personas: mesa.capacidad }); setReservando(true) }} style={btn('#3b82f6', { padding: '0.8rem 1.5rem', fontSize: '0.95rem', marginLeft: '0.5rem' })}>📅 Reservar</button>
              ) : (
                <div style={{ ...card, marginTop: '1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderColor: '#3b82f6' }}>
                  <div style={{ fontWeight: 700, color: '#60a5fa' }}>Nueva reserva</div>
                  <input value={reservaForm.nombre} onChange={e => setReservaForm(s => ({ ...s, nombre: e.target.value }))} placeholder="Nombre" style={inp} autoFocus />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input value={reservaForm.hora} onChange={e => setReservaForm(s => ({ ...s, hora: e.target.value }))} type="time" style={{ ...inp, flex: 1 }} />
                    <input value={reservaForm.personas} onChange={e => setReservaForm(s => ({ ...s, personas: e.target.value }))} type="number" min="1" style={{ ...inp, width: '80px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setReservando(false)} style={btn('#334155', { flex: 1 })}>Cancelar</button>
                    <button onClick={() => { reservarMesa(mesa.id, reservaForm); setReservando(false) }} disabled={!reservaForm.nombre.trim()} style={btn(reservaForm.nombre.trim() ? '#3b82f6' : '#334155', { flex: 1 })}>Guardar</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {mesa.estado === 'reservada' && (
            <div style={{ ...card, borderColor: '#3b82f6', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#60a5fa' }}>📅 Reservada</div>
                <div style={{ fontSize: '0.95rem', marginTop: '0.25rem' }}>{mesa.reserva?.nombre}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{mesa.reserva?.hora && `🕐 ${mesa.reserva.hora} · `}{mesa.reserva?.personas} pers.</div>
              </div>
              <button onClick={() => { sentarReserva(mesa.id, mesa.reserva?.nombre || ''); asignarCamarero(mesa.id, camarero) }} style={btn('#10b981', { width: '100%', padding: '0.75rem' })}>▶ Sentar (abrir mesa)</button>
              <button onClick={() => cancelarReserva(mesa.id)} style={btn('#334155', { width: '100%', fontSize: '0.85rem' })}>Cancelar reserva</button>
            </div>
          )}
          {mesa.personas.map(p => {
            const aPagar = owed[p.id] ?? 0
            return (
              <div key={p.id} style={{ ...card, borderColor: p.pagado ? '#10b981' : 'var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#f97316' }}>{p.nombre}</span>
                  {p.pagado
                    ? <span style={{ fontSize: '0.72rem', background: '#052e16', color: '#10b981', borderRadius: '9999px', padding: '0.15rem 0.6rem', fontWeight: 700 }}>✓ Pagado</span>
                    : <span style={{ fontWeight: 700, color: '#f97316' }}>{aPagar.toFixed(2)} €</span>}
                </div>
                {p.items.length === 0
                  ? <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>Sin pedidos</div>
                  : p.items.map(it => (
                    <div key={it.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--color-muted)', padding: '0.1rem 0' }}>
                      <span>{it.cantidad}× {it.nombre}{it.estado === 'pendiente' && ' ●'}</span>
                      <button onClick={async () => { if (await confirmar({ titulo: 'Anular línea', mensaje: `¿Anular ${it.cantidad}× ${it.nombre}?`, peligro: true, confirmar: 'Anular' })) { anularItem(mesa.id, p.id, it.uid); toast('Línea anulada', 'success') } }} title="Anular" style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '0.9rem', padding: '0 0.25rem' }}>✕</button>
                    </div>
                  ))}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <button onClick={() => setTicket({ tipo: 'persona', persona: p })} style={btn('#1e293b', { flex: 1 })}>🧾 Ticket</button>
                  <button onClick={() => setMover({ tipo: 'comensal', personaId: p.id })} title="Mover a otra mesa" style={btn('#1e293b', { padding: '0.55rem 0.7rem' })}>⇄</button>
                  {!p.pagado && <button onClick={() => setCobroPersona({ personaId: p.id, importe: aPagar })} style={btn('#10b981', { flex: 1 })}>Cobrar</button>}
                </div>
              </div>
            )
          })}

          {(mesa.estado === 'ocupada' || mesa.estado === 'esperando_cobro') && (
            <>
              {(() => {
                const enEspera = [...pedidosCocina, ...pedidosBarra].filter(p => p.mesaId === mesa.id && p.estado === 'espera')
                if (enEspera.length === 0) return null
                const t = Math.min(...enEspera.map(p => p.tiempo || 2))
                const n = enEspera.filter(p => (p.tiempo || 2) === t).reduce((s, p) => s + p.cantidad, 0)
                return (
                  <button onClick={() => { marcharSiguiente(mesa.id); toast(`¡Marchando ${TIEMPOS[t]?.largo?.toLowerCase() || ''}!`, 'success') }} style={btn('#7c3aed', { width: '100%', padding: '0.75rem', fontSize: '0.95rem' })}>
                    🔥 Marchar {TIEMPOS[t]?.largo?.toLowerCase()} ({n})
                  </button>
                )
              })()}
              <button onClick={() => { asignarCamarero(mesa.id, camarero); setPidiendo(true) }} style={btn('#f97316', { width: '100%', padding: '0.75rem', fontSize: '0.95rem' })}>➕ Añadir pedido</button>
              <button onClick={() => { asignarCamarero(mesa.id, camarero); setCobrando(true) }} style={btn('#10b981', { width: '100%', padding: '0.75rem', fontSize: '0.95rem' })}>💶 Cobrar mesa</button>
              <button onClick={() => setMover({ tipo: 'mesa' })} style={btn('#1e293b', { width: '100%', fontSize: '0.9rem' })}>🔀 Mover / Juntar mesa</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setTicket({ tipo: 'comanda' })} style={btn('#1e293b', { flex: 1 })}>🧾 Comanda</button>
                <button onClick={() => setTicket({ tipo: 'cuenta' })} style={btn('#1e293b', { flex: 1 })}>💶 Cuenta</button>
              </div>
              <button onClick={() => { liberarMesa(mesa.id); setMesaId(null) }} style={btn('#334155', { width: '100%', fontSize: '0.85rem' })}>Cerrar mesa sin cobrar</button>
            </>
          )}
        </div>

        {ticket && <Ticket tipo={ticket.tipo} mesa={mesa} persona={ticket.persona} onClose={() => setTicket(null)} />}
        {pidiendo && <PedirPda mesaId={mesa.id} onClose={() => setPidiendo(false)} />}
        {cobrando && <CobroMesa mesa={mesa} onCerrar={() => setCobrando(false)} onCobrar={(metodo) => { cobrarMesa(mesa.id, { metodo, cobradoPor: camarero }); setCobrando(false); setMesaId(null) }} />}
        {cobroPersona && (
          <MetodoPago
            titulo="Cobrar cliente"
            importe={cobroPersona.importe}
            onCerrar={() => setCobroPersona(null)}
            onElegir={(metodo) => { pagarParte(mesa.id, cobroPersona.personaId, { metodo, cobradoPor: camarero }); setCobroPersona(null) }}
          />
        )}

        {mover && (
          <div onClick={() => setMover(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 80, animation: 'fadeIn 0.2s ease both' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', padding: '1.15rem', width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto', borderTop: '1px solid var(--color-border)', boxShadow: '0 -22px 50px -20px rgba(0,0,0,0.8)', animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'var(--color-border)', margin: '-0.15rem auto 0.7rem' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>{mover.tipo === 'mesa' ? 'Mover / juntar a…' : 'Mover comensal a…'}</h3>
                <button onClick={() => setMover(null)} style={btn('#334155', { padding: '0.25rem 0.6rem' })}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {mesas.filter(m => m.id !== mesa.id).map(m => {
                  const libre = m.estado === 'libre'
                  return (
                    <button key={m.id} onClick={() => {
                      if (mover.tipo === 'mesa') { fusionarMesa(mesa.id, m.id); setMesaId(null) }
                      else { transferirComensal(mesa.id, mover.personaId, m.id) }
                      setMover(null)
                    }} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: (libre ? '#10b981' : '#f59e0b') + '66' }}>
                      <div style={{ fontWeight: 800 }}>M{m.numero}</div>
                      <div style={{ fontSize: '0.72rem', color: libre ? '#10b981' : '#f59e0b' }}>{libre ? 'Libre · mover aquí' : `Juntar (${m.personas.length})`}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vista principal (feed / mesas) ────────────────────
  return (
    <div style={{ minHeight: '100vh', maxWidth: '520px', margin: '0 auto', paddingBottom: '4.5rem' }}>
      <div style={cab}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>📟 {camarero}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>{ocupadas.length}/{mesas.length} mesas ocupadas</div>
        </div>
        <button onClick={() => setSonido(s => !s)} title="Aviso sonoro" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>{sonido ? '🔔' : '🔕'}</button>
        <button onClick={clearSesion} title="Cerrar sesión" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--color-muted)' }}>⎋</button>
      </div>

      {vista === 'avisos' && (
        <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {eventos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>☕</div>
              Todo en orden, sin avisos
            </div>
          )}
          {eventos.map(ev => {
            const e = EV[ev.tipo]
            return (
              <div key={ev.id} onClick={() => setMesaId(ev.mesaId)} style={{ ...card, background: e.bg, borderColor: e.color + '66', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ fontSize: '1.5rem' }}>{e.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: e.color }}>Mesa {ev.mesaNumero}</div>
                  <div style={{ fontSize: '0.85rem' }}>{ev.texto}</div>
                  {ev.tipo === 'listo' && (
                    <>
                      <div style={{ fontSize: '0.75rem', color: '#10b981' }}>{ev.items.map(i => `${i.cantidad}× ${i.nombre}`).join(', ')}</div>
                      {ev.pendientes.length > 0
                        ? <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.15rem' }}>⏳ Faltan {ev.pendientes.reduce((s, p) => s + p.cantidad, 0)}: {ev.pendientes.map(p => `${p.cantidad}× ${p.nombre} (${p.estado === 'preparando' ? 'preparándose' : p.estado === 'espera' ? 'sin marchar' : 'en cola'})`).join(', ')}</div>
                        : <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>✅ No queda nada más — puedes llevarlo todo</div>}
                    </>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{haceCuanto(ev.hora)}</div>
                </div>
                {ev.tipo === 'llamada' && (
                  <button onClick={e2 => { e2.stopPropagation(); atenderAviso(ev.avisoId) }} style={btn('#10b981', { padding: '0.45rem 0.8rem' })}>✓ Atender</button>
                )}
                {ev.tipo === 'listo' && (
                  <button onClick={e2 => { e2.stopPropagation(); servirMesa(ev.mesaId) }} style={btn('#10b981', { padding: '0.45rem 0.8rem' })}>✓ Servir</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {vista === 'mesas' && (
        <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setSoloMias(false)} style={btn(!soloMias ? '#f97316' : '#1e293b', { flex: 1, fontSize: '0.82rem' })}>Todas</button>
            <button onClick={() => setSoloMias(true)} style={btn(soloMias ? '#f97316' : '#1e293b', { flex: 1, fontSize: '0.82rem' })}>👤 Mis mesas</button>
          </div>
          {zonasSala.map(z => {
            const ms = mesas.filter(m => (m.zona || 'Sala') === z && (!soloMias || m.camarero === camarero))
            if (ms.length === 0) return null
            return (
            <div key={z}>
              <div style={{ fontWeight: 700, color: 'var(--color-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{z}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                {ms.map(m => {
                  const libre = m.estado === 'libre'
                  const reservada = m.estado === 'reservada'
                  const total = m.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
                  const col = libre ? '#10b981' : reservada ? '#3b82f6' : m.estado === 'esperando_cobro' ? '#f43f5e' : '#f59e0b'
                  const etiqueta = libre ? 'Libre' : reservada ? 'Reservada' : m.estado === 'esperando_cobro' ? 'Pide cuenta' : 'Ocupada'
                  return (
                    <button key={m.id} onClick={() => setMesaId(m.id)} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: col + '66', background: libre ? 'var(--color-surface)' : col + '14' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>M{m.numero}</span>
                        <span style={{ fontSize: '0.66rem', color: col, fontWeight: 700, background: col + '22', borderRadius: '9999px', padding: '0.1rem 0.5rem' }}>{etiqueta}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{m.capacidad} plazas</div>
                      {libre
                        ? <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem', fontWeight: 600 }}>Toca para abrir ▶</div>
                        : reservada
                        ? <div style={{ fontSize: '0.72rem', color: '#60a5fa', marginTop: '0.25rem' }}>📅 {m.reserva?.nombre}{m.reserva?.hora && ` · ${m.reserva.hora}`}</div>
                        : <>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{m.personas.length} comensales · ⏱ {haceCuanto(m.abiertaDesde)}</div>
                            <div style={{ fontWeight: 700, color: '#f97316', marginTop: '0.25rem' }}>{total.toFixed(2)} €</div>
                          </>}
                    </button>
                  )
                })}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {vista === 'carta' && (
        <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Marca un producto como agotado y desaparece al instante de la carta del cliente.</p>
          {carta.categorias.map(cat => (
            <div key={cat.id}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-muted)' }}>{cat.emoji} {cat.nombre}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {carta.productos.filter(p => p.categoria === cat.id).map(prod => (
                  <div key={prod.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: prod.disponible ? 1 : 0.55 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{prod.nombre}</span>
                    <button onClick={() => toggleDisponible(prod.id)} style={btn(prod.disponible ? '#10b981' : '#7f1d1d', { fontSize: '0.78rem', padding: '0.3rem 0.7rem' })}>
                      {prod.disponible ? 'Disponible' : '⛔ Agotado'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {vista === 'turno' && (
        <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ ...card, textAlign: 'center', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Tu turno · {camarero}</div>
            <div style={{ fontWeight: 800, fontSize: '2rem', color: '#f97316', marginTop: '0.25rem' }}>{ventasTurno.toFixed(2)} €</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>facturado hoy</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            <div style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#3b82f6' }}>{misTickets.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>mesas cobradas</div>
            </div>
            <div style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#10b981' }}>{propinasTurno.toFixed(2)} €</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>en propinas</div>
            </div>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Aquí se cuentan las mesas que has abierto/cobrado tú hoy. Tus mesas activas: <strong>{mesas.filter(m => m.camarero === camarero && m.estado !== 'libre').length}</strong>.</p>
        </div>
      )}

      {/* Navegación inferior */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: 'rgba(22,31,49,0.9)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: '1px solid var(--color-border)', boxShadow: '0 -8px 24px -12px rgba(0,0,0,0.7)', maxWidth: '520px', margin: '0 auto' }}>
        {[{ id: 'avisos', label: 'Avisos', emoji: '🔔', n: eventos.length }, { id: 'mesas', label: 'Mesas', emoji: '🍽', n: ocupadas.length }, { id: 'carta', label: 'Carta', emoji: '📋', n: carta.productos.filter(p => !p.disponible).length }, { id: 'turno', label: 'Turno', emoji: '👤', n: 0 }].map(t => (
          <button key={t.id} onClick={() => setVista(t.id)} style={{ flex: 1, background: 'none', border: 'none', padding: '0.75rem', cursor: 'pointer', color: vista === t.id ? '#f97316' : 'var(--color-muted)', fontWeight: vista === t.id ? 700 : 400, fontSize: '0.8rem' }}>
            <div style={{ fontSize: '1.3rem', position: 'relative', display: 'inline-block' }}>
              {t.emoji}
              {t.n > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-10px', background: t.id === 'avisos' ? '#f43f5e' : '#f97316', color: 'white', borderRadius: '9999px', fontSize: '0.6rem', padding: '0 4px', fontWeight: 700 }}>{t.n}</span>}
            </div>
            <div>{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

const cab = { position: 'sticky', top: 0, zIndex: 10, background: 'rgba(22,31,49,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid var(--color-border)', boxShadow: '0 6px 18px -10px rgba(0,0,0,0.6)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }
const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.875rem', boxShadow: 'var(--shadow-sm)' }
const inp = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', color: 'var(--color-text)', fontSize: '0.9rem', width: '100%' }
const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.55rem', padding: '0.55rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', ...extra })
