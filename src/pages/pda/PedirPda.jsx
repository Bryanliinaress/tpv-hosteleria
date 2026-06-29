import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { pedirTexto } from '../../store/useUI'

// Toma de pedidos desde la PDA del camarero, para un comensal de la mesa.
export default function PedirPda({ mesaId, onClose }) {
  const { carta, mesas, agregarItem, cambiarCantidad, confirmarPedido, unirseAMesa } = useStore()
  const mesa = mesas.find(m => m.id === mesaId)
  const [personaId, setPersonaId] = useState(mesa?.personas[0]?.id || null)
  const [cat, setCat] = useState(carta.categorias[0].id)
  const [pers, setPers] = useState(null) // personalización de montadito

  if (!mesa) return null
  const persona = mesa.personas.find(p => p.id === personaId) || mesa.personas[0]
  const productos = carta.productos.filter(p => p.categoria === cat && p.disponible)
  const pendientes = persona?.items.filter(i => i.estado === 'pendiente') || []
  const totalPend = pendientes.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const nuevoComensal = async () => {
    const nombre = await pedirTexto({ titulo: 'Nuevo comensal', placeholder: 'Nombre (opcional)', confirmar: 'Añadir' })
    if (nombre === null) return
    const id = unirseAMesa(mesaId, nombre)
    setPersonaId(id)
  }

  const precioPers = pers ? (pers.producto.precios[pers.formato] + (carta.tiposPan.find(t => t.id === pers.tipo)?.sup || 0) + 0.20 * pers.anadidos.length) : 0
  const toggleEn = (setKey, val) => setPers(s => { const a = s[setKey]; return { ...s, [setKey]: a.includes(val) ? a.filter(x => x !== val) : [...a, val] } })
  const confirmarPers = () => {
    const fmt = carta.formatos.find(f => f.id === pers.formato)
    const tp = carta.tiposPan.find(t => t.id === pers.tipo)
    agregarItem(mesaId, persona.id, { productoId: pers.producto.id, nombre: pers.producto.nombre, precio: precioPers, tipo: pers.producto.tipo, pan: { formato: pers.formato, tipo: pers.tipo, nombreFormato: fmt.nombre, nombreTipo: tp.nombre }, quitados: pers.quitados, anadidos: pers.anadidos, nota: pers.nota.trim() })
    setPers(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', zIndex: 60, maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header + comensal */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <button onClick={onClose} style={btn('#1e293b', { padding: '0.4rem 0.7rem' })}>←</button>
          <div style={{ fontWeight: 800 }}>Pedir · Mesa {mesa.numero}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', alignSelf: 'center', whiteSpace: 'nowrap' }}>Para:</span>
          {mesa.personas.map(p => (
            <button key={p.id} onClick={() => setPersonaId(p.id)} style={btn(persona?.id === p.id ? '#f97316' : '#0f172a', { fontSize: '0.75rem', padding: '0.25rem 0.6rem', whiteSpace: 'nowrap' })}>{p.nombre}</button>
          ))}
          <button onClick={nuevoComensal} style={btn('#334155', { fontSize: '0.75rem', padding: '0.25rem 0.6rem', whiteSpace: 'nowrap' })}>+ Nuevo</button>
        </div>
      </div>

      {/* Categorías */}
      <div style={{ display: 'flex', gap: '0.4rem', padding: '0.6rem 1rem', overflowX: 'auto', borderBottom: '1px solid var(--color-border)' }}>
        {carta.categorias.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={btn(cat === c.id ? '#f97316' : '#1e293b', { whiteSpace: 'nowrap', fontSize: '0.8rem' })}>{c.emoji} {c.nombre}</button>
        ))}
      </div>

      {/* Productos */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {productos.map(prod => {
          const esMont = !!prod.precios
          return (
            <div key={prod.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, marginRight: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{prod.nombre}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{prod.descripcion}</div>
                <div style={{ fontWeight: 700, color: '#f97316', fontSize: '0.85rem' }}>{esMont ? `desde ${Math.min(prod.precios.pitufo, prod.precios.viena).toFixed(2)}` : prod.precio.toFixed(2)} €</div>
              </div>
              <button onClick={() => esMont ? setPers({ producto: prod, formato: 'pitufo', tipo: 'normal', quitados: [], anadidos: [], nota: '' }) : agregarItem(mesaId, persona.id, { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, tipo: prod.tipo })} style={btn('#f97316', { padding: '0.5rem 0.8rem' })}>+</button>
            </div>
          )
        })}
      </div>

      {/* Pendientes + enviar */}
      {pendientes.length > 0 && (
        <div style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '0.75rem 1rem' }}>
          <div style={{ maxHeight: '30vh', overflowY: 'auto', marginBottom: '0.5rem' }}>
            {pendientes.map(it => (
              <div key={it.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                <span style={{ fontSize: '0.82rem' }}>{it.cantidad}× {it.nombre}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button onClick={() => cambiarCantidad(mesaId, persona.id, it.uid, -1)} style={btn('#334155', { padding: '0.15rem 0.5rem' })}>−</button>
                  <button onClick={() => cambiarCantidad(mesaId, persona.id, it.uid, 1)} style={btn('#334155', { padding: '0.15rem 0.5rem' })}>+</button>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', minWidth: '3rem', textAlign: 'right' }}>{(it.precio * it.cantidad).toFixed(2)} €</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { confirmarPedido(mesaId); onClose() }} style={btn('#f97316', { width: '100%', padding: '0.8rem', fontSize: '0.95rem' })}>
            Enviar {pendientes.reduce((s, i) => s + i.cantidad, 0)} a cocina/barra · {totalPend.toFixed(2)} €
          </button>
        </div>
      )}

      {/* Personalización */}
      {pers && (
        <div onClick={() => setPers(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 70, animation: 'fadeIn 0.2s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', padding: '1.1rem', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto', borderTop: '1px solid var(--color-border)', boxShadow: '0 -22px 50px -20px rgba(0,0,0,0.8)', animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'var(--color-border)', margin: '-0.15rem auto 0.7rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{pers.producto.nombre}</h3>
              <button onClick={() => setPers(null)} style={btn('#334155', { padding: '0.25rem 0.6rem' })}>✕</button>
            </div>
            <p style={lbl}>Pan</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
              {carta.formatos.map(f => (
                <button key={f.id} onClick={() => setPers(s => ({ ...s, formato: f.id }))} style={btn(pers.formato === f.id ? '#f97316' : '#1e293b', { flex: 1, padding: '0.55rem' })}>{f.nombre} · {pers.producto.precios[f.id].toFixed(2)}€</button>
              ))}
            </div>
            <p style={lbl}>Tipo de pan</p>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              {carta.tiposPan.map(t => (
                <button key={t.id} onClick={() => setPers(s => ({ ...s, tipo: t.id }))} style={btn(pers.tipo === t.id ? '#7c3aed' : '#1e293b', { fontSize: '0.78rem', padding: '0.3rem 0.6rem' })}>{t.nombre}{t.sup > 0 ? ` +${t.sup.toFixed(2)}€` : ''}</button>
              ))}
            </div>
            {pers.producto.ingredientes.length > 0 && (
              <>
                <p style={lbl}>Lleva (toca para quitar)</p>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                  {pers.producto.ingredientes.map(ing => {
                    const q = pers.quitados.includes(ing)
                    return <button key={ing} onClick={() => toggleEn('quitados', ing)} style={btn(q ? '#7f1d1d' : '#334155', { fontSize: '0.78rem', padding: '0.3rem 0.6rem', textDecoration: q ? 'line-through' : 'none' })}>{q ? '✕ ' : ''}{ing}</button>
                  })}
                </div>
              </>
            )}
            <p style={lbl}>Añadir extra · +0,20 € c/u</p>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
              {carta.extras.map(ex => {
                const on = pers.anadidos.includes(ex)
                return <button key={ex} onClick={() => toggleEn('anadidos', ex)} style={btn(on ? '#065f46' : '#1e293b', { fontSize: '0.78rem', padding: '0.3rem 0.6rem' })}>{on ? '✓ ' : '+ '}{ex}</button>
              })}
            </div>
            <button onClick={confirmarPers} style={btn('#f97316', { width: '100%', padding: '0.8rem', fontSize: '0.95rem' })}>Añadir · {precioPers.toFixed(2)} €</button>
          </div>
        </div>
      )}
    </div>
  )
}

const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.7rem', boxShadow: 'var(--shadow-sm)' }
const lbl = { fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }
const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
