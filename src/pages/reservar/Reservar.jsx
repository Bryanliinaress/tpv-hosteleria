import { useState, useEffect } from 'react'
import { useStore, generarSlots, slotDisponible, diaCerrado } from '../../store/useStore'
import MiniCalendario from '../../components/MiniCalendario'

// ── utilidades de fecha ───────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const fechaISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hoyLocal = () => fechaISO(new Date())
const fechaBonita = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}` }
const minDe = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const DIA_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const gcalLink = (r, dur) => {
  const [y, mo, da] = r.fecha.split('-').map(Number); const [h, mi] = r.hora.split(':').map(Number)
  const ini = new Date(y, mo - 1, da, h, mi); const fin = new Date(ini.getTime() + (dur || 90) * 60000)
  const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Reserva de mesa')}&dates=${fmt(ini)}/${fmt(fin)}&details=${encodeURIComponent(`${r.personas} personas · a nombre de ${r.nombre}`)}`
}

const FORM0 = { fecha: '', hora: '', personas: 0, zona: '', nombre: '', telefono: '', notas: '' }

// Reserva online guiada: personas → zona → día → hora → datos. La zona se pide
// antes que la hora porque condiciona la disponibilidad de cada franja.
export default function Reservar() {
  const { mesas, reservas, reservasConfig: cfg, crearReserva, cambiarEstadoReserva } = useStore()
  const zonas = [...new Set(mesas.map(m => m.zona).filter(Boolean))]

  // Pasos dinámicos (se omite 'zona' si el local no tiene zonas)
  const pasos = ['personas', ...(zonas.length ? ['zona'] : []), 'dia', 'hora', 'datos']
  const [idx, setIdx] = useState(0)
  const paso = pasos[idx]
  const irA = (key) => setIdx(Math.max(0, pasos.indexOf(key)))
  const siguiente = () => setIdx(i => Math.min(pasos.length - 1, i + 1))
  const atras = () => setIdx(i => Math.max(0, i - 1))

  const [form, setForm] = useState(FORM0)
  const [hecha, setHecha] = useState(null)
  const [verMias, setVerMias] = useState(false)
  const set = (campo, val) => setForm(s => ({ ...s, [campo]: val }))

  // Si cambian personas/zona/fecha, la hora elegida puede dejar de valer
  useEffect(() => { set('hora', '') }, [form.personas, form.zona, form.fecha]) // eslint-disable-line react-hooks/exhaustive-deps

  const misIds = (() => { try { return JSON.parse(localStorage.getItem('tpv-mis-reservas') || '[]') } catch { return [] } })()
  const misReservas = reservas.filter(r => misIds.includes(r.id) && r.estado === 'confirmada' && r.fecha >= hoyLocal())

  // Horas libres para el día + personas + zona elegidos
  const esHoy = form.fecha === hoyLocal()
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes()
  const slots = (!form.fecha || !form.personas || diaCerrado(cfg, form.fecha))
    ? []
    : generarSlots(cfg).filter(s =>
        (!esHoy || minDe(s.hora) > ahoraMin) &&
        slotDisponible(cfg, mesas, reservas, form.fecha, s.hora, form.personas, form.zona))
  const porTurno = {}
  slots.forEach(s => { (porTurno[s.turnoNombre] ||= []).push(s) })

  const confirmar = () => {
    const id = crearReserva(form)
    try { const m = JSON.parse(localStorage.getItem('tpv-mis-reservas') || '[]'); localStorage.setItem('tpv-mis-reservas', JSON.stringify([...m, id])) } catch { /* noop */ }
    setHecha({ ...form, id })
  }
  const reiniciar = () => { setForm(FORM0); setIdx(0); setHecha(null) }

  const etiquetaDia = (f) => {
    if (f === hoyLocal()) return 'Hoy'
    const d = new Date(f + 'T12:00:00')
    return `${DIA_SEM[d.getDay()]} ${d.getDate()}`
  }

  // ── Confirmación ──────────────────────────────────────
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
          <a href={gcalLink(hecha, cfg.duracionMin)} target="_blank" rel="noreferrer" style={btn('#1e293b', { display: 'block', marginTop: '0.875rem', padding: '0.75rem', textDecoration: 'none' })}>📆 Añadir a mi calendario</a>
          <button onClick={reiniciar} style={btn('#f97316', { marginTop: '0.6rem', width: '100%', padding: '0.85rem', fontSize: '1rem' })}>Hacer otra reserva</button>
        </div>
      </div>
    )
  }

  // Resumen editable de lo ya elegido
  const resumen = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginBottom: '1rem' }}>
      {form.personas > 0 && <Chip onClick={() => irA('personas')}>👥 {form.personas}</Chip>}
      {form.zona && <Chip onClick={() => irA('zona')}>📍 {form.zona}</Chip>}
      {form.fecha && <Chip onClick={() => irA('dia')}>📅 {etiquetaDia(form.fecha)}</Chip>}
      {form.hora && <Chip onClick={() => irA('hora')}>🕐 {form.hora}</Chip>}
    </div>
  )

  return (
    <div style={wrap}>
      <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '2.25rem' }}>📅</div>
        <h1 style={{ fontWeight: 800, fontSize: '1.5rem' }}>Reservar mesa</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
          {pasos.map((_, n) => (
            <div key={n} style={{ width: idx === n ? '1.6rem' : '0.5rem', height: '0.5rem', borderRadius: '9999px', background: n <= idx ? '#f97316' : '#334155', transition: 'all 0.2s' }} />
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

      {idx > 0 && resumen}

      <div style={card}>
        {/* Personas */}
        {paso === 'personas' && (
          <Paso titulo="¿Cuántas personas?">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {Array.from({ length: cfg.maxPersonasOnline }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => { set('personas', n); siguiente() }} style={opcion(form.personas === n, { fontSize: '1.25rem', padding: '0.9rem 0' })}>{n}</button>
              ))}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.8rem', textAlign: 'center' }}>¿Sois más de {cfg.maxPersonasOnline}? Llámanos y lo organizamos. 📞</p>
          </Paso>
        )}

        {/* Zona */}
        {paso === 'zona' && (
          <Paso titulo="¿Dónde prefieres sentarte?" onAtras={atras}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={() => { set('zona', ''); siguiente() }} style={opcion(form.zona === '', { padding: '0.85rem', textAlign: 'left' })}>🪑 Me da igual <span style={{ fontWeight: 400, opacity: 0.7, fontSize: '0.8rem' }}>· la mejor mesa libre</span></button>
              {zonas.map(z => (
                <button key={z} onClick={() => { set('zona', z); siguiente() }} style={opcion(form.zona === z, { padding: '0.85rem', textAlign: 'left' })}>📍 {z}</button>
              ))}
            </div>
          </Paso>
        )}

        {/* Día (mini calendario) */}
        {paso === 'dia' && (
          <Paso titulo="¿Qué día?" onAtras={atras}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[{ t: 'Hoy', d: 0 }, { t: 'Mañana', d: 1 }].map(({ t, d }) => {
                const dd = new Date(); dd.setDate(dd.getDate() + d); const f = fechaISO(dd); const cerrado = diaCerrado(cfg, f)
                return <button key={t} disabled={cerrado} onClick={() => { set('fecha', f); siguiente() }} style={opcion(form.fecha === f, { flex: 1, padding: '0.6rem', opacity: cerrado ? 0.4 : 1, cursor: cerrado ? 'not-allowed' : 'pointer' })}>{t}</button>
              })}
            </div>
            <MiniCalendario value={form.fecha} minISO={hoyLocal()} esCerrado={(f) => diaCerrado(cfg, f)} onChange={(f) => { set('fecha', f); siguiente() }} />
          </Paso>
        )}

        {/* Hora */}
        {paso === 'hora' && (
          <Paso titulo="¿A qué hora?" onAtras={atras}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
              {form.zona ? `Horas libres en ${form.zona}` : 'Horas libres'} para {form.personas} personas
            </div>
            {diaCerrado(cfg, form.fecha) ? (
              <Aviso>🔒 Ese día está cerrado. <b onClick={() => irA('dia')} style={enlace}>Elige otro día</b>.</Aviso>
            ) : slots.length === 0 ? (
              <Aviso>😕 No quedan horas libres{form.zona ? ` en ${form.zona}` : ''} para {form.personas} personas ese día. <b onClick={() => irA('dia')} style={enlace}>Prueba otro día</b>{zonas.length ? <> o <b onClick={() => irA('zona')} style={enlace}>cambia de zona</b></> : null}.</Aviso>
            ) : (
              Object.entries(porTurno).map(([turno, ss]) => (
                <div key={turno} style={{ marginBottom: '0.8rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>{turno}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
                    {ss.map(s => (
                      <button key={s.hora} onClick={() => { set('hora', s.hora); siguiente() }} style={opcion(form.hora === s.hora, { padding: '0.7rem 0', fontWeight: 700 })}>{s.hora}</button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </Paso>
        )}

        {/* Datos */}
        {paso === 'datos' && (
          <Paso titulo="Tus datos" onAtras={atras}>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre y apellidos *" autoFocus style={{ ...inp, fontSize: '1rem' }} />
            <input value={form.telefono} onChange={e => set('telefono', e.target.value)} inputMode="tel" placeholder="Teléfono (para avisarte)" style={inp} />
            <input value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Alergias, trona, celebración… (opcional)" style={{ ...inp, marginTop: '0.3rem' }} />
            <button onClick={confirmar} disabled={!form.nombre.trim()} style={btn(form.nombre.trim() ? '#10b981' : '#334155', { width: '100%', padding: '0.95rem', fontSize: '1.05rem', marginTop: '0.9rem', cursor: form.nombre.trim() ? 'pointer' : 'not-allowed' })}>Confirmar reserva ✓</button>
            {!form.nombre.trim() && <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center', marginTop: '0.5rem' }}>Escribe tu nombre para terminar.</p>}
          </Paso>
        )}
      </div>
    </div>
  )
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
