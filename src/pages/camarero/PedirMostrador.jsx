import { useEffect, useRef, useState } from 'react'
import { useStore, TIEMPOS } from '../../store/useStore'
import { pedirTexto, toast } from '../../store/useUI'
import { productosVisibles, descripcionUtil } from '../../lib/carta'
import { esMenu, conFormatos, conOpciones, precioMenu, resumenElecciones } from '../../lib/menuDia'
import { sinEnviar, unidadesDe, candidatoDeEnter } from '../../lib/tomaPedido'
import HojaOpciones from '../pda/HojaOpciones'
import FueraDeCarta from '../../components/FueraDeCarta'

/**
 * Tomar pedido en el Mostrador: un monitor o una tablet apaisada.
 *
 * Antes se abría la pantalla de la PDA —una columna de 520 px pensada para una
 * mano— en medio del monitor, con la sala asomando por los lados: un producto
 * por fila a todo lo ancho, las categorías en una tira, y lo pedido escondido
 * en un pie que solo aparecía al pedir algo.
 *
 * Aquí se reparte la pantalla como se trabaja en una barra:
 *   · izquierda, los apartados de la carta, siempre a la vista;
 *   · centro, los productos en rejilla: la tarjeta ENTERA es el botón, y
 *     lleva cuántos van ya pedidos para no marcar dos veces lo mismo;
 *   · derecha, la comanda de la mesa entera, que es lo que va a salir.
 *
 * Con teclado: se escribe «caña» y Enter la añade (solo si no hay duda de
 * cuál es); Escape cierra lo que haya abierto.
 */
