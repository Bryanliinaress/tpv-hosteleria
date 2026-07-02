import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore, METODO_LABEL, METODO_EMOJI, ALERGENOS } from '../../store/useStore'
import { confirmar, toast } from '../../store/useUI'
import Ticket from '../../components/Ticket'
import ReservasManager from '../../components/ReservasManager'
import ReservasConfig from '../../components/ReservasConfig'
import BotonSalir from '../../components/BotonSalir'

const emptyForm = { nombre: '', precioPitufo: '', precioViena: '', categoria: '', descripcion: '', alergenos: [] }
const precioDesde = (prod) => Math.min(prod.precios?.pitufo ?? 0, prod.precios?.viena ?? 0)

export default function PanelAdmin() {
  const { carta, mesas, historial, cierres, reservas, local, updateLocal, empleados, addEmpleado, updateEmpleado, removeEmpleado, cerrarCaja, addProducto, updateProducto, deleteProducto, toggleDisponible, resetDatos, addMesa, removeMesa, updateMesa, addCategoria, removeCategoria, addExtra, removeExtra, addTipoPan, removeTipoPan } = useStore()
  const hoyStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const reservasHoy = reservas.filter(r => r.fecha === hoyStr && r.estado === 'confirmada').length
  const [tab, setTab] = useState('carta')
  const [editando, setEditando] = useState(null) // productoId en edición
  const [form, setForm] = useState(emptyForm)
  const [ticket, setTicket] = useState(null)
  const [nuevaCat, setNuevaCat] = useState({ nombre: '', tipo: 'comida' })
  const [nuevoExtra, setNuevoExtra] = useState('')
  const [nuevoPan, setNuevoPan] = useState({ nombre: '', sup: '' })
  const [contado, setContado] = useState('')

  // Tickets del mes en curso, agrupados por día (más reciente primero)
  const ahora = new Date()
  const delMes = historial.filter(r => { const d = new Date(r.cerradaEn); return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear() })
  const totalMes = delMes.reduce((s, r) => s + r.total, 0)
  const propinasMes = delMes.reduce((s, r) => s + (r.propina || 0), 0)
  const porDia = {}
  delMes.forEach(r => { const k = new Date(r.cerradaEn).toLocaleDateString('es-ES'); (porDia[k] ||= []).push(r) })
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a))

  const totalVentas = mesas.reduce((s, m) =>
    s + m.personas.reduce((ss, p) =>
      ss + p.items.reduce((sss, i) => sss + i.precio * i.cantidad, 0), 0), 0)
  const mesasOcupadas = mesas.filter(m => m.estado !== 'libre').length

  // ── Arqueo de caja: tickets desde el último cierre ──
  const ultimoCierre = cierres.length ? cierres[cierres.length - 1] : null
  const desdeCaja = ultimoCierre?.hasta || null
  const ticketsCaja = historial.filter(r => !desdeCaja || new Date(r.cerradaEn) > new Date(desdeCaja))
  const cajaTotal = ticketsCaja.reduce((s, r) => s + r.total, 0)
  const cajaPropinas = ticketsCaja.reduce((s, r) => s + (r.propina || 0), 0)
  const cajaPagos = {}
  ticketsCaja.forEach(r => Object.entries(r.pagos || {}).forEach(([k, v]) => { cajaPagos[k] = (cajaPagos[k] || 0) + v }))
  const cajaPorCamarero = {}
  ticketsCaja.forEach(r => { const c = r.cobradoPor || r.camarero || '—'; cajaPorCamarero[c] = (cajaPorCamarero[c] || 0) + r.total })
  const efectivoEsperado = cajaPagos.efectivo || 0
  const descuadre = contado === '' ? null : (Number(contado) || 0) - efectivoEsperado
  const hacerCierre = async () => {
    if (ticketsCaja.length === 0) return
    if (!(await confirmar({ titulo: 'Cerrar caja', mensaje: `¿Cerrar caja con ${ticketsCaja.length} ticket(s) y ${cajaTotal.toFixed(2)} €?`, confirmar: 'Cerrar caja' }))) return
    cerrarCaja(contado)
    setContado('')
    toast('Caja cerrada correctamente', 'success')
  }

  const empezarNuevo = (categoriaId) => {
    setEditando('nuevo')
    setForm({ ...emptyForm, categoria: categoriaId })
  }
  const empezarEdicion = (prod) => {
    setEditando(prod.id)
    setForm({ nombre: prod.nombre, precioPitufo: String(prod.precios?.pitufo ?? ''), precioViena: String(prod.precios?.viena ?? ''), categoria: prod.categoria, descripcion: prod.descripcion, alergenos: prod.alergenos || [] })
  }
  const cancelar = () => { setEditando(null); setForm(emptyForm) }
  const guardar = () => {
    if (!form.nombre.trim() || !form.categoria) return
    if (editando === 'nuevo') addProducto(form)
    else updateProducto(editando, form)
    cancelar()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(180deg, var(--color-surface), var(--color-surface-2))', borderBottom: '1px solid var(--color-border)', boxShadow: '0 6px 18px -10px rgba(0,0,0,0.6)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem' }}>🛠 Panel Administración</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{local.nombre || 'Gestión del local'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button onClick={resetDatos} title="Borra todos los datos guardados y recarga" style={{ background: '#1e293b', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.8rem' }}>
            ↺ Reiniciar datos
          </button>
          <BotonSalir />
        </div>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        {[
          { label: 'Mesas ocupadas', value: `${mesasOcupadas}/${mesas.length}`, color: '#f59e0b' },
          { label: 'Productos en carta', value: carta.productos.length, color: '#3b82f6' },
          { label: 'Categorías', value: carta.categorias.length, color: '#8b5cf6' },
          { label: 'Consumo activo', value: `${totalVentas.toFixed(2)} €`, color: '#f97316' },
        ].map(s => (
          <div key={s.label} style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '1rem', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: s.color }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        {[
          { id: 'carta', label: '📋 Carta' },
          { id: 'local', label: '🏪 Local' },
          { id: 'personal', label: '👥 Personal' },
          { id: 'mesas', label: '🍽 Mesas' },
          { id: 'reservas', label: `📅 Reservas${reservasHoy ? ` (${reservasHoy})` : ''}` },
          { id: 'caja', label: '💰 Caja' },
          { id: 'ajustes', label: '⚙️ Ajustes' },
          { id: 'tickets', label: '🧾 Tickets' },
          { id: 'qr', label: '📱 QR Codes' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', padding: '0.875rem 1.5rem', cursor: 'pointer',
            color: tab === t.id ? '#f97316' : 'var(--color-muted)',
            borderBottom: tab === t.id ? '2px solid #f97316' : '2px solid transparent',
            fontWeight: tab === t.id ? 700 : 400, fontSize: '0.875rem',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        {/* Tab Carta */}
        {tab === 'carta' && (
          <div>
            {carta.categorias.map(cat => (
              <div key={cat.id} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{cat.emoji}</span>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{cat.nombre}</h3>
                  <span style={{ fontSize: '0.75rem', background: cat.tipo === 'comida' ? '#052e16' : '#2d0a14', color: cat.tipo === 'comida' ? '#10b981' : '#f43f5e', borderRadius: '9999px', padding: '0.15rem 0.5rem' }}>{cat.tipo}</span>
                  <button onClick={() => empezarNuevo(cat.id)} style={{ marginLeft: 'auto', background: '#f97316', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                    + Añadir
                  </button>
                </div>

                {/* Formulario nuevo producto dentro de esta categoría */}
                {editando === 'nuevo' && form.categoria === cat.id && (
                  <FormProducto carta={carta} form={form} setForm={setForm} onGuardar={guardar} onCancelar={cancelar} titulo="Nuevo producto" />
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.625rem' }}>
                  {carta.productos.filter(p => p.categoria === cat.id).map(prod => (
                    editando === prod.id ? (
                      <FormProducto key={prod.id} carta={carta} form={form} setForm={setForm} onGuardar={guardar} onCancelar={cancelar} titulo="Editar producto" />
                    ) : (
                      <div key={prod.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.625rem', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: prod.disponible ? 1 : 0.5 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            {prod.nombre}
                            {!prod.disponible && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#f43f5e' }}>(agotado)</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                            {prod.descripcion}
                            {(prod.alergenos || []).length > 0 && <span title={prod.alergenos.map(a => ALERGENOS.find(x => x.id === a)?.nombre || a).join(', ')} style={{ marginLeft: '0.4rem' }}>{prod.alergenos.map(a => ALERGENOS.find(x => x.id === a)?.emoji || '•').join('')}</span>}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#f97316', fontSize: '0.85rem', margin: '0 0.75rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {prod.precios
                            ? <>{prod.precios.pitufo.toFixed(2)} €<br />{prod.precios.viena.toFixed(2)} €</>
                            : <>{(prod.precio ?? 0).toFixed(2)} €</>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => toggleDisponible(prod.id)} title={prod.disponible ? 'Marcar agotado' : 'Marcar disponible'} style={iconBtn}>{prod.disponible ? '🟢' : '⚪'}</button>
                          <button onClick={() => empezarEdicion(prod)} title="Editar" style={iconBtn}>✏️</button>
                          <button onClick={async () => { if (await confirmar({ titulo: 'Borrar producto', mensaje: `¿Borrar "${prod.nombre}" de la carta?`, peligro: true, confirmar: 'Borrar' })) { deleteProducto(prod.id); toast('Producto borrado', 'success') } }} title="Borrar" style={iconBtn}>🗑️</button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Mesas (configuración de sala) */}
        {tab === 'mesas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Configura las mesas: capacidad, zona, añadir o quitar. (Solo se pueden borrar mesas libres.)</p>
              <button onClick={addMesa} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>+ Añadir mesa</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' }}>
              {mesas.map(m => {
                const libre = m.estado === 'libre'
                return (
                  <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.875rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Mesa {m.numero}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: libre ? '#10b981' : '#f59e0b' }}>{libre ? 'Libre' : 'Ocupada'}</span>
                    </div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Zona</label>
                    <input value={m.zona || ''} onChange={e => updateMesa(m.id, { zona: e.target.value })} list="zonas-list" placeholder="Zona" style={{ ...inputStyle, marginBottom: '0.5rem' }} />
                    <label style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Capacidad</label>
                    <input value={m.capacidad} onChange={e => updateMesa(m.id, { capacidad: e.target.value })} type="number" min="1" style={{ ...inputStyle, marginBottom: '0.625rem' }} />
                    <button onClick={async () => { if (libre && await confirmar({ titulo: 'Borrar mesa', mensaje: `¿Borrar la mesa ${m.numero}?`, peligro: true, confirmar: 'Borrar' })) { removeMesa(m.id); toast('Mesa borrada', 'success') } }} disabled={!libre} style={{ width: '100%', background: libre ? '#7f1d1d' : '#1e293b', color: libre ? '#fff' : '#64748b', border: 'none', borderRadius: '0.5rem', padding: '0.4rem', cursor: libre ? 'pointer' : 'not-allowed', fontSize: '0.78rem' }}>{libre ? '🗑️ Borrar mesa' : 'Ocupada'}</button>
                  </div>
                )
              })}
            </div>
            <datalist id="zonas-list">
              {[...new Set(mesas.map(m => m.zona).filter(Boolean))].map(z => <option key={z} value={z} />)}
            </datalist>
          </div>
        )}

        {/* Tab Reservas (agenda) */}
        {tab === 'reservas' && (
          <div style={{ maxWidth: '640px' }}>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Reservas online de los clientes. Asigna una mesa y siéntalos cuando lleguen. Las reservas entran desde la página pública <code style={{ color: '#60a5fa' }}>/reservar</code>.
            </p>
            <ReservasConfig />
            <ReservasManager />
          </div>
        )}

        {/* Tab Caja (arqueo / cierre) */}
        {tab === 'caja' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
            {/* Arqueo de la caja abierta */}
            <div style={ajusteCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                <h3 style={ajusteTitulo}>Caja abierta</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                  desde {ultimoCierre ? new Date(ultimoCierre.hasta).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'el inicio'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1rem' }}>
                <div style={{ background: '#0f172a', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Ventas</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#f97316' }}>{cajaTotal.toFixed(2)} €</div>
                </div>
                <div style={{ background: '#0f172a', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Tickets</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#3b82f6' }}>{ticketsCaja.length}</div>
                </div>
                <div style={{ background: '#0f172a', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Propinas</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#10b981' }}>{cajaPropinas.toFixed(2)} €</div>
                </div>
                <div style={{ background: '#0f172a', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Ticket medio</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#8b5cf6' }}>{(ticketsCaja.length ? cajaTotal / ticketsCaja.length : 0).toFixed(2)} €</div>
                </div>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-muted)' }}>Desglose por método</h4>
              {['efectivo', 'tarjeta', 'bizum', 'sincobrar'].filter(k => cajaPagos[k]).length === 0
                ? <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Sin cobros todavía.</p>
                : ['efectivo', 'tarjeta', 'bizum', 'sincobrar'].filter(k => cajaPagos[k]).map(k => (
                  <div key={k} style={ajusteFila}>
                    <span>{METODO_EMOJI[k]} {METODO_LABEL[k]}</span>
                    <strong>{cajaPagos[k].toFixed(2)} €</strong>
                  </div>
                ))}

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '1rem 0 0.5rem', color: 'var(--color-muted)' }}>Por camarero</h4>
              {Object.keys(cajaPorCamarero).length === 0
                ? <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>—</p>
                : Object.entries(cajaPorCamarero).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                  <div key={c} style={ajusteFila}>
                    <span>👤 {c}</span><strong>{v.toFixed(2)} €</strong>
                  </div>
                ))}
            </div>

            {/* Cierre de caja (Z) */}
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Cerrar caja (Z)</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>
                Cuenta el efectivo del cajón y ciérrala. Quedará registrado el arqueo y empezará una caja nueva.
              </p>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Efectivo contado (opcional)</label>
              <input value={contado} onChange={e => setContado(e.target.value)} inputMode="decimal" placeholder="€ en el cajón" style={{ ...inputStyle, marginTop: '0.25rem', marginBottom: '0.5rem' }} />
              <div style={ajusteFila}><span>Efectivo esperado</span><strong>{efectivoEsperado.toFixed(2)} €</strong></div>
              {descuadre != null && (
                <div style={{ ...ajusteFila, color: Math.abs(descuadre) < 0.005 ? '#10b981' : '#f43f5e' }}>
                  <span>Descuadre</span><strong>{descuadre >= 0 ? '+' : ''}{descuadre.toFixed(2)} €</strong>
                </div>
              )}
              <button onClick={hacerCierre} disabled={ticketsCaja.length === 0} style={{ width: '100%', marginTop: '0.875rem', background: ticketsCaja.length ? '#f97316' : '#334155', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.8rem', cursor: ticketsCaja.length ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                🔒 Cerrar caja
              </button>

              {cierres.length > 0 && (
                <>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '1.25rem 0 0.5rem', color: 'var(--color-muted)' }}>Cierres anteriores</h4>
                  {cierres.slice().reverse().map(z => (
                    <div key={z.id} style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.85rem' }}>
                        <span>{new Date(z.hasta).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <span style={{ color: '#f97316' }}>{z.total.toFixed(2)} €</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                        {z.nTickets} ticket(s)
                        {['efectivo', 'tarjeta', 'bizum'].filter(k => z.pagos?.[k]).map(k => ` · ${METODO_EMOJI[k]} ${z.pagos[k].toFixed(2)}`).join('')}
                        {z.descuadre != null && Math.abs(z.descuadre) >= 0.005 && <span style={{ color: '#f43f5e' }}> · descuadre {z.descuadre >= 0 ? '+' : ''}{z.descuadre.toFixed(2)} €</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab Ajustes de carta */}
        {tab === 'ajustes' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
            {/* Categorías */}
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Categorías</h3>
              {carta.categorias.map(c => (
                <div key={c.id} style={ajusteFila}>
                  <span>{c.emoji} {c.nombre} <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>({c.tipo})</span></span>
                  <button onClick={async () => { if (await confirmar({ titulo: 'Borrar categoría', mensaje: `¿Borrar "${c.nombre}" y todos sus productos?`, peligro: true, confirmar: 'Borrar' })) { removeCategoria(c.id); toast('Categoría borrada', 'success') } }} style={iconBtn}>🗑️</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <input value={nuevaCat.nombre} onChange={e => setNuevaCat(s => ({ ...s, nombre: e.target.value }))} placeholder="Nueva categoría" style={{ ...inputStyle, flex: '1 1 120px' }} />
                <select value={nuevaCat.tipo} onChange={e => setNuevaCat(s => ({ ...s, tipo: e.target.value }))} style={{ ...inputStyle, flex: '0 1 110px' }}>
                  <option value="comida">comida</option>
                  <option value="bebida">bebida</option>
                </select>
                <button onClick={() => { if (nuevaCat.nombre.trim()) { addCategoria(nuevaCat.nombre, nuevaCat.tipo); setNuevaCat({ nombre: '', tipo: 'comida' }) } }} style={addBtn}>Añadir</button>
              </div>
            </div>

            {/* Tipos de pan */}
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Tipos de pan</h3>
              {carta.tiposPan.map(t => (
                <div key={t.id} style={ajusteFila}>
                  <span>{t.nombre} {t.sup > 0 && <span style={{ fontSize: '0.72rem', color: '#f97316' }}>+{t.sup.toFixed(2)}€</span>}</span>
                  <button onClick={() => removeTipoPan(t.id)} style={iconBtn}>🗑️</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <input value={nuevoPan.nombre} onChange={e => setNuevoPan(s => ({ ...s, nombre: e.target.value }))} placeholder="Nombre" style={{ ...inputStyle, flex: '1 1 110px' }} />
                <input value={nuevoPan.sup} onChange={e => setNuevoPan(s => ({ ...s, sup: e.target.value }))} type="number" step="0.10" placeholder="+€" style={{ ...inputStyle, flex: '0 1 70px' }} />
                <button onClick={() => { if (nuevoPan.nombre.trim()) { addTipoPan(nuevoPan.nombre, nuevoPan.sup); setNuevoPan({ nombre: '', sup: '' }) } }} style={addBtn}>Añadir</button>
              </div>
            </div>

            {/* Extras / condimentos */}
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Extras (condimentos)</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {carta.extras.map(ex => (
                  <span key={ex} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '9999px', padding: '0.2rem 0.5rem 0.2rem 0.7rem', fontSize: '0.8rem' }}>
                    {ex}<button onClick={() => removeExtra(ex)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                <input value={nuevoExtra} onChange={e => setNuevoExtra(e.target.value)} placeholder="Nuevo extra" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { if (nuevoExtra.trim()) { addExtra(nuevoExtra); setNuevoExtra('') } }} style={addBtn}>Añadir</button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Local (identidad del negocio) */}
        {tab === 'local' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Datos del local</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.9rem' }}>Aparecen en los tickets, las cabeceras y la página de reservas.</p>
              <label style={lblCampo}>Nombre del local</label>
              <input value={local.nombre} onChange={e => updateLocal({ nombre: e.target.value })} placeholder="Mi Bar" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>Subtítulo</label>
              <input value={local.subtitulo} onChange={e => updateLocal({ subtitulo: e.target.value })} placeholder="Bar · Cafetería" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>Dirección</label>
              <input value={local.direccion} onChange={e => updateLocal({ direccion: e.target.value })} placeholder="Calle, número, ciudad" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={lblCampo}>Teléfono</label>
                  <input value={local.telefono} onChange={e => updateLocal({ telefono: e.target.value })} placeholder="600 000 000" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lblCampo}>CIF / NIF</label>
                  <input value={local.cif} onChange={e => updateLocal({ cif: e.target.value })} placeholder="B12345678" style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Facturación y ticket</h3>
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.7rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={lblCampo}>IVA incluido (%)</label>
                  <input value={local.ivaPct} onChange={e => updateLocal({ ivaPct: e.target.value })} type="number" min="0" step="1" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lblCampo}>Moneda</label>
                  <input value={local.moneda} onChange={e => updateLocal({ moneda: e.target.value })} placeholder="€" style={inputStyle} />
                </div>
              </div>
              <label style={lblCampo}>Pie del ticket</label>
              <input value={local.pieTicket} onChange={e => updateLocal({ pieTicket: e.target.value })} placeholder="¡Gracias por su visita!" style={{ ...inputStyle, marginBottom: '1rem' }} />

              {/* Vista previa del encabezado del ticket */}
              <div style={{ background: '#fff', color: '#111', borderRadius: '0.4rem', padding: '0.9rem', fontFamily: '"Courier New", monospace', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}>{(local.nombre || 'Mi Local').toUpperCase()}</div>
                {local.subtitulo && <div style={{ fontSize: '0.72rem', color: '#444' }}>{local.subtitulo}</div>}
                {local.direccion && <div style={{ fontSize: '0.72rem', color: '#444' }}>{local.direccion}</div>}
                {local.cif && <div style={{ fontSize: '0.72rem', color: '#444' }}>CIF: {local.cif}</div>}
                <div style={{ borderTop: '1px dashed #999', margin: '0.5rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 }}><span>TOTAL</span><span>10,00 {local.moneda || '€'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#555' }}><span>IVA ({local.ivaPct || 0}%) incluido</span><span>{(10 - 10 / (1 + (Number(local.ivaPct) || 0) / 100)).toFixed(2)} {local.moneda || '€'}</span></div>
                <div style={{ borderTop: '1px dashed #999', margin: '0.5rem 0' }} />
                <div style={{ fontSize: '0.72rem' }}>{local.pieTicket || '¡Gracias por su visita!'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Personal (empleados y accesos) */}
        {tab === 'personal' && (
          <PersonalTab empleados={empleados} addEmpleado={addEmpleado} updateEmpleado={updateEmpleado} removeEmpleado={removeEmpleado} />
        )}

        {/* Tab Tickets del mes */}
        {tab === 'tickets' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: `Tickets de ${ahora.toLocaleDateString('es-ES', { month: 'long' })}`, value: delMes.length, color: '#3b82f6' },
                { label: 'Facturado (mes)', value: `${totalMes.toFixed(2)} €`, color: '#f97316' },
                { label: 'Propinas (mes)', value: `${propinasMes.toFixed(2)} €`, color: '#10b981' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.25rem', textTransform: 'capitalize' }}>{s.label}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {dias.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Aún no hay tickets este mes. Se guardan automáticamente al cerrar una mesa.</p>}
            {dias.map(dia => (
              <div key={dia} style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.625rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{dia}</span>
                  <span style={{ color: '#f97316' }}>{porDia[dia].reduce((s, r) => s + r.total, 0).toFixed(2)} €</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                  {porDia[dia].slice().reverse().map(r => (
                    <div key={r.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.625rem', padding: '0.75rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Mesa {r.mesaNumero}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{new Date(r.cerradaEn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {r.total.toFixed(2)} €</div>
                      </div>
                      <button onClick={() => setTicket({ numero: r.mesaNumero, personas: r.personas })} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Ver</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab QR */}
        {tab === 'qr' && (
          <div>
            <p style={{ color: 'var(--color-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Cada mesa tiene su QR único. Imprímelo y colócalo en la mesa: al escanearlo, el cliente abre directamente su carta.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem' }}>
              {mesas.map(m => {
                const url = `${window.location.origin}${import.meta.env.BASE_URL}#/mesa/${m.id}`
                return (
                  <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ fontWeight: 700 }}>Mesa {m.numero}</div>
                    <div style={{ background: 'white', padding: '0.625rem', borderRadius: '0.5rem' }}>
                      <QRCodeSVG value={url} size={128} level="M" />
                    </div>
                    <code style={{ fontSize: '0.65rem', color: '#a78bfa', wordBreak: 'break-all', textAlign: 'center' }}>{url}</code>
                    <button
                      onClick={() => navigator.clipboard?.writeText(url)}
                      style={{ background: '#1e293b', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '0.375rem', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem', width: '100%' }}
                    >
                      Copiar URL
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {ticket && <Ticket tipo="cuenta" mesa={ticket} onClose={() => setTicket(null)} />}
    </div>
  )
}

function PersonalTab({ empleados, addEmpleado, updateEmpleado, removeEmpleado }) {
  const [nuevo, setNuevo] = useState({ nombre: '', rol: 'camarero', pin: '' })
  const [err, setErr] = useState('')
  const [pinDraft, setPinDraft] = useState({}) // id -> PIN a medio escribir

  const crear = () => {
    const r = addEmpleado(nuevo)
    if (!r.ok) { setErr(r.error); toast(r.error, 'error'); return }
    toast(`${nuevo.nombre.trim()} dado de alta`, 'success')
    setNuevo({ nombre: '', rol: 'camarero', pin: '' }); setErr('')
  }
  const onPin = (e, val) => {
    if (!/^\d{0,4}$/.test(val)) return
    setPinDraft(d => ({ ...d, [e.id]: val }))
    if (val.length === 4) {
      const r = updateEmpleado(e.id, { pin: val })
      if (!r.ok) setErr(r.error)
      else { setErr(''); setPinDraft(d => { const n = { ...d }; delete n[e.id]; return n }) }
    }
  }
  const borrar = async (e) => {
    if (!(await confirmar({ titulo: 'Eliminar empleado', mensaje: `¿Eliminar a ${e.nombre}? Perderá el acceso.`, peligro: true, confirmar: 'Eliminar' }))) return
    const r = removeEmpleado(e.id)
    if (!r.ok) { setErr(r.error); toast(r.error, 'error') }
    else toast(`${e.nombre} eliminado`, 'success')
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Da de alta al personal y asígnale un PIN. Cada empleado entra en las pantallas (PDA, cocina, barra, impresión y este panel) con su PIN. Los <strong>administradores</strong> además pueden entrar aquí. Desactiva a quien no esté de turno sin perder su ficha.
      </p>
      {err && <div style={{ background: '#2d0a14', border: '1px solid #f43f5e', color: '#fda4af', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠️ {err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {empleados.map(e => (
          <div key={e.id} style={{ ...ajusteCard, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', opacity: e.activo ? 1 : 0.55 }}>
            <input value={e.nombre} onChange={ev => updateEmpleado(e.id, { nombre: ev.target.value })} style={{ ...inputStyle, flex: '2 1 140px' }} />
            <select value={e.rol} onChange={ev => updateEmpleado(e.id, { rol: ev.target.value })} style={{ ...inputStyle, flex: '0 1 130px' }}>
              <option value="camarero">Camarero</option>
              <option value="admin">Administrador</option>
            </select>
            <div style={{ flex: '0 1 110px' }}>
              <label style={lblCampo}>PIN</label>
              <input value={pinDraft[e.id] ?? e.pin} onChange={ev => onPin(e, ev.target.value)} inputMode="numeric" maxLength={4} style={{ ...inputStyle, letterSpacing: '0.2em', fontWeight: 700 }} />
            </div>
            <button onClick={() => updateEmpleado(e.id, { activo: !e.activo })} style={{ background: e.activo ? '#052e16' : '#3f1d0a', color: e.activo ? '#10b981' : '#f59e0b', border: `1px solid ${e.activo ? '#10b981' : '#f59e0b'}66`, borderRadius: '9999px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
              {e.activo ? '🟢 Activo' : '⏸ Inactivo'}
            </button>
            <button onClick={() => borrar(e)} title="Eliminar" style={iconBtn}>🗑️</button>
          </div>
        ))}
      </div>

      {/* Alta de empleado */}
      <div style={{ ...ajusteCard, borderColor: '#f97316' }}>
        <h3 style={{ ...ajusteTitulo, marginBottom: '0.6rem' }}>Nuevo empleado</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 160px' }}>
            <label style={lblCampo}>Nombre</label>
            <input value={nuevo.nombre} onChange={e => setNuevo(s => ({ ...s, nombre: e.target.value }))} placeholder="Nombre" style={inputStyle} />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={lblCampo}>Rol</label>
            <select value={nuevo.rol} onChange={e => setNuevo(s => ({ ...s, rol: e.target.value }))} style={inputStyle}>
              <option value="camarero">Camarero</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div style={{ flex: '0 1 100px' }}>
            <label style={lblCampo}>PIN (4 díg.)</label>
            <input value={nuevo.pin} onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) setNuevo(s => ({ ...s, pin: e.target.value })) }} inputMode="numeric" maxLength={4} placeholder="0000" style={{ ...inputStyle, letterSpacing: '0.2em', fontWeight: 700 }} />
          </div>
          <button onClick={crear} style={addBtn}>+ Añadir</button>
        </div>
      </div>
    </div>
  )
}

function FormProducto({ carta, form, setForm, onGuardar, onCancelar, titulo }) {
  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid #f97316', borderRadius: '0.625rem', padding: '1rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', gridColumn: '1 / -1' }}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f97316' }}>{titulo}</div>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
        <input value={form.nombre} onChange={set('nombre')} placeholder="Nombre" style={{ ...inputStyle, flex: '2 1 180px' }} />
        <input value={form.precioPitufo} onChange={set('precioPitufo')} placeholder="€ Pitufo" type="number" step="0.10" style={{ ...inputStyle, flex: '1 1 90px' }} />
        <input value={form.precioViena} onChange={set('precioViena')} placeholder="€ Viena" type="number" step="0.10" style={{ ...inputStyle, flex: '1 1 90px' }} />
        <select value={form.categoria} onChange={set('categoria')} style={{ ...inputStyle, flex: '1 1 140px' }}>
          {carta.categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
        </select>
      </div>
      <input value={form.descripcion} onChange={set('descripcion')} placeholder="Descripción" style={inputStyle} />
      {/* Alérgenos (14 UE) */}
      <div>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alérgenos</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {ALERGENOS.map(a => {
            const on = (form.alergenos || []).includes(a.id)
            return (
              <button key={a.id} type="button" onClick={() => setForm(f => ({ ...f, alergenos: on ? f.alergenos.filter(x => x !== a.id) : [...(f.alergenos || []), a.id] }))}
                style={{ background: on ? '#7c2d12' : '#0f172a', color: on ? '#fdba74' : 'var(--color-muted)', border: `1px solid ${on ? '#f97316' : 'var(--color-border)'}`, borderRadius: '9999px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                {a.emoji} {a.nombre}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={{ background: '#334155', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
        <button onClick={onGuardar} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Guardar</button>
      </div>
    </div>
  )
}

const inputStyle = {
  background: '#0f172a',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  color: 'var(--color-text)',
  fontSize: '0.85rem',
  width: '100%',
}

const iconBtn = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.95rem',
  padding: '0.25rem',
  lineHeight: 1,
}

const lblCampo = { display: 'block', fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }
const ajusteCard = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.875rem', padding: '1.1rem' }
const ajusteTitulo = { fontWeight: 700, fontSize: '1rem', marginBottom: '0.75rem' }
const ajusteFila = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }
const addBtn = { background: '#f97316', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }
