import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore, METODO_LABEL, METODO_EMOJI, ALERGENOS, normalizarExtra, etiquetasDe, ETIQUETAS_DEFECTO } from '../../store/useStore'
import { confirmar, toast } from '../../store/useUI'
import Ticket from '../../components/Ticket'
import ReservasManager from '../../components/ReservasManager'
import ReservasConfig from '../../components/ReservasConfig'
import BotonSalir from '../../components/BotonSalir'
import TemaToggle from '../../components/TemaToggle'
import Informes from './Informes'

const emptyForm = { nombre: '', categoria: '', descripcion: '', alergenos: [], imagen: '', conFormatos: false, precios: {}, precio: '' }

export default function PanelAdmin() {
  const { carta, mesas, historial, cierres, anulaciones, reservas, local, updateLocal, empleados, addEmpleado, updateEmpleado, removeEmpleado, cerrarCaja, addProducto, updateProducto, deleteProducto, toggleDisponible, resetDatos, addMesa, removeMesa, updateMesa, addCategoria, removeCategoria, addExtra, removeExtra, addTipoPan, removeTipoPan, addFormato, removeFormato, renombrarFormato, updateEtiquetas, fichajes, editarFichaje, borrarFichaje } = useStore()
  const hoyStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const reservasHoy = reservas.filter(r => r.fecha === hoyStr && r.estado === 'confirmada').length
  const [tab, setTab] = useState('carta')
  const [editando, setEditando] = useState(null) // productoId en edición
  const [form, setForm] = useState(emptyForm)
  const [ticket, setTicket] = useState(null)
  const [nuevaCat, setNuevaCat] = useState({ nombre: '', tipo: 'comida' })
  const [nuevoExtra, setNuevoExtra] = useState({ nombre: '', precio: '0.20' })
  const [nuevoPan, setNuevoPan] = useState({ nombre: '', sup: '' })
  const [nuevoFormato, setNuevoFormato] = useState('')
  const etiquetas = etiquetasDe(carta)
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
    setForm({
      nombre: prod.nombre, categoria: prod.categoria, descripcion: prod.descripcion, alergenos: prod.alergenos || [], imagen: prod.imagen || '',
      conFormatos: !!prod.precios,
      precios: prod.precios ? Object.fromEntries(Object.entries(prod.precios).map(([k, v]) => [k, String(v)])) : {},
      precio: String(prod.precio ?? ''),
    })
  }
  const cancelar = () => { setEditando(null); setForm(emptyForm) }
  const guardar = () => {
    if (!form.nombre.trim() || !form.categoria) return
    const payload = { ...form, precios: form.conFormatos ? form.precios : {} }
    if (editando === 'nuevo') addProducto(payload)
    else updateProducto(editando, payload)
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
          <TemaToggle compacto />
          <button onClick={resetDatos} title="Borra todos los datos guardados y recarga" style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.8rem' }}>
            ↺ Reiniciar datos
          </button>
          <BotonSalir />
        </div>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        {[
          { label: 'Mesas ocupadas', value: `${mesasOcupadas}/${mesas.length}`, color: 'var(--tint-warning-fg)' },
          { label: 'Productos en carta', value: carta.productos.length, color: 'var(--tint-info-fg)' },
          { label: 'Categorías', value: carta.categorias.length, color: '#8b5cf6' },
          { label: 'Consumo activo', value: `${totalVentas.toFixed(2)} €`, color: 'var(--color-accent)' },
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
          { id: 'fichajes', label: '⏱ Fichajes' },
          { id: 'mesas', label: '🍽 Mesas' },
          { id: 'reservas', label: `📅 Reservas${reservasHoy ? ` (${reservasHoy})` : ''}` },
          { id: 'caja', label: '💰 Caja' },
          { id: 'ajustes', label: '⚙️ Ajustes' },
          { id: 'tickets', label: '🧾 Tickets' },
          { id: 'informes', label: '📊 Informes' },
          { id: 'qr', label: '📱 QR Codes' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', padding: '0.875rem 1.5rem', cursor: 'pointer',
            color: tab === t.id ? 'var(--color-accent)' : 'var(--color-muted)',
            borderBottom: tab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
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
                  <span style={{ fontSize: '0.75rem', background: cat.tipo === 'comida' ? 'var(--tint-success-bg)' : 'var(--tint-danger-bg)', color: cat.tipo === 'comida' ? 'var(--tint-success-fg)' : 'var(--tint-danger-fg)', borderRadius: '9999px', padding: '0.15rem 0.5rem' }}>{cat.tipo}</span>
                  <button onClick={() => empezarNuevo(cat.id)} style={{ marginLeft: 'auto', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
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
                      <div key={prod.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.625rem', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', opacity: prod.disponible ? 1 : 0.5 }}>
                        {prod.imagen && <img src={prod.imagen} alt="" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '2.4rem', height: '2.4rem', objectFit: 'cover', borderRadius: '0.4rem', flexShrink: 0 }} />}
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
                        <div style={{ fontWeight: 700, color: 'var(--color-accent)', fontSize: '0.85rem', margin: '0 0.75rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {prod.precios
                            ? Object.entries(prod.precios).map(([k, v]) => (
                                <div key={k} title={carta.formatos.find(f => f.id === k)?.nombre || k}>{Number(v).toFixed(2)} €</div>
                              ))
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
              <button onClick={addMesa} style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>+ Añadir mesa</button>
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
                    <button onClick={async () => { if (libre && await confirmar({ titulo: 'Borrar mesa', mensaje: `¿Borrar la mesa ${m.numero}?`, peligro: true, confirmar: 'Borrar' })) { removeMesa(m.id); toast('Mesa borrada', 'success') } }} disabled={!libre} style={{ width: '100%', background: libre ? '#7f1d1d' : 'var(--color-surface-2)', color: libre ? '#fff' : '#64748b', border: 'none', borderRadius: '0.5rem', padding: '0.4rem', cursor: libre ? 'pointer' : 'not-allowed', fontSize: '0.78rem' }}>{libre ? '🗑️ Borrar mesa' : 'Ocupada'}</button>
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
              Reservas online de los clientes. Asigna una mesa y siéntalos cuando lleguen. Las reservas entran desde la página pública <code style={{ color: 'var(--tint-info-fg)' }}>/reservar</code>.
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
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Ventas</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-accent)' }}>{cajaTotal.toFixed(2)} €</div>
                </div>
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Tickets</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#3b82f6' }}>{ticketsCaja.length}</div>
                </div>
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Propinas</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#10b981' }}>{cajaPropinas.toFixed(2)} €</div>
                </div>
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem' }}>
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
              <button onClick={hacerCierre} disabled={ticketsCaja.length === 0} style={{ width: '100%', marginTop: '0.875rem', background: ticketsCaja.length ? 'var(--color-accent)' : 'var(--color-surface-3)', color: ticketsCaja.length ? '#fff' : 'var(--color-text)', border: 'none', borderRadius: '0.5rem', padding: '0.8rem', cursor: ticketsCaja.length ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                🔒 Cerrar caja
              </button>

              {cierres.length > 0 && (
                <>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '1.25rem 0 0.5rem', color: 'var(--color-muted)' }}>Cierres anteriores</h4>
                  {cierres.slice().reverse().map(z => (
                    <div key={z.id} style={{ background: 'var(--color-inset)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.85rem' }}>
                        <span>{new Date(z.hasta).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <span style={{ color: 'var(--color-accent)' }}>{z.total.toFixed(2)} €</span>
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

            {/* Auditoría de anulaciones */}
            <div style={ajusteCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                <h3 style={ajusteTitulo}>Anulaciones</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{(anulaciones || []).length} en total</span>
              </div>
              {(anulaciones || []).length === 0
                ? <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Sin anulaciones registradas.</p>
                : (
                  <>
                    <div style={{ ...ajusteFila, fontWeight: 700 }}>
                      <span>Importe anulado (total)</span>
                      <span style={{ color: '#f43f5e' }}>{(anulaciones || []).reduce((s, a) => s + (a.importe || 0), 0).toFixed(2)} €</span>
                    </div>
                    {(anulaciones || []).slice(-15).reverse().map(a => (
                      <div key={a.id} style={{ background: 'var(--color-inset)', borderRadius: '0.5rem', padding: '0.55rem 0.75rem', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                          <span>M{a.mesaNumero} · {a.cantidad}× {a.nombre}{a.enviado ? ' 🔥' : ''}</span>
                          <span style={{ color: '#f43f5e' }}>−{(a.importe || 0).toFixed(2)} €</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                          {new Date(a.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                          {a.por ? ` · 👤 ${a.por}` : ''} · «{a.motivo}»
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: '0.68rem', color: 'var(--color-faint)', marginTop: '0.25rem' }}>🔥 = ya estaba enviada a cocina/barra. Se muestran las últimas 15.</p>
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
              <h3 style={ajusteTitulo}>{etiquetas.tiposPan} (variedades)</h3>
              {carta.tiposPan.map(t => (
                <div key={t.id} style={ajusteFila}>
                  <span>{t.nombre} {t.sup > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--color-accent)' }}>+{t.sup.toFixed(2)}€</span>}</span>
                  <button onClick={() => removeTipoPan(t.id)} style={iconBtn}>🗑️</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <input value={nuevoPan.nombre} onChange={e => setNuevoPan(s => ({ ...s, nombre: e.target.value }))} placeholder="Nombre" style={{ ...inputStyle, flex: '1 1 110px' }} />
                <input value={nuevoPan.sup} onChange={e => setNuevoPan(s => ({ ...s, sup: e.target.value }))} type="number" step="0.10" placeholder="+€" style={{ ...inputStyle, flex: '0 1 70px' }} />
                <button onClick={() => { if (nuevoPan.nombre.trim()) { addTipoPan(nuevoPan.nombre, nuevoPan.sup); setNuevoPan({ nombre: '', sup: '' }) } }} style={addBtn}>Añadir</button>
              </div>
            </div>

            {/* Extras (cada uno con su precio) */}
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>{etiquetas.extras} (añadibles)</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {carta.extras.map(raw => {
                  const ex = normalizarExtra(raw)
                  return (
                    <span key={ex.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '9999px', padding: '0.2rem 0.5rem 0.2rem 0.7rem', fontSize: '0.8rem' }}>
                      {ex.nombre}{ex.precio > 0 && <span style={{ color: 'var(--color-accent)', fontSize: '0.72rem' }}>+{ex.precio.toFixed(2)}€</span>}
                      <button onClick={() => removeExtra(ex.nombre)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                    </span>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <input value={nuevoExtra.nombre} onChange={e => setNuevoExtra(s => ({ ...s, nombre: e.target.value }))} placeholder="Nuevo extra" style={{ ...inputStyle, flex: '1 1 110px' }} />
                <input value={nuevoExtra.precio} onChange={e => setNuevoExtra(s => ({ ...s, precio: e.target.value }))} type="number" step="0.05" placeholder="+€" style={{ ...inputStyle, flex: '0 1 70px' }} />
                <button onClick={() => { if (nuevoExtra.nombre.trim()) { addExtra(nuevoExtra.nombre, nuevoExtra.precio); setNuevoExtra({ nombre: '', precio: '0.20' }) } }} style={addBtn}>Añadir</button>
              </div>
            </div>

            {/* Formatos (tamaños con precio por producto) */}
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>{etiquetas.formatos} (formatos)</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>Los productos «por formatos» tienen un precio para cada uno (p. ej. tamaños o raciones).</p>
              {carta.formatos.map(f => (
                <div key={f.id} style={ajusteFila}>
                  <input value={f.nombre} onChange={e => renombrarFormato(f.id, e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1, marginRight: '0.5rem' }} />
                  <button onClick={() => removeFormato(f.id)} disabled={carta.formatos.length <= 1} style={{ ...iconBtn, opacity: carta.formatos.length <= 1 ? 0.4 : 1 }}>🗑️</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                <input value={nuevoFormato} onChange={e => setNuevoFormato(e.target.value)} placeholder="Nuevo formato" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { if (nuevoFormato.trim()) { addFormato(nuevoFormato); setNuevoFormato('') } }} style={addBtn}>Añadir</button>
              </div>
            </div>

            {/* Etiquetas de la personalización */}
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Textos de personalización</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>Adapta los nombres a tu negocio (una pizzería usaría Tamaño / Masa / Ingredientes).</p>
              {Object.keys(ETIQUETAS_DEFECTO).map(k => (
                <div key={k} style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.2rem' }}>{{ formatos: 'Grupo de formatos', tiposPan: 'Grupo de variedades', extras: 'Grupo de añadidos' }[k]}</label>
                  <input value={etiquetas[k]} onChange={e => updateEtiquetas({ [k]: e.target.value })} style={inputStyle} />
                </div>
              ))}
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
              <label style={lblCampo}>Razón social (ticket)</label>
              <input value={local.razonSocial || ''} onChange={e => updateLocal({ razonSocial: e.target.value })} placeholder="Si difiere del nombre comercial" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>Dirección fiscal (ticket)</label>
              <input value={local.direccionFiscal || ''} onChange={e => updateLocal({ direccionFiscal: e.target.value })} placeholder="Si difiere de la dirección" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>URL de reseñas (QR del ticket)</label>
              <input value={local.urlResena || ''} onChange={e => updateLocal({ urlResena: e.target.value })} placeholder="https://g.page/r/... (vacío = QR a la carta)" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
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

        {/* Tab Informes */}
        {tab === 'informes' && <Informes historial={historial} moneda={local.moneda || '€'} />}

        {/* Tab Fichajes (registro de jornada) */}
        {tab === 'fichajes' && (
          <FichajesTab fichajes={fichajes} empleados={empleados} editarFichaje={editarFichaje} borrarFichaje={borrarFichaje} local={local} />
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
                { label: 'Facturado (mes)', value: `${totalMes.toFixed(2)} €`, color: 'var(--color-accent)' },
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
                  <span style={{ color: 'var(--color-accent)' }}>{porDia[dia].reduce((s, r) => s + r.total, 0).toFixed(2)} €</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                  {porDia[dia].slice().reverse().map(r => (
                    <div key={r.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.625rem', padding: '0.75rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Mesa {r.mesaNumero}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{new Date(r.cerradaEn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {r.total.toFixed(2)} €</div>
                      </div>
                      <button onClick={() => setTicket({ numero: r.mesaNumero, personas: r.personas })} style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Ver</button>
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
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '0.375rem', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem', width: '100%' }}
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

// Formatea una fecha ISO al valor de un <input type="datetime-local"> (hora local).
const isoALocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d - off).toISOString().slice(0, 16)
}
const localAIso = (v) => (v ? new Date(v).toISOString() : null)
const horasEntre = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 3600000) : 0)
const fmtH = (h) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`

function FichajesTab({ fichajes, empleados, editarFichaje, borrarFichaje, local }) {
  const [mes, setMes] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  const [edit, setEdit] = useState(null) // { id, entrada, salida } en formato datetime-local

  const delMes = fichajes.filter(f => (f.entrada || '').slice(0, 7) === mes)
    .slice().sort((a, b) => new Date(b.entrada) - new Date(a.entrada))

  // Horas por empleado
  const porEmpleado = {}
  delMes.forEach(f => { porEmpleado[f.nombre] = (porEmpleado[f.nombre] || 0) + horasEntre(f.entrada, f.salida) })
  const totalHoras = Object.values(porEmpleado).reduce((s, h) => s + h, 0)

  const guardar = () => {
    const r = editarFichaje(edit.id, { entrada: localAIso(edit.entrada), salida: edit.salida ? localAIso(edit.salida) : null })
    if (!r.ok) return toast(r.error, 'error')
    toast('Fichaje corregido', 'success'); setEdit(null)
  }
  const borrar = async (f) => {
    if (await confirmar({ titulo: 'Borrar fichaje', mensaje: `¿Borrar el fichaje de ${f.nombre} del ${new Date(f.entrada).toLocaleDateString('es-ES')}?`, peligro: true, confirmar: 'Borrar' })) {
      borrarFichaje(f.id); toast('Fichaje borrado', 'success')
    }
  }
  const exportarCSV = () => {
    const filas = [['Empleado', 'Fecha', 'Entrada', 'Salida', 'Horas']]
    delMes.slice().reverse().forEach(f => {
      const e = new Date(f.entrada)
      filas.push([
        f.nombre,
        e.toLocaleDateString('es-ES'),
        e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        f.salida ? new Date(f.salida).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '(abierto)',
        f.salida ? horasEntre(f.entrada, f.salida).toFixed(2) : '',
      ])
    })
    const csv = filas.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `fichajes-${(local?.nombre || 'local').replace(/\s+/g, '_')}-${mes}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{delMes.length} fichaje(s) · <strong style={{ color: 'var(--color-accent)' }}>{fmtH(totalHoras)}</strong> en total</span>
        <button onClick={exportarCSV} disabled={delMes.length === 0} style={{ ...addBtn, marginLeft: 'auto', opacity: delMes.length ? 1 : 0.5 }}>⬇ Exportar CSV</button>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-faint)', marginBottom: '1rem' }}>Registro de jornada obligatorio (RD-ley 8/2019): conservar 4 años. El personal ficha desde su PDA (pestaña Turno). Aquí puedes corregir errores.</p>

      {/* Horas por empleado */}
      {Object.keys(porEmpleado).length > 0 && (
        <div style={{ ...ajusteCard, marginBottom: '1.25rem' }}>
          <h3 style={ajusteTitulo}>Horas por empleado</h3>
          {Object.entries(porEmpleado).sort((a, b) => b[1] - a[1]).map(([n, h]) => (
            <div key={n} style={ajusteFila}><span>👤 {n}</span><strong>{fmtH(h)}</strong></div>
          ))}
        </div>
      )}

      {/* Detalle */}
      {delMes.length === 0
        ? <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Sin fichajes este mes.</p>
        : delMes.map(f => {
          const abierto = !f.salida
          return (
            <div key={f.id} style={{ background: 'var(--color-surface)', border: `1px solid ${abierto ? '#10b981' : 'var(--color-border)'}66`, borderRadius: '0.625rem', padding: '0.7rem 0.85rem', marginBottom: '0.5rem' }}>
              {edit?.id === f.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={lblCampo}>Entrada</label>
                      <input type="datetime-local" value={edit.entrada} onChange={e => setEdit(s => ({ ...s, entrada: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={lblCampo}>Salida {abierto && '(vacío = turno abierto)'}</label>
                      <input type="datetime-local" value={edit.salida} onChange={e => setEdit(s => ({ ...s, salida: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEdit(null)} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancelar</button>
                    <button onClick={guardar} style={addBtn}>Guardar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>👤 {f.nombre} <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: '0.78rem' }}>· {new Date(f.entrada).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                      🟢 {new Date(f.entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {abierto ? <span style={{ color: '#10b981' }}>en curso</span> : `🔴 ${new Date(f.salida).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                      {!abierto && <strong style={{ color: 'var(--color-accent)', marginLeft: '0.5rem' }}>· {fmtH(horasEntre(f.entrada, f.salida))}</strong>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => setEdit({ id: f.id, entrada: isoALocal(f.entrada), salida: isoALocal(f.salida) })} title="Corregir" style={iconBtn}>✏️</button>
                    <button onClick={() => borrar(f)} title="Borrar" style={iconBtn}>🗑️</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
      {err && <div style={{ background: 'var(--tint-danger-bg)', border: '1px solid #f43f5e', color: 'var(--tint-danger-fg)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠️ {err}</div>}

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
            <button onClick={() => updateEmpleado(e.id, { activo: !e.activo })} style={{ background: e.activo ? 'var(--tint-success-bg)' : 'var(--color-surface-3)', color: e.activo ? 'var(--tint-success-fg)' : 'var(--tint-warning-fg)', border: `1px solid ${e.activo ? '#10b981' : '#f59e0b'}66`, borderRadius: '9999px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
              {e.activo ? '🟢 Activo' : '⏸ Inactivo'}
            </button>
            <button onClick={() => borrar(e)} title="Eliminar" style={iconBtn}>🗑️</button>
          </div>
        ))}
      </div>

      {/* Alta de empleado */}
      <div style={{ ...ajusteCard, borderColor: 'var(--color-accent)' }}>
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
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)', borderRadius: '0.625rem', padding: '1rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', gridColumn: '1 / -1' }}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-accent)' }}>{titulo}</div>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
        <input value={form.nombre} onChange={set('nombre')} placeholder="Nombre" style={{ ...inputStyle, flex: '2 1 180px' }} />
        <button type="button" onClick={() => setForm(f => ({ ...f, conFormatos: !f.conFormatos }))}
          style={{ background: form.conFormatos ? '#7c3aed' : 'var(--color-inset)', color: '#fff', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, flex: '0 0 auto' }}>
          {form.conFormatos ? '📐 Por formatos' : '💶 Precio único'}
        </button>
        {form.conFormatos
          ? carta.formatos.map(f => (
              <input key={f.id} value={form.precios[f.id] ?? ''} onChange={e => setForm(x => ({ ...x, precios: { ...x.precios, [f.id]: e.target.value } }))} placeholder={`€ ${f.nombre}`} type="number" step="0.10" style={{ ...inputStyle, flex: '1 1 90px' }} />
            ))
          : <input value={form.precio} onChange={set('precio')} placeholder="€ Precio" type="number" step="0.10" style={{ ...inputStyle, flex: '1 1 90px' }} />}
        <select value={form.categoria} onChange={set('categoria')} style={{ ...inputStyle, flex: '1 1 140px' }}>
          {carta.categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
        </select>
      </div>
      <input value={form.descripcion} onChange={set('descripcion')} placeholder="Descripción" style={inputStyle} />
      {/* Foto del producto (URL) */}
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <input value={form.imagen} onChange={set('imagen')} placeholder="📷 URL de la foto (opcional)" style={{ ...inputStyle, flex: 1 }} />
        {form.imagen?.trim() && <img src={form.imagen} alt="" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '2.6rem', height: '2.6rem', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }} />}
      </div>
      {/* Alérgenos (14 UE) */}
      <div>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alérgenos</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {ALERGENOS.map(a => {
            const on = (form.alergenos || []).includes(a.id)
            return (
              <button key={a.id} type="button" onClick={() => setForm(f => ({ ...f, alergenos: on ? f.alergenos.filter(x => x !== a.id) : [...(f.alergenos || []), a.id] }))}
                style={{ background: on ? '#7c2d12' : 'var(--color-inset)', color: on ? '#fdba74' : 'var(--color-muted)', border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: '9999px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                {a.emoji} {a.nombre}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
        <button onClick={onGuardar} style={{ background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Guardar</button>
      </div>
    </div>
  )
}

const inputStyle = {
  background: 'var(--color-inset)',
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
const addBtn = { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }
