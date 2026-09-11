import { useState } from 'react'
import { useStore } from '../store/useStore'
import { revisarDatosFactura, faltaParaFacturar, validarNif, normalizarNif, numeroDeFactura } from '../lib/factura'
import { buscarClientes, clientePorNif } from '../lib/clientesFactura'
import FacturaDocumento from './FacturaDocumento'

const euros = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`

/**
 * «¿Me haces factura?»: los datos del cliente para convertir un ticket en una
 * factura completa.
 *
 * El que pide factura suele volver, así que arriba están los clientes
 * guardados: se busca por nombre o por un trozo de NIF y se rellena todo de
 * un toque. Y si alguien teclea un NIF que ya está guardado, se le ofrece usar
 * esos datos en vez de escribirlos otra vez (con otra errata).
 *
 * Con `factura` es el MISMO formulario para corregir una que Hacienda ha
 * rechazado —casi siempre porque el nombre no casa con el NIF—: sale ya
 * relleno, con el motivo del rechazo a la vista, y se reenvía con el mismo
 * número. Una factura aceptada no pasa por aquí: esa ya no se toca.
 *
 * Al emitirla se pasa directamente a la factura, con Imprimir y Enviar a la
 * vista: es lo siguiente que va a pedir el cliente, que está delante.
 */
export default function Facturar({ ticket, factura = null, por, onCerrar }) {
  const corrigiendo = !!factura
  const local = useStore(s => s.local)
  const emitirFactura = useStore(s => s.emitirFactura)
  const corregirFactura = useStore(s => s.corregirFactura)
  const clientes = useStore(s => s.clientesFactura) || []
  const [datos, setDatos] = useState(() => (corrigiendo
    ? { nombre: factura.cliente?.nombre || '', nif: factura.cliente?.nif || '', direccion: factura.cliente?.direccion || '', email: factura.cliente?.email || '' }
    : { nombre: '', nif: '', direccion: '', email: '' }))
  const [error, setError] = useState(null)
  const [emitiendo, setEmitiendo] = useState(false)
  const [hecha, setHecha] = useState(null)
  // El NIF se comprueba al salir del campo, no a cada tecla: con «B1234» a
  // medio escribir, un rojo antes de terminar solo molesta.
  const [avisoNif, setAvisoNif] = useState(null)
  const [busca, setBusca] = useState('')
  const [elegido, setElegido] = useState(null)   // id del cliente guardado que se está usando
  const [guardar, setGuardar] = useState(true)

  if (hecha) return <FacturaDocumento factura={hecha} por={por} onCerrar={onCerrar} />

  const falta = corrigiendo ? [] : faltaParaFacturar(local)
  const cambia = (k) => (e) => { setDatos(d => ({ ...d, [k]: e.target.value })); setError(null) }
  const usar = (c) => {
    setDatos({ nombre: c.nombre, nif: c.nif, direccion: c.direccion, email: c.email || '' })
    setElegido(c.id); setBusca(''); setAvisoNif(null); setError(null)
  }
  const sugeridos = buscarClientes(clientes, busca, 5)
  // Un NIF tecleado a mano que ya está guardado con otros datos.
  const yaGuardado = !elegido && datos.nif.trim() ? clientePorNif(clientes, datos.nif) : null

  const enviar = async () => {
    const r = revisarDatosFactura(datos)
    if (!r.ok) { setError(r.error); return }
    setEmitiendo(true)
    const res = corrigiendo
      ? await corregirFactura({ facturaId: factura.id, ...r.valor, por, guardar })
      : await emitirFactura({ ticketId: ticket.id, ...r.valor, por, guardar })
    setEmitiendo(false)
    if (!res?.ok) { setError(res?.error || 'No se pudo emitir la factura'); return }
    // Corrigiendo, quien la abrió (la factura) ya la está enseñando y se pone
    // al día sola: basta con cerrar el formulario.
    if (corrigiendo) onCerrar()
    else setHecha(res.factura)
  }

  const importe = corrigiendo ? factura.total : ticket.total

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.25rem', width: '100%', maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.2rem' }}>
          {corrigiendo ? `✏️ Corregir la factura ${numeroDeFactura(factura)}` : `🧾 Factura del ticket nº ${ticket.numero}`}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
          {corrigiendo
            ? `${euros(importe)}. Se reenvía a Hacienda con el mismo número: como la rechazó, nunca llegó a constar.`
            : `${ticket.mesaNumero != null ? `Mesa ${ticket.mesaNumero} · ` : ''}${euros(importe)}. Sustituye al ticket: no es una venta nueva y no suma otra vez en caja.`}
        </p>

        {corrigiendo && factura.fiscalError && (
          <div role="alert" style={{ background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', borderRadius: '0.6rem', padding: '0.7rem 0.8rem', fontSize: '0.8rem', marginBottom: '0.9rem' }}>
            <b>Hacienda la rechazó:</b> {factura.fiscalError}
          </div>
        )}

        {falta.length > 0 ? (
          <div role="alert" style={{ background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)', borderRadius: '0.6rem', padding: '0.8rem', fontSize: '0.85rem' }}>
            Para emitir facturas falta <b>{falta.join(' y ')}</b> del local. Se rellena en <b>Admin › Local</b>: sale en cada factura y sin eso no es válida.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {clientes.length > 0 && (
              <div style={{ background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.6rem', padding: '0.6rem' }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} autoFocus={!corrigiendo}
                  placeholder={`🔍 Cliente guardado (${clientes.length}): nombre o NIF`}
                  style={{ ...inp, background: 'var(--color-surface)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.45rem' }}>
                  {sugeridos.length === 0
                    ? <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', padding: '0.2rem' }}>Ninguno coincide: rellena los datos abajo.</span>
                    : sugeridos.map(c => (
                      <button key={c.id} onClick={() => usar(c)} style={{
                        textAlign: 'left', cursor: 'pointer', borderRadius: '0.5rem', padding: '0.5rem 0.65rem', minHeight: '44px',
                        background: elegido === c.id ? 'var(--color-accent)' : 'var(--color-surface-2)',
                        color: elegido === c.id ? '#fff' : 'var(--color-text)', border: 'none',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.nombre}</div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>{c.nif} · {c.direccion}</div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <label style={campo}>
              <span style={etiqueta}>Nombre o razón social</span>
              <input value={datos.nombre} onChange={e => { cambia('nombre')(e); setElegido(null) }} autoFocus={corrigiendo || clientes.length === 0} maxLength={120} placeholder="Talleres Pérez S.L." style={inp} />
              {/* Hacienda comprueba que el nombre casa con el NIF: con un nombre
                  inventado o abreviado, rechaza la factura. Pasó con la F-1. */}
              <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Tal como consta en Hacienda: si no casa con el NIF, la rechaza.</span>
            </label>
            <label style={campo}>
              <span style={etiqueta}>NIF / CIF / NIE</span>
              <input value={datos.nif} onChange={e => { cambia('nif')(e); setAvisoNif(null); setElegido(null) }}
                onBlur={() => { const v = datos.nif.trim() ? validarNif(datos.nif) : { ok: true }; setAvisoNif(v.ok ? null : v.error) }}
                autoCapitalize="characters" autoComplete="off" placeholder="B12345674" style={{ ...inp, textTransform: 'uppercase', borderColor: avisoNif ? '#f43f5e' : 'var(--color-border)' }} />
              {avisoNif && <span style={{ fontSize: '0.74rem', color: '#f43f5e' }}>{avisoNif}</span>}
              {yaGuardado && normalizarNif(datos.nif).length >= 9 && !corrigiendo && (
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  Ya está guardado como «{yaGuardado.nombre}».{' '}
                  <button onClick={() => usar(yaGuardado)} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.78rem' }}>Usar sus datos</button>
                </span>
              )}
            </label>
            <label style={campo}>
              <span style={etiqueta}>Domicilio</span>
              <input value={datos.direccion} onChange={cambia('direccion')} maxLength={200} placeholder="C/ Mayor 3, 28001 Madrid" style={inp} />
            </label>
            <label style={campo}>
              <span style={etiqueta}>Correo <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional, para mandársela)</span></span>
              <input value={datos.email} onChange={cambia('email')} type="email" inputMode="email" placeholder="administracion@talleres.es" style={inp} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.85rem', cursor: 'pointer', minHeight: '40px' }}>
              <input type="checkbox" checked={guardar} onChange={e => setGuardar(e.target.checked)} style={{ width: '1.15rem', height: '1.15rem', accentColor: 'var(--color-accent)' }} />
              {elegido ? 'Actualizar sus datos guardados' : 'Guardar este cliente para la próxima vez'}
            </label>

            {error && (
              <div role="alert" style={{ background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', fontSize: '0.82rem' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.1rem' }}>
              <button onClick={onCerrar} style={{ ...boton, background: 'var(--color-surface-3)', color: 'var(--color-text)', flex: 1 }}>Cancelar</button>
              <button onClick={enviar} disabled={emitiendo} style={{ ...boton, background: 'var(--color-accent)', color: '#fff', flex: 2 }}>
                {emitiendo ? (corrigiendo ? 'Reenviando…' : 'Emitiendo…') : (corrigiendo ? 'Corregir y reenviar' : 'Emitir factura')}
              </button>
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
