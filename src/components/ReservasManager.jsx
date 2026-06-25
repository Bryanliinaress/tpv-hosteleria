import { useState } from 'react'
import { useStore, generarSlots, aforoTotal, ocupacionEn } from '../store/useStore'
import { enviarEmailReserva } from '../lib/email'

const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fechaBonita = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}` }

// Envía un correo de confirmación o recordatorio de la reserva.
const enviarCorreo = async (tipo, r) => {
  try {
    const { via } = await enviarEmailReserva(tipo, r)
    if (via === 'emailjs') alert(`✅ Correo de ${tipo} enviado a ${r.email}`)
  } catch (e) {
    alert('No se pudo enviar el correo: ' + e.message)
  }
}

const EST = {
  confirmada: { label: 'Confirmada', color: '#3b82f6' },
  sentada: { label: 'Sentada', color: '#10b981' },
  cancelada: { label: 'Cancelada', color: '#6b7280' },
  no_show: { label: 'No-show', color: '#f43f5e' },
}

// Agenda de reservas con gestión (asignar mesa, sentar, cancelar, no-show).
// Reutilizable en Admin (pestaña) y Camarero (drawer). `onSentada` se llama
// con el mesaId tras sentar (para que el contenedor pueda navegar si quiere).
export default function ReservasManager({ onSentada }) {
  const { reservas, mesas, reservasConfig: cfg, asignarReservaMesa, sentarReservaAgenda, cambiarEstadoReserva } = useStore()
  const hoy = hoyLocal()
  const [filtro, setFiltro] = useState('hoy') // hoy | proximas | todas
  const [vista, setVista] = useState('agenda') // agenda | servicio
  const [fechaSrv, setFechaSrv] = useState(hoy)

  const visibles = reservas
    .filter(r => {
      if (filtro === 'hoy') return r.fecha === hoy
      if (filtro === 'proximas') return r.fecha >= hoy
      return true
    })
    .filter(r => filtro === 'todas' || r.estado === 'confirmada' || r.estado === 'sentada')
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))

  // Agrupa por fecha
  const porFecha = {}
  visibles.forEach(r => { (porFecha[r.fecha] ||= []).push(r) })
  const fechas = Object.keys(porFecha).sort()

  const pendientesHoy = reservas.filter(r => r.fecha === hoy && r.estado === 'confirmada').length

  // Mesas candidatas para asignar a una reserva: libres (+ la ya asignada),
  // ordenadas por coincidencia de zona y capacidad suficiente.
  const candidatas = (r) => mesas
    .filter(m => m.estado === 'libre' || m.id === r.mesaId)
    .sort((a, b) => {
      const za = (a.zona === r.zona ? 0 : 1), zb = (b.zona === r.zona ? 0 : 1)
      if (za !== zb) return za - zb
      const fa = a.capacidad >= r.personas ? 0 : 1, fb = b.capacidad >= r.personas ? 0 : 1
      if (fa !== fb) return fa - fb
      return a.numero - b.numero
    })

  const sentar = (id) => { const pid = sentarReservaAgenda(id); const r = reservas.find(x => x.id === id); if (pid && onSentada) onSentada(r?.mesaId) }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        {[{ id: 'agenda', t: '📋 Agenda' }, { id: 'servicio', t: '📊 Servicio' }].map(o => (
          <button key={o.id} onClick={() => setVista(o.id)} style={btn(vista === o.id ? '#3b82f6' : '#1e293b', { flex: 1, fontSize: '0.82rem' })}>{o.t}</button>
        ))}
      </div>

      {vista === 'servicio' && <Servicio cfg={cfg} mesas={mesas} reservas={reservas} fecha={fechaSrv} setFecha={setFechaSrv} />}

      {vista === 'agenda' && (<>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        {[{ id: 'hoy', t: `Hoy${pendientesHoy ? ` (${pendientesHoy})` : ''}` }, { id: 'proximas', t: 'Próximas' }, { id: 'todas', t: 'Todas' }].map(o => (
          <button key={o.id} onClick={() => setFiltro(o.id)} style={btn(filtro === o.id ? '#f97316' : '#1e293b', { flex: 1, fontSize: '0.82rem' })}>{o.t}</button>
        ))}
      </div>

      {visibles.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
          No hay reservas {filtro === 'hoy' ? 'para hoy' : filtro === 'proximas' ? 'próximas' : ''}.
        </div>
      )}

      {fechas.map(f => (
        <div key={f} style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-muted)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            {f === hoy ? 'Hoy' : fechaBonita(f)} · {porFecha[f].length} reserva(s)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {porFecha[f].map(r => {
              const est = EST[r.estado] || EST.confirmada
              const mesaAsignada = mesas.find(m => m.id === r.mesaId)
              const activa = r.estado === 'confirmada'
              return (
                <div key={r.id} style={{ background: 'var(--color-surface)', border: `1px solid ${est.color}55`, borderRadius: '0.75rem', padding: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>🕐 {r.hora}</span>
                      <span style={{ fontWeight: 700 }}>{r.nombre}</span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: est.color, fontWeight: 700, background: est.color + '22', borderRadius: '9999px', padding: '0.15rem 0.6rem' }}>{est.label}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: r.notas ? '0.25rem' : '0.5rem' }}>
                    👥 {r.personas} pers.{r.zona && ` · 📍 ${r.zona}`}{r.email && ` · ✉️ ${r.email}`}
                    {mesaAsignada && <span style={{ color: '#60a5fa' }}> · 🍽 Mesa {mesaAsignada.numero}</span>}
                  </div>
                  {r.notas && <div style={{ fontSize: '0.78rem', color: '#fbbf24', marginBottom: '0.5rem' }}>📝 {r.notas}</div>}

                  {activa && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                      <select value={r.mesaId || ''} onChange={e => e.target.value && asignarReservaMesa(r.id, e.target.value)} style={sel}>
                        <option value="">Asignar mesa…</option>
                        {candidatas(r).map(m => (
                          <option key={m.id} value={m.id}>Mesa {m.numero} · {m.zona} · {m.capacidad}p{m.capacidad < r.personas ? ' ⚠' : ''}</option>
                        ))}
                      </select>
                      <button onClick={() => sentar(r.id)} disabled={!r.mesaId} title={r.mesaId ? '' : 'Asigna una mesa primero'} style={btn(r.mesaId ? '#10b981' : '#334155', { fontSize: '0.8rem', cursor: r.mesaId ? 'pointer' : 'not-allowed' })}>▶ Sentar</button>
                      {r.email && <button onClick={() => enviarCorreo('confirmacion', r)} title={`Confirmación a ${r.email}`} style={btn('#16a34a', { fontSize: '0.8rem' })}>✉️ Confirmar</button>}
                      {r.email && <button onClick={() => enviarCorreo('recordatorio', r)} title={`Recordatorio a ${r.email}`} style={btn('#1d4ed8', { fontSize: '0.8rem' })}>🔔 Recordar</button>}
                      <button onClick={() => cambiarEstadoReserva(r.id, 'no_show')} style={btn('#7f1d1d', { fontSize: '0.8rem' })}>No-show</button>
                      <button onClick={() => cambiarEstadoReserva(r.id, 'cancelada')} style={btn('#334155', { fontSize: '0.8rem' })}>Cancelar</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      </>)}
    </div>
  )
}

// Vista de servicio: ocupación por franja horaria del día elegido.
function Servicio({ cfg, mesas, reservas, fecha, setFecha }) {
  const aforo = aforoTotal(cfg, mesas)
  const slots = generarSlots(cfg)
  const delDia = reservas.filter(r => r.fecha === fecha && (r.estado === 'confirmada' || r.estado === 'sentada'))
  const coversDia = delDia.reduce((s, r) => s + r.personas, 0)

  // Agrupa los slots por turno
  const porTurno = {}
  slots.forEach(s => { (porTurno[s.turnoNombre] ||= []).push(s) })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.45rem 0.6rem', color: 'var(--color-text)', fontSize: '0.85rem' }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{delDia.length} reserva(s) · <strong style={{ color: '#f97316' }}>{coversDia}</strong> comensales · aforo {aforo}</span>
      </div>

      {slots.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>No hay turnos configurados.</p>}

      {Object.entries(porTurno).map(([turno, ss]) => (
        <div key={turno} style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>{turno}</div>
          {ss.map(s => {
            const ocup = ocupacionEn(reservas, cfg, fecha, s.hora)
            const pct = aforo ? Math.min(100, Math.round(ocup / aforo * 100)) : 0
            const col = pct >= 100 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : '#10b981'
            const enSlot = delDia.filter(r => r.hora === s.hora)
            return (
              <div key={s.hora} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <span style={{ width: '3rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>{s.hora}</span>
                <div style={{ flex: 1, background: '#0f172a', borderRadius: '9999px', height: '1.1rem', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: col, transition: 'width 0.2s' }} />
                  <span style={{ position: 'absolute', left: '0.5rem', top: 0, lineHeight: '1.1rem', fontSize: '0.68rem', color: '#e2e8f0' }}>{ocup}/{aforo}{enSlot.length ? ` · ${enSlot.map(r => r.nombre.split(' ')[0]).join(', ')}` : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 0.8rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
const sel = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.45rem 0.6rem', color: 'var(--color-text)', fontSize: '0.8rem', flex: '1 1 160px' }
