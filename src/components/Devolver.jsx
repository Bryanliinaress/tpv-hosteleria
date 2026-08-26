import { useState } from 'react'
import { useStore } from '../store/useStore'
import { toast } from '../store/useUI'
import { useEmpleadoActual } from '../lib/sesion'
import { METODO_LABEL } from '../store/useStore'
import { cent, metodosDeDevolucion } from '../lib/dinero'

// ────────────────────────────────────────────────────────────────────────────
// Devolver dinero de un ticket ya emitido.
//
// Un ticket registrado en la AEAT no se borra ni se edita: se corrige con una
// FACTURA RECTIFICATIVA. Esta pantalla es la que la pide, y está escrita para
// la situación real en la que se usa: alguien reclamando en la barra mientras
// hay cola. Por eso:
//
//   · lo normal —devolver el ticket entero— es un solo toque;
//   · el importe parcial se escribe solo si hace falta;
//   · el motivo es obligatorio, porque va al registro fiscal y porque es lo
//     que el encargado va a querer leer dentro de un mes;
//   · el método importa: si se devuelve en efectivo, ese dinero sale del cajón
//     y el arqueo de la noche tiene que contar con ello.
// ────────────────────────────────────────────────────────────────────────────



export default function Devolver({ ticket, pendiente, onCerrar, onHecho }) {
  const emitirRectificativa = useStore(s => s.emitirRectificativa)
  const yo = useEmpleadoActual()
  const [modo, setModo] = useState('todo')   // 'todo' | 'parte'
  const [importe, setImporte] = useState('')
  const [motivo, setMotivo] = useState('')
  const metodos = metodosDeDevolucion(ticket.pagos)
  const [metodo, setMetodo] = useState(metodos[0] || 'efectivo')
  const [enviando, setEnviando] = useState(false)

  const parcial = modo === 'parte' ? Number(String(importe).replace(',', '.')) : null
  const aDevolver = modo === 'todo' ? pendiente : (Number.isFinite(parcial) ? cent(parcial) : 0)
  const importeValido = aDevolver > 0 && aDevolver <= pendiente + 0.001
  const puede = importeValido && motivo.trim().length > 0 && !enviando

  const confirmar = async () => {
    setEnviando(true)
    // `await` obligatorio: la acción habla con el servidor y con la AEAT. Sin
    // esperarla se leería `r.ok` sobre una promesa y saldría un error falso
    // habiendo devuelto el dinero.
    const r = await emitirRectificativa({
      ticketId: ticket.id,
      motivo: motivo.trim(),
      importe: modo === 'todo' ? null : aDevolver,
      metodo,
      por: yo?.nombre || null,
    })
    setEnviando(false)
    if (!r?.ok) return toast(r?.error || 'No se pudo emitir la devolución', 'error')
    if (r.avisoReembolso) {
      // La rectificativa está emitida (es el documento legal), pero el dinero
      // NO ha vuelto. Decirlo claro: el encargado tiene a alguien delante
      // esperando su dinero y no puede despedirle creyendo que ya está.
      toast(`Rectificativa nº ${r.numero} emitida, pero el dinero NO ha vuelto a la tarjeta: ${r.avisoReembolso}. Reinténtalo desde Tickets.`, 'error', 10000)
    } else if (r.reembolso === 'hecho') {
      toast(`Devueltos ${aDevolver.toFixed(2)} € a la tarjeta · rectificativa nº ${r.numero}`, 'success')
    } else {
      toast(`Devueltos ${aDevolver.toFixed(2)} € · rectificativa nº ${r.numero}`, 'success')
    }
    onHecho?.()
    onCerrar()
  }

  const boton = (activo) => ({
    flex: 1, minHeight: '44px', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem',
    fontWeight: 600, padding: '0.5rem 0.75rem',
    background: activo ? 'var(--color-accent)' : 'var(--color-surface-3)',
    color: activo ? '#fff' : 'var(--color-text)',
    border: `1px solid ${activo ? 'var(--color-accent)' : 'var(--color-border)'}`,
  })

  return (
    <div onClick={onCerrar} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', padding: '1.25rem', width: '100%', maxWidth: '25rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>Devolver del ticket nº {ticket.numero}</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
            Mesa {ticket.mesaNumero} · cobrado {ticket.total.toFixed(2)} € ·
            {' '}<strong>quedan {pendiente.toFixed(2)} €</strong> por devolver
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setModo('todo')} style={boton(modo === 'todo')}>
            Todo · {pendiente.toFixed(2)} €
          </button>
          <button onClick={() => setModo('parte')} style={boton(modo === 'parte')}>
            Una parte
          </button>
        </div>

        {modo === 'parte' && (
          <input value={importe} onChange={e => setImporte(e.target.value)} autoFocus
            type="number" inputMode="decimal" step="0.10" min="0" max={pendiente}
            placeholder={`€ a devolver (máx. ${pendiente.toFixed(2)})`}
            style={{ background: 'var(--color-inset)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', minHeight: '44px', fontSize: '1rem' }} />
        )}

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>¿Cómo se devuelve?</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            {metodos.map(m => (
              <button key={m} onClick={() => setMetodo(m)} style={boton(metodo === m)}>
                {METODO_LABEL[m] || m}
              </button>
            ))}
          </div>
          {metodo === 'efectivo' && (
            <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.3rem' }}>
              Sale del cajón: el arqueo de esta noche ya lo cuenta.
            </p>
          )}
          {metodo === 'online' && (
            <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.3rem' }}>
              Vuelve a la <strong>misma tarjeta</strong> con la que se pagó. Puede tardar
              unos días en aparecerle al cliente en su banco.
            </p>
          )}
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Motivo (queda en el registro fiscal)</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={200}
            placeholder="Cobrado de más, plato devuelto…"
            style={{ width: '100%', background: 'var(--color-inset)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', minHeight: '44px', fontSize: '0.9rem', marginTop: '0.25rem' }} />
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>
          Se emite una <strong>factura rectificativa</strong> por {aDevolver > 0 ? `${aDevolver.toFixed(2)} €` : '—'}
          {metodo === 'online' ? ' y el dinero vuelve a la tarjeta' : ''}.
          El ticket original no se toca: es un documento ya emitido y se queda como está.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onCerrar} style={{ ...boton(false), flex: '0 1 8rem' }}>Cancelar</button>
          <button onClick={confirmar} disabled={!puede} style={{
            ...boton(true), opacity: puede ? 1 : 0.5, cursor: puede ? 'pointer' : 'not-allowed',
            background: '#f43f5e', borderColor: '#f43f5e',
          }}>
            {enviando ? 'Emitiendo…' : 'Devolver'}
          </button>
        </div>
      </div>
    </div>
  )
}
