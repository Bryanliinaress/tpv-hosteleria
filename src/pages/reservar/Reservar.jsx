import { useState } from 'react'
import { useStore, generarSlots, slotDisponible, diaCerrado } from '../../store/useStore'

// ── utilidades de fecha ───────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const fechaISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hoyLocal = () => fechaISO(new Date())
const fechaBonita = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}` }
const minDe = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const DIA_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MES_AB = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const proximosDias = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d })

// Enlace para añadir la reserva a Google Calendar (hora local flotante).
const gcalLink = (r, dur) => {
  const [y, mo, da] = r.fecha.split('-').map(Number); const [h, mi] = r.hora.split(':').map(Number)
  const ini = new Date(y, mo - 1, da, h, mi); const fin = new Date(ini.getTime() + (dur || 90) * 60000)
  const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  const text = encodeURIComponent('Reserva de mesa')
  const det = encodeURIComponent(`${r.personas} personas · a nombre de ${r.nombre}`)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(ini)}/${fmt(fin)}&details=${det}`
}

const FORM0 = { fecha: '', hora: '', personas: 0, zona: '', nombre: '', telefono: '', notas: '' }

// Reserva online guiada paso a paso: personas → día → hora → datos.
// Pensada para ser muy simple en móvil y para usuarios de cualquier edad.
export default function Reservar() {
  const { mesas, reservas, reservasConfig: cfg, crearReserva, cambiarEstadoReserva } = useStore()
  const zonas = [...new Set(mesas.map(m => m.zona).filter(Boolean))]

  const [paso, setPaso] = useState(1)         // 1 personas · 2 día · 3 hora · 4 datos
  const [form, setForm] = useState(FORM0)
  const [hecha, setHecha] = useState(null)
  const [verMias, setVerMias] = useState(false)

  const set = (campo, val) => setForm(s => ({ ...s, [campo]: val }))

  // Reservas hechas desde este dispositivo que siguen activas
  const misIds = (() => { try { return JSON.parse(localStorage.getItem('tpv-mis-reservas') || '[]') } catch { return [] } })()
  const misReservas = reservas.filter(r => misIds.includes(r.id) && r.estado === 'confirmada' && r.fecha >= hoyLocal())

  // Horas disponibles para el día y nº de personas elegidos
  const esHoy = form.fecha === hoyLocal()
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes()
  const slots = (!form.fecha || !form.personas || diaCerrado(cfg, form.fecha))
    ? []
    : generarSlots(cfg).filter(s =>
        (!esHoy || minDe(s.hora) > ahoraMin) &&
        slotDisponible(cfg, mesas, reservas, form.fecha, s.hora, form.personas))
  const porTurno = {}
  slots.forEach(s => { (porTurno[s.turnoNombre] ||= []).push(s) })

  const confirmar = () => {
    const id = crearReserva(form)
    try {
      const mias = JSON.parse(localStorage.getItem('tpv-mis-reservas') || '[]')
      localStorage.setItem('tpv-mis-reservas', JSON.stringify([...mias, id]))
    } catch { /* noop */ }
    setHecha({ ...form, id })
  }
  const reiniciar = () => { setForm(FORM0); setPaso(1); setHecha(null) }

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
          </div>
          <a href={gcalLink(hecha, cfg.duracionMin)} target="_blank" rel="noreferrer" style={{ ...btn('#1e293b', { display: 'block', marginTop: '0.875rem', padding: '0.75rem', textDecoration: 'none' }) }}>📆 Añadir a mi calendario</a>
          <button onClick={reiniciar} style={btn('#f97316', { marginTop: '0.6rem', width: '100%', padding: '0.85rem', fontSize: '1rem' })}>Hacer otra reserva</button>
        </div>
      </div>
    )
  }

  // Resumen (chips) de lo ya elegido — se puede tocar para volver a ese paso
  const resumen = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginBottom: '1rem', minHeight: '1.9rem' }}>
      {form.personas > 0 && <Chip onClick={() => setPaso(1)}>👥 {form.personas}</Chip>}
      {form.fecha && <Chip onClick={() => setPaso(2)}>📅 {etiquetaDia(form.fecha)}</Chip>}
      {form.hora && <Chip onClick={() => setPaso(3)}>🕐 {form.hora}</Chip>}
    </div>
  )

  return (
    <div style={wrap}>
      {/* Cabecera + progreso */}
      <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '2.25rem' }}>📅</div>
        <h1 style={{ fontWeight: 800, fontSize: '1.5rem' }}>Reservar mesa</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
          {[1, 2, 3, 4].map(n => (
            <div key={n} style={{ width: paso === n ? '1.6rem' : '0.5rem', height: '0.5rem', borderRadius: '9999px', background: n <= paso ? '#f97316' : '#334155', transition: 'all 0.2s' }} />
          ))}
        </div>
      </div>

      {misReservas.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <button onClick={() => setVerMias(v => !v)} style={btn('#0c1e3a', { width: '100%', border: '1px solid #3b82f6', color: '#60a5fa', fontSize: '0.82rem' })}>
            🔔 Tienes {misReservas.length} reserva(s) · {verMias ? 'ocultar' : 'gestionar'}
          </button>
          {verMias && (
            <div style={{ ...card, marginTop: '0.5rem', padding: '0.75rem' }}>
              {misReservas.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0' }}>
                  <span style={{ fontSize: '0.85rem' }}>📅 {fechaBonita(r.fecha)} · 🕐 {r.hora} · 👥 {r.personas}</span>
                  <button onClick={() => { if (confirm('¿Cancelar esta reserva?')) cambiarEstadoReserva(r.id, 'cancelada') }} style={btn('#7f1d1d', { fontSize: '0.75rem', padding: '0.3rem 0.6rem' })}>Cancelar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {paso > 1 && resumen}

      <div style={card}>
        {/* PASO 1 · Personas */}
        {paso === 1 && (
          <Paso titulo="¿Cuántas personas?">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {Array.from({ length: Math.max(8, cfg.maxPersonasOnline) }, (_, i) => i + 1)
                .filter(n => n <= cfg.maxPersonasOnline)
                .map(n => (
                  <button key={n} onClick={() => { set('personas', n); setPaso(2) }} style={opcion(form.personas === n, { fontSize: '1.25rem', padding: '0.9rem 0' })}>{n}</button>
                ))}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.8rem', textAlign: 'center' }}>
              ¿Sois más de {cfg.maxPersonasOnline}? Llámanos y lo organizamos. 📞
            </p>
          </Paso>
        )}

        {/* PASO 2 · Día */}
        {paso === 2 && (
          <Paso titulo="¿Qué día?" onAtras={() => setPaso(1)}>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {proximosDias(21).map((d, i) => {
                const iso = fechaISO(d); const cerrado = diaCerrado(cfg, iso); const sel = form.fecha === iso
                return (
                  <button key={iso} disabled={cerrado} onClick={() => { set('fecha', iso); set('hora', ''); setPaso(3) }}
                    style={{ ...opcion(sel, { minWidth: '4.2rem', padding: '0.6rem 0.3rem', opacity: cerrado ? 0.35 : 1, cursor: cerrado ? 'not-allowed' : 'pointer' }), display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DIA_SEM[d.getDay()]}</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{d.getDate()}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{cerrado ? 'cerrado' : MES_AB[d.getMonth()]}</span>
                  </button>
                )
              })}
            </div>
            <label style={{ display: 'block', marginTop: '0.9rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>¿Otra fecha?</label>
            <input type="date" min={hoyLocal()} value={form.fecha} onChange={e => { set('fecha', e.target.value); set('hora', ''); if (e.target.value) setPaso(3) }} style={inp} />
          </Paso>
        )}

        {/* PASO 3 · Hora */}
        {paso === 3 && (
          <Paso titulo="¿A qué hora?" onAtras={() => setPaso(2)}>
            {diaCerrado(cfg, form.fecha) ? (
              <Aviso>🔒 Ese día está cerrado. <b onClick={() => setPaso(2)} style={enlace}>Elige otro día</b>.</Aviso>
            ) : slots.length === 0 ? (
              <Aviso>😕 No quedan horas libres para {form.personas} personas ese día. <b onClick={() => setPaso(2)} style={enlace}>Prueba otro día</b>.</Aviso>
            ) : (
              Object.entries(porTurno).map(([turno, ss]) => (
                <div key={turno} style={{ marginBottom: '0.8rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>{turno}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
                    {ss.map(s => (
                      <button key={s.hora} onClick={() => { set('hora', s.hora); setPaso(4) }} style={opcion(form.hora === s.hora, { padding: '0.7rem 0', fontWeight: 700 })}>{s.hora}</button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </Paso>
        )}

        {/* PASO 4 · Datos */}
        {paso === 4 && (
          <Paso titulo="Tus datos" onAtras={() => setPaso(3)}>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre y apellidos *" autoFocus style={{ ...inp, fontSize: '1rem' }} />
            <input value={form.telefono} onChange={e => set('telefono', e.target.value)} inputMode="tel" placeholder="Teléfono (para avisarte)" style={inp} />
            {zonas.length > 0 && (
              <>
                <label style={{ display: 'block', margin: '0.6rem 0 0.35rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>Zona preferida (opcional)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <button onClick={() => set('zona', '')} style={chip(form.zona === '')}>Indiferente</button>
                  {zonas.map(z => <button key={z} onClick={() => set('zona', z)} style={chip(form.zona === z)}>{z}</button>)}
                </div>
              </>
            )}
            <input value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Alergias, trona, celebración… (opcional)" style={{ ...inp, marginTop: '0.6rem' }} />
            <button onClick={confirmar} disabled={!form.nombre.trim()} style={btn(form.nombre.trim() ? '#10b981' : '#334155', { width: '100%', padding: '0.95rem', fontSize: '1.05rem', marginTop: '0.9rem', cursor: form.nombre.trim() ? 'pointer' : 'not-allowed' })}>
              Confirmar reserva ✓
            </button>
            {!form.nombre.trim() && <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center', marginTop: '0.5rem' }}>Escribe tu nombre para terminar.</p>}
          </Paso>
        )}
      </div>
    </div>
  )

  function etiquetaDia(iso) {
    if (iso === hoyLocal()) return 'Hoy'
    const d = new Date(iso + 'T12:00:00')
    return `${DIA_SEM[d.getDay()]} ${d.getDate()}`
  }
}

// ── piezas de UI ──────────────────────────────────────────
const Paso = ({ titulo, onAtras, children }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
      {onAtras && <button onClick={onAtras} style={btn('#1e293b', { padding: '0.3rem 0.6rem' })}>←</button>}
      <h2 style={{ fontWeight: 800, fontSize: '1.15rem' }}>{titulo}</h2>
    </div>
    {children}
  </div>
)
const Fila = ({ k, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
    <span style={{ color: 'var(--color-muted)' }}>{k}</span><strong>{v}</strong>
  </div>
)
const Chip = ({ onClick, children }) => (
  <button onClick={onClick} style={{ background: '#1e293b', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '9999px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>{children}</button>
)
const Aviso = ({ children }) => (
  <div style={{ background: '#2d1900', border: '1px solid #7c3a00', borderRadius: '0.5rem', padding: '0.8rem 0.85rem', fontSize: '0.85rem', color: '#fbbf24' }}>{children}</div>
)

const wrap = { maxWidth: '460px', margin: '0 auto', minHeight: '100vh', padding: '1.5rem 1.25rem' }
const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.875rem', padding: '1.25rem' }
const inp = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.7rem 0.85rem', color: 'var(--color-text)', fontSize: '0.95rem', width: '100%', marginBottom: '0.4rem' }
const enlace = { color: '#fbbf24', textDecoration: 'underline', cursor: 'pointer' }
const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center', ...extra })
const opcion = (sel, extra = {}) => ({ background: sel ? '#f97316' : '#1e293b', color: '#fff', border: `1px solid ${sel ? '#f97316' : 'var(--color-border)'}`, borderRadius: '0.6rem', cursor: 'pointer', fontWeight: 600, ...extra })
const chip = (sel) => ({ background: sel ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 0.8rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' })
