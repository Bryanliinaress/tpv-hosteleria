import { useState } from 'react'
import { useStore, TIEMPOS, normalizarExtra, etiquetasDe } from '../../store/useStore'
import { pedirTexto } from '../../store/useUI'
import { productosVisibles, descripcionUtil } from '../../lib/carta'
import { esMenu, conFormatos, conOpciones, menuCompleto, siguientePendiente, precioMenu, lineaDeMenu, alternarOpcion } from '../../lib/menuDia'
import { importeLinea, cent } from '../../lib/dinero'

// Toma de pedidos desde la PDA del camarero, para un comensal de la mesa.
export default function PedirPda({ mesaId, onClose }) {
  const { carta, mesas, agregarItem, cambiarCantidad, confirmarPedido, unirseAMesa, setTiempoItem } = useStore()
  const mesa = mesas.find(m => m.id === mesaId)
  const [personaId, setPersonaId] = useState(mesa?.personas[0]?.id || null)
  const [cat, setCat] = useState(carta.categorias[0].id)
  const [busqueda, setBusqueda] = useState('')
  const [pers, setPers] = useState(null) // personalización de montadito

  if (!mesa) return null
  const persona = mesa.personas.find(p => p.id === personaId) || mesa.personas[0]
  // Con 60+ productos, teclear «cafe» gana siempre a bajar por la categoría.
  const productos = productosVisibles(carta, { busqueda, categoria: cat })
  const pendientes = persona?.items.filter(i => i.estado === 'pendiente') || []
  const totalPend = cent(pendientes.reduce((s, i) => s + importeLinea(i), 0))

  const nuevoComensal = async () => {
    const nombre = await pedirTexto({ titulo: 'Nuevo comensal', placeholder: 'Nombre (opcional)', confirmar: 'Añadir' })
    if (nombre === null) return
    // En el backend real esto es una llamada al servidor: sin esperar el id se
    // guardaba una PROMESA como comensal elegido, no aparecía en la lista y el
    // camarero acababa cargándole los platos al primero de la mesa.
    const id = await Promise.resolve(unirseAMesa(mesaId, nombre))
    if (id) setPersonaId(id)
  }

  const etiquetas = etiquetasDe(carta)
  const extrasNorm = (carta.extras || []).map(normalizarExtra)
  const precioExtra = (nombre) => extrasNorm.find(x => x.nombre === nombre)?.precio || 0
  const precioPers = !pers ? 0 : esMenu(pers.producto)
    ? precioMenu(pers.producto, pers.elecciones || [])
    : ((pers.producto.precios?.[pers.formato] ?? 0) + (carta.tiposPan.find(t => t.id === pers.tipo)?.sup || 0) + pers.anadidos.reduce((s, n) => s + precioExtra(n), 0))
  // un menú a medias no se manda: cocina no sabría qué preparar
  const menuIncompleto = pers ? !menuCompleto(pers.producto, pers.elecciones || []) : false
  const faltaGrupo = pers && menuIncompleto ? siguientePendiente(pers.producto, pers.elecciones || []) : null
  const toggleEn = (setKey, val) => setPers(s => { const a = s[setKey]; return { ...s, [setKey]: a.includes(val) ? a.filter(x => x !== val) : [...a, val] } })
  const confirmarPers = () => {
    if (esMenu(pers.producto)) {
      agregarItem(mesaId, persona.id, lineaDeMenu(pers.producto, pers.elecciones || [], pers.nota))
      setPers(null)
      return
    }
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
              <button onClick={() => abreHoja ? setPers({ producto: prod, formato: (carta.formatos.find(f => prod.precios?.[f.id] != null) || carta.formatos[0])?.id, tipo: carta.tiposPan[0]?.id, quitados: [], anadidos: [], nota: '', elecciones: [] }) : agregarItem(mesaId, persona.id, { productoId: prod.id, nombre: prod.nombre, precio: prod.precio, tipo: prod.tipo })} aria-label={`Añadir ${prod.nombre}`} style={btn('var(--color-accent)', cuadrado)}>+</button>
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
          </div>
          <button onClick={() => { confirmarPedido(mesaId); onClose() }} style={btn('var(--color-accent)', { width: '100%', padding: '0.8rem', fontSize: '0.95rem' })}>
            Enviar {pendientes.reduce((s, i) => s + i.cantidad, 0)} a cocina/barra · {totalPend.toFixed(2)} €
          </button>
        </div>
      )}

      {/* Personalización */}
      {pers && (
        <div onClick={() => setPers(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 70, animation: 'fadeIn 0.2s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', width: '100%', maxWidth: '520px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--color-border)', boxShadow: '0 -22px 50px -20px rgba(0,0,0,0.8)', animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div style={{ padding: '1.1rem 1.1rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'var(--color-border)', margin: '-0.15rem auto 0.7rem' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{pers.producto.nombre}</h3>
                <button onClick={() => setPers(null)} aria-label="Cerrar" style={btn('var(--color-surface-3)', cuadrado)}>✕</button>
              </div>
            </div>
            {/* cuerpo con scroll: el botón de añadir nunca se va de pantalla */}
            <div style={{ padding: '0.9rem 1.1rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {/* Menú del día / combo: elegir de cada grupo (primero, segundo, postre) */}
            {esMenu(pers.producto) && pers.producto.menu.grupos.map((g, gi) => {
              const titulo = g.titulo || `Grupo ${gi + 1}`
              const elegidas = (pers.elecciones || []).filter(e => e.grupo === titulo)
              return (
                <div key={gi} style={{ marginBottom: '0.7rem' }}>
                  <p style={lbl}>
                    {titulo}
                    <span style={{ marginLeft: '0.4rem', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      {(g.max ?? 1) > 1 ? `(elige hasta ${g.max})` : ''}
                      {elegidas.length === 0 && <span style={{ color: 'var(--tint-warning-fg)' }}> · elige uno</span>}
                    </span>
                  </p>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {(g.opciones || []).map((o, oi) => {
                      const sel = elegidas.some(e => e.opcion === o.nombre)
                      return (
                        <button key={oi} onClick={() => setPers(s => ({ ...s, elecciones: alternarOpcion({ ...g, titulo }, o, s.elecciones || []) }))}
                          style={btn(sel ? 'var(--color-accent)' : 'var(--color-surface-2)', { fontSize: '0.82rem', padding: '0.5rem 0.75rem' })}>
                          {o.nombre}{o.sup ? ` +${Number(o.sup).toFixed(2)} €` : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {!esMenu(pers.producto) && <>
            <p style={lbl}>{etiquetas.formatos}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
              {carta.formatos.filter(f => pers.producto.precios?.[f.id] != null).map(f => (
                <button key={f.id} onClick={() => setPers(s => ({ ...s, formato: f.id }))} style={btn(pers.formato === f.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { flex: 1, minWidth: '7rem', padding: '0.55rem' })}>{f.nombre} · {(pers.producto.precios[f.id] ?? 0).toFixed(2)}€</button>
              ))}
            </div>
            <p style={lbl}>{etiquetas.tiposPan}</p>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              {carta.tiposPan.map(t => (
                <button key={t.id} onClick={() => setPers(s => ({ ...s, tipo: t.id }))} style={btn(pers.tipo === t.id ? '#7c3aed' : 'var(--color-surface-2)', { fontSize: '0.78rem', padding: '0.3rem 0.6rem' })}>{t.nombre}{t.sup > 0 ? ` +${t.sup.toFixed(2)}€` : ''}</button>
              ))}
            </div>
            </>}
            {(pers.producto.ingredientes || []).length > 0 && (
              <>
                <p style={lbl}>Lleva (toca para quitar)</p>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                  {pers.producto.ingredientes.map(ing => {
                    const q = pers.quitados.includes(ing)
                    return <button key={ing} onClick={() => toggleEn('quitados', ing)} style={btn(q ? '#7f1d1d' : 'var(--color-surface-3)', { fontSize: '0.78rem', padding: '0.3rem 0.6rem', textDecoration: q ? 'line-through' : 'none' })}>{q ? '✕ ' : ''}{ing}</button>
                  })}
                </div>
              </>
            )}
            <p style={lbl}>Añadir {etiquetas.extras.toLowerCase()}</p>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
              {extrasNorm.map(ex => {
                const on = pers.anadidos.includes(ex.nombre)
                return <button key={ex.nombre} onClick={() => toggleEn('anadidos', ex.nombre)} style={btn(on ? '#065f46' : 'var(--color-surface-2)', { fontSize: '0.78rem', padding: '0.3rem 0.6rem' })}>{on ? '✓ ' : '+ '}{ex.nombre}{ex.precio > 0 ? ` +${ex.precio.toFixed(2)}€` : ''}</button>
              })}
            </div>
            </div>
            <div style={{ padding: '0.85rem 1.1rem calc(0.85rem + env(safe-area-inset-bottom))', borderTop: '1px solid var(--color-border)' }}>
              <button onClick={confirmarPers} disabled={menuIncompleto}
                style={btn(menuIncompleto ? 'var(--color-surface-3)' : 'var(--color-accent)', { width: '100%', minHeight: `${TOQUE + 6}px`, fontSize: '0.95rem', cursor: menuIncompleto ? 'not-allowed' : 'pointer' })}>
                {menuIncompleto ? `Elige ${faltaGrupo?.titulo || ''}` : `Añadir · ${precioPers.toFixed(2)} €`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 44 px: el mínimo para no fallar el toque con el móvil en una mano
const TOQUE = 44
const cuadrado = { width: `${TOQUE}px`, height: `${TOQUE}px`, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }
const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.7rem', boxShadow: 'var(--shadow-sm)' }
const lbl = { fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }
const btn = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
