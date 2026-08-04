import { grupoVacio } from '../lib/menuDia'

// Editor de menú del día / combo dentro del formulario de producto:
// grupos ("Primero", "Segundo"…) con sus opciones y suplementos.
// Si no hay grupos, el producto es normal y esto ni aparece desplegado.
export default function EditorMenu({ menu, onChange }) {
  const grupos = menu?.grupos || []
  const set = (gs) => onChange(gs.length ? { grupos: gs } : null)

  const editarGrupo = (i, cambios) => set(grupos.map((g, j) => j === i ? { ...g, ...cambios } : g))
  const editarOpcion = (gi, oi, cambios) => editarGrupo(gi, {
    opciones: grupos[gi].opciones.map((o, j) => j === oi ? { ...o, ...cambios } : o),
  })

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '0.6rem', padding: '0.75rem', marginBottom: '0.75rem', background: 'var(--color-inset)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: grupos.length ? '0.6rem' : 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>🍽 Menú del día / combo</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>
            Precio cerrado y el cliente elige de cada grupo. Vacío = producto normal.
          </div>
        </div>
        <button type="button" onClick={() => set([...grupos, grupoVacio(['Primero', 'Segundo', 'Postre'][grupos.length] || '')])}
          style={btnMini('var(--color-accent)')}>+ Grupo</button>
      </div>

      {grupos.map((g, gi) => (
        <div key={gi} style={{ border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem', marginBottom: '0.5rem', background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.45rem' }}>
            <input value={g.titulo} onChange={e => editarGrupo(gi, { titulo: e.target.value })}
              placeholder="Primero" style={{ ...inp, flex: 1, marginBottom: 0 }} />
            <label style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>elige hasta</label>
            <input type="number" min="1" max="5" value={g.max ?? 1}
              onChange={e => editarGrupo(gi, { max: Math.max(1, Number(e.target.value) || 1) })}
              style={{ ...inp, width: '3.5rem', marginBottom: 0 }} />
            <button type="button" onClick={() => set(grupos.filter((_, j) => j !== gi))}
              style={btnMini('var(--color-surface-3)')}>🗑️</button>
          </div>

          {(g.opciones || []).map((o, oi) => (
            <div key={oi} style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.3rem' }}>
              <input value={o.nombre} onChange={e => editarOpcion(gi, oi, { nombre: e.target.value })}
                placeholder="Ensalada mixta" style={{ ...inp, flex: 1, marginBottom: 0 }} />
              <input type="number" step="0.10" value={o.sup ?? ''} onChange={e => editarOpcion(gi, oi, { sup: Number(e.target.value) || 0 })}
                placeholder="+€" title="Suplemento" style={{ ...inp, width: '4.5rem', marginBottom: 0 }} />
              <button type="button" onClick={() => editarGrupo(gi, { opciones: g.opciones.filter((_, j) => j !== oi) })}
                style={btnMini('var(--color-surface-3)')}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => editarGrupo(gi, { opciones: [...(g.opciones || []), { nombre: '', sup: 0 }] })}
            style={btnMini('var(--color-surface-2)')}>+ Opción</button>
        </div>
      ))}
    </div>
  )
}

const inp = { background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.4rem', padding: '0.4rem 0.55rem', color: 'var(--color-text)', fontSize: '0.82rem' }
const btnMini = (bg) => ({ background: bg, color: /surface|inset/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.6rem', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 })
