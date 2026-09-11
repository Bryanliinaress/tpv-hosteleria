import { useState } from 'react'
import { createPortal } from 'react-dom'
import FacturaPapel from './FacturaPapel'
import { numeroDeFactura, correoDeFactura, enlaceFactura } from '../lib/factura'
import { enviarCorreoFactura, emailConfigurado } from '../lib/email'
import { copiar } from '../lib/portapapeles'
import { toast } from '../store/useUI'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Una factura emitida, con lo que se hace con ella: imprimirla o mandarla.
 *
 * Para imprimir se pinta una COPIA aparte, colgada directamente del `body`: la
 * vista previa vive dentro de un modal con scroll, y un elemento `fixed`
 * impreso se corta en la primera hoja o se repite en todas.
 */
export default function FacturaDocumento({ factura, onCerrar }) {
  const [correo, setCorreo] = useState(factura.cliente?.email || '')
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    const para = correo.trim()
    if (!EMAIL.test(para)) { toast('Ese correo no parece válido', 'error'); return }
    setEnviando(true)
    try {
      const { asunto, mensaje } = correoDeFactura(factura, { enlace: enlaceFactura(factura) })
      const r = await enviarCorreoFactura({ para, nombre: factura.cliente?.nombre, asunto, mensaje })
      toast(r.via === 'mailto' ? 'Se ha abierto tu programa de correo con la factura' : `Factura enviada a ${para}`, 'success')
    } catch (e) {
      toast(`No se pudo enviar: ${e.message}`, 'error')
    } finally { setEnviando(false) }
  }

  const fiscal = {
    enviado: { txt: '✓ Registrada en Hacienda', color: 'var(--tint-success-fg)' },
    pendiente: { txt: '⏳ Pendiente de registrar en Hacienda', color: 'var(--tint-warning-fg)' },
    error: { txt: `⚠ No se pudo registrar${factura.fiscalError ? `: ${factura.fiscalError}` : ''}`, color: '#f43f5e' },
  }[factura.fiscalEstado]

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem 1rem', overflowY: 'auto' }}>
        <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.8rem 1rem' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>🧾 Factura {numeroDeFactura(factura)}</div>
              {fiscal && <div style={{ fontSize: '0.78rem', color: fiscal.color }}>{fiscal.txt}</div>}
            </div>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button onClick={() => window.print()} style={boton('var(--color-accent)', '#fff')}>🖨️ Imprimir</button>
              <button onClick={async () => toast(await copiar(enlaceFactura(factura)) ? 'Enlace copiado' : 'No se pudo copiar', 'info')} style={boton('var(--color-surface-2)')}>🔗 Copiar enlace</button>
              <button onClick={onCerrar} aria-label="Cerrar" style={boton('var(--color-surface-3)')}>✕</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.7rem 1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>✉️ Enviar por correo</span>
            <input value={correo} onChange={e => setCorreo(e.target.value)} type="email" inputMode="email" placeholder="correo@empresa.es"
              onKeyDown={e => { if (e.key === 'Enter') enviar() }}
              style={{ flex: '1 1 14rem', minWidth: 0, background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', color: 'var(--color-text)', fontSize: '0.9rem' }} />
            <button onClick={enviar} disabled={enviando} style={boton('#10b981', '#fff')}>{enviando ? 'Enviando…' : 'Enviar'}</button>
            {!emailConfigurado && (
              <span style={{ flexBasis: '100%', fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                El correo automático no está configurado: se abrirá tu programa de correo con la factura ya escrita.
              </span>
            )}
          </div>

          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <FacturaPapel factura={factura} />
          </div>
        </div>
      </div>

      {createPortal(<div className="factura-print solo-impresion"><FacturaPapel factura={factura} /></div>, document.body)}
    </>
  )
}

const boton = (bg, color = 'var(--color-text)') => ({ background: bg, color, border: 'none', borderRadius: '0.5rem', padding: '0.55rem 0.9rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', minHeight: '40px' })
