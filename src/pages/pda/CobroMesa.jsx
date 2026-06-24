import { useState } from 'react'
import { owedPorPersona, METODOS_PAGO } from '../../store/useStore'

// Cobro de la mesa desde la PDA: método de pago, descuento/invitación, dividir
// a partes iguales y cálculo de cambio en efectivo. Al cobrar, cierra la mesa.
export default function CobroMesa({ mesa, onCobrar, onCerrar }) {
  const owed = owedPorPersona(mesa)
  const totalBruto = mesa.personas.filter(p => !p.pagado).reduce((s, p) => s + owed[p.id], 0)
  const [dtoPct, setDtoPct] = useState(0)
  const [n, setN] = useState(mesa.personas.length || 1)
  const [efectivo, setEfectivo] = useState('')
  const [metodo, setMetodo] = useState('efectivo')

  const descuento = totalBruto * dtoPct / 100
  const aCobrar = Math.max(0, totalBruto - descuento)
  const porPersona = aCobrar / Math.max(1, n)
  const dado = parseFloat(efectivo.replace(',', '.')) || 0
  const cambio = dado - aCobrar

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 80 }}>
      <div onClick={e => e.stopPropagation()} style={hoja}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Cobrar Mesa {mesa.numero}</h3>
          <button onClick={onCerrar} style={btn('#334155', { padding: '0.25rem 0.6rem' })}>✕</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          <span>Pendiente</span><span>{totalBruto.toFixed(2)} €</span>
        </div>

        {/* Descuento / invitación */}
        <p style={lbl}>Descuento</p>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {[{ v: 0, t: 'Sin dto.' }, { v: 5, t: '5%' }, { v: 10, t: '10%' }, { v: 100, t: '🎁 Invitación' }].map(o => (
            <button key={o.v} onClick={() => setDtoPct(o.v)} style={btn(dtoPct === o.v ? '#f97316' : '#334155', { fontSize: '0.78rem', padding: '0.35rem 0.7rem' })}>{o.t}</button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.25rem', margin: '0.4rem 0 0.8rem' }}>
          <span>A cobrar</span><span style={{ color: '#f97316' }}>{aCobrar.toFixed(2)} €</span>
        </div>

        {/* Método de pago */}
        <p style={lbl}>Método de pago</p>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.7rem' }}>
          {METODOS_PAGO.map(m => (
            <button key={m.id} onClick={() => setMetodo(m.id)} style={btn(metodo === m.id ? '#10b981' : '#334155', { flex: 1, fontSize: '0.82rem', padding: '0.55rem 0.4rem' })}>{m.emoji} {m.label}</button>
          ))}
        </div>

        {/* Dividir a partes iguales */}
        <p style={lbl}>Dividir a partes iguales</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' }}>
          <button onClick={() => setN(v => Math.max(1, v - 1))} style={btn('#334155', { padding: '0.3rem 0.8rem' })}>−</button>
          <span style={{ fontWeight: 700, minWidth: '1.5rem', textAlign: 'center' }}>{n}</span>
          <button onClick={() => setN(v => v + 1)} style={btn('#334155', { padding: '0.3rem 0.8rem' })}>+</button>
          <span style={{ marginLeft: 'auto', fontSize: '0.9rem' }}><strong style={{ color: '#f97316' }}>{porPersona.toFixed(2)} €</strong> / persona</span>
        </div>

        {/* Efectivo y cambio (solo si se cobra en efectivo) */}
        {metodo === 'efectivo' && (
          <>
            <p style={lbl}>Pago en efectivo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <input value={efectivo} onChange={e => setEfectivo(e.target.value)} inputMode="decimal" placeholder="Pagan con… €" style={{ flex: 1, background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem 0.8rem', color: 'var(--color-text)', fontSize: '0.95rem' }} />
              {[10, 20, 50].map(b => <button key={b} onClick={() => setEfectivo(String(b))} style={btn('#1e293b', { fontSize: '0.78rem', padding: '0.4rem 0.5rem' })}>{b}</button>)}
            </div>
            {dado > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '0.8rem', color: cambio >= 0 ? '#10b981' : '#f43f5e' }}>
                <span>Cambio</span><span>{cambio >= 0 ? cambio.toFixed(2) + ' €' : 'Falta ' + (-cambio).toFixed(2) + ' €'}</span>
              </div>
            )}
          </>
        )}

        <button onClick={() => onCobrar(metodo)} style={btn('#10b981', { width: '100%', padding: '0.85rem', fontSize: '1rem' })}>✓ Cobrado · cerrar mesa</button>
      </div>
    </div>
  )
}

const hoja = { background: 'var(--color-surface)', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem', padding: '1.15rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }
const lbl = { fontSize: '0.72rem', color: 'var(--color-muted)', margin: '0.5rem 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }
const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
