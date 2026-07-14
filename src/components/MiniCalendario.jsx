import { useState } from 'react'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

// Mini calendario mensual. Deshabilita días pasados (< minISO) y los que
// `esCerrado(iso)` marque. Llama a onChange(iso) al elegir un día.
export default function MiniCalendario({ value, onChange, esCerrado, minISO }) {
  const inicial = value ? new Date(value + 'T12:00:00') : new Date()
  const [vista, setVista] = useState({ y: inicial.getFullYear(), m: inicial.getMonth() })

  const primero = new Date(vista.y, vista.m, 1)
  const offset = (primero.getDay() + 6) % 7 // lunes = 0
  const diasMes = new Date(vista.y, vista.m + 1, 0).getDate()
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)]

  const minMes = minISO ? new Date(minISO + 'T12:00:00') : null
  const noRetroceder = minMes && vista.y === minMes.getFullYear() && vista.m === minMes.getMonth()
  const mover = (delta) => setVista(v => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  return (
    <div style={{ background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <button onClick={() => mover(-1)} disabled={noRetroceder} style={navBtn(noRetroceder)}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{MESES[vista.m]} {vista.y}</span>
        <button onClick={() => mover(1)} style={navBtn(false)}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', marginBottom: '0.25rem' }}>
        {DOW.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--color-muted)', fontWeight: 700 }}>{d}</div>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem' }}>
        {celdas.map((d, i) => {
          if (!d) return <div key={i} />
          const f = iso(vista.y, vista.m, d)
          const pasado = minISO && f < minISO
          const cerrado = esCerrado && esCerrado(f)
          const deshab = pasado || cerrado
          const sel = value === f
          return (
            <button key={i} onClick={() => !deshab && onChange(f)} disabled={deshab} title={cerrado ? 'Cerrado' : ''}
              style={{
                aspectRatio: '1 / 1', borderRadius: '0.5rem', border: 'none', cursor: deshab ? 'not-allowed' : 'pointer',
                background: sel ? 'var(--color-accent)' : deshab ? 'transparent' : 'var(--color-surface-2)',
                color: sel ? '#fff' : deshab ? 'var(--color-faint)' : 'var(--color-text)',
                fontWeight: sel ? 800 : 600, fontSize: '0.85rem',
                textDecoration: cerrado ? 'line-through' : 'none',
                boxShadow: sel ? '0 6px 16px -6px rgba(249,115,22,0.85)' : 'none',
                transition: 'transform 0.12s ease, background 0.15s ease',
              }}>{d}</button>
          )
        })}
      </div>
    </div>
  )
}

const navBtn = (off) => ({ background: off ? 'transparent' : 'var(--color-surface-2)', color: off ? 'var(--color-faint)' : 'var(--color-text)', border: 'none', borderRadius: '0.5rem', width: '2rem', height: '2rem', cursor: off ? 'not-allowed' : 'pointer', fontSize: '1.2rem', fontWeight: 700, lineHeight: 1 })
