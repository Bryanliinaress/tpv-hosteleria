import { useState } from 'react'
import { useStore, aforoTotal } from '../store/useStore'

const DIAS = [{ d: 1, t: 'L' }, { d: 2, t: 'M' }, { d: 3, t: 'X' }, { d: 4, t: 'J' }, { d: 5, t: 'V' }, { d: 6, t: 'S' }, { d: 0, t: 'D' }]

// Configuración de disponibilidad de reservas: turnos, intervalo, duración,
// aforo, grupo máximo online y días cerrados. Editable desde el Panel Admin.
export default function ReservasConfig() {
  const { reservasConfig: cfg, mesas, updateReservasConfig } = useStore()
  const [abierto, setAbierto] = useState(false)
  const aforoAuto = mesas.reduce((s, m) => s + (Number(m.capacidad) || 0), 0)

  const setTurno = (idx, campo, val) => {
    const turnos = cfg.turnos.map((t, i) => i === idx ? { ...t, [campo]: val } : t)
    updateReservasConfig({ turnos })
  }
  const addTurno = () => updateReservasConfig({ turnos: [...cfg.turnos, { id: `t${Date.now()}`, nombre: 'Turno', inicio: '13:00', fin: '16:00' }] })
  const removeTurno = (idx) => updateReservasConfig({ turnos: cfg.turnos.filter((_, i) => i !== idx) })
  const toggleDia = (d) => {
    const dc = cfg.diasCerrados.includes(d) ? cfg.diasCerrados.filter(x => x !== d) : [...cfg.diasCerrados, d]
    updateReservasConfig({ diasCerrados: dc })
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <button onClick={() => setAbierto(a => !a)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer', padding: '1rem 1.1rem', fontSize: '0.95rem', fontWeight: 700 }}>
        <span>⚙️ Horarios y aforo</span>
        <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: '0.8rem' }}>{cfg.turnos.length} turno(s) · aforo {aforoTotal(cfg, mesas)} · {abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{ padding: '0 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Turnos */}
          <div>
            <p style={lbl}>Turnos</p>
            {cfg.turnos.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <input value={t.nombre} onChange={e => setTurno(i, 'nombre', e.target.value)} placeholder="Nombre" style={{ ...inp, flex: '1 1 110px' }} />
                <input type="time" value={t.inicio} onChange={e => setTurno(i, 'inicio', e.target.value)} style={{ ...inp, width: '110px' }} />
                <span style={{ color: 'var(--color-muted)' }}>→</span>
                <input type="time" value={t.fin} onChange={e => setTurno(i, 'fin', e.target.value)} style={{ ...inp, width: '110px' }} />
                <button onClick={() => removeTurno(i)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button>
              </div>
            ))}
            <button onClick={addTurno} style={addBtn}>+ Añadir turno</button>
          </div>

          {/* Parámetros */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            <Campo label="Intervalo (min)">
              <select value={cfg.intervaloMin} onChange={e => updateReservasConfig({ intervaloMin: Number(e.target.value) })} style={inp}>
                {[15, 20, 30, 60].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            </Campo>
            <Campo label="Duración reserva (min)">
              <input type="number" min="30" step="15" value={cfg.duracionMin} onChange={e => updateReservasConfig({ duracionMin: Number(e.target.value) || 90 })} style={inp} />
            </Campo>
            <Campo label={`Aforo (auto: ${aforoAuto})`}>
              <input type="number" min="1" value={cfg.aforo ?? ''} placeholder={`auto ${aforoAuto}`} onChange={e => updateReservasConfig({ aforo: e.target.value === '' ? null : Number(e.target.value) })} style={inp} />
            </Campo>
            <Campo label="Grupo máx. online">
              <input type="number" min="1" value={cfg.maxPersonasOnline} onChange={e => updateReservasConfig({ maxPersonasOnline: Number(e.target.value) || 10 })} style={inp} />
            </Campo>
          </div>

          {/* Días cerrados */}
          <div>
            <p style={lbl}>Días cerrados</p>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {DIAS.map(({ d, t }) => {
                const cerrado = cfg.diasCerrados.includes(d)
                return (
                  <button key={d} onClick={() => toggleDia(d)} title={cerrado ? 'Cerrado' : 'Abierto'} style={{ flex: 1, background: cerrado ? '#7f1d1d' : '#1e293b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>{t}</button>
                )
              })}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.35rem' }}>Los días en rojo no admiten reservas online.</p>
          </div>
        </div>
      )}
    </div>
  )
}

const Campo = ({ label, children }) => (
  <div>
    <p style={lbl}>{label}</p>
    {children}
  </div>
)

const lbl = { fontSize: '0.72rem', color: 'var(--color-muted)', margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inp = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.65rem', color: 'var(--color-text)', fontSize: '0.85rem', width: '100%' }
const addBtn = { background: '#f97316', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.25rem' }
