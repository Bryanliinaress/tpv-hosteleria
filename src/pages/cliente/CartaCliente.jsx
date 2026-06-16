import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore'

const ESTADO_COLOR = {
  libre: '#10b981',
  ocupada: '#f59e0b',
  esperando_cobro: '#f43f5e',
}

export default function CartaCliente() {
  const { mesaId } = useParams()
  const { carta, mesas, ocuparMesa, addItem, removeItem, confirmarPedido, pedirCuenta } = useStore()
  const mesa = mesas.find(m => m.id === mesaId)

  const [categoriaActiva, setCategoriaActiva] = useState(carta.categorias[0].id)
  const [personaActiva, setPersonaActiva] = useState(null)
  const [numPersonas, setNumPersonas] = useState(2)
  const [vistaActiva, setVistaActiva] = useState('carta') // carta | pedido | cuenta

  if (!mesa) return <div style={{ padding: '2rem', color: 'var(--color-muted)' }}>Mesa no encontrada</div>

  // ── Mesa libre: pantalla de bienvenida ────────────────
  if (mesa.estado === 'libre') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.5rem' }}>
        <div style={{ fontSize: '4rem' }}>🍽</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Mesa {mesa.numero}</h1>
        <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>¡Bienvenidos! ¿Cuántas personas sois?</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setNumPersonas(Math.max(1, numPersonas - 1))} style={btnStyle('#334155')}>−</button>
          <span style={{ fontSize: '2rem', fontWeight: 700, minWidth: '2rem', textAlign: 'center' }}>{numPersonas}</span>
          <button onClick={() => setNumPersonas(Math.min(10, numPersonas + 1))} style={btnStyle('#334155')}>+</button>
        </div>
        <button onClick={() => { ocuparMesa(mesaId, numPersonas); setPersonaActiva('p1') }} style={btnStyle('#f97316', { width: '100%', maxWidth: '300px', padding: '0.875rem', fontSize: '1rem' })}>
          Abrir mesa
        </button>
      </div>
    )
  }

  const productosFiltrados = carta.productos.filter(p => p.categoria === categoriaActiva && p.disponible)
  const persona = mesa.personas.find(p => p.id === personaActiva) || mesa.personas[0]
  const itemsPendientes = persona?.items.filter(i => i.estado === 'pendiente') || []
  const itemsEnviados = persona?.items.filter(i => i.estado === 'enviado') || []
  const totalPendiente = itemsPendientes.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const totalPersona = persona?.items.reduce((s, i) => s + i.precio * i.cantidad, 0) || 0
  const totalMesa = mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)

  // ── Vista CUENTA ──────────────────────────────────────
  if (vistaActiva === 'cuenta') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.25rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setVistaActiva('carta')} style={btnStyle('#1e293b')}>←</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Cuenta — Mesa {mesa.numero}</h2>
        </div>
        {mesa.personas.map(p => (
          <div key={p.id} style={{ ...cardStyle, marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#f97316' }}>{p.nombre}</div>
            {p.items.length === 0
              ? <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Sin pedidos</p>
              : p.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.25rem 0' }}>
                  <span style={{ color: 'var(--color-muted)' }}>{item.cantidad}× {item.nombre}</span>
                  <span style={{ fontWeight: 600 }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                </div>
              ))
            }
            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: '#f97316' }}>{p.items.reduce((s, i) => s + i.precio * i.cantidad, 0).toFixed(2)} €</span>
            </div>
          </div>
        ))}
        <div style={{ ...cardStyle, borderColor: '#f97316', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
            <span>Total mesa</span>
            <span style={{ color: '#f97316' }}>{totalMesa.toFixed(2)} €</span>
          </div>
        </div>
        {mesa.estado !== 'esperando_cobro' && (
          <button onClick={() => pedirCuenta(mesaId)} style={btnStyle('#f97316', { width: '100%', padding: '0.875rem', fontSize: '1rem' })}>
            Pedir la cuenta al camarero
          </button>
        )}
        {mesa.estado === 'esperando_cobro' && (
          <div style={{ textAlign: 'center', padding: '1rem', background: '#052e16', borderRadius: '0.75rem', color: '#10b981', fontWeight: 700 }}>
            ✅ El camarero viene a cobrar
          </div>
        )}
      </div>
    )
  }

  // ── Vista MI PEDIDO ───────────────────────────────────
  if (vistaActiva === 'pedido') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.25rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setVistaActiva('carta')} style={btnStyle('#1e293b')}>←</button>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Mi pedido</h2>
        </div>
        {/* Selector persona */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {mesa.personas.map(p => (
            <button key={p.id} onClick={() => setPersonaActiva(p.id)} style={btnStyle(personaActiva === p.id ? '#f97316' : '#1e293b', { fontSize: '0.8rem', padding: '0.375rem 0.75rem' })}>
              {p.nombre}
            </button>
          ))}
        </div>

        {itemsEnviados.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enviado a cocina/barra</p>
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
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por enviar</p>
            {itemsPendientes.map((item, idx) => (
              <div key={idx} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{item.precio.toFixed(2)} € / ud</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => removeItem(mesaId, persona.id, item.productoId)} style={btnStyle('#334155', { padding: '0.25rem 0.625rem', fontSize: '1rem' })}>−</button>
                  <span style={{ fontWeight: 700, minWidth: '1.5rem', textAlign: 'center' }}>{item.cantidad}</span>
                  <button onClick={() => addItem(mesaId, persona.id, carta.productos.find(p => p.id === item.productoId))} style={btnStyle('#334155', { padding: '0.25rem 0.625rem', fontSize: '1rem' })}>+</button>
                  <span style={{ fontWeight: 700, minWidth: '3rem', textAlign: 'right' }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
                </div>
              </div>
            ))}
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '1rem', borderColor: '#f97316' }}>
              <span>Total pendiente</span>
              <span style={{ color: '#f97316' }}>{totalPendiente.toFixed(2)} €</span>
            </div>
            <button onClick={() => { confirmarPedido(mesaId); setVistaActiva('carta') }} style={btnStyle('#f97316', { width: '100%', padding: '0.875rem', fontSize: '1rem' })}>
              Enviar pedido 🚀
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</div>
            <p>Tu pedido está vacío</p>
            <button onClick={() => setVistaActiva('carta')} style={{ ...btnStyle('#f97316'), marginTop: '1rem' }}>Ver carta</button>
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
            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>· {mesa.personas.length} personas</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setVistaActiva('pedido')} style={{ ...btnStyle('#1e293b', { fontSize: '0.8rem', padding: '0.375rem 0.75rem' }), position: 'relative' }}>
              🛒 {itemsPendientes.length > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#f97316', color: 'white', borderRadius: '9999px', fontSize: '0.65rem', padding: '0 4px', fontWeight: 700 }}>{itemsPendientes.length}</span>}
            </button>
            <button onClick={() => setVistaActiva('cuenta')} style={btnStyle('#1e293b', { fontSize: '0.8rem', padding: '0.375rem 0.75rem' })}>💰</button>
          </div>
        </div>
        {/* Selector persona */}
        <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {mesa.personas.map(p => (
            <button key={p.id} onClick={() => setPersonaActiva(p.id)} style={btnStyle(personaActiva === p.id || (!personaActiva && p.id === 'p1') ? '#f97316' : '#0f172a', { fontSize: '0.75rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' })}>
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

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
          const enPedido = persona?.items.find(i => i.productoId === prod.id && i.estado === 'pendiente')
          return (
            <div key={prod.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, marginRight: '1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{prod.nombre}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{prod.descripcion}</div>
                <div style={{ fontWeight: 700, color: '#f97316' }}>{prod.precio.toFixed(2)} €</div>
              </div>
              {enPedido ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => removeItem(mesaId, (personaActiva || 'p1'), prod.id)} style={btnStyle('#334155', { padding: '0.25rem 0.625rem' })}>−</button>
                  <span style={{ fontWeight: 700, minWidth: '1rem', textAlign: 'center' }}>{enPedido.cantidad}</span>
                  <button onClick={() => addItem(mesaId, (personaActiva || 'p1'), prod)} style={btnStyle('#f97316', { padding: '0.25rem 0.625rem' })}>+</button>
                </div>
              ) : (
                <button onClick={() => addItem(mesaId, (personaActiva || 'p1'), prod)} style={btnStyle('#f97316', { padding: '0.5rem 1rem' })}>+</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      {itemsPendientes.length > 0 && (
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>{itemsPendientes.reduce((s, i) => s + i.cantidad, 0)} producto(s) · {totalPendiente.toFixed(2)} €</span>
          <button onClick={() => setVistaActiva('pedido')} style={btnStyle('#f97316', { padding: '0.625rem 1.25rem' })}>Ver pedido →</button>
        </div>
      )}
    </div>
  )
}

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
  position: 'relative',
  ...extra,
})

const cardStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.75rem',
  padding: '1rem',
}
