import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useStore, owedPorPersona, ALERGENO_INFO, normalizarExtra, etiquetasDe } from '../../store/useStore'
import { iniciarPagoOnline, leerResultadoPago, limpiarUrlPago, pagoOnlineDisponible } from '../../lib/pagos'
import { syncListo } from '../../lib/sync'
import { toast } from '../../store/useUI'
import { useIdioma, tr } from '../../lib/i18n'

export default function CartaCliente() {
  const { mesaId } = useParams()
  const { local, carta, mesas, pedidosCocina, pedidosBarra, avisos, unirseAMesa, agregarItem, cambiarCantidad, confirmarPedido, pedirCuenta, pagarParte, pagarTodo, toggleCompartir, llamarCamarero, atenderAviso } = useStore()
  const mesa = mesas.find(m => m.id === mesaId)
  const { idioma, setIdioma } = useIdioma()
  const t = (s) => tr(idioma, s)

  const [miPersonaId, setMiPersonaId] = useState(() => localStorage.getItem(`tpv-yo-${mesaId}`))
  const [nombre, setNombre] = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState(carta.categorias[0].id)
  const [pidiendoPara, setPidiendoPara] = useState(null) // personaId; null = yo
  const [vista, setVista] = useState('carta') // carta | pedido | cuenta
  const [cerrada, setCerrada] = useState(false)
  const [yoVisto, setYoVisto] = useState(false) // ¿hemos estado activos en la mesa?
  const [pagando, setPagando] = useState(null)
  const [propinaPct, setPropinaPct] = useState(0)
  const [pagandoTodo, setPagandoTodo] = useState(false)
  const [propinaTodoPct, setPropinaTodoPct] = useState(0)
  const [dividiendo, setDividiendo] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarResumen, setMostrarResumen] = useState(false)

  // Personalización de un plato (elegir pan + condimentos)
  const [pers, setPers] = useState(null) // { producto, formato, tipo, quitados, anadidos, nota }

  const yo = mesa?.personas.find(p => p.id === miPersonaId)

  useEffect(() => { if (yo) setYoVisto(true) }, [yo])

  // Pantalla de "cuenta pagada": solo si estuvimos activos y la mesa se reinició
  // (evita el falso positivo del estado por defecto antes de cargar Supabase).
  useEffect(() => {
    if (yoVisto && miPersonaId && mesa && !yo && mesa.estado === 'libre') setCerrada(true)
  }, [yoVisto, miPersonaId, mesa, yo])

  // Al volver de Stripe Checkout: si el pago fue OK, marca esa parte como pagada.
  // Espera a que Supabase cargue el estado para no ser sobrescrito por la sync.
  useEffect(() => {
    const r = leerResultadoPago()
    if (!r.estado) return
    syncListo.then(() => {
      if (r.estado === 'ok' && r.mesaId === mesaId && r.personaId) {
        if (r.personaId === '__todo__') pagarTodo(mesaId, { propina: r.propina, metodo: 'tarjeta', cobradoPor: 'Cliente' })
        else pagarParte(mesaId, r.personaId, r.propina)
        localStorage.removeItem(`tpv-pago-${mesaId}-${r.personaId}`)
      }
      limpiarUrlPago(mesaId)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!mesa) return <div style={{ padding: '2rem', color: 'var(--color-muted)' }}>{t('Mesa no encontrada')}</div>

  const limpiarDispositivo = () => {
    localStorage.removeItem(`tpv-yo-${mesaId}`)
    setMiPersonaId(null); setCerrada(false); setVista('carta'); setPidiendoPara(null)
  }

  // ── Pantalla GRACIAS ──────────────────────────────────
  if (cerrada) {
    return (
      <div style={centerScreen}>
        <div style={{ fontSize: '4rem' }}>✅</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, textAlign: 'center' }}>{t('¡Cuenta pagada!')}</h1>
        <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>{t('Gracias por tu visita a la Mesa')} {mesa.numero}. {t('¡Hasta pronto! 👋')}</p>
        <button onClick={limpiarDispositivo} style={btnStyle('var(--color-accent)', { padding: '0.875rem 1.5rem', fontSize: '1rem' })}>{t('Empezar una nueva mesa')}</button>
      </div>
    )
  }

  // ── Pantalla IDENTIFICACIÓN ───────────────────────────
  if (!yo) {
    const ocupada = mesa.estado !== 'libre'
    const unirse = async () => {
      // v1 devuelve el id síncrono; v2 (RPC) una promesa — cubrimos ambos
      const id = await Promise.resolve(unirseAMesa(mesaId, nombre))
      if (!id) return
      localStorage.setItem(`tpv-yo-${mesaId}`, id)
      setMiPersonaId(id); setNombre('')
    }
    return (
      <div style={centerScreen}>
        <button onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '9999px', padding: '0.35rem 0.8rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
          {idioma === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}
        </button>
        <div style={{ fontSize: '3.5rem' }}>🥪</div>
        {local?.nombre && <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '0.01em' }}>{local.nombre}</div>}
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{t('Mesa')} {mesa.numero}</h1>
        {ocupada ? (
          <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>{t('Ya están en la mesa:')} <strong style={{ color: 'var(--color-text)' }}>{mesa.personas.map(p => p.nombre).join(', ')}</strong>.<br />{t('Únete escribiendo tu nombre.')}</p>
        ) : (
          <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>{t('¡Bienvenido/a! Escribe tu nombre para empezar a pedir.')}</p>
        )}
        <input value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && nombre.trim()) unirse() }} placeholder={t('Tu nombre')} autoFocus style={{ ...inputStyle, maxWidth: '300px', textAlign: 'center', fontSize: '1rem' }} />
        <button onClick={unirse} disabled={!nombre.trim()} style={btnStyle(nombre.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)', { width: '100%', maxWidth: '300px', padding: '0.875rem', fontSize: '1rem', cursor: nombre.trim() ? 'pointer' : 'not-allowed' })}>
          {ocupada ? t('Unirme a la mesa') : t('Abrir mesa y pedir')}
        </button>
      </div>
    )
  }

  // ── Cliente identificado ──────────────────────────────
  const personaActiva = mesa.personas.find(p => p.id === pidiendoPara) || yo
  const q = busqueda.trim().toLowerCase()
  const productosFiltrados = q
    ? carta.productos.filter(p => p.disponible && (p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q)))
    : carta.productos.filter(p => p.categoria === categoriaActiva && p.disponible)
  const itemsPendientes = personaActiva.items.filter(i => i.estado === 'pendiente')
  const itemsEnviados = personaActiva.items.filter(i => i.estado === 'enviado')
  const totalPendiente = itemsPendientes.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const totalMesa = mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
  const owed = owedPorPersona(mesa)
  const totalPendienteMesa = mesa.personas.filter(p => !p.pagado).reduce((s, p) => s + owed[p.id], 0)
  const pedirParaOtro = personaActiva.id !== yo.id

  const ESTADO_ITEM = {
    recibido: { label: t('En cola'), color: '#f59e0b', emoji: '📥' },
    preparando: { label: t('Preparándose'), color: '#3b82f6', emoji: '👨‍🍳' },
    listo: { label: t('¡Listo!'), color: '#10b981', emoji: '✅' },
  }
  const misPedidos = [...pedidosCocina, ...pedidosBarra].filter(p => p.personaId === yo.id)
  const misListos = misPedidos.filter(p => p.estado === 'listo')
  const avisoMesa = avisos.find(a => a.mesaId === mesaId)
  const avisoActivo = !!avisoMesa
  // Llama al camarero; si ya está avisado, volver a tocar cancela el aviso.
  const toggleAviso = () => {
    if (avisoMesa) { atenderAviso(avisoMesa.id); toast(t('Aviso cancelado'), 'info') }
    else { llamarCamarero(mesaId, yo.nombre); toast(t('Camarero avisado'), 'success') }
  }

  const descrItem = (item) => {
    const p = []
    if (item.pan) p.push(`${item.pan.nombreFormato} · ${item.pan.nombreTipo}`)
    if (item.quitados?.length) p.push(t('sin') + ' ' + item.quitados.join(', '))
    if (item.anadidos?.length) p.push(t('con') + ' ' + item.anadidos.join(', '))
    if (item.nota) p.push('“' + item.nota + '”')
    return p.join(' · ')
  }
  const minPrecio = (prod) => Math.min(...Object.values(prod.precios || {}).map(Number))
  const etiquetas = etiquetasDe(carta)
  const extrasNorm = (carta.extras || []).map(normalizarExtra)
  const precioExtra = (nombre) => extrasNorm.find(x => x.nombre === nombre)?.precio || 0

  const lineasDe = (persona) => {
    const lineas = []
    mesa.personas.forEach(owner => {
      owner.items.forEach(item => {
        const sharers = [owner.id, ...(item.compartidoCon || [])]
        if (!sharers.includes(persona.id)) return
        lineas.push({ owner, item, sharers, cuota: item.precio * item.cantidad / sharers.length, esPropio: owner.id === persona.id })
      })
    })
    return lineas
  }

  const pagarOnline = async (p) => {
    const total = owed[p.id]
    const propina = total * propinaPct / 100
    try {
      await iniciarPagoOnline({ mesaId, personaId: p.id, importe: total + propina, propina, descripcion: `Mesa ${mesa.numero} · ${p.nombre}` })
    } catch (e) {
      toast('No se pudo iniciar el pago: ' + e.message, 'error')
    }
  }

  // Paga la cuenta completa de la mesa (un comensal por todos)
  const pagarTodoOnline = async () => {
    const total = totalPendienteMesa
    const propina = total * propinaTodoPct / 100
    try {
      await iniciarPagoOnline({ mesaId, personaId: '__todo__', importe: total + propina, propina, descripcion: `Mesa ${mesa.numero} · cuenta completa` })
    } catch (e) {
      toast('No se pudo iniciar el pago: ' + e.message, 'error')
    }
  }

  // ── Vista CUENTA ──────────────────────────────────────
  if (vista === 'cuenta') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.25rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setVista('carta')} style={btnStyle('var(--color-surface-2)')}>←</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>{t('Cuenta — Mesa')} {mesa.numero}</h2>
        </div>
        {mesa.personas.map(p => {
          const totalP = owed[p.id]
          const esYo = p.id === yo.id
          const lineas = lineasDe(p)
          return (
            <div key={p.id} style={{ ...cardStyle, marginBottom: '0.75rem', borderColor: p.pagado ? '#10b981' : 'var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{p.nombre}{esYo && <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> (tú)</span>}</div>
                {p.pagado && <span style={{ fontSize: '0.7rem', background: 'var(--tint-success-bg)', color: 'var(--tint-success-fg)', borderRadius: '9999px', padding: '0.15rem 0.6rem', fontWeight: 700 }}>✓ Pagado{p.propina > 0 ? ` · +${p.propina.toFixed(2)} €` : ''}</span>}
              </div>
              {lineas.length === 0
                ? <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{t('Sin pedidos')}</p>
                : lineas.map(({ owner, item, sharers, cuota, esPropio }, idx) => {
                  const compartido = sharers.length > 1
                  return (
                    <div key={idx} style={{ padding: '0.3rem 0', borderBottom: idx < lineas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--color-muted)' }}>
                          {esPropio ? `${item.cantidad}× ${item.nombre}` : item.nombre}
                          {!esPropio && <span style={{ fontSize: '0.7rem' }}> (de {owner.nombre})</span>}
                          {compartido && <span style={{ fontSize: '0.7rem', color: '#a78bfa' }}> · {t('compartido')} ×{sharers.length}</span>}
                        </span>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{cuota.toFixed(2)} €</span>
                      </div>
                      {item.pan && <div style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>{descrItem(item)}</div>}
                      {esPropio && !p.pagado && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <button onClick={() => setDividiendo(dividiendo === item.uid ? null : item.uid)} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.72rem', padding: 0 }}>
                            👥 {compartido ? t('Editar reparto') : t('Dividir este plato')}
                          </button>
                          {dividiendo === item.uid && (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                              {mesa.personas.filter(x => x.id !== p.id).map(x => {
                                const activo = (item.compartidoCon || []).includes(x.id)
                                return (
                                  <button key={x.id} onClick={() => toggleCompartir(mesaId, p.id, item.uid, x.id)} style={btnStyle(activo ? '#7c3aed' : 'var(--color-surface-3)', { fontSize: '0.72rem', padding: '0.2rem 0.55rem' })}>
                                    {activo ? '✓ ' : ''}{x.nombre}
                                  </button>
                                )
                              })}
                              {mesa.personas.length === 1 && <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{t('No hay nadie más en la mesa')}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              }
              <div style={{ borderTop: '2px solid var(--color-border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{totalP.toFixed(2)} €</span>
                  {!p.pagado && pagoOnlineDisponible && pagando !== p.id && (
                    <button onClick={() => { setPagando(p.id); setPropinaPct(0) }} style={btnStyle('#635bff', { padding: '0.4rem 0.9rem', fontSize: '0.8rem' })}>
                      💳 {esYo ? t('Pagar mi parte') : `${t('Pagar parte de')} ${p.nombre}`}
                    </button>
                  )}
                </div>
                {!p.pagado && pagando === p.id && (
                  <div style={{ marginTop: '0.6rem' }}>
                    <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.35rem' }}>{t('¿Añadir propina?')}</p>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {[0, 5, 10, 15].map(pct => (
                        <button key={pct} onClick={() => setPropinaPct(pct)} style={btnStyle(propinaPct === pct ? 'var(--color-accent)' : 'var(--color-surface-3)', { fontSize: '0.75rem', padding: '0.3rem 0.6rem' })}>
                          {pct === 0 ? t('Sin propina') : `${pct}%`}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => pagarOnline(p)} style={btnStyle('#635bff', { width: '100%', padding: '0.7rem', fontSize: '0.9rem' })}>
                      💳 {t('Pagar')} {(totalP * (1 + propinaPct / 100)).toFixed(2)} € {t('con tarjeta/Bizum')}
                    </button>
                    <button onClick={() => setPagando(null)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.4rem', width: '100%' }}>{t('Cancelar')}</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div style={{ ...cardStyle, borderColor: 'var(--color-accent)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
            <span>{t('Pendiente de pago')}</span><span style={{ color: 'var(--color-accent)' }}>{totalPendienteMesa.toFixed(2)} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            <span>{t('Total mesa')}</span><span>{totalMesa.toFixed(2)} €</span>
          </div>
        </div>

        {/* Pagar la cuenta completa (un comensal por todos) */}
        {pagoOnlineDisponible && totalPendienteMesa > 0 && (
          <div style={{ ...cardStyle, marginBottom: '1rem' }}>
            {!pagandoTodo ? (
              <button onClick={() => { setPagandoTodo(true); setPropinaTodoPct(0); setPagando(null) }} style={btnStyle('#635bff', { width: '100%', padding: '0.875rem', fontSize: '0.95rem' })}>
                💳 {t('Pagar toda la cuenta')} · {totalPendienteMesa.toFixed(2)} €
              </button>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                  Pagas la cuenta <strong>completa</strong> de la mesa{mesa.personas.filter(p => !p.pagado).length > 1 ? ` · ${mesa.personas.filter(p => !p.pagado).length} comensales` : ''}.
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.35rem' }}>{t('¿Añadir propina?')}</p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                  {[0, 5, 10, 15].map(pct => (
                    <button key={pct} onClick={() => setPropinaTodoPct(pct)} style={btnStyle(propinaTodoPct === pct ? 'var(--color-accent)' : 'var(--color-surface-3)', { fontSize: '0.75rem', padding: '0.3rem 0.6rem' })}>
                      {pct === 0 ? t('Sin propina') : `${pct}%`}
                    </button>
                  ))}
                </div>
                <button onClick={pagarTodoOnline} style={btnStyle('#635bff', { width: '100%', padding: '0.8rem', fontSize: '0.95rem' })}>
                  💳 {t('Pagar')} {(totalPendienteMesa * (1 + propinaTodoPct / 100)).toFixed(2)} € {t('con tarjeta/Bizum')}
                </button>
                <button onClick={() => setPagandoTodo(false)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.4rem', width: '100%' }}>{t('Cancelar')}</button>
              </>
            )}
          </div>
        )}

        {mesa.estado !== 'esperando_cobro' ? (
          <button onClick={() => pedirCuenta(mesaId)} style={btnStyle('var(--color-surface-2)', { width: '100%', padding: '0.875rem', fontSize: '0.95rem' })}>{t('🧑‍🍳 Que cobre el camarero (efectivo/tarjeta)')}</button>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--tint-success-bg)', borderRadius: '0.75rem', color: 'var(--tint-success-fg)', fontWeight: 700 }}>✅ {t('✅ El camarero viene a cobrar').replace('✅ ','')}</div>
        )}
      </div>
    )
  }

  // ── Vista MI PEDIDO ───────────────────────────────────
  if (vista === 'pedido') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.25rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <button onClick={() => setVista('carta')} style={btnStyle('var(--color-surface-2)')}>←</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>{t('Pedido de')} {personaActiva.nombre}{!pedirParaOtro && ` ${t('(tú)')}`}</h2>
        </div>

        {itemsEnviados.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={labelMini}>{t('Ya enviado · seguimiento en vivo')}</p>
            {itemsEnviados.map((item) => {
              const ents = [...pedidosCocina, ...pedidosBarra].filter(p => p.personaId === personaActiva.id && p.nombre === item.nombre)
              const clave = ents.some(e => e.estado === 'recibido') ? 'recibido' : ents.some(e => e.estado === 'preparando') ? 'preparando' : ents.length ? 'listo' : null
              const est = clave && ESTADO_ITEM[clave]
              return (
                <div key={item.uid} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderColor: est ? est.color + '66' : 'var(--color-border)' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem' }}>{item.cantidad}× {item.nombre}</div>
                    {item.pan && <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{descrItem(item)}</div>}
                    {est && <div style={{ fontSize: '0.72rem', color: est.color, fontWeight: 700, marginTop: '0.15rem' }}>{est.emoji} {est.label}</div>}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                </div>
              )
            })}
          </div>
        )}

        {itemsPendientes.length > 0 ? (
          <>
            <p style={labelMini}>{t('Por enviar')}</p>
            {itemsPendientes.map((item) => (
              <div key={item.uid} style={{ ...cardStyle, marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.nombre}</div>
                    {item.pan && <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.1rem' }}>{descrItem(item)}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
                    <button onClick={() => cambiarCantidad(mesaId, personaActiva.id, item.uid, -1)} style={btnStyle('var(--color-surface-3)', { padding: '0.25rem 0.625rem', fontSize: '1rem' })}>−</button>
                    <span style={{ fontWeight: 700, minWidth: '1.5rem', textAlign: 'center' }}>{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(mesaId, personaActiva.id, item.uid, 1)} style={btnStyle('var(--color-surface-3)', { padding: '0.25rem 0.625rem', fontSize: '1rem' })}>+</button>
                    <span style={{ fontWeight: 700, minWidth: '3rem', textAlign: 'right' }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '1rem', borderColor: 'var(--color-accent)' }}>
              <span>{t('Total pendiente')}</span><span style={{ color: 'var(--color-accent)' }}>{totalPendiente.toFixed(2)} €</span>
            </div>
            <button onClick={() => setMostrarResumen(true)} style={btnStyle('var(--color-accent)', { width: '100%', padding: '0.875rem', fontSize: '1rem' })}>{t('Enviar pedido 🚀')}</button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</div>
            <p>{t('Aún no hay nada por enviar')}</p>
            <button onClick={() => setVista('carta')} style={{ ...btnStyle('var(--color-accent)'), marginTop: '1rem' }}>{t('Ver carta')}</button>
          </div>
        )}

        {mostrarResumen && (
          <div onClick={() => setMostrarResumen(false)} style={overlay}>
            <div onClick={e => e.stopPropagation()} style={hoja}>
            <div style={grabHandle} />
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{t('Confirmar pedido')}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>{t('Revisa antes de enviarlo a cocina')}</p>
              {itemsPendientes.map((item) => (
                <div key={item.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.cantidad}× {item.nombre}</div>
                    {item.pan && <div style={{ fontSize: '0.74rem', color: 'var(--tint-warning-fg)' }}>{descrItem(item)}</div>}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', margin: '0.75rem 0 1rem' }}>
                <span>Total</span><span style={{ color: 'var(--color-accent)' }}>{totalPendiente.toFixed(2)} €</span>
              </div>
              <button onClick={() => { confirmarPedido(mesaId); setMostrarResumen(false); setVista('carta') }} style={btnStyle('var(--color-accent)', { width: '100%', padding: '0.875rem', fontSize: '1rem', marginBottom: '0.5rem' })}>{t('Confirmar y enviar 🚀')}</button>
              <button onClick={() => setMostrarResumen(false)} style={btnStyle('var(--color-surface-3)', { width: '100%', padding: '0.7rem', fontSize: '0.9rem' })}>{t('Seguir pidiendo')}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vista CARTA ───────────────────────────────────────
  const precioPers = pers ? ((pers.producto.precios[pers.formato] ?? 0) + (carta.tiposPan.find(t => t.id === pers.tipo)?.sup || 0) + pers.anadidos.reduce((s, n) => s + precioExtra(n), 0)) : 0
  const toggleEn = (setKey, val) => setPers(s => {
    const arr = s[setKey]
    return { ...s, [setKey]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
  })
  const confirmarPers = () => {
    const fmt = carta.formatos.find(f => f.id === pers.formato)
    const tp = carta.tiposPan.find(t => t.id === pers.tipo)
    agregarItem(mesaId, personaActiva.id, {
      productoId: pers.producto.id, nombre: pers.producto.nombre, precio: precioPers, tipo: pers.producto.tipo,
      pan: { formato: pers.formato, tipo: pers.tipo, nombreFormato: fmt.nombre, nombreTipo: tp.nombre },
      quitados: pers.quitados, anadidos: pers.anadidos, nota: pers.nota.trim(),
    })
    setPers(null)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{t('Mesa')} {mesa.numero}</span>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 600 }}>{t('Hola,')} {yo.nombre} 👋</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')} title="Idioma / Language" style={btnStyle('var(--color-surface-2)', { fontSize: '0.75rem', padding: '0.375rem 0.6rem', fontWeight: 700 })}>{idioma === 'es' ? '🇬🇧' : '🇪🇸'}</button>
            <button onClick={toggleAviso} title={avisoActivo ? t('Cancelar el aviso al camarero') : t('Llamar al camarero')} style={btnStyle(avisoActivo ? '#10b981' : 'var(--color-surface-2)', { fontSize: '0.8rem', padding: '0.375rem 0.75rem' })}>{avisoActivo ? `🔔 ${t('Avisado')} ✕` : '🔔'}</button>
            <button onClick={() => setVista('pedido')} style={{ ...btnStyle('var(--color-surface-2)', { fontSize: '0.8rem', padding: '0.375rem 0.75rem' }), position: 'relative' }}>🛒 {itemsPendientes.length > 0 && <span style={badge}>{itemsPendientes.length}</span>}</button>
            <button onClick={() => setVista('cuenta')} style={btnStyle('var(--color-surface-2)', { fontSize: '0.8rem', padding: '0.375rem 0.75rem' })}>💰</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', paddingBottom: '0.25rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', whiteSpace: 'nowrap', marginRight: '0.25rem' }}>{t('Pedir para:')}</span>
          <button onClick={() => setPidiendoPara(null)} style={btnStyle(!pedirParaOtro ? 'var(--color-accent)' : 'var(--color-inset)', { fontSize: '0.75rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' })}>{yo.nombre} {t('(tú)')}</button>
          {mesa.personas.filter(p => p.id !== yo.id).map(p => (
            <button key={p.id} onClick={() => setPidiendoPara(p.id)} style={btnStyle(pidiendoPara === p.id ? 'var(--color-accent)' : 'var(--color-inset)', { fontSize: '0.75rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' })}>{p.nombre}</button>
          ))}
        </div>
      </div>

      {misListos.length > 0 && (
        <div style={{ background: 'var(--tint-success-bg)', color: 'var(--tint-success-fg)', fontSize: '0.85rem', fontWeight: 700, padding: '0.55rem 1.25rem', textAlign: 'center', borderBottom: '1px solid var(--tint-success-bd)' }}>
          ✅ {t('¡Listo para ti!')} {misListos.map(p => `${p.cantidad}× ${p.nombre}`).join(', ')}
        </div>
      )}
      {pedirParaOtro && (
        <div style={{ background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)', fontSize: '0.78rem', padding: '0.4rem 1.25rem', textAlign: 'center' }}>{t('Estás pidiendo para')} <strong>{personaActiva.nombre}</strong></div>
      )}

      {/* Buscador */}
      <div style={{ padding: '0.75rem 1.25rem 0.75rem', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ position: 'relative' }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder={t('🔍 Buscar en la carta…')} style={{ ...inputStyle, fontSize: '0.85rem', padding: '0.5rem 0.75rem' }} />
          {busqueda && <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
        </div>
        {q && <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>{productosFiltrados.length} resultado(s) para «{busqueda}»</div>}
      </div>

      {/* Categorías (ocultas al buscar) */}
      {!q && (
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.25rem', overflowX: 'auto', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
          {carta.categorias.map(cat => (
            <button key={cat.id} onClick={() => setCategoriaActiva(cat.id)} style={btnStyle(categoriaActiva === cat.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { whiteSpace: 'nowrap', fontSize: '0.85rem', padding: '0.4rem 0.85rem' })}>
              {cat.emoji} {cat.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Productos */}
      <div style={{ flex: 1, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {productosFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
            <p>{t('No hay nada que coincida con')} «{busqueda}»</p>
          </div>
        )}
        {productosFiltrados.map(prod => {
          const esMontadito = !!prod.precios
          return (
            <div key={prod.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              {prod.imagen && <img src={prod.imagen} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '4rem', height: '4rem', objectFit: 'cover', borderRadius: '0.6rem', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{prod.nombre}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{prod.descripcion}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{esMontadito ? `${t('desde')} ${minPrecio(prod).toFixed(2)} €` : `${prod.precio.toFixed(2)} €`}</span>
                  {(prod.alergenos || []).length > 0 && (
                    <span title={'Alérgenos: ' + prod.alergenos.map(a => ALERGENO_INFO[a]?.nombre || a).join(', ')} style={{ fontSize: '0.72rem', letterSpacing: '0.1em', opacity: 0.85 }}>
                      {prod.alergenos.map(a => ALERGENO_INFO[a]?.emoji || '•').join('')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => esMontadito
                  ? setPers({ producto: prod, formato: (carta.formatos.find(f => prod.precios[f.id] != null) || carta.formatos[0])?.id, tipo: carta.tiposPan[0]?.id, quitados: [], anadidos: [], nota: '' })
                  : agregarItem(mesaId, personaActiva.id, { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, tipo: prod.tipo })}
                style={btnStyle('var(--color-accent)', { padding: '0.5rem 0.9rem', whiteSpace: 'nowrap' })}
              >
                {esMontadito ? t('Añadir') : t('+ Añadir')}
              </button>
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      {itemsPendientes.length > 0 && (
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', bottom: 0 }}>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>{itemsPendientes.reduce((s, i) => s + i.cantidad, 0)} {t('producto(s)')} · {totalPendiente.toFixed(2)} €</span>
          <button onClick={() => setVista('pedido')} style={btnStyle('var(--color-accent)', { padding: '0.625rem 1.25rem' })}>{t('Ver pedido →')}</button>
        </div>
      )}

      {/* Hoja de personalización */}
      {pers && (
        <div onClick={() => setPers(null)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={hoja}>
            <div style={grabHandle} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>{pers.producto.nombre}</h3>
              <button onClick={() => setPers(null)} style={btnStyle('var(--color-surface-3)', { padding: '0.25rem 0.6rem' })}>✕</button>
            </div>
            {pers.producto.imagen && <img src={pers.producto.imagen} alt="" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '9rem', objectFit: 'cover', borderRadius: '0.75rem', marginBottom: '0.75rem' }} />}
            {(pers.producto.alergenos || []).length > 0 && (
              <p style={{ fontSize: '0.74rem', color: 'var(--tint-warning-fg)', marginBottom: '0.75rem' }}>
                ⚠️ {t('Alérgenos')}: {pers.producto.alergenos.map(a => `${ALERGENO_INFO[a]?.emoji || ''} ${ALERGENO_INFO[a]?.nombre || a}`).join(' · ')}
              </p>
            )}

            {/* Formato (tamaño/pan según el local) */}
            <p style={labelMini}>{etiquetas.formatos}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {carta.formatos.filter(f => pers.producto.precios[f.id] != null).map(f => (
                <button key={f.id} onClick={() => setPers(s => ({ ...s, formato: f.id }))} style={btnStyle(pers.formato === f.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { flex: 1, minWidth: '7rem', padding: '0.6rem', fontSize: '0.85rem' })}>
                  {f.nombre}<br /><span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{(pers.producto.precios[f.id] ?? 0).toFixed(2)} €</span>
                </button>
              ))}
            </div>

            {/* Tipo/variedad */}
            <p style={labelMini}>{etiquetas.tiposPan}</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {carta.tiposPan.map(t => (
                <button key={t.id} onClick={() => setPers(s => ({ ...s, tipo: t.id }))} style={btnStyle(pers.tipo === t.id ? '#7c3aed' : 'var(--color-surface-2)', { fontSize: '0.78rem', padding: '0.35rem 0.65rem' })}>
                  {t.nombre}{t.sup > 0 ? ` +${t.sup.toFixed(2)}€` : ''}
                </button>
              ))}
            </div>

            {/* Quitar condimentos del plato */}
            {pers.producto.ingredientes.length > 0 && (
              <>
                <p style={labelMini}>{t('Lleva (toca para quitar)')}</p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {pers.producto.ingredientes.map(ing => {
                    const quitado = pers.quitados.includes(ing)
                    return (
                      <button key={ing} onClick={() => toggleEn('quitados', ing)} style={btnStyle(quitado ? '#7f1d1d' : 'var(--color-surface-3)', { fontSize: '0.78rem', padding: '0.35rem 0.65rem', textDecoration: quitado ? 'line-through' : 'none' })}>
                        {quitado ? '✕ ' : ''}{ing}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Añadir extras (cada uno con su precio) */}
            <p style={labelMini}>Añadir {etiquetas.extras.toLowerCase()}</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {extrasNorm.map(ex => {
                const puesto = pers.anadidos.includes(ex.nombre)
                return (
                  <button key={ex.nombre} onClick={() => toggleEn('anadidos', ex.nombre)} style={btnStyle(puesto ? '#065f46' : 'var(--color-surface-2)', { fontSize: '0.78rem', padding: '0.35rem 0.65rem' })}>
                    {puesto ? '✓ ' : '+ '}{ex.nombre}{ex.precio > 0 && <span style={{ opacity: 0.7 }}> +{ex.precio.toFixed(2)}€</span>}
                  </button>
                )
              })}
            </div>

            <input value={pers.nota} onChange={e => setPers(s => ({ ...s, nota: e.target.value }))} placeholder="📝 Otra indicación (opcional)" style={{ ...inputStyle, fontSize: '0.82rem', padding: '0.5rem 0.7rem', marginBottom: '0.9rem' }} />

            <button onClick={confirmarPers} style={btnStyle('var(--color-accent)', { width: '100%', padding: '0.875rem', fontSize: '1rem' })}>
              Añadir al pedido · {precioPers.toFixed(2)} €
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const centerScreen = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.25rem' }
const grabHandle = { width: '36px', height: '4px', borderRadius: '9999px', background: 'var(--color-border)', margin: '-0.25rem auto 0.85rem' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50, animation: 'fadeIn 0.2s ease both' }
const hoja = { background: 'var(--color-surface)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', padding: '1.25rem', width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', borderTop: '1px solid var(--color-border)', boxShadow: '0 -22px 50px -20px rgba(0,0,0,0.8)', animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }

const btnStyle = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : 'white', border: 'none', borderRadius: '0.55rem', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', ...extra })
const cardStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }
const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: 'var(--color-text)', width: '100%' }
const labelMini = { fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }
const badge = { position: 'absolute', top: '-4px', right: '-4px', background: 'var(--color-accent)', color: 'white', borderRadius: '9999px', fontSize: '0.65rem', padding: '0 4px', fontWeight: 700 }
