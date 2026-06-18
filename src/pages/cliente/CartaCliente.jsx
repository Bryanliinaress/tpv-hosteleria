import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore'

export default function CartaCliente() {
  const { mesaId } = useParams()
  const { carta, mesas, unirseAMesa, addItem, removeItem, confirmarPedido, pedirCuenta, pagarParte } = useStore()
  const mesa = mesas.find(m => m.id === mesaId)

  const [miPersonaId, setMiPersonaId] = useState(() => localStorage.getItem(`tpv-yo-${mesaId}`))
  const [nombre, setNombre] = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState(carta.categorias[0].id)
  const [pidiendoPara, setPidiendoPara] = useState(null) // personaId; null = yo
  const [vista, setVista] = useState('carta') // carta | pedido | cuenta
  const [cerrada, setCerrada] = useState(false)

  // ¿Mi comensal sigue en la mesa? (si la mesa se reinició, ya no estará)
  const yo = mesa?.personas.find(p => p.id === miPersonaId)

  // Si la mesa se reinició (todos pagaron) y yo estaba dentro → pantalla de gracias
  useEffect(() => {
    if (miPersonaId && mesa && !yo && mesa.estado === 'libre') setCerrada(true)
  }, [miPersonaId, mesa, yo])

  if (!mesa) return <div style={{ padding: '2rem', color: 'var(--color-muted)' }}>Mesa no encontrada</div>

  const limpiarDispositivo = () => {
    localStorage.removeItem(`tpv-yo-${mesaId}`)
    setMiPersonaId(null)
    setCerrada(false)
    setVista('carta')
    setPidiendoPara(null)
  }

  // ── Pantalla de GRACIAS (tras cierre/pago total) ──────
  if (cerrada) {
    return (
      <div style={centerScreen}>
        <div style={{ fontSize: '4rem' }}>✅</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, textAlign: 'center' }}>¡Cuenta pagada!</h1>
        <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>Gracias por tu visita a la Mesa {mesa.numero}. ¡Hasta pronto! 👋</p>
        <button onClick={limpiarDispositivo} style={btnStyle('#f97316', { padding: '0.875rem 1.5rem', fontSize: '1rem' })}>
          Empezar una nueva mesa
        </button>
      </div>
    )
  }

  // ── Pantalla de IDENTIFICACIÓN (escribir nombre) ──────
  if (!yo) {
    const ocupada = mesa.estado !== 'libre'
    const unirse = () => {
      const id = unirseAMesa(mesaId, nombre)
      localStorage.setItem(`tpv-yo-${mesaId}`, id)
      setMiPersonaId(id)
      setNombre('')
    }
    return (
      <div style={centerScreen}>
        <div style={{ fontSize: '3.5rem' }}>🍽</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Mesa {mesa.numero}</h1>
        {ocupada ? (
          <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>
            Ya están en la mesa: <strong style={{ color: 'var(--color-text)' }}>{mesa.personas.map(p => p.nombre).join(', ')}</strong>.<br />Únete escribiendo tu nombre.
          </p>
        ) : (
          <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>¡Bienvenido/a! Escribe tu nombre para empezar a pedir.</p>
        )}
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && nombre.trim()) unirse() }}
          placeholder="Tu nombre"
          autoFocus
          style={{ ...inputStyle, maxWidth: '300px', textAlign: 'center', fontSize: '1rem' }}
        />
        <button onClick={unirse} disabled={!nombre.trim()} style={btnStyle(nombre.trim() ? '#f97316' : '#334155', { width: '100%', maxWidth: '300px', padding: '0.875rem', fontSize: '1rem', cursor: nombre.trim() ? 'pointer' : 'not-allowed' })}>
          {ocupada ? 'Unirme a la mesa' : 'Abrir mesa y pedir'}
        </button>
      </div>
    )
  }

  // ── Cliente identificado ──────────────────────────────
  const personaActiva = mesa.personas.find(p => p.id === pidiendoPara) || yo
  const productosFiltrados = carta.productos.filter(p => p.categoria === categoriaActiva && p.disponible)
  const itemsPendientes = personaActiva.items.filter(i => i.estado === 'pendiente')
  const itemsEnviados = personaActiva.items.filter(i => i.estado === 'enviado')
  const totalPendiente = itemsPendientes.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const totalMesa = mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
  const totalPendienteMesa = mesa.personas.filter(p => !p.pagado).reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
  const pedirParaOtro = personaActiva.id !== yo.id

  // ── Vista CUENTA ──────────────────────────────────────
  if (vista === 'cuenta') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.25rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setVista('carta')} style={btnStyle('#1e293b')}>←</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Cuenta — Mesa {mesa.numero}</h2>
        </div>
        {mesa.personas.map(p => {
          const total = p.items.reduce((s, i) => s + i.precio * i.cantidad, 0)
          const esYo = p.id === yo.id
          return (
            <div key={p.id} style={{ ...cardStyle, marginBottom: '0.75rem', borderColor: p.pagado ? '#10b981' : 'var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#f97316' }}>{p.nombre}{esYo && <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> (tú)</span>}</div>
                {p.pagado && <span style={{ fontSize: '0.7rem', background: '#052e16', color: '#10b981', borderRadius: '9999px', padding: '0.15rem 0.6rem', fontWeight: 700 }}>✓ Pagado</span>}
              </div>
              {p.items.length === 0
                ? <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Sin pedidos</p>
                : p.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.25rem 0' }}>
                    <span style={{ color: 'var(--color-muted)' }}>{item.cantidad}× {item.nombre}</span>
                    <span style={{ fontWeight: 600 }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                  </div>
                ))
              }
              <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>{total.toFixed(2)} €</span>
                {!p.pagado && (
                  <button onClick={() => pagarParte(mesaId, p.id)} style={btnStyle('#10b981', { padding: '0.4rem 0.9rem', fontSize: '0.8rem' })}>
                    {esYo ? 'Pagar mi parte' : `Pagar parte de ${p.nombre}`}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        <div style={{ ...cardStyle, borderColor: '#f97316', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
            <span>Pendiente de pago</span>
            <span style={{ color: '#f97316' }}>{totalPendienteMesa.toFixed(2)} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            <span>Total mesa</span>
            <span>{totalMesa.toFixed(2)} €</span>
          </div>
        </div>

        {mesa.estado !== 'esperando_cobro' ? (
          <button onClick={() => pedirCuenta(mesaId)} style={btnStyle('#1e293b', { width: '100%', padding: '0.875rem', fontSize: '0.95rem' })}>
            🧑‍🍳 Que cobre el camarero (en efectivo/tarjeta)
          </button>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem', background: '#052e16', borderRadius: '0.75rem', color: '#10b981', fontWeight: 700 }}>
            ✅ El camarero viene a cobrar
          </div>
        )}
      </div>
    )
  }

  // ── Vista MI PEDIDO ───────────────────────────────────
  if (vista === 'pedido') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.25rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <button onClick={() => setVista('carta')} style={btnStyle('#1e293b')}>←</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Pedido de {personaActiva.nombre}{!pedirParaOtro && ' (tú)'}</h2>
        </div>

        {itemsEnviados.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={labelMini}>Ya enviado a cocina/barra</p>
            {itemsEnviados.map((item, idx) => (
              <div key={idx} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', opacity: 0.7 }}>
                <span style={{ fontSize: '0.875rem' }}>{item.cantidad}× {item.nombre}</span>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
              </div>
            ))}
          </div>
        )}

        {itemsPendientes.length > 0 ? (
          <>
            <p style={labelMini}>Por enviar</p>
            {itemsPendientes.map((item, idx) => (
              <div key={idx} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{item.precio.toFixed(2)} € / ud</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => removeItem(mesaId, personaActiva.id, item.productoId)} style={btnStyle('#334155', { padding: '0.25rem 0.625rem', fontSize: '1rem' })}>−</button>
                  <span style={{ fontWeight: 700, minWidth: '1.5rem', textAlign: 'center' }}>{item.cantidad}</span>
                  <button onClick={() => addItem(mesaId, personaActiva.id, carta.productos.find(p => p.id === item.productoId))} style={btnStyle('#334155', { padding: '0.25rem 0.625rem', fontSize: '1rem' })}>+</button>
                  <span style={{ fontWeight: 700, minWidth: '3rem', textAlign: 'right' }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                </div>
              </div>
            ))}
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '1rem', borderColor: '#f97316' }}>
              <span>Total pendiente</span>
              <span style={{ color: '#f97316' }}>{totalPendiente.toFixed(2)} €</span>
            </div>
            <button onClick={() => { confirmarPedido(mesaId); setVista('carta') }} style={btnStyle('#f97316', { width: '100%', padding: '0.875rem', fontSize: '1rem' })}>
              Enviar pedido 🚀
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</div>
            <p>Aún no hay nada por enviar</p>
            <button onClick={() => setVista('carta')} style={{ ...btnStyle('#f97316'), marginTop: '1rem' }}>Ver carta</button>
          </div>
        )}
      </div>
    )
  }

  // ── Vista CARTA ───────────────────────────────────────
  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mesa {mesa.numero}</span>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#f97316', fontWeight: 600 }}>Hola, {yo.nombre} 👋</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setVista('pedido')} style={{ ...btnStyle('#1e293b', { fontSize: '0.8rem', padding: '0.375rem 0.75rem' }), position: 'relative' }}>
              🛒 {itemsPendientes.length > 0 && <span style={badge}>{itemsPendientes.length}</span>}
            </button>
            <button onClick={() => setVista('cuenta')} style={btnStyle('#1e293b', { fontSize: '0.8rem', padding: '0.375rem 0.75rem' })}>💰</button>
          </div>
        </div>

        {/* Pedir para: yo u otro comensal */}
        <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', paddingBottom: '0.25rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', whiteSpace: 'nowrap', marginRight: '0.25rem' }}>Pedir para:</span>
          <button onClick={() => setPidiendoPara(null)} style={btnStyle(!pedirParaOtro ? '#f97316' : '#0f172a', { fontSize: '0.75rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' })}>
            {yo.nombre} (tú)
          </button>
          {mesa.personas.filter(p => p.id !== yo.id).map(p => (
            <button key={p.id} onClick={() => setPidiendoPara(p.id)} style={btnStyle(pidiendoPara === p.id ? '#f97316' : '#0f172a', { fontSize: '0.75rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' })}>
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      {pedirParaOtro && (
        <div style={{ background: '#2d1900', color: '#f59e0b', fontSize: '0.78rem', padding: '0.4rem 1.25rem', textAlign: 'center' }}>
          Estás pidiendo para <strong>{personaActiva.nombre}</strong>
        </div>
      )}

      {/* Categorías */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.25rem', overflowX: 'auto', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        {carta.categorias.map(cat => (
          <button key={cat.id} onClick={() => setCategoriaActiva(cat.id)} style={btnStyle(categoriaActiva === cat.id ? '#f97316' : '#1e293b', { whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.375rem 0.75rem' })}>
            {cat.emoji} {cat.nombre}
          </button>
        ))}
      </div>

      {/* Productos */}
      <div style={{ flex: 1, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {productosFiltrados.map(prod => {
          const enPedido = personaActiva.items.find(i => i.productoId === prod.id && i.estado === 'pendiente')
          return (
            <div key={prod.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, marginRight: '1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{prod.nombre}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{prod.descripcion}</div>
                <div style={{ fontWeight: 700, color: '#f97316' }}>{prod.precio.toFixed(2)} €</div>
              </div>
              {enPedido ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => removeItem(mesaId, personaActiva.id, prod.id)} style={btnStyle('#334155', { padding: '0.25rem 0.625rem' })}>−</button>
                  <span style={{ fontWeight: 700, minWidth: '1rem', textAlign: 'center' }}>{enPedido.cantidad}</span>
                  <button onClick={() => addItem(mesaId, personaActiva.id, prod)} style={btnStyle('#f97316', { padding: '0.25rem 0.625rem' })}>+</button>
                </div>
              ) : (
                <button onClick={() => addItem(mesaId, personaActiva.id, prod)} style={btnStyle('#f97316', { padding: '0.5rem 1rem' })}>+</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      {itemsPendientes.length > 0 && (
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', bottom: 0 }}>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>{itemsPendientes.reduce((s, i) => s + i.cantidad, 0)} producto(s) · {totalPendiente.toFixed(2)} €</span>
          <button onClick={() => setVista('pedido')} style={btnStyle('#f97316', { padding: '0.625rem 1.25rem' })}>Ver pedido →</button>
        </div>
      )}
    </div>
  )
}

const centerScreen = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.25rem' }

const btnStyle = (bg, extra = {}) => ({
  background: bg,
  color: 'white',
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.5rem 1rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.875rem',
  transition: 'opacity 0.15s',
  ...extra,
})

const cardStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.75rem',
  padding: '1rem',
}

const inputStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  padding: '0.75rem 1rem',
  color: 'var(--color-text)',
  width: '100%',
}

const labelMini = { fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }

const badge = { position: 'absolute', top: '-4px', right: '-4px', background: '#f97316', color: 'white', borderRadius: '9999px', fontSize: '0.65rem', padding: '0 4px', fontWeight: 700 }
