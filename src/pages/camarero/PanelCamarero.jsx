import { useState, useRef } from 'react'
import { useStore, owedPorPersona, TIEMPOS } from '../../store/useStore'
import { useEmpleadoActual } from '../../lib/sesion'
import { pedirTexto, confirmar, toast } from '../../store/useUI'
import Ticket from '../../components/Ticket'
import MetodoPago from '../../components/MetodoPago'
import ReservasManager from '../../components/ReservasManager'
import BotonSalir from '../../components/BotonSalir'
import PedirPda from '../pda/PedirPda'
import CobroMesa from '../pda/CobroMesa'

const ESTADO = {
  libre: { label: 'Libre', color: '#10b981', bg: 'var(--tint-success-bg)' },
  ocupada: { label: 'Ocupada', color: '#f59e0b', bg: 'var(--tint-warning-bg)' },
  esperando_cobro: { label: 'Pide cuenta', color: '#f43f5e', bg: 'var(--tint-danger-bg)' },
  reservada: { label: 'Reservada', color: '#3b82f6', bg: 'var(--tint-info-bg)' },
}
const ORDEN_ESTADO = ['esperando_cobro', 'ocupada', 'reservada', 'libre']

function haceCuanto(iso) {
  if (!iso) return ''
  const min = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

export default function PanelCamarero() {
  const { mesas, pedidosCocina, pedidosBarra, avisos, historial, reservas, liberarMesa, atenderAviso, pagarParte, cobrarMesa, reservarMesa, cancelarReserva, sentarReserva, unirseAMesa, asignarCamarero, agruparMesas, separarMesas, marcharSiguiente, cambiarCantidad, moverItem, anularItem } = useStore()
  const empleado = useEmpleadoActual()
  const yo = empleado?.nombre || 'Mostrador'
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [ticket, setTicket] = useState(null) // { tipo, persona, mesa? }
  const [verHistorial, setVerHistorial] = useState(false)
  const [verReservas, setVerReservas] = useState(false)
  const [cobro, setCobro] = useState(null) // { tipo:'persona'|'mesa', personaId?, importe }
  const [cobrandoMesa, setCobrandoMesa] = useState(false) // cobro completo (CobroMesa)
  const [pidiendo, setPidiendo] = useState(false)         // toma de pedido (PedirPda)
  const [mover, setMover] = useState(null)                // { tipo:'mesa'|'comensal', personaId? }
  const [moverLinea, setMoverLinea] = useState(null)      // { personaId, uid, nombre }
  const [reservando, setReservando] = useState(false)
  const [reservaForm, setReservaForm] = useState({ nombre: '', hora: '', personas: 2 })

  const abrirMesa = async (m) => {
    const n = await pedirTexto({ titulo: `Abrir Mesa ${m.numero}`, mensaje: 'Nombre del primer comensal (opcional)', placeholder: 'Nombre', confirmar: 'Abrir mesa' })
    if (n === null) return
    unirseAMesa(m.id, n)
    asignarCamarero(m.id, yo)
  }

  // Unificar mesas arrastrando una sobre otra.
  const [arrastrando, setArrastrando] = useState(null) // id de la mesa que se arrastra
  const [sobre, setSobre] = useState(null)             // id de la mesa sobre la que se suelta
  // Modo táctil (tablet): pulsación larga sobre una mesa → tocar la destino.
  const [tactil, setTactil] = useState(false)
  const touchTimer = useRef(null)
  const empezarPulsacionLarga = (m) => (e) => {
    if (e.pointerType !== 'touch') return
    if (m.estado === 'reservada' || m.unidaA) return
    clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => { setArrastrando(m.id); setTactil(true) }, 450)
  }
  const cancelarPulsacionLarga = () => clearTimeout(touchTimer.current)
  const salirModoTactil = () => { setTactil(false); setArrastrando(null); setSobre(null) }
  const soltarSobre = async (destinoId) => {
    const origenId = arrastrando
    setArrastrando(null); setSobre(null)
    if (!origenId) return
    const o = mesas.find(x => x.id === origenId)
    // Si suelto sobre una mesa unida, el grupo lo manda su cabeza
    const dRaw = mesas.find(x => x.id === destinoId)
    const dm = dRaw?.unidaA ? mesas.find(x => x.id === dRaw.unidaA) : dRaw
    if (!o || !dm || o.id === dm.id) return
    // La cabeza del grupo es quien tenga cuenta; si no, la mesa destino
    const tieneCuenta = m => m.personas.length > 0 || (m.unidas && m.unidas.length > 0)
    const principal = (tieneCuenta(o) && !tieneCuenta(dm)) ? o : dm
    const sec = principal.id === o.id ? dm : o
    const ok = await confirmar({
      titulo: 'Unir mesas',
      mensaje: `¿Unir la Mesa ${o.numero} y la Mesa ${dm.numero}? Se ocuparán juntas y compartirán una sola cuenta (en la Mesa ${principal.numero}).`,
      confirmar: 'Unir mesas',
    })
    if (!ok) return
    asignarCamarero(principal.id, yo)
    agruparMesas(principal.id, sec.id)
    setMesaSeleccionada(principal.id)
    toast(`Mesas ${o.numero} y ${dm.numero} unidas`, 'success')
  }

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
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem' }}>🧾 Mostrador · TPV</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{mesas.filter(m => m.estado !== 'libre').length} ocupadas de {mesas.length} · {empleado?.nombre || ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {totalCocina > 0 && <div style={{ background: 'var(--tint-success-bg)', color: 'var(--tint-success-fg)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>🍳 {totalCocina} listo(s)</div>}
          {totalBarra > 0 && <div style={{ background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>🍺 {totalBarra} listo(s)</div>}
          <button onClick={() => setVerReservas(true)} style={{ background: reservasHoyN ? 'var(--tint-info-bg)' : 'var(--color-surface-2)', color: reservasHoyN ? 'var(--tint-info-fg)' : 'var(--color-text)', border: `1px solid ${reservasHoyN ? '#3b82f6' : 'var(--color-border)'}`, borderRadius: '0.5rem', padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            📅 Reservas{reservasHoyN > 0 ? ` (${reservasHoyN})` : ''}
          </button>
          <button onClick={() => setVerHistorial(true)} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            🧾 Cerradas hoy{cerradasHoy.length > 0 ? ` (${cerradasHoy.length})` : ''}
          </button>
          <BotonSalir />
        </div>
      </div>

      {/* Avisos de clientes (llamadas al camarero) */}
      {avisos.length > 0 && (
        <div style={{ background: 'var(--tint-warning-bg)', borderBottom: '1px solid var(--tint-warning-bd)', padding: '0.75rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.625rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: 'var(--tint-warning-fg)', fontSize: '0.85rem' }}>🔔 Te llaman:</span>
          {avisos.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface-2)', border: '1px solid #f59e0b', borderRadius: '9999px', padding: '0.25rem 0.4rem 0.25rem 0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Mesa {a.mesaNumero}</span>
              {a.personaNombre && <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>· {a.personaNombre}</span>}
              <button onClick={() => atenderAviso(a.id)} title="Marcar atendido" style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '9999px', width: '1.5rem', height: '1.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>✓</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Mapa de sala por zonas */}
        <div style={{ flex: 1, padding: '1.25rem 1.5rem', overflowY: 'auto' }}>
          {/* Leyenda de estados */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.4rem' }}>
            {ORDEN_ESTADO.map(k => {
              const e = ESTADO[k]
              const n = mesas.filter(m => m.estado === k).length
              return (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '9999px', padding: '0.3rem 0.7rem', fontSize: '0.78rem', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ width: '0.6rem', height: '0.6rem', borderRadius: '9999px', background: e.color }} />
                  <span style={{ color: 'var(--color-muted)' }}>{e.label}</span>
                  <strong>{n}</strong>
                </span>
              )
            })}
            <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.72rem', color: 'var(--color-faint)' }}>💡 Arrastra una mesa sobre otra para unirlas (una sola cuenta)</span>
          </div>

          {[...new Set(mesas.map(m => m.zona || 'Sala'))].map(zona => {
            const ms = mesas.filter(m => (m.zona || 'Sala') === zona)
            const ocup = ms.filter(m => m.estado !== 'libre').length
            return (
              <div key={zona} style={{ marginBottom: '1.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-faint)' }}>📍 {zona}</span>
                  <span style={{ flex: 1, height: '1px', background: 'var(--color-border-soft)' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{ocup}/{ms.length} ocupadas</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '0.875rem' }}>
                  {ms.map(m => {
                    const est = ESTADO[m.estado]
                    const sel = mesaSeleccionada === m.id
                    const listo = [...pedidosCocina, ...pedidosBarra].filter(p => p.mesaId === m.id && p.estado === 'listo').length
                    const listoCocina = pedidosCocina.filter(p => p.mesaId === m.id && p.estado === 'listo').length
                    const listoBarra = pedidosBarra.filter(p => p.mesaId === m.id && p.estado === 'listo').length
                    const totalMesa = m.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
                    const esSec = !!m.unidaA
                    const principalNum = esSec ? mesas.find(x => x.id === m.unidaA)?.numero : null
                    const enGrupo = m.unidas && m.unidas.length > 0
                    const plazasGrupo = (m.capacidad || 0) + (m.unidas || []).reduce((s, id) => s + (mesas.find(x => x.id === id)?.capacidad || 0), 0)
                    const arrastrable = m.estado !== 'reservada' && !esSec
                    const esObjetivo = !!arrastrando && arrastrando !== m.id && sobre === m.id
                    const candidataTactil = tactil && !!arrastrando && arrastrando !== m.id && !esSec
                    return (
                      <button
                        key={m.id}
                        draggable={arrastrable}
                        onDragStart={e => { setArrastrando(m.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', m.id) } catch { /* noop */ } }}
                        onDragEnd={() => { setArrastrando(null); setSobre(null) }}
                        onDragOver={e => { if (arrastrando && arrastrando !== m.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sobre !== m.id) setSobre(m.id) } }}
                        onDragLeave={() => setSobre(s => (s === m.id ? null : s))}
                        onDrop={e => { e.preventDefault(); soltarSobre(m.id) }}
                        onPointerDown={empezarPulsacionLarga(m)}
                        onPointerUp={cancelarPulsacionLarga}
                        onPointerMove={cancelarPulsacionLarga}
                        onPointerCancel={cancelarPulsacionLarga}
                        onContextMenu={e => { if (tactil || arrastrando) e.preventDefault() }}
                        onClick={() => {
                          if (tactil && arrastrando) {
                            if (arrastrando === m.id) salirModoTactil()
                            else { setTactil(false); soltarSobre(m.id) }
                            return
                          }
                          setReservando(false); setMesaSeleccionada(esSec ? m.unidaA : (sel ? null : m.id))
                        }}
                        style={{
                          position: 'relative', overflow: 'hidden',
                          background: m.estado === 'libre' ? 'var(--color-surface)' : `linear-gradient(160deg, ${est.color}1f, var(--color-surface) 70%)`,
                          border: esObjetivo ? '2px dashed var(--color-accent)' : candidataTactil ? '1.5px dashed #f9731688' : `1.5px solid ${sel ? est.color : m.estado === 'libre' ? 'var(--color-border)' : est.color + '66'}`,
                          borderRadius: 'var(--radius)', padding: '0.85rem 0.9rem', cursor: arrastrable ? 'grab' : 'pointer', textAlign: 'left',
                          boxShadow: esObjetivo ? '0 0 0 4px rgba(249,115,22,0.35), var(--shadow-lg)' : sel ? `0 0 0 3px ${est.color}55, var(--shadow)` : 'var(--shadow-sm)',
                          minHeight: '6.6rem', display: 'flex', flexDirection: 'column',
                          opacity: arrastrando === m.id ? 0.4 : 1,
                          transform: esObjetivo ? 'scale(1.04)' : 'none',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
                        }}
                        onMouseEnter={e => { if (!arrastrando) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 14px 28px -14px ${est.color}aa` } }}
                        onMouseLeave={e => { if (!arrastrando) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = sel ? `0 0 0 3px ${est.color}55, var(--shadow)` : 'var(--shadow-sm)' } }}
                      >
                        {/* franja de estado */}
                        <span style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: est.color }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>M{m.numero}{enGrupo && <span style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 700 }}> 🔗+{m.unidas.length}</span>}</span>
                          <span style={{ fontSize: '0.62rem', background: est.color + '22', color: est.color, borderRadius: '9999px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>{esSec ? 'Unida' : est.label}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{'👤'.repeat(Math.min(enGrupo ? plazasGrupo : m.capacidad, 8))} <span style={{ opacity: 0.7 }}>{enGrupo ? plazasGrupo : m.capacidad}p</span></div>

                        <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
                          {esSec && <div style={{ fontSize: '0.74rem', color: '#a78bfa', fontWeight: 600 }}>🔗 Unida a M{principalNum}</div>}
                          {!esSec && m.estado === 'libre' && <div style={{ fontSize: '0.74rem', color: 'var(--tint-success-fg)', fontWeight: 600 }}>Toca para abrir ▶</div>}
                          {!esSec && m.estado === 'reservada' && <div style={{ fontSize: '0.72rem', color: 'var(--tint-info-fg)' }}>📅 {m.reserva?.nombre}{m.reserva?.hora ? ` · ${m.reserva.hora}` : ''}</div>}
                          {!esSec && (m.estado === 'ocupada' || m.estado === 'esperando_cobro') && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>👥 {m.personas.length} · ⏱ {haceCuanto(m.abiertaDesde)}</span>
                              </div>
                              <div style={{ fontWeight: 800, color: 'var(--color-accent)', fontSize: '1rem' }}>{totalMesa.toFixed(2)} €</div>
                            </>
                          )}
                        </div>

                        {listo > 0 && (
                          <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.2rem' }}>
                            {listoCocina > 0 && <span style={{ fontSize: '0.62rem', background: 'var(--tint-success-bg)', color: 'var(--tint-success-fg)', borderRadius: '4px', padding: '0 4px', fontWeight: 700 }}>🍳{listoCocina}</span>}
                            {listoBarra > 0 && <span style={{ fontSize: '0.62rem', background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', borderRadius: '4px', padding: '0 4px', fontWeight: 700 }}>🍺{listoBarra}</span>}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Panel derecho - detalle mesa */}
        {mesa && (
          <div style={{ width: '340px', background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mesa {mesa.numero}</h2>
                {mesa.unidas?.length > 0 && <div style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 600 }}>🔗 Unida con {mesa.unidas.map(id => 'M' + (mesas.find(x => x.id === id)?.numero)).join(' · ')} · cuenta única</div>}
              </div>
              <button onClick={() => setMesaSeleccionada(null)} style={btn('var(--color-surface-2)')}>✕</button>
            </div>

            {mesa.estado === 'reservada' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: 'var(--tint-info-bg)', border: '1px solid #3b82f6', borderRadius: '0.625rem', padding: '0.875rem' }}>
                  <div style={{ fontWeight: 800, color: 'var(--tint-info-fg)', marginBottom: '0.35rem' }}>📅 Reservada</div>
                  <div style={{ fontSize: '0.9rem' }}>{mesa.reserva?.nombre}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    {mesa.reserva?.hora && `🕐 ${mesa.reserva.hora} · `}{mesa.reserva?.personas} pers.
                    {mesa.reserva?.telefono && ` · ☎ ${mesa.reserva.telefono}`}
                  </div>
                </div>
                <button onClick={() => { sentarReserva(mesa.id, mesa.reserva?.nombre || '') }} style={btn('#10b981', { width: '100%' })}>▶ Sentar (abrir mesa)</button>
                <button onClick={() => cancelarReserva(mesa.id)} style={btn('var(--color-surface-3)', { width: '100%', fontSize: '0.8rem' })}>Cancelar reserva</button>
              </div>
            ) : mesa.estado === 'libre' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Mesa libre · {mesa.capacidad} plazas</p>
                <button onClick={() => abrirMesa(mesa)} style={btn('#10b981', { width: '100%', padding: '0.75rem' })}>▶ Abrir mesa y pedir</button>
                {!reservando ? (
                  <button onClick={() => { setReservaForm({ nombre: '', hora: '', personas: mesa.capacidad }); setReservando(true) }} style={btn('#3b82f6', { width: '100%' })}>📅 Reservar mesa</button>
                ) : (
                  <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #3b82f6' }}>
                    <div style={{ fontWeight: 700, color: 'var(--tint-info-fg)', fontSize: '0.9rem' }}>Nueva reserva</div>
                    <input value={reservaForm.nombre} onChange={e => setReservaForm(s => ({ ...s, nombre: e.target.value }))} placeholder="Nombre" style={inp} autoFocus />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input value={reservaForm.hora} onChange={e => setReservaForm(s => ({ ...s, hora: e.target.value }))} type="time" style={{ ...inp, flex: 1 }} />
                      <input value={reservaForm.personas} onChange={e => setReservaForm(s => ({ ...s, personas: e.target.value }))} type="number" min="1" placeholder="Pers." style={{ ...inp, width: '80px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setReservando(false)} style={btn('var(--color-surface-3)', { flex: 1, fontSize: '0.8rem' })}>Cancelar</button>
                      <button onClick={() => { reservarMesa(mesa.id, reservaForm); setReservando(false) }} disabled={!reservaForm.nombre.trim()} style={btn(reservaForm.nombre.trim() ? '#3b82f6' : 'var(--color-surface-3)', { flex: 1, fontSize: '0.8rem' })}>Guardar</button>
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
                    <div key={p.id} style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.875rem', border: p.pagado ? '1px solid #10b981' : '1px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-accent)', fontSize: '0.9rem' }}>{p.nombre}</span>
                        {p.pagado && <span style={{ fontSize: '0.7rem', background: 'var(--tint-success-bg)', color: 'var(--tint-success-fg)', borderRadius: '9999px', padding: '0.15rem 0.6rem', fontWeight: 700 }}>✓ Pagado{p.propina > 0 ? ` · +${p.propina.toFixed(2)} €` : ''}</span>}
                      </div>
                      {p.items.length === 0
                        ? <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>Sin pedidos aún</p>
                        : p.items.map(item => (
                          <div key={item.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.2rem 0', borderBottom: '1px solid var(--color-border)', gap: '0.4rem' }}>
                            <span style={{ flex: 1, color: item.estado === 'pendiente' ? '#f59e0b' : 'var(--color-muted)' }}>
                              {item.cantidad}× {item.nombre}
                              {item.estado === 'pendiente' && <span style={{ marginLeft: '4px', fontSize: '0.7rem' }}>●</span>}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <button onClick={() => cambiarCantidad(mesa.id, p.id, item.uid, -1)} disabled={item.cantidad <= 1} title="Una menos" style={miniBtn(item.cantidad <= 1)}>−</button>
                              <button onClick={() => cambiarCantidad(mesa.id, p.id, item.uid, 1)} title="Una más" style={miniBtn(false)}>+</button>
                              {mesa.personas.length > 1 && <button onClick={() => setMoverLinea({ personaId: p.id, uid: item.uid, nombre: item.nombre })} title="Mover a otro comensal" style={miniBtn(false)}>⇄</button>}
                              <button onClick={async () => { const motivo = await pedirTexto({ titulo: `Anular ${item.cantidad}× ${item.nombre}`, mensaje: 'Indica el motivo — queda registrado en la auditoría.', placeholder: 'Motivo (error, cliente cambió…)', confirmar: 'Anular' }); if (motivo === null) return; anularItem(mesa.id, p.id, item.uid, { motivo, por: yo }); toast('Línea anulada', 'success') }} title="Anular" style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.15rem' }}>✕</button>
                            </span>
                            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                          </div>
                        ))
                      }
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-accent)' }}>{aPagar.toFixed(2)} €</span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => setTicket({ tipo: 'persona', persona: p })} title="Ticket de este cliente" style={btn('var(--color-surface-2)', { fontSize: '0.78rem', padding: '0.35rem 0.6rem' })}>🧾</button>
                          {!p.pagado && (
                            <button onClick={() => setCobro({ tipo: 'persona', personaId: p.id, importe: aPagar })} style={btn('#10b981', { fontSize: '0.78rem', padding: '0.35rem 0.75rem' })}>Cobrar</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Total mesa */}
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                  <span>Total mesa</span>
                  <span style={{ color: 'var(--color-accent)' }}>{mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0).toFixed(2)} €</span>
                </div>

                {/* Listos para servir */}
                {(pedidosCocina.some(p => p.mesaId === mesa.id && p.estado === 'listo') || pedidosBarra.some(p => p.mesaId === mesa.id && p.estado === 'listo')) && (
                  <div style={{ background: 'var(--tint-success-bg)', borderRadius: '0.625rem', padding: '0.875rem' }}>
                    <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '0.5rem', fontSize: '0.875rem' }}>✅ Listos para servir</div>
                    {[...pedidosCocina, ...pedidosBarra].filter(p => p.mesaId === mesa.id && p.estado === 'listo').map(p => (
                      <div key={p.id} style={{ fontSize: '0.8rem', color: '#86efac', padding: '0.2rem 0' }}>
                        {p.cantidad}× {p.nombre} → {p.personaNombre}
                      </div>
                    ))}
                  </div>
                )}

                {/* Acciones principales */}
                {(() => {
                  const enEspera = [...pedidosCocina, ...pedidosBarra].filter(p => p.mesaId === mesa.id && p.estado === 'espera')
                  if (enEspera.length === 0) return null
                  const t = Math.min(...enEspera.map(p => p.tiempo || 2))
                  const n = enEspera.filter(p => (p.tiempo || 2) === t).reduce((s, p) => s + p.cantidad, 0)
                  return (
                    <button onClick={() => { marcharSiguiente(mesa.id); toast(`¡Marchando ${TIEMPOS[t]?.largo?.toLowerCase() || ''}!`, 'success') }} style={btn('#7c3aed', { width: '100%', padding: '0.8rem', fontSize: '0.95rem' })}>
                      🔥 Marchar {TIEMPOS[t]?.largo?.toLowerCase()} ({n})
                    </button>
                  )
                })()}
                <button onClick={() => { asignarCamarero(mesa.id, yo); setPidiendo(true) }} style={btn('var(--color-accent)', { width: '100%', padding: '0.8rem', fontSize: '0.95rem' })}>➕ Tomar pedido</button>
                {mesa.personas.some(p => !p.pagado) && (
                  <button onClick={() => { asignarCamarero(mesa.id, yo); setCobrandoMesa(true) }} style={btn('#10b981', { width: '100%', padding: '0.8rem', fontSize: '0.95rem' })}>💶 Cobrar mesa</button>
                )}
                <button onClick={() => setMover({ tipo: 'mesa' })} style={btn('var(--color-surface-2)', { width: '100%', fontSize: '0.85rem' })}>🔗 Unir con otra mesa</button>
                {mesa.unidas?.length > 0 && (
                  <button onClick={() => { separarMesas(mesa.id); toast('Mesas separadas', 'success') }} style={btn('var(--color-surface-2)', { width: '100%', fontSize: '0.85rem' })}>✂️ Separar mesas ({mesa.unidas.length + 1})</button>
                )}

                {/* Tickets de mesa */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setTicket({ tipo: 'comanda' })} style={btn('var(--color-surface-2)', { flex: 1, fontSize: '0.85rem' })}>🧾 Comanda</button>
                  <button onClick={() => setTicket({ tipo: 'cuenta' })} style={btn('var(--color-surface-2)', { flex: 1, fontSize: '0.85rem' })}>💶 Cuenta</button>
                </div>

                <button onClick={() => liberarMesa(mesa.id)} style={btn('var(--color-surface-3)', { width: '100%', fontSize: '0.8rem' })}>
                  Cerrar mesa sin cobrar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Banner de unión táctil (pulsación larga) */}
      {tactil && arrastrando && (
        <div className="anim-fade" style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-accent)', borderRadius: '9999px', padding: '0.55rem 1rem', boxShadow: 'var(--shadow-lg)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>🔗 Uniendo la <strong>M{mesas.find(x => x.id === arrastrando)?.numero}</strong> — toca la mesa destino</span>
          <button onClick={salirModoTactil} style={btn('var(--color-surface-3)', { fontSize: '0.78rem', padding: '0.3rem 0.7rem' })}>Cancelar</button>
        </div>
      )}

      {ticket && (ticket.mesa || mesa) && (
        <Ticket tipo={ticket.tipo} mesa={ticket.mesa || mesa} persona={ticket.persona} onClose={() => setTicket(null)} />
      )}

      {cobro && mesa && (
        <MetodoPago
          titulo={cobro.tipo === 'mesa' ? `Cobrar Mesa ${mesa.numero}` : 'Cobrar cliente'}
          importe={cobro.importe}
          onCerrar={() => setCobro(null)}
          onElegir={(metodo) => {
            if (cobro.tipo === 'mesa') cobrarMesa(mesa.id, { metodo, cobradoPor: yo })
            else pagarParte(mesa.id, cobro.personaId, { metodo, cobradoPor: yo })
            setCobro(null)
          }}
        />
      )}

      {/* Toma de pedido (escritorio, reutiliza la carta de la PDA) */}
      {pidiendo && mesa && <PedirPda mesaId={mesa.id} onClose={() => setPidiendo(false)} />}

      {/* Cobro completo de mesa (descuento, dividir, efectivo) */}
      {cobrandoMesa && mesa && (
        <CobroMesa mesa={mesa} onCerrar={() => setCobrandoMesa(false)} onCobrar={(opts) => { cobrarMesa(mesa.id, { ...opts, cobradoPor: yo }); setCobrandoMesa(false); setMesaSeleccionada(null) }} />
      )}

      {/* Mover una línea a otro comensal */}
      {moverLinea && mesa && (
        <div onClick={() => setMoverLinea(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem', animation: 'fadeIn 0.2s ease both' }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.25rem', width: '100%', maxWidth: '340px' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.75rem' }}>Mover «{moverLinea.nombre}» a…</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {mesa.personas.filter(x => x.id !== moverLinea.personaId).map(x => (
                <button key={x.id} onClick={() => { moverItem(mesa.id, moverLinea.personaId, moverLinea.uid, x.id); setMoverLinea(null); toast(`Movido a ${x.nombre}`, 'success') }} style={btn('var(--color-surface-2)', { width: '100%', padding: '0.7rem', textAlign: 'left', border: '1px solid var(--color-border)' })}>👤 {x.nombre}</button>
              ))}
            </div>
            <button onClick={() => setMoverLinea(null)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.6rem', width: '100%' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Mover / juntar mesa */}
      {mover && mesa && (
        <div onClick={() => setMover(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem', animation: 'fadeIn 0.2s ease both' }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.25rem', width: '100%', maxWidth: '460px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>Unir Mesa {mesa.numero} con…</h3>
              <button onClick={() => setMover(null)} style={btn('var(--color-surface-2)', { padding: '0.25rem 0.6rem' })}>✕</button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>Compartirán una sola cuenta y se ocuparán juntas hasta que cobres.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem' }}>
              {mesas.filter(m => m.id !== mesa.id && !m.unidaA && !(mesa.unidas || []).includes(m.id) && m.estado !== 'reservada').map(m => {
                const libre = m.estado === 'libre'
                return (
                  <button key={m.id} onClick={() => { asignarCamarero(mesa.id, yo); agruparMesas(mesa.id, m.id); setMover(null); setMesaSeleccionada(mesa.id); toast(`Mesa ${m.numero} unida a la ${mesa.numero}`, 'success') }} style={{ background: 'var(--color-surface-2)', border: `1px solid ${(libre ? '#10b981' : '#f59e0b')}66`, borderRadius: 'var(--radius)', padding: '0.7rem', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontWeight: 800 }}>M{m.numero}</div>
                    <div style={{ fontSize: '0.7rem', color: libre ? '#10b981' : '#f59e0b' }}>{libre ? 'Libre' : `Ocupada (${m.personas.length})`}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {verReservas && (
        <div onClick={() => setVerReservas(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end', zIndex: 90, animation: 'fadeIn 0.2s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '420px', maxWidth: '94vw', background: 'var(--color-surface)', height: '100%', overflowY: 'auto', padding: '1.25rem', borderLeft: '1px solid var(--color-border)', boxShadow: '-22px 0 50px -20px rgba(0,0,0,0.8)', animation: 'slideLeft 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>📅 Reservas</h2>
              <button onClick={() => setVerReservas(false)} style={btn('var(--color-surface-2)')}>✕</button>
            </div>
            <ReservasManager onSentada={(mesaId) => { setVerReservas(false); if (mesaId) setMesaSeleccionada(mesaId) }} />
          </div>
        </div>
      )}

      {verHistorial && (
        <div onClick={() => setVerHistorial(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end', zIndex: 90, animation: 'fadeIn 0.2s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '380px', maxWidth: '92vw', background: 'var(--color-surface)', height: '100%', overflowY: 'auto', padding: '1.25rem', borderLeft: '1px solid var(--color-border)', boxShadow: '-22px 0 50px -20px rgba(0,0,0,0.8)', animation: 'slideLeft 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>🧾 Cerradas hoy</h2>
              <button onClick={() => setVerHistorial(false)} style={btn('var(--color-surface-2)')}>✕</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--color-muted)' }}>
              <span>{cerradasHoy.length} ticket(s)</span>
              <span>Total: <strong style={{ color: 'var(--color-accent)' }}>{cerradasHoy.reduce((s, r) => s + r.total, 0).toFixed(2)} €</strong></span>
            </div>
            {cerradasHoy.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Aún no se ha cerrado ninguna mesa hoy.</p>}
            {cerradasHoy.map(r => (
              <div key={r.id} style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem 0.875rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Mesa {r.mesaNumero}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{new Date(r.cerradaEn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {r.total.toFixed(2)} €</div>
                </div>
                <button onClick={() => setTicket({ tipo: 'cuenta', mesa: { numero: r.mesaNumero, personas: r.personas } })} style={btn('var(--color-accent)', { fontSize: '0.78rem', padding: '0.4rem 0.7rem' })}>Ver ticket</button>
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
  color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : 'white',
  border: 'none',
  borderRadius: '0.55rem',
  padding: '0.5rem 1rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.875rem',
  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  ...extra,
})

const inp = { background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.7rem', color: 'var(--color-text)', fontSize: '0.85rem', width: '100%' }
const miniBtn = (off) => ({ background: 'var(--color-surface-2)', color: off ? 'var(--color-faint)' : 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.4rem', width: '1.5rem', height: '1.5rem', lineHeight: 1, cursor: off ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, padding: 0 })
