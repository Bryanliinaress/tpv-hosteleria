import { useState, useEffect, useRef } from 'react'
import { useStore, owedPorPersona } from '../../store/useStore'
import Ticket from '../../components/Ticket'
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

const ZONAS = [
  { id: 'terraza', nombre: '🌳 Terraza', test: n => n <= 4 },
  { id: 'interior', nombre: '🪟 Interior', test: n => n >= 5 && n <= 8 },
  { id: 'salon', nombre: '🍽 Salón', test: n => n >= 9 },
]

function haceCuanto(iso) {
  if (!iso) return ''
  const min = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h`
}

export default function PdaCamarero() {
  const { carta, mesas, pedidosCocina, pedidosBarra, avisos, atenderAviso, pagarParte, liberarMesa, unirseAMesa, servirMesa, anularItem, toggleDisponible, fusionarMesa, transferirComensal } = useStore()
  const [mover, setMover] = useState(null) // { tipo:'mesa'|'comensal', personaId? }
  const [sonido, setSonido] = useState(true)
  const prevIds = useRef(null)
  const [vista, setVista] = useState('avisos') // avisos | mesas
  const [mesaId, setMesaId] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [pidiendo, setPidiendo] = useState(false)
  const [cobrando, setCobrando] = useState(false)

  const mesa = mesas.find(m => m.id === mesaId)
  const ocupadas = mesas.filter(m => m.estado !== 'libre')

  // ── Feed de eventos ───────────────────────────────────
  const eventos = []
  avisos.forEach(a => eventos.push({ id: a.id, prio: 0, tipo: 'llamada', mesaId: a.mesaId, mesaNumero: a.mesaNumero, texto: `${a.personaNombre || 'Alguien'} te llama`, hora: a.hora, avisoId: a.id }))
  const listos = [...pedidosCocina, ...pedidosBarra].filter(p => p.estado === 'listo')
  const porMesa = {}
  listos.forEach(p => { (porMesa[p.mesaId] ||= []).push(p) })
  Object.entries(porMesa).forEach(([mid, arr]) => {
    const m = mesas.find(x => x.id === mid)
    eventos.push({ id: 'listo-' + mid, prio: 1, tipo: 'listo', mesaId: mid, mesaNumero: m?.numero ?? arr[0].mesaNumero, texto: `${arr.reduce((s, x) => s + x.cantidad, 0)} listo(s) para servir`, hora: arr[0].horaEntrada, items: arr })
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
          <button onClick={() => setMesaId(null)} style={btn('#1e293b', { padding: '0.4rem 0.7rem' })}>←</button>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mesa {mesa.numero}</div>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#f97316' }}>{totalMesa.toFixed(2)} €</span>
        </div>

        <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mesa.estado === 'libre' && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🪑</div>
              <p style={{ marginBottom: '1.25rem' }}>Mesa libre · {mesa.capacidad} plazas</p>
              <button onClick={() => { const n = prompt('Nombre del primer comensal (opcional):') ?? ''; unirseAMesa(mesa.id, n) }} style={btn('#10b981', { padding: '0.8rem 1.5rem', fontSize: '0.95rem' })}>▶ Abrir mesa</button>
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
                      <button onClick={() => { if (confirm(`¿Anular ${it.cantidad}× ${it.nombre}?`)) anularItem(mesa.id, p.id, it.uid) }} title="Anular" style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '0.9rem', padding: '0 0.25rem' }}>✕</button>
                    </div>
                  ))}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <button onClick={() => setTicket({ tipo: 'persona', persona: p })} style={btn('#1e293b', { flex: 1 })}>🧾 Ticket</button>
                  <button onClick={() => setMover({ tipo: 'comensal', personaId: p.id })} title="Mover a otra mesa" style={btn('#1e293b', { padding: '0.55rem 0.7rem' })}>⇄</button>
                  {!p.pagado && <button onClick={() => pagarParte(mesa.id, p.id)} style={btn('#10b981', { flex: 1 })}>Cobrar</button>}
                </div>
              </div>
            )
          })}

          {mesa.estado !== 'libre' && (
            <>
              <button onClick={() => setPidiendo(true)} style={btn('#f97316', { width: '100%', padding: '0.75rem', fontSize: '0.95rem' })}>➕ Añadir pedido</button>
              <button onClick={() => setCobrando(true)} style={btn('#10b981', { width: '100%', padding: '0.75rem', fontSize: '0.95rem' })}>💶 Cobrar mesa</button>
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
        {cobrando && <CobroMesa mesa={mesa} onCerrar={() => setCobrando(false)} onCobrar={() => { liberarMesa(mesa.id); setCobrando(false); setMesaId(null) }} />}

        {mover && (
          <div onClick={() => setMover(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 80 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem', padding: '1.15rem', width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto' }}>
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
        <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>📟 PDA Camarero</div>
        <button onClick={() => setSonido(s => !s)} title="Aviso sonoro" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>{sonido ? '🔔' : '🔕'}</button>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{ocupadas.length}/{mesas.length}</span>
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
          {ZONAS.map(z => (
            <div key={z.id}>
              <div style={{ fontWeight: 700, color: 'var(--color-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{z.nombre}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                {mesas.filter(m => z.test(m.numero)).map(m => {
                  const libre = m.estado === 'libre'
                  const total = m.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
                  const col = libre ? '#10b981' : m.estado === 'esperando_cobro' ? '#f43f5e' : '#f59e0b'
                  const etiqueta = libre ? 'Libre' : m.estado === 'esperando_cobro' ? 'Pide cuenta' : 'Ocupada'
                  return (
                    <button key={m.id} onClick={() => setMesaId(m.id)} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: col + '66', background: libre ? 'var(--color-surface)' : col + '14' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>M{m.numero}</span>
                        <span style={{ fontSize: '0.66rem', color: col, fontWeight: 700, background: col + '22', borderRadius: '9999px', padding: '0.1rem 0.5rem' }}>{etiqueta}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{m.capacidad} plazas</div>
                      {libre
                        ? <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem', fontWeight: 600 }}>Toca para abrir ▶</div>
                        : <>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{m.personas.length} comensales · ⏱ {haceCuanto(m.abiertaDesde)}</div>
                            <div style={{ fontWeight: 700, color: '#f97316', marginTop: '0.25rem' }}>{total.toFixed(2)} €</div>
                          </>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
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

      {/* Navegación inferior */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', maxWidth: '520px', margin: '0 auto' }}>
        {[{ id: 'avisos', label: 'Avisos', emoji: '🔔', n: eventos.length }, { id: 'mesas', label: 'Mesas', emoji: '🍽', n: ocupadas.length }, { id: 'carta', label: 'Carta', emoji: '📋', n: carta.productos.filter(p => !p.disponible).length }].map(t => (
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

const cab = { position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }
const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.875rem' }
const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
