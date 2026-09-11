import { useState } from 'react'
import { useStore } from '../store/useStore'
import { revisarDatosFactura, faltaParaFacturar, validarNif } from '../lib/factura'
import FacturaDocumento from './FacturaDocumento'

const euros = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`

/**
 * «¿Me haces factura?»: los datos del cliente para convertir un ticket en una
 * factura completa.
 *
 * Al emitirla se pasa directamente a la factura, con Imprimir y Enviar por
 * correo a la vista: es lo siguiente que va a pedir el cliente, que está
 * delante esperando.
 */
export default function Facturar({ ticket, por, onCerrar }) {
  const local = useStore(s => s.local)
  const emitirFactura = useStore(s => s.emitirFactura)
  const [datos, setDatos] = useState({ nombre: '', nif: '', direccion: '', email: '' })
  const [error, setError] = useState(null)
  const [emitiendo, setEmitiendo] = useState(false)
  const [hecha, setHecha] = useState(null)
  // El NIF se comprueba al salir del campo, no a cada tecla: con «B1234» a
  // medio escribir, un rojo antes de terminar solo molesta.
  const [avisoNif, setAvisoNif] = useState(null)

  if (hecha) return <FacturaDocumento factura={hecha} onCerrar={onCerrar} />

  const falta = faltaParaFacturar(local)
  const cambia = (k) => (e) => { setDatos(d => ({ ...d, [k]: e.target.value })); setError(null) }

  const emitir = async () => {
    const r = revisarDatosFactura(datos)
    if (!r.ok) { setError(r.error); return }
    setEmitiendo(true)
    const res = await emitirFactura({ ticketId: ticket.id, ...r.valor, por })
    setEmitiendo(false)
    if (!res?.ok) { setError(res?.error || 'No se pudo emitir la factura'); return }
    setHecha(res.factura)
  }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.25rem', width: '100%', maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.2rem' }}>🧾 Factura del ticket nº {ticket.numero}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
          {ticket.mesaNumero != null ? `Mesa ${ticket.mesaNumero} · ` : ''}{euros(ticket.total)}. Sustituye al ticket: no es una venta nueva y no suma otra vez en caja.
        </p>

        {falta.length > 0 ? (
          <div role="alert" style={{ background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)', borderRadius: '0.6rem', padding: '0.8rem', fontSize: '0.85rem' }}>
            Para emitir facturas falta <b>{falta.join(' y ')}</b> del local. Se rellena en <b>Admin › Local</b>: sale en cada factura y sin eso no es válida.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <label style={campo}>
              <span style={etiqueta}>Nombre o razón social</span>
              <input value={datos.nombre} onChange={cambia('nombre')} autoFocus maxLength={120} placeholder="Talleres Pérez S.L." style={inp} />
            </label>
            <label style={campo}>
              <span style={etiqueta}>NIF / CIF / NIE</span>
              <input value={datos.nif} onChange={e => { cambia('nif')(e); setAvisoNif(null) }}
                onBlur={() => { const v = datos.nif.trim() ? validarNif(datos.nif) : { ok: true }; setAvisoNif(v.ok ? null : v.error) }}
                autoCapitalize="characters" autoComplete="off" placeholder="B12345674" style={{ ...inp, textTransform: 'uppercase', borderColor: avisoNif ? '#f43f5e' : 'var(--color-border)' }} />
              {avisoNif && <span style={{ fontSize: '0.74rem', color: '#f43f5e' }}>{avisoNif}</span>}
            </label>
            <label style={campo}>
              <span style={etiqueta}>Domicilio</span>
              <input value={datos.direccion} onChange={cambia('direccion')} maxLength={200} placeholder="C/ Mayor 3, 28001 Madrid" style={inp} />
            </label>
            <label style={campo}>
              <span style={etiqueta}>Correo <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional, para mandársela)</span></span>
              <input value={datos.email} onChange={cambia('email')} type="email" inputMode="email" placeholder="administracion@talleres.es" style={inp} />
            </label>

            {error && (
              <div role="alert" style={{ background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', fontSize: '0.82rem' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
              <button onClick={onCerrar} style={{ ...boton, background: 'var(--color-surface-3)', color: 'var(--color-text)', flex: 1 }}>Cancelar</button>
              <button onClick={emitir} disabled={emitiendo} style={{ ...boton, background: 'var(--color-accent)', color: '#fff', flex: 2 }}>{emitiendo ? 'Emitiendo…' : 'Emitir factura'}</button>
            </div>
          </div>
        )}
        {falta.length > 0 && (
          <button onClick={onCerrar} style={{ ...boton, background: 'var(--color-surface-3)', color: 'var(--color-text)', width: '100%', marginTop: '0.8rem' }}>Cerrar</button>
        )}
      </div>
    </div>
  )
}

const campo = { display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const etiqueta = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }
const inp = { background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', color: 'var(--color-text)', fontSize: '0.92rem', width: '100%' }
const boton = { border: 'none', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }
