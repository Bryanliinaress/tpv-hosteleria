import { useState } from 'react'
import { useStore, TIEMPOS } from '../../store/useStore'
import { pedirTexto } from '../../store/useUI'
import { productosVisibles, descripcionUtil } from '../../lib/carta'
import { esMenu, conFormatos, conOpciones, precioMenu } from '../../lib/menuDia'
import { sinEnviar } from '../../lib/tomaPedido'
import HojaOpciones from './HojaOpciones'

// Toma de pedidos desde la PDA del camarero, para un comensal de la mesa.
// En un monitor se usa `PedirMostrador`: esta es la versión de una mano.
export default function PedirPda({ mesaId, onClose }) {
  const { carta, mesas, agregarItem, cambiarCantidad, confirmarPedido, unirseAMesa, setTiempoItem } = useStore()
  const mesa = mesas.find(m => m.id === mesaId)
  const [personaId, setPersonaId] = useState(mesa?.personas[0]?.id || null)
  const [cat, setCat] = useState(carta.categorias[0].id)
  const [busqueda, setBusqueda] = useState('')
  const [hoja, setHoja] = useState(null) // producto con opciones (montadito, menú)

  if (!mesa) return null
  const persona = mesa.personas.find(p => p.id === personaId) || mesa.personas[0]
  // Con 60+ productos, teclear «cafe» gana siempre a bajar por la categoría.
  const productos = productosVisibles(carta, { busqueda, categoria: cat })
  const pendientes = persona?.items.filter(i => i.estado === 'pendiente') || []
  // Lo que sale al pulsar «Enviar» es lo pendiente de TODA la mesa, no solo
  // del comensal elegido: el botón decía «2» y a cocina salían 5.
  const mesaSinEnviar = sinEnviar(mesa)
  const deOtros = mesaSinEnviar.unidades - pendientes.reduce((s, i) => s + i.cantidad, 0)

  const nuevoComensal = async () => {
    const nombre = await pedirTexto({ titulo: 'Nuevo comensal', placeholder: 'Nombre (opcional)', confirmar: 'Añadir' })
    if (nombre === null) return
    // En el backend real esto es una llamada al servidor: sin esperar el id se
    // guardaba una PROMESA como comensal elegido, no aparecía en la lista y el
    // camarero acababa cargándole los platos al primero de la mesa.
    const id = await Promise.resolve(unirseAMesa(mesaId, nombre))
    if (id) setPersonaId(id)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', zIndex: 60, maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header + comensal */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <button onClick={onClose} style={btn('var(--color-surface-2)', { padding: '0.4rem 0.7rem' })}>←</button>
          <div style={{ fontWeight: 800 }}>Pedir · Mesa {mesa.numero}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', alignSelf: 'center', whiteSpace: 'nowrap' }}>Para:</span>
          {mesa.personas.map(p => (
            <button key={p.id} onClick={() => setPersonaId(p.id)} style={btn(persona?.id === p.id ? 'var(--color-accent)' : 'var(--color-inset)', { fontSize: '0.75rem', padding: '0.25rem 0.6rem', whiteSpace: 'nowrap' })}>{p.nombre}</button>
          ))}
          <button onClick={nuevoComensal} style={btn('var(--color-surface-3)', { fontSize: '0.75rem', padding: '0.25rem 0.6rem', whiteSpace: 'nowrap' })}>+ Nuevo</button>
        </div>
      </div>

      {/* Buscador: lo primero que hace un camarero con prisa */}
      <div style={{ padding: '0.6rem 1rem 0', position: 'relative' }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔍 Buscar producto…"
          style={{ background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', color: 'var(--color-text)', width: '100%', fontSize: '0.9rem', minHeight: `${TOQUE}px` }} />
        {busqueda && <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"
          style={{ position: 'absolute', right: '1.1rem', top: '0.6rem', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', width: `${TOQUE}px`, height: `${TOQUE}px`, fontSize: '1rem' }}>✕</button>}
      </div>

      {/* Categorías (al buscar sobran: la búsqueda cruza toda la carta) */}
      {!busqueda.trim() && (
        <div style={{ display: 'flex', gap: '0.4rem', padding: '0.6rem 1rem', overflowX: 'auto', borderBottom: '1px solid var(--color-border)' }}>
          {carta.categorias.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={btn(cat === c.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { whiteSpace: 'nowrap', fontSize: '0.85rem', minHeight: `${TOQUE}px` })}>{c.emoji} {c.nombre}</button>
          ))}
        </div>
      )}

      {/* Productos */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {productos.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '1.5rem', fontSize: '0.9rem' }}>
            {busqueda.trim() ? `Nada que coincida con «${busqueda}»` : 'No hay productos disponibles en esta categoría'}
          </p>
        )}
        {productos.map(prod => {
          const esMont = conFormatos(prod)
          const abreHoja = conOpciones(prod)
          return (
            <div key={prod.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, marginRight: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{prod.nombre}</div>
                {descripcionUtil(prod) && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{descripcionUtil(prod)}</div>}
                <div style={{ fontWeight: 700, color: 'var(--color-accent)', fontSize: '0.85rem' }}>{esMont ? `desde ${Math.min(...Object.values(prod.precios || {}).map(Number)).toFixed(2)}` : esMenu(prod) ? precioMenu(prod).toFixed(2) : (prod.precio ?? 0).toFixed(2)} €</div>
              </div>
              <button onClick={() => abreHoja ? setHoja(prod) : agregarItem(mesaId, persona.id, { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, tipo: prod.tipo })} aria-label={`Añadir ${prod.nombre}`} style={btn('var(--color-accent)', cuadrado)}>+</button>
            </div>
          )
        })}
      </div>

      {/* Pendientes + enviar */}
      {mesaSinEnviar.unidades > 0 && (
        <div style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '0.75rem 1rem' }}>
          <div style={{ maxHeight: '30vh', overflowY: 'auto', marginBottom: '0.5rem' }}>
            {pendientes.map(it => (
              <div key={it.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                <span style={{ fontSize: '0.82rem' }}>{it.cantidad}× {it.nombre}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {it.tipo === 'comida' && (
                    <button
                      onClick={() => setTiempoItem(mesaId, persona.id, it.uid, ((it.tiempo || 1) % 3) + 1)}
                      title={`Tiempo: ${TIEMPOS[it.tiempo || 1].largo} (toca para cambiar)`}
                      style={btn((it.tiempo || 1) > 1 ? '#7c3aed' : 'var(--color-surface-2)', { padding: '0.15rem 0.5rem', fontSize: '0.72rem' })}
                    >{TIEMPOS[it.tiempo || 1].label}</button>
                  )}
                  <button onClick={() => cambiarCantidad(mesaId, persona.id, it.uid, -1)} aria-label={`Quitar una unidad de ${it.nombre}`} style={btn('var(--color-surface-3)', cuadrado)}>−</button>
                  <button onClick={() => cambiarCantidad(mesaId, persona.id, it.uid, 1)} aria-label={`Añadir una unidad de ${it.nombre}`} style={btn('var(--color-surface-3)', cuadrado)}>+</button>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', minWidth: '3rem', textAlign: 'right' }}>{(it.precio * it.cantidad).toFixed(2)} €</span>
                </div>
              </div>
            ))}
            {deOtros > 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', padding: '0.25rem 0' }}>
                + {deOtros} de otros comensales, que también salen al enviar
              </p>
            )}
          </div>
          <button onClick={() => { confirmarPedido(mesaId); onClose() }} style={btn('var(--color-accent)', { width: '100%', padding: '0.8rem', fontSize: '0.95rem' })}>
            Enviar {mesaSinEnviar.unidades} a cocina/barra · {mesaSinEnviar.total.toFixed(2)} €
          </button>
        </div>
      )}

      {hoja && (
        <HojaOpciones carta={carta} producto={hoja} onCerrar={() => setHoja(null)}
          onAnadir={(config) => { agregarItem(mesaId, persona.id, config); setHoja(null) }} />
      )}
    </div>
  )
}

// 44 px: el mínimo para no fallar el toque con el móvil en una mano
const TOQUE = 44
const cuadrado = { width: `${TOQUE}px`, height: `${TOQUE}px`, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }
const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.7rem', boxShadow: 'var(--shadow-sm)' }
const btn = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
