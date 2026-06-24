import { useState } from 'react'
import { useStore } from '../store/useStore'

const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fechaBonita = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}` }

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
  const { reservas, mesas, asignarReservaMesa, sentarReservaAgenda, cambiarEstadoReserva } = useStore()
  const hoy = hoyLocal()
  const [filtro, setFiltro] = useState('hoy') // hoy | proximas | todas

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
                    👥 {r.personas} pers.{r.zona && ` · 📍 ${r.zona}`}{r.telefono && ` · ☎ ${r.telefono}`}
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
    </div>
  )
}

const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 0.8rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
const sel = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.45rem 0.6rem', color: 'var(--color-text)', fontSize: '0.8rem', flex: '1 1 160px' }
