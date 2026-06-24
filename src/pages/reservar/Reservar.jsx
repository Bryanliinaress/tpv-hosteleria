import { useState } from 'react'
import { useStore } from '../../store/useStore'

// Fecha de hoy en formato YYYY-MM-DD (hora local)
const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const HORAS = ['13:00', '13:30', '14:00', '14:30', '15:00', '20:30', '21:00', '21:30', '22:00', '22:30']
const fechaBonita = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}` }

// Reserva online del cliente (estilo CoverManager): fecha, hora, personas y
// zona preferida. Se confirma al instante; el local la gestiona en su panel.
export default function Reservar() {
  const { mesas, crearReserva } = useStore()
  const zonas = [...new Set(mesas.map(m => m.zona).filter(Boolean))]

  const [form, setForm] = useState({ fecha: hoyLocal(), hora: '', personas: 2, zona: '', nombre: '', telefono: '', notas: '' })
  const [hecha, setHecha] = useState(null) // datos de la reserva confirmada

  const set = (campo, val) => setForm(s => ({ ...s, [campo]: val }))
  const valido = form.fecha && form.hora && form.nombre.trim() && form.personas >= 1

  const enviar = () => {
    if (!valido) return
    crearReserva(form)
    setHecha({ ...form })
  }

  // ── Pantalla de confirmación ──────────────────────────
  if (hecha) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center', borderColor: '#10b981' }}>
          <div style={{ fontSize: '3.5rem' }}>✅</div>
          <h1 style={{ fontWeight: 800, fontSize: '1.5rem', margin: '0.5rem 0' }}>¡Reserva confirmada!</h1>
          <p style={{ color: 'var(--color-muted)', marginBottom: '1rem' }}>Te esperamos, {hecha.nombre}.</p>
          <div style={{ background: '#0f172a', borderRadius: '0.75rem', padding: '1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Fila k="📅 Día" v={fechaBonita(hecha.fecha)} />
            <Fila k="🕐 Hora" v={hecha.hora} />
            <Fila k="👥 Personas" v={hecha.personas} />
            {hecha.zona && <Fila k="📍 Zona" v={hecha.zona} />}
            {hecha.telefono && <Fila k="☎ Teléfono" v={hecha.telefono} />}
            {hecha.notas && <Fila k="📝 Notas" v={hecha.notas} />}
          </div>
          <button onClick={() => { setForm({ fecha: hoyLocal(), hora: '', personas: 2, zona: '', nombre: '', telefono: '', notas: '' }); setHecha(null) }} style={btn('#f97316', { marginTop: '1.25rem', width: '100%', padding: '0.85rem', fontSize: '1rem' })}>Hacer otra reserva</button>
        </div>
      </div>
    )
  }

  // ── Formulario de reserva ─────────────────────────────
  return (
    <div style={wrap}>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '2.75rem' }}>📅</div>
        <h1 style={{ fontWeight: 800, fontSize: '1.6rem' }}>Reservar mesa</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Elige día, hora y personas. Confirmación inmediata.</p>
      </div>

      <div style={card}>
        <p style={lbl}>Día</p>
        <input type="date" value={form.fecha} min={hoyLocal()} onChange={e => set('fecha', e.target.value)} style={inp} />

        <p style={lbl}>Hora</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
          {HORAS.map(h => (
            <button key={h} onClick={() => set('hora', h)} style={btn(form.hora === h ? '#f97316' : '#1e293b', { fontSize: '0.82rem', padding: '0.45rem 0.7rem' })}>{h}</button>
          ))}
        </div>
        <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} placeholder="Otra hora" style={inp} />

        <p style={lbl}>Personas</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => set('personas', Math.max(1, form.personas - 1))} style={btn('#334155', { padding: '0.4rem 0.95rem', fontSize: '1.1rem' })}>−</button>
          <span style={{ fontWeight: 800, fontSize: '1.3rem', minWidth: '2rem', textAlign: 'center' }}>{form.personas}</span>
          <button onClick={() => set('personas', form.personas + 1)} style={btn('#334155', { padding: '0.4rem 0.95rem', fontSize: '1.1rem' })}>+</button>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>personas</span>
        </div>

        {zonas.length > 0 && (
          <>
            <p style={lbl}>Zona preferida (opcional)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button onClick={() => set('zona', '')} style={btn(form.zona === '' ? '#3b82f6' : '#1e293b', { fontSize: '0.82rem', padding: '0.45rem 0.8rem' })}>Sin preferencia</button>
              {zonas.map(z => (
                <button key={z} onClick={() => set('zona', z)} style={btn(form.zona === z ? '#3b82f6' : '#1e293b', { fontSize: '0.82rem', padding: '0.45rem 0.8rem' })}>{z}</button>
              ))}
            </div>
          </>
        )}

        <p style={lbl}>Tus datos</p>
        <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre y apellidos" style={inp} />
        <input value={form.telefono} onChange={e => set('telefono', e.target.value)} inputMode="tel" placeholder="Teléfono (opcional)" style={inp} />
        <input value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Notas: alergias, trona, celebración… (opcional)" style={inp} />

        <button onClick={enviar} disabled={!valido} style={btn(valido ? '#10b981' : '#334155', { width: '100%', padding: '0.9rem', fontSize: '1rem', marginTop: '0.75rem', cursor: valido ? 'pointer' : 'not-allowed' })}>
          Confirmar reserva
        </button>
        {!valido && <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center', marginTop: '0.5rem' }}>Elige hora y escribe tu nombre para continuar.</p>}
      </div>
    </div>
  )
}

const Fila = ({ k, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
    <span style={{ color: 'var(--color-muted)' }}>{k}</span><strong>{v}</strong>
  </div>
)

const wrap = { maxWidth: '480px', margin: '0 auto', minHeight: '100vh', padding: '1.5rem 1.25rem' }
const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.875rem', padding: '1.25rem' }
const lbl = { fontSize: '0.72rem', color: 'var(--color-muted)', margin: '0.9rem 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inp = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', color: 'var(--color-text)', fontSize: '0.95rem', width: '100%', marginBottom: '0.4rem' }
const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
