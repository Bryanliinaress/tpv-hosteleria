import { useState } from 'react'
import { useStore, generarSlots, aforoTotal, aforoZona, ocupacionEn, mesasCandidatas, diaCerrado } from '../store/useStore'
import { enviarEmailReserva } from '../lib/email'
import { confirmar, toast } from '../store/useUI'

const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fechaBonita = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}` }

// Envía un correo de confirmación o recordatorio de la reserva.
const enviarCorreo = async (tipo, r) => {
  try {
    const { via } = await enviarEmailReserva(tipo, r)
    if (via === 'emailjs') toast(`Correo de ${tipo} enviado a ${r.email}`, 'success')
  } catch (e) {
    toast('No se pudo enviar el correo: ' + e.message, 'error')
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
  const { reservas, mesas, reservasConfig: cfg, asignarReservaMesa, sentarReservaAgenda, cambiarEstadoReserva, crearReservaPersonal } = useStore()
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

  // Mesas candidatas (la regla vive en el store y está probada)
  const candidatas = (r) => mesasCandidatas(mesas, r)

  // `sentarReservaAgenda` habla con el servidor en la app real: sin esperarlo,
  // `pid` era una promesa (siempre «verdadera») y se daba por sentada la mesa
  // aunque hubiera fallado.
  const sentar = async (id) => {
    const pid = await Promise.resolve(sentarReservaAgenda(id))
    const r = reservas.find(x => x.id === id)
    if (pid && onSentada) onSentada(r?.mesaId)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        {[{ id: 'agenda', t: '📋 Agenda' }, { id: 'servicio', t: '📊 Servicio' }].map(o => (
          <button key={o.id} onClick={() => setVista(o.id)} style={btn(vista === o.id ? '#3b82f6' : 'var(--color-surface-2)', { flex: 1, fontSize: '0.82rem' })}>{o.t}</button>
        ))}
      </div>

      {vista === 'servicio' && <Servicio cfg={cfg} mesas={mesas} reservas={reservas} fecha={fechaSrv} setFecha={setFechaSrv} />}

      {vista === 'agenda' && (<>
      <NuevaReserva cfg={cfg} mesas={mesas} reservas={reservas} crear={crearReservaPersonal} />

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        {[{ id: 'hoy', t: `Hoy${pendientesHoy ? ` (${pendientesHoy})` : ''}` }, { id: 'proximas', t: 'Próximas' }, { id: 'todas', t: 'Todas' }].map(o => (
          <button key={o.id} onClick={() => setFiltro(o.id)} style={btn(filtro === o.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { flex: 1, fontSize: '0.82rem' })}>{o.t}</button>
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
                <div key={r.id} style={{ background: 'var(--color-surface)', border: `1px solid ${est.color}55`, borderRadius: 'var(--radius)', padding: '0.875rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>🕐 {r.hora}</span>
                      <span style={{ fontWeight: 700 }}>{r.nombre}</span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: est.color, fontWeight: 700, background: est.color + '22', borderRadius: '9999px', padding: '0.15rem 0.6rem' }}>{est.label}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: r.notas ? '0.25rem' : '0.5rem' }}>
                    👥 {r.personas} pers.{r.zona && ` · 📍 ${r.zona}`}{r.email && ` · ✉️ ${r.email}`}{r.telefono && ` · ☎ ${r.telefono}`}
                    {mesaAsignada && <span style={{ color: 'var(--tint-info-fg)' }}> · 🍽 Mesa {mesaAsignada.numero}</span>}
                  </div>
                  {r.notas && <div style={{ fontSize: '0.78rem', color: 'var(--tint-warning-fg)', marginBottom: '0.5rem' }}>📝 {r.notas}</div>}

                  {activa && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                      <select value={r.mesaId || ''} onChange={e => e.target.value && asignarReservaMesa(r.id, e.target.value)} style={sel}>
                        <option value="">Asignar mesa…</option>
                        {candidatas(r).map(m => (
                          <option key={m.id} value={m.id}>Mesa {m.numero} · {m.zona} · {m.capacidad}p{m.capacidad < r.personas ? ' ⚠' : ''}</option>
                        ))}
                      </select>
                      <button onClick={() => sentar(r.id)} disabled={!r.mesaId} title={r.mesaId ? '' : 'Asigna una mesa primero'} style={btn(r.mesaId ? '#10b981' : 'var(--color-surface-3)', { fontSize: '0.8rem', cursor: r.mesaId ? 'pointer' : 'not-allowed' })}>▶ Sentar</button>
                      {r.email && <button onClick={() => enviarCorreo('confirmacion', r)} title={`Confirmación a ${r.email}`} style={btn('#16a34a', { fontSize: '0.8rem' })}>✉️ Confirmar</button>}
                      {r.email && <button onClick={() => enviarCorreo('recordatorio', r)} title={`Recordatorio a ${r.email}`} style={btn('#1d4ed8', { fontSize: '0.8rem' })}>🔔 Recordar</button>}
                      <button onClick={async () => { if (await confirmar({ titulo: 'Cancelar reserva', mensaje: 'Se avisará al cliente por email. ¿Continuar?', peligro: true, confirmar: 'Cancelar reserva', cancelar: 'Volver' })) { cambiarEstadoReserva(r.id, 'cancelada'); if (r.email) enviarEmailReserva('cancelacion', r, { permitirMailto: false }).catch(() => {}); toast('Reserva cancelada', 'success') } }} style={btn('var(--color-surface-3)', { fontSize: '0.8rem' })}>Cancelar</button>
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

// ── Alta manual: la reserva que el bar coge por teléfono ──────────────────
// Es la vía por la que entra la mayoría de las reservas de un bar, y hasta
// ahora solo se podía desde Mostrador, que obliga a asignar mesa en el acto y
// no manda ni la confirmación ni el enlace de gestión al cliente.
//
// A diferencia de la reserva online, aquí NO se bloquea por aforo ni por día
// cerrado: se avisa y se deja pasar. Quien está al teléfono decide si mete una
// mesa más, no la pantalla.
const FORM0 = { fecha: '', hora: '', personas: 2, zona: '', nombre: '', email: '', telefono: '', notas: '' }
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim())

function NuevaReserva({ cfg, mesas, reservas, crear }) {
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ ...FORM0, fecha: hoyLocal() })
  const [otraHora, setOtraHora] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const set = (campo, val) => setForm(s => ({ ...s, [campo]: val }))

  const zonas = [...new Set(mesas.map(m => m.zona).filter(Boolean))]
  const personas = Math.max(1, Number(form.personas) || 1)
  const aforo = form.zona ? aforoZona(cfg, mesas, form.zona) : aforoTotal(cfg, mesas)
  const libresEn = (hora) => aforo - ocupacionEn(reservas, cfg, form.fecha, hora, form.zona || null)

  const cerrado = !!form.fecha && diaCerrado(cfg, form.fecha)
  const libres = form.fecha && form.hora ? libresEn(form.hora) : null
  const sinAforo = libres != null && libres < personas
  const emailMal = !!form.email.trim() && !emailValido(form.email)
  const ok = !!form.fecha && !!form.hora && !!form.nombre.trim() && !emailMal && !guardando

  const guardar = async () => {
    setGuardando(true)
    try {
      const id = await Promise.resolve(crear({ ...form, personas }))
      if (!id) return                       // la acción ya avisó del motivo
      const r = useStore.getState().reservas.find(x => x.id === id)
      toast(`Reserva de ${form.nombre.trim()} guardada`, 'success')
      if (r?.email) await enviarCorreo('confirmacion', r)
      setForm({ ...FORM0, fecha: hoyLocal() }); setOtraHora(false); setAbierto(false)
    } finally { setGuardando(false) }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={btn('#10b981', { width: '100%', marginBottom: '1rem', padding: '0.7rem', fontSize: '0.9rem' })}>
        ➕ Nueva reserva (teléfono)
      </button>
    )
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.875rem', marginBottom: '1rem', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
        <strong style={{ fontSize: '0.95rem' }}>➕ Nueva reserva</strong>
        <button onClick={() => setAbierto(false)} aria-label="Cerrar" style={btn('var(--color-surface-2)', { fontSize: '0.8rem', padding: '0.3rem 0.6rem' })}>✕</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <label style={campo}>
          <span style={etiqueta}>Día</span>
          <input type="date" value={form.fecha} min={hoyLocal()} onChange={e => set('fecha', e.target.value)} style={inp} />
        </label>
        <label style={campo}>
          <span style={etiqueta}>Personas</span>
          <input type="number" min="1" value={form.personas} onChange={e => set('personas', e.target.value)} style={inp} />
        </label>
        {zonas.length > 0 && (
          <label style={campo}>
            <span style={etiqueta}>Zona</span>
            <select value={form.zona} onChange={e => set('zona', e.target.value)} style={inp}>
              <option value="">Sin preferencia</option>
              {zonas.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
        )}
        <label style={campo}>
          <span style={etiqueta}>Hora</span>
          {otraHora ? (
            <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} style={inp} />
          ) : (
            <select value={form.hora} onChange={e => { if (e.target.value === '__otra') { setOtraHora(true); set('hora', '') } else set('hora', e.target.value) }} style={inp}>
              <option value="">Elige hora…</option>
              {generarSlots(cfg).map(s => {
                const l = form.fecha ? libresEn(s.hora) : aforo
                return <option key={s.hora} value={s.hora}>{s.hora} · {l >= personas ? `${l} libres` : l > 0 ? `solo ${l} libres` : 'completo'}</option>
              })}
              <option value="__otra">Otra hora…</option>
            </select>
          )}
        </label>
      </div>

      {cerrado && <Nota>🔒 Ese día el local está cerrado. La reserva se guarda igual.</Nota>}
      {sinAforo && <Nota>⚠️ A esa hora {libres <= 0 ? 'no queda sitio' : `solo quedan ${libres} plazas`} de {aforo}{form.zona && ` en ${form.zona}`}. La reserva se guarda igual.</Nota>}

      <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre *" style={{ ...inp, marginBottom: '0.4rem' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
        <input value={form.telefono} onChange={e => set('telefono', e.target.value)} type="tel" inputMode="tel" placeholder="Teléfono" style={{ ...inp, flex: '1 1 140px' }} />
        <input value={form.email} onChange={e => set('email', e.target.value)} type="email" inputMode="email" placeholder="Email (para confirmarle)" style={{ ...inp, flex: '1 1 180px', borderColor: emailMal ? '#f43f5e' : 'var(--color-border)' }} />
      </div>
      <input value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Alergias, trona, celebración…" style={{ ...inp, marginBottom: '0.6rem' }} />

      <button onClick={guardar} disabled={!ok} style={btn(ok ? '#10b981' : 'var(--color-surface-3)', { width: '100%', padding: '0.7rem', cursor: ok ? 'pointer' : 'not-allowed' })}>
        {guardando ? 'Guardando…' : 'Guardar reserva ✓'}
      </button>
      <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', textAlign: 'center', marginTop: '0.45rem' }}>
        {emailMal ? 'Ese email no es válido.'
          : form.email.trim() ? 'Se le manda la confirmación con el enlace para cancelar o cambiarla.'
          : 'Sin email no hay confirmación ni recordatorio: apunta el teléfono.'}
      </p>
    </div>
  )
}

const Nota = ({ children }) => (
  <div style={{ background: 'var(--tint-warning-bg)', border: '1px solid var(--tint-warning-bd)', color: 'var(--tint-warning-fg)', borderRadius: '0.5rem', padding: '0.5rem 0.6rem', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{children}</div>
)

const campo = { display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '1 1 130px' }
const etiqueta = { fontSize: '0.7rem', color: 'var(--color-muted)', fontWeight: 600 }
const inp = { background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.6rem', color: 'var(--color-text)', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }

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
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.45rem 0.6rem', color: 'var(--color-text)', fontSize: '0.85rem' }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{delDia.length} reserva(s) · <strong style={{ color: 'var(--color-accent)' }}>{coversDia}</strong> comensales · aforo {aforo}</span>
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
                <div style={{ flex: 1, background: 'var(--color-inset)', borderRadius: '9999px', height: '1.1rem', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: col, transition: 'width 0.2s' }} />
                  <span style={{ position: 'absolute', left: '0.5rem', top: 0, lineHeight: '1.1rem', fontSize: '0.68rem', color: 'var(--color-text-2)' }}>{ocup}/{aforo}{enSlot.length ? ` · ${enSlot.map(r => r.nombre.split(' ')[0]).join(', ')}` : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

const btn = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 0.8rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
const sel = { background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.45rem 0.6rem', color: 'var(--color-text)', fontSize: '0.8rem', flex: '1 1 160px' }
