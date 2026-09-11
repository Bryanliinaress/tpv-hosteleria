import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import FacturaPapel from './FacturaPapel'
import { numeroDeFactura, correoDeFactura } from '../lib/factura'
import { pdfDeFactura, trazosQr, nombreArchivoFactura } from '../lib/facturaPdf'
import { enviarCorreoFactura, correoConAdjunto, descargarPdf } from '../lib/email'
import { toast } from '../store/useUI'
import { useStore } from '../store/useStore'
import Facturar from './Facturar'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Una factura emitida, con lo que se hace con ella: imprimirla, descargarla en
 * PDF o mandarla por correo con el PDF adjunto.
 *
 * Para imprimir se pinta una COPIA aparte, colgada directamente del `body`: la
 * vista previa vive dentro de un modal con scroll, y un elemento `fixed`
 * impreso se corta en la primera hoja o se repite en todas.
 */
export default function FacturaDocumento({ factura: inicial, por, onCerrar }) {
  // La factura VIVA del store: tras corregirla o registrarla en Hacienda, lo
  // que se ve (y el PDF que se manda) se pone al día sin cerrar y volver a abrir.
  const factura = useStore(s => (s.facturas || []).find(f => f.id === inicial.id)) || inicial
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [correo, setCorreo] = useState(factura.cliente?.email || '')
  const [enviando, setEnviando] = useState(false)
  const papel = useRef(null)

  // El QR de Verifactu ya está pintado en la vista previa: se lee de ahí en
  // vez de volver a calcularlo, y así el PDF lleva EXACTAMENTE el mismo.
  const qrDelPapel = () => {
    const svg = papel.current?.querySelector('svg')
    if (!svg) return null
    const n = Number(svg.getAttribute('viewBox')?.split(/\s+/)[2])
    const rutas = svg.querySelectorAll('path')
    const trazos = trazosQr(rutas[rutas.length - 1]?.getAttribute('d'))
    return n && trazos.length ? { n, trazos } : null
  }
  const generarPdf = () => pdfDeFactura(factura, { qr: qrDelPapel() })

  const descargar = () => {
    try { descargarPdf(generarPdf(), nombreArchivoFactura(factura)) }
    catch (e) { toast(`No se pudo generar el PDF: ${e.message}`, 'error') }
  }

  const enviar = async () => {
    const para = correo.trim()
    if (!EMAIL.test(para)) { toast('Ese correo no parece válido', 'error'); return }
    setEnviando(true)
    try {
      const { asunto, mensaje } = correoDeFactura(factura)
      const r = await enviarCorreoFactura({
        para, nombre: factura.cliente?.nombre, asunto, mensaje,
        pdf: generarPdf(), nombreArchivo: nombreArchivoFactura(factura),
      })
      toast({
        emailjs: `Factura enviada a ${para} con el PDF adjunto`,
        compartir: 'Elige tu correo: el PDF va ya adjunto',
        mailto: 'PDF descargado: adjúntalo al correo que se ha abierto',
      }[r.via], 'success')
    } catch (e) {
      // Cerrar el menú de compartir no es un error: es cambiar de idea.
      if (e?.name !== 'AbortError') toast(`No se pudo enviar: ${e.message}`, 'error')
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
              <button onClick={descargar} style={boton('var(--color-surface-2)')}>⬇️ Descargar PDF</button>
              <button onClick={onCerrar} aria-label="Cerrar" style={boton('var(--color-surface-3)')}>✕</button>
            </div>
          </div>

          {/* Rechazada por Hacienda: casi siempre, un nombre que no casa con el
              NIF. Se corrige y se reenvía con el mismo número, que nunca llegó
              a constar. */}
          {factura.fiscalEstado === 'error' && (
            <div role="alert" style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--tint-danger-bg)', color: 'var(--tint-danger-fg)', border: '1px solid #f43f5e', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem' }}>
              <div style={{ flex: '1 1 18rem', fontSize: '0.84rem' }}>
                <b>Hacienda ha rechazado esta factura.</b> No vale hasta que se corrija y se reenvíe.
                {factura.fiscalError && <div style={{ fontSize: '0.76rem', marginTop: '0.25rem', opacity: 0.9 }}>{factura.fiscalError}</div>}
              </div>
              <button onClick={() => setCorrigiendo(true)} style={boton('#f43f5e', '#fff')}>✏️ Corregir datos y reenviar</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.7rem 1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>✉️ Enviar por correo</span>
            <input value={correo} onChange={e => setCorreo(e.target.value)} type="email" inputMode="email" placeholder="correo@empresa.es"
              onKeyDown={e => { if (e.key === 'Enter') enviar() }}
              style={{ flex: '1 1 14rem', minWidth: 0, background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', color: 'var(--color-text)', fontSize: '0.9rem' }} />
            <button onClick={enviar} disabled={enviando} style={boton('#10b981', '#fff')}>{enviando ? 'Enviando…' : '📎 Enviar PDF'}</button>
            {!correoConAdjunto && (
              <span style={{ flexBasis: '100%', fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                El envío automático con adjunto no está configurado: se abrirá «Compartir» con el PDF para elegir tu correo o, si este aparato no puede, se descargará para adjuntarlo.
              </span>
            )}
          </div>

          <div ref={papel} style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <FacturaPapel factura={factura} />
          </div>
        </div>
      </div>

      {createPortal(<div className="factura-print solo-impresion"><FacturaPapel factura={factura} /></div>, document.body)}
      {corrigiendo && <Facturar factura={factura} por={por} onCerrar={() => setCorrigiendo(false)} />}
    </>
  )
}

const boton = (bg, color = 'var(--color-text)') => ({ background: bg, color, border: 'none', borderRadius: '0.5rem', padding: '0.55rem 0.9rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', minHeight: '40px' })
