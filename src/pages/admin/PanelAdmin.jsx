import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '../../store/useStore'

const emptyForm = { nombre: '', precioPitufo: '', precioViena: '', categoria: '', descripcion: '' }
const precioDesde = (prod) => Math.min(prod.precios?.pitufo ?? 0, prod.precios?.viena ?? 0)

export default function PanelAdmin() {
  const { carta, mesas, addProducto, updateProducto, deleteProducto, toggleDisponible, resetDatos } = useStore()
  const [tab, setTab] = useState('carta')
  const [editando, setEditando] = useState(null) // productoId en edición
  const [form, setForm] = useState(emptyForm)

  const totalVentas = mesas.reduce((s, m) =>
    s + m.personas.reduce((ss, p) =>
      ss + p.items.reduce((sss, i) => sss + i.precio * i.cantidad, 0), 0), 0)
  const mesasOcupadas = mesas.filter(m => m.estado !== 'libre').length

  const empezarNuevo = (categoriaId) => {
    setEditando('nuevo')
    setForm({ ...emptyForm, categoria: categoriaId })
  }
  const empezarEdicion = (prod) => {
    setEditando(prod.id)
    setForm({ nombre: prod.nombre, precioPitufo: String(prod.precios?.pitufo ?? ''), precioViena: String(prod.precios?.viena ?? ''), categoria: prod.categoria, descripcion: prod.descripcion })
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
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem' }}>🛠 Panel Administración</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>Gestión del local</p>
        </div>
        <button onClick={resetDatos} title="Borra todos los datos guardados y recarga" style={{ background: '#1e293b', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.8rem' }}>
          ↺ Reiniciar datos
        </button>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        {[
          { label: 'Mesas ocupadas', value: `${mesasOcupadas}/${mesas.length}`, color: '#f59e0b' },
          { label: 'Productos en carta', value: carta.productos.length, color: '#3b82f6' },
          { label: 'Categorías', value: carta.categorias.length, color: '#8b5cf6' },
          { label: 'Consumo activo', value: `${totalVentas.toFixed(2)} €`, color: '#f97316' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        {[
          { id: 'carta', label: '📋 Carta' },
          { id: 'mesas', label: '🍽 Mesas' },
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
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{prod.descripcion}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#f97316', fontSize: '0.85rem', margin: '0 0.75rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {prod.precios
                            ? <>{prod.precios.pitufo.toFixed(2)} €<br />{prod.precios.viena.toFixed(2)} €</>
                            : <>{(prod.precio ?? 0).toFixed(2)} €</>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => toggleDisponible(prod.id)} title={prod.disponible ? 'Marcar agotado' : 'Marcar disponible'} style={iconBtn}>{prod.disponible ? '🟢' : '⚪'}</button>
                          <button onClick={() => empezarEdicion(prod)} title="Editar" style={iconBtn}>✏️</button>
                          <button onClick={() => { if (confirm(`¿Borrar "${prod.nombre}"?`)) deleteProducto(prod.id) }} title="Borrar" style={iconBtn}>🗑️</button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Mesas */}
        {tab === 'mesas' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem' }}>
            {mesas.map(m => {
              const total = m.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
              return (
                <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.875rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mesa {m.numero}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: m.estado === 'libre' ? '#10b981' : m.estado === 'esperando_cobro' ? '#f43f5e' : '#f59e0b' }}>
                      {m.estado === 'libre' ? 'Libre' : m.estado === 'esperando_cobro' ? 'Pide cuenta' : 'Ocupada'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Capacidad: {m.capacidad} personas</div>
                  {m.estado !== 'libre' && (
                    <>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{m.personas.length} comensales</div>
                      <div style={{ fontWeight: 700, color: '#f97316', fontSize: '0.9rem', marginTop: '0.25rem' }}>{total.toFixed(2)} €</div>
                    </>
                  )}
                </div>
              )
            })}
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
