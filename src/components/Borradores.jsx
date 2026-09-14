import { useState } from 'react'
import { useStore } from '../store/useStore'
import { confirmar, toast } from '../store/useUI'
import { borradoresPendientes } from '../lib/borradores'

const euros = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`
const cuando = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—')

/**
 * Admin › Caja › Borradores: lo que se empezó y no se terminó.
 *
 * · Cuentas cerradas sin cobrar: se VEN, no se borran. La ley antifraude
 *   prohíbe que un TPV permita ocultar ventas, y el encargado tiene que poder
 *   saber qué pasó con cada mesa que no se cobró.
 * · Facturas sin terminar: se retoman desde aquí, o se descartan (aún no son
 *   ningún documento).
 */
export default function Borradores({ historial = [], facturas = [], onContinuarFactura }) {
  const cuentas = useStore(s => s.cuentasAnuladas) || []
  const borradores = useStore(s => s.borradoresFactura) || []
  const descartar = useStore(s => s.descartarBorradorFactura)
  const [abierta, setAbierta] = useState(null)

  const lista = [...cuentas].sort((a, b) => String(b.cerradaEn).localeCompare(String(a.cerradaEn)))
  const pendientes = borradoresPendientes(borradores, facturas)
    .sort((a, b) => String(b.actualizadoEn).localeCompare(String(a.actualizadoEn)))

  const quitarBorrador = async (b, numero) => {
    const ok = await confirmar({
      titulo: `Descartar el borrador de factura${numero ? ` del ticket nº ${numero}` : ''}`,
      mensaje: 'Se borran los datos que se habían tecleado. El ticket no se toca y se le puede hacer factura igualmente.',
      confirmar: 'Descartar', peligro: true,
    })
    if (!ok) return
    descartar(b.ticketId)
    toast('Borrador descartado', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <section>
        <div style={titulo}>Cuentas cerradas sin cobrar</div>
        <p style={nota}>No se pueden borrar: quedan con lo que se pidió, el motivo y quién cerró la mesa.</p>
        {lista.length === 0 ? (
          <p style={vacio}>Ninguna mesa se ha cerrado sin cobrar.</p>
        ) : lista.map(c => (
          <div key={c.id} style={fila}>
            <button onClick={() => setAbierta(abierta === c.id ? null : c.id)} aria-expanded={abierta === c.id}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left', flexWrap: 'wrap' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Mesa {c.mesaNumero ?? '—'}{c.zona ? ` · ${c.zona}` : ''}</span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--color-muted)' }}>
                  {cuando(c.cerradaEn)}{c.por ? ` · 👤 ${c.por}` : ''} · «{c.motivo}»
                </span>
              </span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'block', fontWeight: 800, color: '#f43f5e' }}>{euros(c.sinCobrar)}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                  {Number(c.total) !== Number(c.sinCobrar) ? `de ${euros(c.total)} · ` : ''}sin cobrar {abierta === c.id ? '▲' : '▼'}
                </span>
              </span>
            </button>
            {abierta === c.id && (
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                {(c.personas || []).map((p, i) => (
                  <div key={p.id || i} style={{ marginBottom: '0.35rem' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-accent)' }}>{p.nombre}{p.pagado ? ' · pagado' : ''}</div>
                    {(p.items || []).map((it, j) => (
                      <div key={it.uid || it.id || j} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.78rem' }}>
                        <span>{it.cantidad}× {it.nombre}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{euros(Number(it.precio) * Number(it.cantidad))}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {c.abiertaDesde && <div style={{ fontSize: '0.7rem', color: 'var(--color-faint)' }}>Abierta desde {cuando(c.abiertaDesde)}{c.camarero ? ` · atendía ${c.camarero}` : ''}</div>}
              </div>
            )}
          </div>
        ))}
      </section>

      <section>
        <div style={titulo}>Facturas sin terminar</div>
        <p style={nota}>Se empezaron y se cancelaron antes de emitir. Se retoman con lo que ya se había tecleado.</p>
        {pendientes.length === 0 ? (
          <p style={vacio}>No hay facturas a medias.</p>
        ) : pendientes.map(b => {
          const ticket = historial.find(t => t.id === b.ticketId)
          return (
            <div key={b.ticketId} style={{ ...fila, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{b.datos?.nombre || 'Sin nombre todavía'}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>
                  {ticket ? `Ticket nº ${ticket.numero} · ${euros(ticket.total)}` : 'Ticket de un periodo no cargado'}
                  {b.datos?.nif ? ` · ${b.datos.nif}` : ''} · {cuando(b.actualizadoEn)}
                </div>
              </div>
              <button onClick={() => ticket && onContinuarFactura?.(ticket)} disabled={!ticket}
                title={ticket ? 'Seguir con la factura' : 'Ese ticket no está en los tickets cargados'} style={boton(ticket ? 'var(--color-accent)' : 'var(--color-surface-3)', ticket ? '#fff' : 'var(--color-muted)')}>Continuar</button>
              <button onClick={() => quitarBorrador(b, ticket?.numero)} style={{ ...boton('none'), color: '#f43f5e', border: '1px solid var(--color-border)' }}>Descartar</button>
            </div>
          )
        })}
      </section>
    </div>
  )
}

const titulo = { fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.15rem' }
const nota = { fontSize: '0.74rem', color: 'var(--color-muted)', marginBottom: '0.55rem' }
const vacio = { fontSize: '0.82rem', color: 'var(--color-muted)' }
const fila = { background: 'var(--color-inset)', borderRadius: '0.55rem', padding: '0.6rem 0.75rem', marginBottom: '0.4rem' }
const boton = (bg, color = 'var(--color-text)') => ({ background: bg, color, border: 'none', borderRadius: '0.5rem', padding: '0.45rem 0.8rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', minHeight: '38px' })