export default function PedirMostrador({ mesaId, onClose }) {
  const { carta, mesas, agregarItem, cambiarCantidad, confirmarPedido, unirseAMesa, setTiempoItem } = useStore()
  const mesa = mesas.find(m => m.id === mesaId)
  const [personaId, setPersonaId] = useState(mesa?.personas[0]?.id || null)
  const [cat, setCat] = useState(carta.categorias[0]?.id)
  const [busqueda, setBusqueda] = useState('')
  const [hoja, setHoja] = useState(null)       // producto con opciones
  const [libre, setLibre] = useState(false)    // plato fuera de carta
  const [recien, setRecien] = useState(null)   // tarjeta que acaba de añadirse
  const buscador = useRef(null)

  // Escape cierra de dentro afuera: la hoja, luego la búsqueda, luego la
  // pantalla. Cerrar la pantalla entera con la búsqueda a medias sería perder
  // lo tecleado por querer borrarlo.
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== 'Escape' || libre) return
      if (hoja) setHoja(null)
      else if (busqueda) setBusqueda('')
      else onClose()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [hoja, busqueda, libre, onClose])

  if (!mesa) return null
  const persona = mesa.personas.find(p => p.id === personaId) || mesa.personas[0]
  const buscando = !!busqueda.trim()
  const productos = productosVisibles(carta, { busqueda, categoria: cat })
  const pendiente = sinEnviar(mesa)
  const enviado = mesa.personas.flatMap(p => p.items.filter(i => i.estado !== 'pendiente'))
  const totalEnviado = enviado.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const disponiblesEn = (catId) => carta.productos.filter(p => p.disponible && p.categoria === catId).length

  const marcar = (id) => { setRecien(id); setTimeout(() => setRecien(r => (r === id ? null : r)), 350) }

  const pulsar = (prod) => {
    if (!persona) return
    if (conOpciones(prod)) { setHoja(prod); return }
    agregarItem(mesaId, persona.id, { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, tipo: prod.tipo })
    marcar(prod.id)
  }

  const alPulsarEnter = (e) => {
    if (e.key !== 'Enter') return
    const prod = candidatoDeEnter(productos, busqueda)
    if (!prod) { if (productos.length > 1) toast(`Hay ${productos.length} que coinciden: toca el que sea`, 'info'); return }
    pulsar(prod)
    // Listo para el siguiente: «caña ⏎ tortilla ⏎» sin tocar el ratón.
    setBusqueda('')
  }

  const nuevoComensal = async () => {
    const nombre = await pedirTexto({ titulo: 'Nuevo comensal', placeholder: 'Nombre (opcional)', confirmar: 'Añadir' })
    if (nombre === null) return
    // En el backend real es una llamada al servidor: hay que esperar el id o
    // los platos acaban cargados al primero de la mesa.
    const id = await Promise.resolve(unirseAMesa(mesaId, nombre))
    if (id) setPersonaId(id)
  }

  const enviar = () => {
    if (pendiente.unidades === 0) return
    confirmarPedido(mesaId)
    toast(`${pendiente.unidades} a cocina/barra`, 'success')
    onClose()
  }

  const precioDe = (prod) => conFormatos(prod)
    ? `desde ${Math.min(...Object.values(prod.precios || {}).map(Number)).toFixed(2)} €`
    : `${(esMenu(prod) ? precioMenu(prod) : (prod.precio ?? 0)).toFixed(2)} €`

  const detalle = (it) => [
    it.pan && `${it.pan.nombreFormato || ''} ${it.pan.nombreTipo || ''}`.trim(),
    it.quitados?.length && `sin ${it.quitados.join(', ')}`,
    it.anadidos?.length && `con ${it.anadidos.join(', ')}`,
    it.elecciones?.length && resumenElecciones(it.elecciones),
    it.nota,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--color-bg)', display: 'grid', gridTemplateRows: 'auto 1fr', gridTemplateColumns: 'clamp(10.5rem, 16vw, 14rem) 1fr clamp(18rem, 28vw, 26rem)' }}>
      {/* Los laterales crecen con la pantalla y no al revés: con anchos fijos,
          en una tablet apaisada de 1024 px la rejilla del centro se quedaba en
          UNA columna de tarjetas —el mismo desperdicio que se venía a quitar—. */}

      {/* ── Cabecera: volver, mesa y buscador ─────────────────────────────── */}
      <header style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.7rem 1rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={onClose} style={btn('var(--color-surface-2)', { minHeight: '46px', padding: '0 1rem', fontSize: '0.95rem' })}>← Volver</button>
        <div style={{ whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.1 }}>Mesa {mesa.numero}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{mesa.zona ? `${mesa.zona} · ` : ''}tomando pedido</div>
        </div>
        <div style={{ flex: 1, position: 'relative', maxWidth: '40rem', marginLeft: 'auto' }}>
          <input ref={buscador} value={busqueda} autoFocus
            onChange={e => setBusqueda(e.target.value)} onKeyDown={alPulsarEnter}
            placeholder="🔍 Buscar en toda la carta…  (Enter añade)"
            style={{ background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.6rem', padding: '0 2.8rem 0 0.9rem', color: 'var(--color-text)', width: '100%', fontSize: '1rem', height: '46px' }} />
          {busqueda && (
            <button onClick={() => { setBusqueda(''); buscador.current?.focus() }} aria-label="Limpiar búsqueda"
              style={{ position: 'absolute', right: '0.3rem', top: '3px', width: '40px', height: '40px', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          )}
        </div>
      </header>

      {/* ── Apartados de la carta ─────────────────────────────────────────── */}
      <nav aria-label="Apartados de la carta" style={{ overflowY: 'auto', padding: '0.7rem', borderRight: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '0.35rem', minHeight: 0 }}>
        {carta.categorias.map(c => {
          const activa = !buscando && cat === c.id
          return (
            <button key={c.id} onClick={() => { setCat(c.id); setBusqueda('') }}
              aria-current={activa ? 'true' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', textAlign: 'left',
                minHeight: '52px', padding: '0.5rem 0.7rem', borderRadius: '0.6rem', cursor: 'pointer',
                border: `1px solid ${activa ? 'var(--color-accent)' : 'transparent'}`,
                background: activa ? 'var(--color-accent)' : 'var(--color-surface-2)',
                color: activa ? '#fff' : 'var(--color-text)', opacity: buscando ? 0.55 : 1,
                fontWeight: 700, fontSize: '0.92rem',
              }}>
              <span style={{ fontSize: '1.3rem' }}>{c.emoji}</span>
              <span style={{ flex: 1, minWidth: 0, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.75, flexShrink: 0 }}>{disponiblesEn(c.id)}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Productos ─────────────────────────────────────────────────────── */}
      <main style={{ overflowY: 'auto', padding: '0.9rem 1rem 1.5rem', minHeight: 0 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
          {buscando
            ? `${productos.length} ${productos.length === 1 ? 'resultado' : 'resultados'} para «${busqueda.trim()}» en toda la carta`
            : `${carta.categorias.find(c => c.id === cat)?.nombre || ''} · toca un producto para añadirlo a ${persona?.nombre || 'la mesa'}`}
        </div>

        {productos.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '3rem 1rem', fontSize: '0.95rem' }}>
            {buscando ? `Nada que coincida con «${busqueda}»` : 'No hay productos disponibles en este apartado'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))', gap: '0.6rem' }}>
            {productos.map(prod => {
              const n = unidadesDe(persona?.items, prod.id)
              const opciones = conOpciones(prod)
              return (
                <button key={prod.id} onClick={() => pulsar(prod)} aria-label={`Añadir ${prod.nombre}`}
                  style={{
                    position: 'relative', textAlign: 'left', cursor: 'pointer', minHeight: '6.5rem',
                    display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.7rem 0.75rem',
                    background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: 'var(--radius)',
                    border: `${n > 0 ? 2 : 1}px solid ${n > 0 ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    boxShadow: recien === prod.id ? '0 0 0 4px color-mix(in srgb, var(--color-accent) 35%, transparent)' : 'var(--shadow-sm)',
                    transform: recien === prod.id ? 'scale(0.97)' : 'none', transition: 'transform 0.12s ease, box-shadow 0.2s ease',
                  }}>
                  {n > 0 && (
                    <span style={{ position: 'absolute', top: '-0.45rem', right: '-0.45rem', minWidth: '1.7rem', height: '1.7rem', padding: '0 0.35rem', borderRadius: '9999px', background: 'var(--color-accent)', color: '#fff', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>{n}</span>
                  )}
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{prod.nombre}</span>
                  {descripcionUtil(prod) && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-muted)', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{descripcionUtil(prod)}</span>
                  )}
                  <span style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: '0.4rem', paddingTop: '0.3rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--color-accent)', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{precioDe(prod)}</span>
                    {opciones && <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{esMenu(prod) ? 'menú ›' : 'opciones ›'}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* ── La comanda ────────────────────────────────────────────────────── */}
      <aside style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div style={{ padding: '0.8rem 1rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Pidiendo para</div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {mesa.personas.map(p => (
              <button key={p.id} onClick={() => setPersonaId(p.id)} aria-pressed={persona?.id === p.id}
                style={btn(persona?.id === p.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { minHeight: '40px', fontSize: '0.88rem' })}>
                👤 {p.nombre}
              </button>
            ))}
            <button onClick={nuevoComensal} style={btn('var(--color-surface-3)', { minHeight: '40px', fontSize: '0.88rem' })}>+ Comensal</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 1rem', minHeight: 0 }}>
          {pendiente.unidades === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2.5rem 0.5rem', fontSize: '0.88rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🧾</div>
              Aún no hay nada sin enviar.<br />Toca productos para ir montando la comanda.
            </div>
          ) : pendiente.porPersona.filter(x => x.unidades > 0).map(({ persona: p, items, total }) => (
            <section key={p.id} style={{ marginBottom: '0.8rem' }}>
              {/* Tocar el nombre elige a esa persona: es donde se mira */}
              <button onClick={() => setPersonaId(p.id)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0', color: persona?.id === p.id ? 'var(--color-accent)' : 'var(--color-text-2)', fontWeight: 800, fontSize: '0.85rem' }}>
                <span>👤 {p.nombre}</span><span>{total.toFixed(2)} €</span>
              </button>
              {items.map(it => (
                <div key={it.uid} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{it.cantidad}× {it.nombre}</div>
                    {detalle(it) && <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detalle(it)}</div>}
                  </div>
                  {it.tipo === 'comida' && (
                    <button onClick={() => setTiempoItem(mesaId, p.id, it.uid, ((it.tiempo || 1) % 3) + 1)}
                      title={`Tiempo: ${TIEMPOS[it.tiempo || 1].largo} (toca para cambiar)`}
                      style={btn((it.tiempo || 1) > 1 ? '#7c3aed' : 'var(--color-surface-2)', { ...mini, width: 'auto', padding: '0 0.55rem', fontSize: '0.75rem' })}>
                      {TIEMPOS[it.tiempo || 1].label}
                    </button>
                  )}
                  <button onClick={() => cambiarCantidad(mesaId, p.id, it.uid, -1)} aria-label={`Quitar una unidad de ${it.nombre}`} style={btn('var(--color-surface-3)', mini)}>−</button>
                  <button onClick={() => cambiarCantidad(mesaId, p.id, it.uid, 1)} aria-label={`Añadir una unidad de ${it.nombre}`} style={btn('var(--color-surface-3)', mini)}>+</button>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', minWidth: '3.6rem', textAlign: 'right' }}>{(it.precio * it.cantidad).toFixed(2)} €</span>
                </div>
              ))}
            </section>
          ))}

          {enviado.length > 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-faint)', marginTop: '0.4rem' }}>
              Ya enviado a cocina/barra: {enviado.reduce((s, i) => s + i.cantidad, 0)} uds · {totalEnviado.toFixed(2)} €
            </p>
          )}
        </div>

        <div style={{ padding: '0.8rem 1rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button onClick={() => setLibre(true)} disabled={!persona} style={btn('var(--color-surface-2)', { minHeight: '44px', border: '1px solid var(--color-border)' })}>✍️ Fuera de carta</button>
          <button onClick={enviar} disabled={pendiente.unidades === 0}
            style={btn(pendiente.unidades ? 'var(--color-accent)' : 'var(--color-surface-3)', { minHeight: '58px', fontSize: '1.05rem', fontWeight: 800, cursor: pendiente.unidades ? 'pointer' : 'not-allowed' })}>
            {pendiente.unidades
              ? <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>Enviar {pendiente.unidades} a cocina/barra</span>
                  <span style={{ whiteSpace: 'nowrap' }}>{pendiente.total.toFixed(2)} €</span>
                </span>
              : 'Nada que enviar'}
          </button>
        </div>
      </aside>

      {hoja && (
        <HojaOpciones centrado carta={carta} producto={hoja} onCerrar={() => setHoja(null)}
          onAnadir={(config) => { agregarItem(mesaId, persona.id, config); marcar(hoja.id); setHoja(null) }} />
      )}
      {libre && persona && <FueraDeCarta mesa={mesa} personaId={persona.id} onCerrar={() => setLibre(false)} />}
    </div>
  )
}

const mini = { width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }
const btn = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
