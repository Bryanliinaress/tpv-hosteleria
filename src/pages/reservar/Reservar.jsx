import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore, generarSlots, slotDisponible, diaCerrado } from '../../store/useStore'
import { enviarEmailReserva, emailConfigurado } from '../../lib/email'
import { syncListo } from '../../lib/sync'
import MiniCalendario from '../../components/MiniCalendario'
import { confirmar } from '../../store/useUI'

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

const FORM0 = { fecha: '', hora: '', personas: 0, zona: '', nombre: '', email: '', telefono: '', notas: '' }
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim())

// Reserva online guiada (personas → zona → día → hora → datos). Si se entra con
// ?r=<id>&t=<token> (enlace del email), muestra el panel para cancelar/modificar.
export default function Reservar() {
  const { local, mesas, reservas, reservasConfig: cfg, crearReserva, actualizarReserva, cambiarEstadoReserva } = useStore()
  const zonas = [...new Set(mesas.map(m => m.zona).filter(Boolean))]

  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const gestId = params.get('r')
  const gestTok = params.get('t')

  const [listo, setListo] = useState(!gestId) // espera al sync solo si venimos por enlace
  useEffect(() => { if (gestId) syncListo.then(() => setListo(true)) }, [gestId])
  const reservaGestion = gestId ? reservas.find(x => x.id === gestId && x.token === gestTok) : null

  const [pasoIdxRaw, setIdx] = useState(0)
  const [form, setForm] = useState(FORM0)
  const [hecha, setHecha] = useState(null)
  const [verMias, setVerMias] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [cancelada, setCancelada] = useState(null) // reserva recién cancelada (pantalla de aviso)
  const set = (campo, val) => setForm(s => ({ ...s, [campo]: val }))

  const pasos = ['personas', ...(zonas.length ? ['zona'] : []), 'dia', 'hora', 'datos']
  const idx = Math.min(pasoIdxRaw, pasos.length - 1)
  const paso = pasos[idx]
  const irA = (key) => setIdx(Math.max(0, pasos.indexOf(key)))
  const siguiente = () => setIdx(i => Math.min(pasos.length - 1, i + 1))
  const atras = () => setIdx(i => Math.max(0, i - 1))

  useEffect(() => { set('hora', '') }, [form.personas, form.zona, form.fecha]) // eslint-disable-line react-hooks/exhaustive-deps

  const misIds = (() => { try { return JSON.parse(localStorage.getItem('tpv-mis-reservas') || '[]') } catch { return [] } })()
  const misReservas = reservas.filter(r => misIds.includes(r.id) && r.estado === 'confirmada' && r.fecha >= hoyLocal())

  const esHoy = form.fecha === hoyLocal()
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes()
  const slots = (!form.fecha || !form.personas || diaCerrado(cfg, form.fecha))
    ? []
    : generarSlots(cfg).filter(s =>
        (!esHoy || minDe(s.hora) > ahoraMin) &&
        slotDisponible(cfg, mesas, reservas, form.fecha, s.hora, form.personas, form.zona, editandoId))
  const porTurno = {}
  slots.forEach(s => { (porTurno[s.turnoNombre] ||= []).push(s) })

  const reiniciar = () => { window.location.hash = '#/reservar'; setForm(FORM0); setIdx(0); setHecha(null); setEditandoId(null); setCancelada(null) }

  const confirmar = () => {
    let id
    if (editandoId) { actualizarReserva(editandoId, form); id = editandoId }
    else {
      id = crearReserva(form)
      try { const m = JSON.parse(localStorage.getItem('tpv-mis-reservas') || '[]'); localStorage.setItem('tpv-mis-reservas', JSON.stringify([...m, id])) } catch { /* noop */ }
    }
    const r = useStore.getState().reservas.find(x => x.id === id) || { ...form, id }
    if (emailConfigurado && r.email) enviarEmailReserva('confirmacion', r, { permitirMailto: false }).catch(() => {})
    setHecha({ ...r, modificada: !!editandoId })
    setEditandoId(null)
  }

  const cancelarReservaCliente = (r) => {
    cambiarEstadoReserva(r.id, 'cancelada')
    if (emailConfigurado && r.email) enviarEmailReserva('cancelacion', r, { permitirMailto: false }).catch(() => {})
  }

  const etiquetaDia = (f) => {
    if (f === hoyLocal()) return 'Hoy'
    const d = new Date(f + 'T12:00:00')
    return `${DIA_SEM[d.getDay()]} ${d.getDate()}`
  }

  // ── Pantalla: reserva cancelada ───────────────────────
  if (cancelada) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem' }}>🗑️</div>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem', margin: '0.5rem 0' }}>Reserva cancelada</h1>
          <p style={{ color: 'var(--color-muted)' }}>Tu reserva del {fechaBonita(cancelada.fecha)} a las {cancelada.hora} se ha cancelado.{emailConfigurado && cancelada.email ? ' Te hemos enviado un correo de confirmación.' : ''}</p>
          <button onClick={reiniciar} style={btn('#f97316', { marginTop: '1rem', width: '100%', padding: '0.85rem', fontSize: '1rem' })}>Hacer una nueva reserva</button>
        </div>
      </div>
    )
  }

  // ── Pantalla: confirmación (nueva o modificada) ───────
  if (hecha) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center', borderColor: '#10b981', boxShadow: '0 18px 50px -18px rgba(16,185,129,0.5)' }}>
          <div className="anim-pop" style={{ fontSize: '3.5rem' }}>✅</div>
          <h1 style={{ fontWeight: 800, fontSize: '1.5rem', margin: '0.5rem 0' }}>{hecha.modificada ? '¡Reserva modificada!' : '¡Reserva confirmada!'}</h1>
          <p style={{ color: 'var(--color-muted)', marginBottom: '1rem' }}>Te esperamos, {hecha.nombre}.</p>
          <div style={{ background: '#0f172a', borderRadius: '0.75rem', padding: '1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Fila k="📅 Día" v={fechaBonita(hecha.fecha)} />
            <Fila k="🕐 Hora" v={hecha.hora} />
            <Fila k="👥 Personas" v={hecha.personas} />
            {hecha.zona && <Fila k="📍 Zona" v={hecha.zona} />}
          </div>
          <p style={{ fontSize: '0.82rem', color: emailConfigurado ? '#10b981' : 'var(--color-muted)', marginTop: '0.875rem' }}>
            {emailConfigurado ? `📧 Te hemos enviado la confirmación a ${hecha.email}` : `📧 Confirmación a ${hecha.email}`}
          </p>
          <a href={gcalLink(hecha, cfg.duracionMin)} target="_blank" rel="noreferrer" style={btn('#1e293b', { display: 'block', marginTop: '0.875rem', padding: '0.75rem', textDecoration: 'none' })}>📆 Añadir a mi calendario</a>
          <button onClick={reiniciar} style={btn('#f97316', { marginTop: '0.6rem', width: '100%', padding: '0.85rem', fontSize: '1rem' })}>Hacer otra reserva</button>
        </div>
      </div>
    )
  }

  // ── Modo gestión (entrando por el enlace del email) ───
  if (gestId && !editandoId) {
    if (!listo) return <div style={wrap}><div style={{ ...card, textAlign: 'center', color: 'var(--color-muted)' }}>Cargando tu reserva…</div></div>
    if (!reservaGestion) {
      return (
        <div style={wrap}>
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem' }}>🤔</div>
            <h1 style={{ fontWeight: 800, fontSize: '1.2rem', margin: '0.5rem 0' }}>No encontramos esa reserva</h1>
            <p style={{ color: 'var(--color-muted)' }}>El enlace no es válido o la reserva ya estaba cancelada.</p>
            <button onClick={reiniciar} style={btn('#f97316', { marginTop: '1rem', width: '100%', padding: '0.85rem', fontSize: '1rem' })}>Hacer una reserva</button>
          </div>
        </div>
      )
    }
    const r = reservaGestion
    return (
      <div style={wrap}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '2.25rem' }}>📋</div>
          <h1 style={{ fontWeight: 800, fontSize: '1.5rem' }}>Tu reserva</h1>
        </div>
        <div style={card}>
          <div style={{ background: '#0f172a', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            <Fila k="👤 Nombre" v={r.nombre} />
            <Fila k="📅 Día" v={fechaBonita(r.fecha)} />
            <Fila k="🕐 Hora" v={r.hora} />
            <Fila k="👥 Personas" v={r.personas} />
            {r.zona && <Fila k="📍 Zona" v={r.zona} />}
          </div>
          <button onClick={() => { setForm({ fecha: r.fecha, hora: r.hora, personas: r.personas, zona: r.zona || '', nombre: r.nombre, email: r.email || '', telefono: r.telefono || '', notas: r.notas || '' }); setEditandoId(r.id); setIdx(0) }} style={btn('#f97316', { width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.5rem' })}>✏️ Modificar reserva</button>
          <button onClick={async () => { if (await confirmar({ titulo: 'Cancelar reserva', mensaje: '¿Seguro que quieres cancelar tu reserva?', peligro: true, confirmar: 'Sí, cancelar', cancelar: 'Volver' })) { cancelarReservaCliente(r); setCancelada(r) } }} style={btn('#7f1d1d', { width: '100%', padding: '0.85rem', fontSize: '1rem' })}>🗑️ Cancelar reserva</button>
        </div>
      </div>
    )
  }

  // Resumen editable
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
        {local?.nombre && <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f97316' }}>{local.nombre}</div>}
        <h1 style={{ fontWeight: 800, fontSize: '1.5rem' }}>{editandoId ? 'Modificar reserva' : 'Reservar mesa'}</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
          {pasos.map((_, n) => (
            <div key={n} style={{ width: idx === n ? '1.6rem' : '0.5rem', height: '0.5rem', borderRadius: '9999px', background: n <= idx ? '#f97316' : '#334155', transition: 'all 0.2s' }} />
          ))}
        </div>
      </div>

      {!editandoId && misReservas.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <button onClick={() => setVerMias(v => !v)} style={btn('#0c1e3a', { width: '100%', border: '1px solid #3b82f6', color: '#60a5fa', fontSize: '0.82rem' })}>
            🔔 Tienes {misReservas.length} reserva(s) · {verMias ? 'ocultar' : 'gestionar'}
          </button>
          {verMias && (
            <div style={{ ...card, marginTop: '0.5rem', padding: '0.75rem' }}>
              {misReservas.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0' }}>
                  <span style={{ fontSize: '0.85rem' }}>📅 {fechaBonita(r.fecha)} · 🕐 {r.hora} · 👥 {r.personas}</span>
                  <button onClick={async () => { if (await confirmar({ titulo: 'Cancelar reserva', mensaje: '¿Cancelar esta reserva?', peligro: true, confirmar: 'Sí, cancelar', cancelar: 'Volver' })) cancelarReservaCliente(r) }} style={btn('#7f1d1d', { fontSize: '0.75rem', padding: '0.3rem 0.6rem' })}>Cancelar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {idx > 0 && resumen}

      <div style={card}>
        {paso === 'personas' && (
          <Paso titulo="¿Cuántas personas?" onAtras={editandoId ? reiniciar : undefined}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {Array.from({ length: cfg.maxPersonasOnline }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => { set('personas', n); siguiente() }} style={opcion(form.personas === n, { fontSize: '1.25rem', padding: '0.9rem 0' })}>{n}</button>
              ))}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.8rem', textAlign: 'center' }}>¿Sois más de {cfg.maxPersonasOnline}? Llámanos y lo organizamos. 📞</p>
          </Paso>
        )}

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

        {paso === 'datos' && (
          <Paso titulo="Tus datos" onAtras={atras}>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre y apellidos *" autoFocus style={{ ...inp, fontSize: '1rem' }} />
            <input value={form.email} onChange={e => set('email', e.target.value)} type="email" inputMode="email" placeholder="Email * (te enviamos la confirmación)" style={{ ...inp, fontSize: '1rem', borderColor: form.email && !emailValido(form.email) ? '#f43f5e' : 'var(--color-border)' }} />
            <input value={form.telefono} onChange={e => set('telefono', e.target.value)} type="tel" inputMode="tel" placeholder="Teléfono (opcional)" style={inp} />
            <input value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Alergias, trona, celebración… (opcional)" style={{ ...inp, marginTop: '0.3rem' }} />
            {(() => {
              const ok = form.nombre.trim() && emailValido(form.email)
              return <>
                <button onClick={confirmar} disabled={!ok} style={btn(ok ? '#10b981' : '#334155', { width: '100%', padding: '0.95rem', fontSize: '1.05rem', marginTop: '0.9rem', cursor: ok ? 'pointer' : 'not-allowed' })}>{editandoId ? 'Guardar cambios ✓' : 'Confirmar reserva ✓'}</button>
                {!ok && <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center', marginTop: '0.5rem' }}>{!form.nombre.trim() ? 'Escribe tu nombre' : 'Escribe un email válido'} para terminar.</p>}
                {/* RGPD: información básica sobre el uso de los datos */}
                <p style={{ fontSize: '0.68rem', color: 'var(--color-faint)', textAlign: 'center', marginTop: '0.7rem', lineHeight: 1.5 }}>
                  Al confirmar aceptas que usemos estos datos <strong>solo para gestionar tu reserva</strong> (confirmación, cambios y recordatorio).
                </p>
                <details style={{ fontSize: '0.68rem', color: 'var(--color-faint)', marginTop: '0.3rem' }}>
                  <summary style={{ cursor: 'pointer', textAlign: 'center' }}>Más información sobre tus datos</summary>
                  <p style={{ marginTop: '0.4rem', lineHeight: 1.55 }}>
                    Responsable: el establecimiento{local?.nombre ? ` (${local.nombre})` : ''}. Finalidad: gestionar la reserva.
                    Conservación: los datos se eliminan automáticamente {cfg.retencionDias ?? 30} días después de la fecha de la reserva.
                    No se ceden a terceros ni se usan para publicidad. Puedes cancelar o modificar la reserva (y tus datos) desde el enlace del email de confirmación.
                  </p>
                </details>
              </>
            })()}
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
const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', boxShadow: 'var(--shadow)', animation: 'fadeIn 0.3s ease both' }
const inp = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.7rem 0.85rem', color: 'var(--color-text)', fontSize: '0.95rem', width: '100%', marginBottom: '0.4rem' }
const enlace = { color: '#fbbf24', textDecoration: 'underline', cursor: 'pointer' }
const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.55rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', ...extra })
const opcion = (sel, extra = {}) => ({ background: sel ? '#f97316' : '#1e293b', color: '#fff', border: `1px solid ${sel ? '#f97316' : 'var(--color-border)'}`, borderRadius: '0.65rem', cursor: 'pointer', fontWeight: 600, boxShadow: sel ? '0 6px 16px -8px rgba(249,115,22,0.8)' : 'var(--shadow-sm)', transition: 'transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease', ...extra })
