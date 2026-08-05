import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useStore, owedPorPersona, ALERGENO_INFO, normalizarExtra, etiquetasDe } from '../../store/useStore'
import { iniciarPagoOnline, leerResultadoPago, limpiarUrlPago, pagoOnlineDisponible } from '../../lib/pagos'
import { syncListo } from '../../lib/sync'
import { toast } from '../../store/useUI'
import { useIdioma, tr } from '../../lib/i18n'
import { useUnaVez } from '../../lib/unaVez'
import { esMenu, menuCompleto, siguientePendiente, precioMenu, resumenElecciones, alternarOpcion } from '../../lib/menuDia'
import { productosVisibles, descripcionUtil, lineaSimplePendiente, unidades, configDeItem, ultimaRonda } from '../../lib/carta'
import { construirRecibo, lineasDeConsumo, guardarRecibo, leerRecibo, olvidarRecibo, descargarRecibo, reciboReciente } from '../../lib/recibo'

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
  // Las categorías se quedan pegadas justo debajo de la cabecera: en una carta
  // larga, cambiar de categoría no puede obligar a subir hasta arriba.
  const cabeceraRef = useRef(null)
  const buscadorRef = useRef(null)
  const [altoCabecera, setAltoCabecera] = useState(0)
  // Lo que el cliente quería hacer cuando aún no había dado su nombre; se
  // ejecuta solo en cuanto se une a la mesa.
  const [intento, setIntento] = useState(null)
  // en un movil el doble toque enviaba la comanda dos veces
  const [enviarPedido, enviando] = useUnaVez(async () => {
    await Promise.resolve(confirmarPedido(mesaId))
    setMostrarResumen(false); setVista('carta')
  })

  // Personalización de un plato (elegir pan + condimentos)
  const [pers, setPers] = useState(null) // { producto, formato, tipo, quitados, anadidos, nota }

  const yo = mesa?.personas.find(p => p.id === miPersonaId)

  useEffect(() => { if (yo) setYoVisto(true) }, [yo])

  // Al escanear el QR de OTRA mesa, la ruta cambia pero el componente sigue
  // montado: sin esto arrastraba la identidad de la mesa anterior y saltaba un
  // falso «¡Cuenta pagada!». Cada mesa empieza de cero.
  useEffect(() => {
    setMiPersonaId(localStorage.getItem(`tpv-yo-${mesaId}`))
    setYoVisto(false); setCerrada(false); setVista('carta')
    setPidiendoPara(null); setIntento(null); setPers(null); setBusqueda('')
  }, [mesaId])

  // Ya tiene nombre: retomamos lo que estaba intentando hacer (añadir el plato
  // que tocó, o abrir su pedido) sin que tenga que repetir el gesto.
  useEffect(() => {
    if (!yo || !intento) return
    if (intento.tipo === 'anadir') agregarItem(mesaId, yo.id, intento.config)
    if (intento.tipo === 'opciones') setPers(intento.pers)
    if (intento.tipo === 'vista') setVista(intento.vista)
    setIntento(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yo, intento])

  // Foto del consumo para el recibo del cliente. Se guarda MIENTRAS la mesa
  // está viva: al cobrar, la mesa se libera y el consumo desaparece del estado.
  useEffect(() => {
    if (!yo || !yo.items?.length) return
    const lineas = lineasDeConsumo(mesa, yo.id)
    if (!lineas.length) return
    guardarRecibo(mesaId, construirRecibo({
      local, mesa, nombre: yo.nombre, lineas, propina: yo.propina || 0,
      metodo: yo.pagado ? (yo.metodoPago || null) : null,
    }))
  }, [mesa, yo, local, mesaId])

  // La cabecera crece o encoge (avisos, «pedir para»): medimos su alto real
  // para colgar de ahí las categorías pegadas.
  useEffect(() => {
    const el = cabeceraRef.current
    if (!el) return
    const medir = () => setAltoCabecera(el.getBoundingClientRect().height)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  })

  // Pantalla de "cuenta pagada": solo si estuvimos activos y la mesa se reinició
  // (evita el falso positivo del estado por defecto antes de cargar Supabase).
  // También cubre al que cierra la app tras pagar y la vuelve a abrir: si hay
  // recibo de este servicio, lo suyo es enseñárselo, no la carta.
  useEffect(() => {
    if (!miPersonaId || !mesa || yo || mesa.estado !== 'libre') return
    if (yoVisto || reciboReciente(mesaId)) setCerrada(true)
  }, [yoVisto, miPersonaId, mesa, yo, mesaId])

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
    olvidarRecibo(mesaId)
    setMiPersonaId(null); setCerrada(false); setVista('carta'); setPidiendoPara(null)
  }

  // ── Pantalla GRACIAS + RECIBO ─────────────────────────
  // Quien paga desde el móvil se iba sin nada. Aquí tiene el detalle de lo que
  // ha pagado y se lo puede llevar.
  if (cerrada) {
    const recibo = leerRecibo(mesaId)
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.5rem 1.25rem 2.5rem', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '3.5rem' }}>✅</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('¡Cuenta pagada!')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>{t('Gracias por tu visita a la Mesa')} {mesa.numero}. {t('¡Hasta pronto! 👋')}</p>
        </div>

        {recibo && <ReciboCliente recibo={recibo} t={t} />}

        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.25rem' }}>
          {recibo && <>
            <button onClick={() => { descargarRecibo(recibo); toast(t('Recibo descargado'), 'success') }}
              style={btnStyle('var(--color-accent)', { width: '100%', minHeight: `${TOQUE + 6}px`, fontSize: '1rem' })}>
              📄 {t('Descargar mi recibo')}
            </button>
            <button onClick={() => window.print()}
              style={btnStyle('var(--color-surface-2)', { width: '100%', minHeight: `${TOQUE}px`, fontSize: '0.92rem' })}>
              🖨 {t('Imprimir o guardar como PDF')}
            </button>
          </>}
          <button onClick={limpiarDispositivo} style={btnStyle('var(--color-surface-3)', { width: '100%', minHeight: `${TOQUE}px`, fontSize: '0.9rem' })}>{t('Empezar una nueva mesa')}</button>
        </div>
      </div>
    )
  }

  // Quien escanea el QR ve la carta ANTES de dar su nombre: el nombre solo hace
  // falta para pedir, y pedirlo de entrada espantaba al cliente (y abría mesas
  // fantasma en el local).
  const ojeando = !yo
  const unirse = async () => {
    // v1 devuelve el id síncrono; v2 (RPC) una promesa — cubrimos ambos
    const id = await Promise.resolve(unirseAMesa(mesaId, nombre))
    if (!id) return
    localStorage.setItem(`tpv-yo-${mesaId}`, id)
    setMiPersonaId(id); setNombre('')
  }

  // ── Carta ─────────────────────────────────────────────
  // Mientras se ojea no hay persona: una vacía evita comprobar `yo` en cada línea.
  const personaActiva = mesa.personas.find(p => p.id === pidiendoPara) || yo || SIN_PERSONA
  const q = busqueda.trim().toLowerCase()
  const productosFiltrados = productosVisibles(carta, { busqueda: busqueda, categoria: categoriaActiva })
  const itemsPendientes = personaActiva.items.filter(i => i.estado === 'pendiente')
  const itemsEnviados = personaActiva.items.filter(i => i.estado === 'enviado')
  const totalPendiente = itemsPendientes.reduce((s, i) => s + i.precio * i.cantidad, 0)
  // el carrito cuenta UNIDADES, no líneas: 3 cafés son «3», no «1»
  const udsPendientes = unidades(itemsPendientes)
  const totalMesa = mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
  const owed = owedPorPersona(mesa)
  const totalPendienteMesa = mesa.personas.filter(p => !p.pagado).reduce((s, p) => s + owed[p.id], 0)
  const pedirParaOtro = !!yo && personaActiva.id !== yo.id

  const ESTADO_ITEM = {
    recibido: { label: t('En cola'), color: '#f59e0b', emoji: '📥' },
    preparando: { label: t('Preparándose'), color: '#3b82f6', emoji: '👨‍🍳' },
    listo: { label: t('¡Listo!'), color: '#10b981', emoji: '✅' },
  }
  const misPedidos = [...pedidosCocina, ...pedidosBarra].filter(p => p.personaId === yo?.id)
  const misListos = misPedidos.filter(p => p.estado === 'listo')
  const misEnMarcha = misPedidos.filter(p => p.estado === 'recibido' || p.estado === 'preparando' || p.estado === 'espera')
  // lo que me toca pagar a mí (con lo compartido ya repartido)
  const miParte = yo ? (owed[yo.id] || 0) : 0
  const pestanas = !ojeando && (
    <Pestanas vista={vista} setVista={setVista} uds={udsPendientes} enMarcha={misEnMarcha.length}
      listos={misListos.length} aPagar={miParte} pagado={!!yo?.pagado} t={t} />
  )
  const avisoMesa = avisos.find(a => a.mesaId === mesaId)
  const avisoActivo = !!avisoMesa
  // Llama al camarero; si ya está avisado, volver a tocar cancela el aviso.
  const toggleAviso = () => {
    if (avisoMesa) { atenderAviso(avisoMesa.id); toast(t('Aviso cancelado'), 'info') }
    else { llamarCamarero(mesaId, yo?.nombre || `${t('Mesa')} ${mesa.numero}`); toast(t('Camarero avisado'), 'success') }
  }

  // «Otra ronda»: vuelve a poner en el carrito lo mismo que ya se pidió, sin
  // tener que buscar cada cosa otra vez. Es lo que más se repite en una barra.
  const repetirItem = (item) => {
    const config = configDeItem(item)
    for (let i = 0; i < (item.cantidad || 1); i++) agregarItem(mesaId, personaActiva.id, config)
    toast(`🔁 ${item.cantidad}× ${item.nombre} ${t('otra vez en tu pedido')}`, 'success')
  }
  const repetirRonda = () => {
    const ronda = ultimaRonda(personaActiva.items)
    if (!ronda.length) return
    ronda.forEach(item => {
      const config = configDeItem(item)
      for (let i = 0; i < (item.cantidad || 1); i++) agregarItem(mesaId, personaActiva.id, config)
    })
    toast(`🔁 ${unidades(ronda)} ${t('producto(s)')} ${t('otra vez en tu pedido')}`, 'success')
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
      toast(e.message + '. Avisa al camarero para pagar en efectivo o con datáfono.', 'error')
    }
  }

  // Paga la cuenta completa de la mesa (un comensal por todos)
  const pagarTodoOnline = async () => {
    const total = totalPendienteMesa
    const propina = total * propinaTodoPct / 100
    try {
      await iniciarPagoOnline({ mesaId, personaId: '__todo__', importe: total + propina, propina, descripcion: `Mesa ${mesa.numero} · cuenta completa` })
    } catch (e) {
      toast(e.message + '. Avisa al camarero para pagar en efectivo o con datáfono.', 'error')
    }
  }

  // ── Vista CUENTA ──────────────────────────────────────
  // sin identificarse no hay cuenta ni pedido que enseñar
  if (vista === 'cuenta' && !ojeando) {
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

        {/* Ya pagó lo suyo: que pueda llevarse el recibo sin esperar al cierre */}
        {yo?.pagado && (
          <button onClick={() => {
            const r = leerRecibo(mesaId)
            if (!r) return toast(t('El recibo estará listo al cerrar la mesa'), 'info')
            descargarRecibo(r); toast(t('Recibo descargado'), 'success')
          }} style={btnStyle('var(--color-surface-2)', { width: '100%', minHeight: `${TOQUE}px`, fontSize: '0.9rem', marginBottom: '1rem' })}>
            📄 {t('Descargar mi recibo')}
          </button>
        )}

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
          <button onClick={() => pedirCuenta(mesaId)} style={btnStyle('var(--color-surface-2)', { width: '100%', padding: '0.875rem', minHeight: `${TOQUE + 6}px`, fontSize: '0.95rem' })}>{t('🧑‍🍳 Que cobre el camarero (efectivo/tarjeta)')}</button>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--tint-success-bg)', borderRadius: '0.75rem', color: 'var(--tint-success-fg)', fontWeight: 700 }}>✅ {t('✅ El camarero viene a cobrar').replace('✅ ','')}</div>
        )}
        <div style={huecoPestanas} />
        {pestanas}
      </div>
    )
  }

  // ── Vista MI PEDIDO ───────────────────────────────────
  if (vista === 'pedido' && !ojeando) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.25rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <button onClick={() => setVista('carta')} style={btnStyle('var(--color-surface-2)')}>←</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>{t('Pedido de')} {personaActiva.nombre}{!pedirParaOtro && ` ${t('(tú)')}`}</h2>
        </div>

        {/* Cómo va lo mío, de un vistazo */}
        {itemsEnviados.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: misListos.length ? 'var(--color-success)' : 'var(--color-border)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {misListos.length > 0 && <span style={chipEstado('var(--tint-success-bg)', 'var(--tint-success-fg)')}>✅ {misListos.reduce((s, p) => s + p.cantidad, 0)} {t('¡Listo!')}</span>}
              {misEnMarcha.length > 0 && <span style={chipEstado('var(--tint-info-bg)', 'var(--tint-info-fg)')}>👨‍🍳 {misEnMarcha.reduce((s, p) => s + p.cantidad, 0)} {t('Preparándose')}</span>}
              {misPedidos.length === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{t('Ya enviado · seguimiento en vivo')}</span>}
              <button onClick={repetirRonda} style={{ ...btnStyle('var(--color-surface-3)', { marginLeft: 'auto', padding: '0.5rem 0.85rem', minHeight: `${TOQUE}px`, fontSize: '0.82rem' }) }}>
                🔁 {t('Otra ronda')}
              </button>
            </div>
          </div>
        )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                    <button onClick={() => repetirItem(item)} title={`${t('Pedir otro')} ${item.nombre}`} aria-label={`${t('Pedir otro')} ${item.nombre}`}
                      style={btnStyle('var(--color-surface-3)', { ...paso, padding: 0, fontSize: '0.95rem' })}>🔁</button>
                  </div>
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
              <button onClick={enviarPedido} disabled={enviando} style={btnStyle(enviando ? 'var(--color-surface-3)' : 'var(--color-accent)', { width: '100%', padding: '0.875rem', fontSize: '1rem', marginBottom: '0.5rem', cursor: enviando ? 'wait' : 'pointer' })}>{enviando ? t('Enviando…') : t('Confirmar y enviar 🚀')}</button>
              <button onClick={() => setMostrarResumen(false)} style={btnStyle('var(--color-surface-3)', { width: '100%', padding: '0.7rem', minHeight: `${TOQUE}px`, fontSize: '0.9rem' })}>{t('Seguir pidiendo')}</button>
            </div>
          </div>
        )}
        <div style={huecoPestanas} />
        {pestanas}
      </div>
    )
  }

  // ── Vista CARTA ───────────────────────────────────────
  const precioPers = !pers ? 0 : esMenu(pers.producto)
    ? precioMenu(pers.producto, pers.elecciones || [])
    // un producto sin formatos (o un menú) no tiene `precios`: se cae al precio simple
    : ((pers.producto.precios?.[pers.formato] ?? pers.producto.precio ?? 0) + (carta.tiposPan.find(t => t.id === pers.tipo)?.sup || 0) + pers.anadidos.reduce((s, n) => s + precioExtra(n), 0))
  // un menú no se puede enviar a medias: cocina no sabría qué preparar
  const menuIncompleto = pers ? !menuCompleto(pers.producto, pers.elecciones || []) : false
  const faltaGrupo = pers && menuIncompleto ? siguientePendiente(pers.producto, pers.elecciones || []) : null
  const toggleEn = (setKey, val) => setPers(s => {
    const arr = s[setKey]
    return { ...s, [setKey]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
  })
  const confirmarPers = () => {
    // agregarItem suma 1 y fusiona lo idéntico: N unidades son N llamadas
    const uds = Math.max(1, pers.uds || 1)
    const anadirNVeces = (config) => { for (let i = 0; i < uds; i++) agregarItem(mesaId, personaActiva.id, config) }
    // En un menú lo que importa es QUÉ ha elegido el cliente: eso es lo que
    // cocina tiene que preparar, así que va en la nota de la comanda.
    if (esMenu(pers.producto)) {
      const detalle = resumenElecciones(pers.elecciones || [])
      anadirNVeces({
        productoId: pers.producto.id, nombre: pers.producto.nombre,
        precio: precioPers, tipo: pers.producto.tipo,
        elecciones: pers.elecciones || [],
        nota: [detalle, pers.nota.trim()].filter(Boolean).join(' · '),
      })
      setPers(null)
      return
    }
    const fmt = carta.formatos.find(f => f.id === pers.formato)
    const tp = carta.tiposPan.find(t => t.id === pers.tipo)
    anadirNVeces({
      productoId: pers.producto.id, nombre: pers.producto.nombre, precio: precioPers, tipo: pers.producto.tipo,
      pan: { formato: pers.formato, tipo: pers.tipo, nombreFormato: fmt.nombre, nombreTipo: tp.nombre },
      quitados: pers.quitados, anadidos: pers.anadidos, nota: pers.nota.trim(),
    })
    setPers(null)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div ref={cabeceraRef} style={{ padding: '1rem 1.25rem 0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{local?.nombre || t('Mesa') + ' ' + mesa.numero}</span>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 600 }}>
              {ojeando ? `${t('Mesa')} ${mesa.numero}` : `${t('Hola,')} ${yo.nombre} 👋`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')} title="Idioma / Language" aria-label="Idioma / Language" style={btnStyle('var(--color-surface-2)', { ...paso, padding: 0, fontSize: '1rem' })}>{idioma === 'es' ? '🇬🇧' : '🇪🇸'}</button>
            <button onClick={toggleAviso} title={avisoActivo ? t('Cancelar el aviso al camarero') : t('Llamar al camarero')} aria-label={t('Llamar al camarero')} style={btnStyle(avisoActivo ? '#10b981' : 'var(--color-surface-2)', { ...paso, padding: avisoActivo ? '0 0.75rem' : 0, width: avisoActivo ? 'auto' : `${TOQUE}px`, fontSize: '0.8rem' })}>{avisoActivo ? `🔔 ${t('Avisado')} ✕` : '🔔'}</button>

          </div>
        </div>
        {/* «Pedir para» solo tiene sentido si hay más gente en la mesa */}
        {!ojeando && mesa.personas.length > 1 && (
          <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', marginTop: '0.6rem', paddingBottom: '0.25rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', whiteSpace: 'nowrap', marginRight: '0.25rem' }}>{t('Pedir para:')}</span>
            <button onClick={() => setPidiendoPara(null)} style={btnStyle(!pedirParaOtro ? 'var(--color-accent)' : 'var(--color-inset)', { fontSize: '0.82rem', padding: '0.5rem 0.8rem', minHeight: '40px', whiteSpace: 'nowrap' })}>{yo.nombre} {t('(tú)')}</button>
            {mesa.personas.filter(p => p.id !== yo.id).map(p => (
              <button key={p.id} onClick={() => setPidiendoPara(p.id)} style={btnStyle(pidiendoPara === p.id ? 'var(--color-accent)' : 'var(--color-inset)', { fontSize: '0.82rem', padding: '0.5rem 0.8rem', minHeight: '40px', whiteSpace: 'nowrap' })}>{p.nombre}</button>
            ))}
          </div>
        )}
      </div>

      {misListos.length > 0 && (
        <div style={{ background: 'var(--tint-success-bg)', color: 'var(--tint-success-fg)', fontSize: '0.85rem', fontWeight: 700, padding: '0.55rem 1.25rem', textAlign: 'center', borderBottom: '1px solid var(--tint-success-bd)' }}>
          ✅ {t('¡Listo para ti!')} {misListos.map(p => `${p.cantidad}× ${p.nombre}`).join(', ')}
        </div>
      )}
      {pedirParaOtro && (
        <div style={{ background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)', fontSize: '0.78rem', padding: '0.4rem 1.25rem', textAlign: 'center' }}>{t('Estás pidiendo para')} <strong>{personaActiva.nombre}</strong></div>
      )}

      {/* Buscador (se va con el scroll: el atajo 🔍 de las categorías lo trae) */}
      <div style={{ padding: '0.75rem 1.25rem', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ position: 'relative' }}>
          <input ref={buscadorRef} value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder={t('🔍 Buscar en la carta…')} style={{ ...inputStyle, fontSize: '0.9rem', padding: '0.6rem 0.75rem' }} />
          {busqueda && <button onClick={() => setBusqueda('')} aria-label={t('Cancelar')} style={{ position: 'absolute', right: '0.15rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '1rem', ...paso }}>✕</button>}
        </div>
        {q && <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>{productosFiltrados.length} resultado(s) para «{busqueda}»</div>}
      </div>

      {/* Categorías: se quedan pegadas bajo la cabecera al bajar por la carta */}
      {!q && (
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.6rem 1.25rem', overflowX: 'auto', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: altoCabecera, zIndex: 9 }}>
          <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); buscadorRef.current?.focus() }} aria-label={t('🔍 Buscar en la carta…')}
            style={btnStyle('var(--color-surface-2)', { ...paso, padding: 0, flexShrink: 0 })}>🔍</button>
          {carta.categorias.map(cat => (
            <button key={cat.id} onClick={() => { setCategoriaActiva(cat.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={btnStyle(categoriaActiva === cat.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { whiteSpace: 'nowrap', fontSize: '0.88rem', padding: '0.5rem 0.9rem', minHeight: `${TOQUE}px` })}>
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
          const conOpciones = esMontadito || esMenu(prod)
          // Un producto simple pedido «tal cual» se puede subir y bajar desde la
          // propia tarjeta, sin pasar por el carrito.
          const yaPedido = conOpciones ? null : lineaSimplePendiente(itemsPendientes, prod.id)
          return (
            <div key={prod.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              {prod.imagen && <img src={prod.imagen} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '4rem', height: '4rem', objectFit: 'cover', borderRadius: '0.6rem', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{prod.nombre}</div>
                {descripcionUtil(prod) && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{descripcionUtil(prod)}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{esMontadito ? `${t('desde')} ${minPrecio(prod).toFixed(2)} €` : `${prod.precio.toFixed(2)} €`}</span>
                  {(prod.alergenos || []).length > 0 && (
                    <span title={'Alérgenos: ' + prod.alergenos.map(a => ALERGENO_INFO[a]?.nombre || a).join(', ')} style={{ fontSize: '0.72rem', letterSpacing: '0.1em', opacity: 0.85 }}>
                      {prod.alergenos.map(a => ALERGENO_INFO[a]?.emoji || '•').join('')}
                    </span>
                  )}
                </div>
              </div>
              {yaPedido ? (
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-inset)', border: '1px solid var(--color-accent)', borderRadius: '0.55rem', flexShrink: 0 }}>
                  <button onClick={() => cambiarCantidad(mesaId, personaActiva.id, yaPedido.uid, -1)} aria-label={`${t('Quitar una unidad')} · ${prod.nombre}`}
                    style={{ ...btnStyle('none', paso), color: 'var(--color-text)', boxShadow: 'none' }}>−</button>
                  <span style={{ minWidth: '1.4rem', textAlign: 'center', fontWeight: 800, color: 'var(--color-accent)' }}>{yaPedido.cantidad}</span>
                  <button onClick={() => agregarItem(mesaId, personaActiva.id, { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, tipo: prod.tipo })} aria-label={`${t('Añadir una unidad')} · ${prod.nombre}`}
                    style={{ ...btnStyle('none', paso), color: 'var(--color-text)', boxShadow: 'none' }}>+</button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const persNueva = { producto: prod, formato: (carta.formatos.find(f => prod.precios?.[f.id] != null) || carta.formatos[0])?.id, tipo: carta.tiposPan[0]?.id, quitados: [], anadidos: [], nota: '', elecciones: [], uds: 1 }
                    const config = { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, tipo: prod.tipo }
                    // sin nombre todavía: lo pedimos y luego seguimos solos
                    if (ojeando) return setIntento(conOpciones ? { tipo: 'opciones', pers: persNueva } : { tipo: 'anadir', config })
                    return conOpciones ? setPers(persNueva) : agregarItem(mesaId, personaActiva.id, config)
                  }}
                  style={btnStyle('var(--color-accent)', { padding: '0.5rem 0.9rem', minHeight: `${TOQUE}px`, whiteSpace: 'nowrap' })}
                >
                  {conOpciones ? t('Añadir') : t('+ Añadir')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      {itemsPendientes.length > 0 && (
        <div style={{ padding: '0.75rem 1.25rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', position: 'sticky', bottom: 'calc(62px + env(safe-area-inset-bottom))', zIndex: 12 }}>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>{udsPendientes} {t('producto(s)')} · {totalPendiente.toFixed(2)} €</span>
          <button onClick={() => setVista('pedido')} style={btnStyle('var(--color-accent)', { padding: '0.625rem 1.25rem', minHeight: `${TOQUE}px` })}>{t('Ver pedido →')}</button>
        </div>
      )}

      <div style={huecoPestanas} />
      {pestanas}

      {/* Hoja del nombre: solo cuando el cliente ya ha decidido pedir algo */}
      {intento && ojeando && (
        <div onClick={() => setIntento(null)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={hoja}>
            <div style={grabHandle} />
            <h3 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: '0.3rem' }}>
              {mesa.estado !== 'libre' ? t('Unirme a la mesa') : `${t('Mesa')} ${mesa.numero}`}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.9rem' }}>
              {mesa.estado !== 'libre'
                ? <>{t('Ya están en la mesa:')} <strong style={{ color: 'var(--color-text)' }}>{mesa.personas.map(p => p.nombre).join(', ')}</strong>. {t('Únete escribiendo tu nombre.')}</>
                : t('Solo tu nombre, para que el camarero sepa de quién es cada plato.')}
            </p>
            <input value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && nombre.trim()) unirse() }} placeholder={t('Tu nombre')} autoFocus
              style={{ ...inputStyle, fontSize: '1rem', marginBottom: '0.75rem' }} />
            <button onClick={unirse} disabled={!nombre.trim()}
              style={btnStyle(nombre.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)', { width: '100%', minHeight: `${TOQUE + 6}px`, fontSize: '1rem', cursor: nombre.trim() ? 'pointer' : 'not-allowed' })}>
              {mesa.estado !== 'libre' ? t('Unirme a la mesa') : t('Abrir mesa y pedir')}
            </button>
            <button onClick={() => setIntento(null)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.6rem', width: '100%', minHeight: `${TOQUE}px` }}>{t('Seguir mirando la carta')}</button>
          </div>
        </div>
      )}

      {/* Hoja de personalización */}
      {pers && (
        <div onClick={() => setPers(null)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={hojaCol}>
            <div style={hojaCabecera}>
              <div style={grabHandle} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>{pers.producto.nombre}</h3>
                <button onClick={() => setPers(null)} aria-label={t('Cerrar')} style={btnStyle('var(--color-surface-3)', { ...paso, padding: 0 })}>✕</button>
              </div>
            </div>
            <div style={hojaCuerpo}>
            {pers.producto.imagen && <img src={pers.producto.imagen} alt="" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '9rem', objectFit: 'cover', borderRadius: '0.75rem', marginBottom: '0.75rem' }} />}
            {(pers.producto.alergenos || []).length > 0 && (
              <p style={{ fontSize: '0.74rem', color: 'var(--tint-warning-fg)', marginBottom: '0.75rem' }}>
                ⚠️ {t('Alérgenos')}: {pers.producto.alergenos.map(a => `${ALERGENO_INFO[a]?.emoji || ''} ${ALERGENO_INFO[a]?.nombre || a}`).join(' · ')}
              </p>
            )}

            {/* Menú del día / combo: elegir de cada grupo */}
            {esMenu(pers.producto) && pers.producto.menu.grupos.map((g, gi) => {
              const titulo = g.titulo || `${t('Grupo')} ${gi + 1}`
              const elegidas = (pers.elecciones || []).filter(e => e.grupo === titulo)
              return (
                <div key={gi} style={{ marginBottom: '0.85rem' }}>
                  <p style={labelMini}>
                    {titulo}
                    <span style={{ marginLeft: '0.4rem', fontWeight: 400, opacity: 0.8 }}>
                      {(g.max ?? 1) > 1 ? `(${t('elige hasta')} ${g.max})` : ''}
                      {elegidas.length === 0 && <span style={{ color: 'var(--tint-warning-fg)' }}> · {t('elige uno')}</span>}
                    </span>
                  </p>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {(g.opciones || []).map((o, oi) => {
                      const sel = elegidas.some(e => e.opcion === o.nombre)
                      return (
                        <button key={oi}
                          onClick={() => setPers(s => ({ ...s, elecciones: alternarOpcion({ ...g, titulo }, o, s.elecciones || []) }))}
                          style={btnStyle(sel ? 'var(--color-accent)' : 'var(--color-surface-2)', { fontSize: '0.85rem', padding: '0.55rem 0.8rem' })}>
                          {o.nombre}{o.sup ? ` +${Number(o.sup).toFixed(2)} €` : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Formato (tamaño/pan según el local) */}
            {!esMenu(pers.producto) && <>
            <p style={labelMini}>{etiquetas.formatos}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {carta.formatos.filter(f => pers.producto.precios?.[f.id] != null).map(f => (
                <button key={f.id} onClick={() => setPers(s => ({ ...s, formato: f.id }))} style={btnStyle(pers.formato === f.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { flex: 1, minWidth: '7rem', padding: '0.6rem', fontSize: '0.85rem' })}>
                  {f.nombre}<br /><span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{(pers.producto.precios?.[f.id] ?? 0).toFixed(2)} €</span>
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
            </>}

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

            <input value={pers.nota} onChange={e => setPers(s => ({ ...s, nota: e.target.value }))} placeholder="📝 Otra indicación (opcional)" style={{ ...inputStyle, fontSize: '0.82rem', padding: '0.5rem 0.7rem' }} />
            </div>

            {/* Pie quieto: cantidad + confirmar, siempre a la vista */}
            <div style={hojaPie}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.55rem', flexShrink: 0 }}>
                <button onClick={() => setPers(s => ({ ...s, uds: Math.max(1, (s.uds || 1) - 1) }))} aria-label={t('Quitar una unidad')}
                  style={{ ...btnStyle('none', paso), color: (pers.uds || 1) > 1 ? 'var(--color-text)' : 'var(--color-faint)', boxShadow: 'none' }}>−</button>
                <span style={{ minWidth: '1.5rem', textAlign: 'center', fontWeight: 800 }}>{pers.uds || 1}</span>
                <button onClick={() => setPers(s => ({ ...s, uds: (s.uds || 1) + 1 }))} aria-label={t('Añadir una unidad')}
                  style={{ ...btnStyle('none', paso), color: 'var(--color-text)', boxShadow: 'none' }}>+</button>
              </div>
              <button onClick={confirmarPers} disabled={menuIncompleto}
                style={btnStyle(menuIncompleto ? 'var(--color-surface-3)' : 'var(--color-accent)', { flex: 1, minHeight: `${TOQUE + 6}px`, fontSize: '1rem', cursor: menuIncompleto ? 'not-allowed' : 'pointer' })}>
                {menuIncompleto
                  ? `${t('Elige')} ${faltaGrupo?.titulo || ''}`
                  : `${t('Añadir al pedido')} · ${(precioPers * (pers.uds || 1)).toFixed(2)} €`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Persona «en blanco» mientras se ojea la carta sin haber dado el nombre
const SIN_PERSONA = { id: null, nombre: '', items: [] }

// El recibo en pantalla, con la misma pinta que el ticket de papel. Lleva la
// clase `ticket-print` para que al imprimir salga solo esto (ver index.css).
function ReciboCliente({ recibo, t }) {
  const f = (n) => n.toFixed(2)
  const m = recibo.moneda
  return (
    <div className="ticket-print" style={{ ...cardStyle, fontFamily: 'ui-monospace, "Courier New", monospace', background: 'var(--color-surface)' }}>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.05rem' }}>{recibo.local.nombre}</div>
      {recibo.local.cif && <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-muted)' }}>N.I.F.: {recibo.local.cif}</div>}
      {recibo.local.direccion && <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-muted)' }}>{recibo.local.direccion}</div>}

      <div style={{ borderTop: '1px dashed var(--color-border)', margin: '0.6rem 0' }} />
      <div style={filaRecibo}><span>{t('Fecha')}</span><span>{new Date(recibo.fecha).toLocaleString('es-ES')}</span></div>
      {recibo.mesa.numero != null && <div style={filaRecibo}><span>{t('Mesa')}</span><span>{recibo.mesa.numero}{recibo.mesa.zona ? ` · ${recibo.mesa.zona}` : ''}</span></div>}
      {recibo.nombre && <div style={filaRecibo}><span>{t('Cliente')}</span><span>{recibo.nombre}</span></div>}
      <div style={{ borderTop: '1px dashed var(--color-border)', margin: '0.6rem 0' }} />

      {recibo.lineas.map((l, i) => (
        <div key={i} style={{ marginBottom: '0.3rem' }}>
          <div style={filaRecibo}>
            <span>{l.uds}× {l.nombre}</span>
            <span style={{ fontWeight: 700 }}>{f(l.importe)} {m}</span>
          </div>
          {(l.extra || l.compartido) && (
            <div style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>
              {[l.extra, l.compartido ? t('compartido') : ''].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      ))}

      <div style={{ borderTop: '1px dashed var(--color-border)', margin: '0.6rem 0' }} />
      <div style={{ ...filaRecibo, color: 'var(--color-muted)', fontSize: '0.75rem' }}><span>{t('Base imponible')}</span><span>{f(recibo.base)} {m}</span></div>
      <div style={{ ...filaRecibo, color: 'var(--color-muted)', fontSize: '0.75rem' }}><span>IVA ({recibo.ivaPct}%)</span><span>{f(recibo.iva)} {m}</span></div>
      {recibo.propina > 0 && <div style={{ ...filaRecibo, color: 'var(--color-muted)', fontSize: '0.75rem' }}><span>{t('Propina')}</span><span>{f(recibo.propina)} {m}</span></div>}
      <div style={{ ...filaRecibo, fontSize: '1.15rem', fontWeight: 800, marginTop: '0.3rem' }}>
        <span>Total</span><span style={{ color: 'var(--color-accent)' }}>{f(recibo.total + recibo.propina)} {m}</span>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.7rem' }}>{recibo.local.pie}</div>
      <div style={{ textAlign: 'center', fontSize: '0.64rem', color: 'var(--color-faint)', marginTop: '0.5rem', lineHeight: 1.4 }}>
        {t('Copia para el cliente de su consumo. No sustituye a la factura simplificada, que emite el establecimiento.')}
      </div>
    </div>
  )
}

const filaRecibo = { display: 'flex', justifyContent: 'space-between', gap: '0.6rem', fontSize: '0.8rem' }

// Barra de abajo: las tres cosas que hace un cliente en la mesa — mirar la
// carta, ver cómo va lo suyo y pagar. Antes eran emojis sueltos en la cabecera
// (🛒 💰) y nadie encontraba la cuenta.
function Pestanas({ vista, setVista, uds, enMarcha, listos, aPagar, pagado, t }) {
  const tabs = [
    { id: 'carta', emoji: '🍽', label: t('Ver carta') },
    { id: 'pedido', emoji: '🧾', label: t('Mi pedido'), badge: uds || null, punto: listos > 0 ? 'listo' : enMarcha > 0 ? 'marcha' : null },
    { id: 'cuenta', emoji: '💳', label: t('Pagar'), pie: pagado ? `✓ ${t('Pagado')}` : aPagar > 0 ? `${aPagar.toFixed(2)} €` : null },
  ]
  return (
    <nav style={barraPestanas}>
      {tabs.map(tb => {
        const activa = vista === tb.id
        return (
          <button key={tb.id} onClick={() => setVista(tb.id)} aria-current={activa ? 'page' : undefined}
            style={{ ...pestana, color: activa ? 'var(--color-accent)' : 'var(--color-muted)', fontWeight: activa ? 800 : 600 }}>
            <span style={{ position: 'relative', fontSize: '1.35rem', lineHeight: 1 }}>
              {tb.emoji}
              {tb.badge && <span style={badge}>{tb.badge}</span>}
              {tb.punto && <span style={{ ...puntoEstado, background: tb.punto === 'listo' ? 'var(--color-success)' : 'var(--color-info)' }} />}
            </span>
            <span style={{ fontSize: '0.68rem' }}>{tb.label}</span>
            {tb.pie && <span style={{ fontSize: '0.66rem', color: activa ? 'var(--color-accent)' : 'var(--color-faint)' }}>{tb.pie}</span>}
          </button>
        )
      })}
    </nav>
  )
}
const grabHandle = { width: '36px', height: '4px', borderRadius: '9999px', background: 'var(--color-border)', margin: '-0.25rem auto 0.85rem' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50, animation: 'fadeIn 0.2s ease both' }
// La hoja es una columna: cabecera y pie quietos, y el contenido scrollando en
// medio. Así el botón de añadir NUNCA queda fuera de pantalla (antes había que
// bajar por todos los extras para encontrarlo).
const hoja = { background: 'var(--color-surface)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', padding: '1.25rem', width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', borderTop: '1px solid var(--color-border)', boxShadow: '0 -22px 50px -20px rgba(0,0,0,0.8)', animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }
const hojaCol = { ...hoja, padding: 0, overflowY: 'visible', display: 'flex', flexDirection: 'column' }
const hojaCabecera = { padding: '1.25rem 1.25rem 0.75rem', borderBottom: '1px solid var(--color-border)' }
const hojaCuerpo = { padding: '0.9rem 1.25rem', overflowY: 'auto', flex: 1, minHeight: 0 }
const hojaPie = { padding: '0.85rem 1.25rem calc(0.85rem + env(safe-area-inset-bottom))', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', gap: '0.6rem' }
// 44 px es el mínimo cómodo de toque en móvil (Apple HIG / Material)
const TOQUE = 44
const paso = { width: `${TOQUE}px`, height: `${TOQUE}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }

const btnStyle = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : 'white', border: 'none', borderRadius: '0.55rem', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', ...extra })
const cardStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }
const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: 'var(--color-text)', width: '100%' }
const chipEstado = (bg, fg) => ({ background: bg, color: fg, borderRadius: '9999px', padding: '0.3rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 })
const labelMini = { fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }
const badge = { position: 'absolute', top: '-4px', right: '-8px', background: 'var(--color-accent)', color: 'white', borderRadius: '9999px', fontSize: '0.65rem', padding: '0 4px', fontWeight: 700, minWidth: '1rem', textAlign: 'center' }
const puntoEstado = { position: 'absolute', top: '-1px', right: '-6px', width: '0.55rem', height: '0.55rem', borderRadius: '9999px', border: '2px solid var(--color-surface)' }
const barraPestanas = { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, maxWidth: '480px', margin: '0 auto', display: 'flex', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -8px 24px -16px rgba(0,0,0,0.8)' }
const pestana = { flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', padding: '0.5rem 0.25rem', minHeight: '58px' }
// hueco para que la barra fija no tape el final del contenido
const huecoPestanas = { height: 'calc(62px + env(safe-area-inset-bottom))' }
