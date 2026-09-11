import { useState } from 'react'
import { confirmar, toast } from '../store/useUI'
import { buscarClientes } from '../lib/clientesFactura'

/**
 * Los clientes de factura guardados, para buscarlos y BORRARLOS.
 *
 * Un DNI y un domicilio son datos de una persona (RGPD): se guardan solo para
 * facturarle, y el que lo pida tiene que poder desaparecer de aquí sin llamar
 * al informático. Borrarlo no toca sus facturas, que son documentos fiscales y
 * se conservan con sus datos dentro.
 */
export default function ClientesFactura({ clientes = [], borrar }) {
  const [busca, setBusca] = useState('')
  const lista = busca.trim() ? buscarClientes(clientes, busca, 50) : buscarClientes(clientes, '', 50)

  const quitar = async (c) => {
    const ok = await confirmar({
      titulo: `Borrar a ${c.nombre}`,
      mensaje: 'Se borran sus datos guardados y no saldrá al hacer facturas. Sus facturas ya emitidas NO se tocan: son documentos fiscales y se conservan.',
      confirmar: 'Borrar', peligro: true,
    })
    if (!ok) return
    borrar(c.id)
    toast(`${c.nombre} borrado`, 'success')
  }

  if (clientes.length === 0) {
    return (
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
        Aún no hay clientes guardados. Se guardan al hacer una factura, marcando «Guardar este cliente para la próxima vez».
      </p>
    )
  }

  return (
    <div>
      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nombre o NIF…"
        style={{ background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.55rem 0.75rem', color: 'var(--color-text)', width: '100%', fontSize: '0.88rem', marginBottom: '0.6rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {lista.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Ninguno coincide con «{busca}».</p>}
        {lista.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', background: 'var(--color-inset)', borderRadius: '0.5rem', padding: '0.55rem 0.75rem' }}>
            <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.nombre}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>
                {c.nif} · {c.direccion}{c.email ? ` · ${c.email}` : ''}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-faint)' }}>
                {c.facturas || 0} {c.facturas === 1 ? 'factura' : 'facturas'}
                {c.usadoEn ? ` · última el ${new Date(c.usadoEn).toLocaleDateString('es-ES')}` : ''}
              </div>
            </div>
            <button onClick={() => quitar(c)} title="Borrar sus datos guardados"
              style={{ background: 'none', color: '#f43f5e', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.4rem 0.65rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>🗑 Borrar</button>
          </div>
        ))}
      </div>
    </div>
  )
}
