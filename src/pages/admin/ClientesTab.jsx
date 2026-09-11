import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { confirmar, toast } from '../../store/useUI'
import { buscarClientes, resumenCliente, clientesSinGuardar, csvFacturasCliente } from '../../lib/clientesFactura'
import { numeroDeFactura } from '../../lib/factura'
import FacturaDocumento from '../../components/FacturaDocumento'

const euros = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const VACIO = { nombre: '', nif: '', direccion: '', email: '' }

/**
 * Admin › Clientes: la agenda de los que piden factura, y todo sobre sus
 * facturas.
 *
 * Vivía plegado dentro de Caja, donde solo se podía borrar. Pero «¿me sacas
 * todas las facturas de Talleres Pérez de este año?» es una pregunta que hace
 * la gestoría del cliente cada trimestre, y la respuesta tiene que estar a
 * dos toques: el cliente, el año, el CSV o cada factura en PDF.
 */
export default function ClientesTab() {
  const clientes = useStore(s => s.clientesFactura) || []
  const facturas = useStore(s => s.facturas) || []
  const crear = useStore(s => s.crearClienteFactura)
  const [busca, setBusca] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [nuevo, setNuevo] = useState(false)

  const cliente = clientes.find(c => c.id === abierto)
  if (cliente) return <FichaCliente cliente={cliente} onVolver={() => setAbierto(null)} />

  const lista = buscarClientes(clientes, busca, 500)
  const sinGuardar = clientesSinGuardar(clientes, facturas)

  const guardarSinGuardar = (c) => {
    const r = crear(c)
    toast(r.ok ? `${c.nombre} guardado` : r.error, r.ok ? 'success' : 'error')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: '1.2rem' }}>🤝 Clientes</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Los que piden factura. Toca uno para ver todas sus facturas.</p>
        </div>
        <button onClick={() => setNuevo(v => !v)} style={boton('var(--color-accent)', '#fff')}>{nuevo ? 'Cerrar' : '+ Nuevo cliente'}</button>
      </div>

      {nuevo && <NuevoCliente onHecho={() => setNuevo(false)} />}

      {sinGuardar.length > 0 && (
        <div style={{ ...tarjeta, borderColor: 'var(--tint-warning-bd, var(--color-border))' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>Tienen facturas pero no están guardados</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>Se les facturó sin marcar «Guardar este cliente». Con los datos de su última factura:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {sinGuardar.map(c => (
              <div key={c.nif} style={fila}>
                <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.nombre}</div>
                  <div style={sub}>{c.nif} · {c.direccion}</div>
                </div>
                <button onClick={() => guardarSinGuardar(c)} style={boton('var(--color-surface-2)')}>Guardar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {clientes.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🤝</div>
          Aún no hay clientes guardados.<br />
          Se guardan al hacer una factura, o con «+ Nuevo cliente».
        </div>
      ) : (
        <div style={tarjeta}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={`🔍 Buscar entre ${clientes.length} por nombre o NIF…`} style={{ ...inp, marginBottom: '0.7rem' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {lista.length === 0 && <p style={{ fontSize: '0.84rem', color: 'var(--color-muted)' }}>Ninguno coincide con «{busca}».</p>}
            {lista.map(c => (
              <button key={c.id} onClick={() => setAbierto(c.id)} style={{ ...fila, width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', color: 'var(--color-text)' }}>
                <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{c.nombre}</div>
                  <div style={sub}>{c.nif} · {c.direccion}{c.email ? ` · ${c.email}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{c.facturas || 0} {c.facturas === 1 ? 'factura' : 'facturas'}</div>
                  <div style={sub}>{c.usadoEn ? `última el ${fecha(c.usadoEn)}` : ''}</div>
                </div>
                <span style={{ color: 'var(--color-muted)', fontSize: '1.1rem' }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NuevoCliente({ onHecho }) {
  const crear = useStore(s => s.crearClienteFactura)
  const [datos, setDatos] = useState(VACIO)
  const [error, setError] = useState(null)
  const cambia = (k) => (e) => { setDatos(d => ({ ...d, [k]: e.target.value })); setError(null) }
  const guardar = () => {
    const r = crear(datos)
    if (!r.ok) { setError(r.error); return }
    toast(`${datos.nombre.trim()} guardado`, 'success')
    onHecho()
  }
  return (
    <div style={tarjeta}>
      <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>Nuevo cliente</div>
      <CamposCliente datos={datos} cambia={cambia} />
      {error && <div role="alert" style={alerta}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.7rem' }}>
        <button onClick={guardar} style={boton('var(--color-accent)', '#fff')}>Guardar cliente</button>
      </div>
    </div>
  )
}

function CamposCliente({ datos, cambia, nifFijo = false }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.6rem' }}>
      <label style={campo}><span style={etiqueta}>Nombre o razón social</span>
        <input value={datos.nombre} onChange={cambia('nombre')} maxLength={120} placeholder="Talleres Pérez S.L." style={inp} />
      </label>
      <label style={campo}><span style={etiqueta}>NIF / CIF / NIE</span>
        {nifFijo
          ? <input value={datos.nif} readOnly title="El NIF une al cliente con sus facturas: no se cambia" style={{ ...inp, opacity: 0.7 }} />
          : <input value={datos.nif} onChange={cambia('nif')} autoCapitalize="characters" placeholder="B12345674" style={{ ...inp, textTransform: 'uppercase' }} />}
      </label>
      <label style={campo}><span style={etiqueta}>Domicilio</span>
        <input value={datos.direccion} onChange={cambia('direccion')} maxLength={200} placeholder="C/ Mayor 3, 28001 Madrid" style={inp} />
      </label>
      <label style={campo}><span style={etiqueta}>Correo</span>
        <input value={datos.email} onChange={cambia('email')} type="email" inputMode="email" placeholder="administracion@empresa.es" style={inp} />
      </label>
    </div>
  )
}

function FichaCliente({ cliente, onVolver }) {
  const actualizar = useStore(s => s.actualizarClienteFactura)
  const borrar = useStore(s => s.borrarClienteFactura)
  const facturasDeCliente = useStore(s => s.facturasDeCliente)
  const [datos, setDatos] = useState({ nombre: cliente.nombre, nif: cliente.nif, direccion: cliente.direccion, email: cliente.email || '' })
  const [error, setError] = useState(null)
  const [facturas, setFacturas] = useState(null)
  const [anio, setAnio] = useState('todos')
  const [verFactura, setVerFactura] = useState(null)

  // Todas sus facturas, del servidor: no solo las del mes que tiene bajadas
  // el aparato, que es justo lo que pide una gestoría a final de trimestre.
  useEffect(() => {
    let vivo = true
    Promise.resolve(facturasDeCliente(cliente.nif)).then(fs => { if (vivo) setFacturas(fs || []) }).catch(() => { if (vivo) setFacturas([]) })
    return () => { vivo = false }
  }, [cliente.nif, facturasDeCliente])

  const todas = resumenCliente(cliente, facturas || [])
  const anios = [...new Set(todas.facturas.map(f => new Date(f.expedidaEn).getFullYear()))].sort((a, b) => b - a)
  const visibles = anio === 'todos' ? todas.facturas : todas.facturas.filter(f => new Date(f.expedidaEn).getFullYear() === Number(anio))
  const r = resumenCliente(cliente, visibles)

  const cambia = (k) => (e) => { setDatos(d => ({ ...d, [k]: e.target.value })); setError(null) }
  const cambiado = datos.nombre !== cliente.nombre || datos.direccion !== cliente.direccion || (datos.email || '') !== (cliente.email || '')
  const guardar = () => {
    const res = actualizar(cliente.id, datos)
    if (!res.ok) { setError(res.error); return }
    toast('Datos guardados', 'success')
  }

  const descargarCsv = () => {
    const csv = csvFacturasCliente(cliente, r.facturas)
    // BOM y `;`, como el CSV de Informes: Excel en español lo abre bien a la primera.
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `facturas-${cliente.nif}${anio === 'todos' ? '' : `-${anio}`}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const quitar = async () => {
    const ok = await confirmar({
      titulo: `Borrar a ${cliente.nombre}`,
      mensaje: 'Se borran sus datos guardados. Sus facturas ya emitidas NO se tocan: son documentos fiscales y se conservan con sus datos dentro.',
      confirmar: 'Borrar', peligro: true,
    })
    if (!ok) return
    borrar(cliente.id)
    toast(`${cliente.nombre} borrado`, 'success')
    onVolver()
  }

  const estado = {
    enviado: { txt: '✓ Registrada', color: 'var(--tint-success-fg)' },
    pendiente: { txt: '⏳ Pendiente', color: 'var(--tint-warning-fg)' },
    error: { txt: '⚠ Rechazada', color: '#f43f5e' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
        <button onClick={onVolver} style={boton('var(--color-surface-2)')}>← Clientes</button>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.2 }}>{cliente.nombre}</h2>
          <div style={sub}>NIF {cliente.nif}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.6rem' }}>
        {[
          { label: anio === 'todos' ? 'Facturas' : `Facturas ${anio}`, valor: facturas ? r.numero : '…' },
          { label: 'Facturado', valor: facturas ? euros(r.total) : '…', color: 'var(--color-accent)' },
          { label: 'Última factura', valor: facturas ? fecha(todas.ultima) : '…' },
          ...(r.rechazadas ? [{ label: 'Rechazadas', valor: r.rechazadas, color: '#f43f5e' }] : []),
        ].map(s => (
          <div key={s.label} style={{ ...tarjeta, padding: '0.75rem 0.9rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: s.color || 'var(--color-text)' }}>{s.valor}</div>
          </div>
        ))}
      </div>

      <div style={tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          <div style={{ fontWeight: 700 }}>Facturas</div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {anios.length > 1 && (
              <select value={anio} onChange={e => setAnio(e.target.value)} aria-label="Año" style={{ ...inp, width: 'auto', minHeight: '40px' }}>
                <option value="todos">Todos los años</option>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <button onClick={descargarCsv} disabled={!r.numero} style={boton('var(--color-surface-2)')}>⬇️ CSV</button>
          </div>
        </div>

        {facturas === null ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Cargando sus facturas…</p>
        ) : r.numero === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Todavía no tiene facturas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {r.facturas.map(f => (
              <button key={f.id} onClick={() => setVerFactura(f)} style={{ ...fila, width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', color: 'var(--color-text)' }}>
                <div style={{ fontWeight: 800, minWidth: '4.5rem' }}>{numeroDeFactura(f)}</div>
                <div style={{ flex: '1 1 8rem', ...sub, fontSize: '0.8rem' }}>{fecha(f.expedidaEn)}</div>
                {estado[f.fiscalEstado] && <div style={{ fontSize: '0.74rem', fontWeight: 700, color: estado[f.fiscalEstado].color, whiteSpace: 'nowrap' }}>{estado[f.fiscalEstado].txt}</div>}
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: '5rem', textAlign: 'right' }}>{euros(f.total)}</div>
                <span style={{ color: 'var(--color-muted)' }}>›</span>
              </button>
            ))}
            <p style={{ fontSize: '0.72rem', color: 'var(--color-faint)', marginTop: '0.3rem' }}>
              Toca una para verla, imprimirla, descargar su PDF o enviarla. El facturado no cuenta las rechazadas por Hacienda.
            </p>
          </div>
        )}
      </div>

      <div style={tarjeta}>
        <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>Datos</div>
        <CamposCliente datos={datos} cambia={cambia} nifFijo />
        <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.4rem' }}>
          Cambiarlos aquí vale para las próximas facturas; las ya emitidas conservan los datos con los que se hicieron.
        </p>
        {error && <div role="alert" style={alerta}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
          <button onClick={quitar} style={{ ...boton('none'), color: '#f43f5e', border: '1px solid var(--color-border)' }}>🗑 Borrar cliente</button>
          <button onClick={guardar} disabled={!cambiado} style={boton(cambiado ? 'var(--color-accent)' : 'var(--color-surface-3)', cambiado ? '#fff' : 'var(--color-muted)')}>Guardar cambios</button>
        </div>
      </div>

      {verFactura && <FacturaDocumento factura={verFactura} onCerrar={() => setVerFactura(null)} />}
    </div>
  )
}

const tarjeta = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }
const fila = { display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap', background: 'var(--color-inset)', borderRadius: '0.6rem', padding: '0.65rem 0.8rem', minHeight: '48px' }
const sub = { fontSize: '0.75rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }
const campo = { display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const etiqueta = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }
const inp = { background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', color: 'var(--color-text)', fontSize: '0.9rem', width: '100%' }
const alerta = { background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', fontSize: '0.82rem', marginTop: '0.6rem' }
const boton = (bg, color = 'var(--color-text)') => ({ background: bg, color, border: 'none', borderRadius: '0.5rem', padding: '0.55rem 0.9rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', minHeight: '40px' })
