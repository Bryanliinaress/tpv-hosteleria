import { owedPorPersona } from '../store/useStore'

// Modificadores de una línea (pan, sin/con, nota) en una sola cadena
const descr = (item) => {
  const p = []
  if (item.pan) p.push(`${item.pan.nombreFormato}/${item.pan.nombreTipo}`)
  if (item.quitados?.length) p.push('SIN ' + item.quitados.join(', '))
  if (item.anadidos?.length) p.push('CON ' + item.anadidos.join(', '))
  if (item.nota) p.push('"' + item.nota + '"')
  return p.join(' · ')
}

const IVA = 0.10 // hostelería (incluido en el precio)

// Ticket de comanda (cocina/barra): qué preparar, sin precios
function Comanda({ mesa }) {
  const conItems = mesa.personas.filter(p => p.items.length > 0)
  const cocina = []
  const barra = []
  conItems.forEach(p => p.items.forEach(it => (it.tipo === 'comida' ? cocina : barra).push({ persona: p.nombre, it })))
  const seccion = (titulo, arr) => arr.length > 0 && (
    <>
      <div style={st.h2}>{titulo}</div>
      {arr.map(({ persona, it }, i) => (
        <div key={i} style={{ marginBottom: '0.35rem' }}>
          <div style={st.linea}><span style={{ fontWeight: 700 }}>{it.cantidad}× {it.nombre}</span><span>[{persona}]</span></div>
          {descr(it) && <div style={st.mod}>{descr(it)}</div>}
        </div>
      ))}
    </>
  )
  return (
    <>
      <div style={st.titulo}>COMANDA</div>
      <div style={st.sub}>Mesa {mesa.numero} · {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
      <div style={st.hr} />
      {seccion('🍳 COCINA', cocina)}
      {cocina.length > 0 && barra.length > 0 && <div style={st.hr} />}
      {seccion('🍺 BARRA', barra)}
      {cocina.length + barra.length === 0 && <div style={st.sub}>Sin pedidos</div>}
    </>
  )
}

// Líneas + total de una persona o de la mesa entera
function lineasPersona(p) {
  return p.items.map((it, i) => (
    <div key={i} style={{ marginBottom: '0.15rem' }}>
      <div style={st.linea}><span>{it.cantidad}× {it.nombre}</span><span>{(it.precio * it.cantidad).toFixed(2)}</span></div>
      {descr(it) && <div style={st.mod}>{descr(it)}</div>}
    </div>
  ))
}

// Ticket de cuenta (mesa completa o una persona)
function Cuenta({ mesa, persona }) {
  const personas = persona ? [persona] : mesa.personas
  const total = personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
  const propina = personas.reduce((s, p) => s + (p.propina || 0), 0)
  const base = total / (1 + IVA)
  const cuotaIva = total - base
  return (
    <>
      <div style={st.titulo}>CASA LOLI</div>
      <div style={st.sub}>Restaurante · Desayunos</div>
      <div style={st.hr} />
      <div style={st.linea}><span>Mesa {mesa.numero}</span><span>{new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
      {persona && <div style={st.linea}><span>Cliente</span><span>{persona.nombre}</span></div>}
      <div style={st.hr} />
      {personas.map(p => {
        const sub = p.items.reduce((s, i) => s + i.precio * i.cantidad, 0)
        return (
          <div key={p.id} style={{ marginBottom: '0.4rem' }}>
            {!persona && <div style={{ fontWeight: 700 }}>{p.nombre}{p.pagado ? ' ✓ pagado' : ''}</div>}
            {p.items.length === 0 ? <div style={st.mod}>sin consumo</div> : lineasPersona(p)}
            {!persona && <div style={st.linea}><span style={{ color: '#555' }}>Subtotal</span><span>{sub.toFixed(2)}</span></div>}
          </div>
        )
      })}
      <div style={st.hr} />
      <div style={{ ...st.linea, fontWeight: 800, fontSize: '1.05rem' }}><span>TOTAL</span><span>{total.toFixed(2)} €</span></div>
      <div style={st.linea}><span style={st.fine}>Base imponible</span><span style={st.fine}>{base.toFixed(2)} €</span></div>
      <div style={st.linea}><span style={st.fine}>IVA (10%) incluido</span><span style={st.fine}>{cuotaIva.toFixed(2)} €</span></div>
      {propina > 0 && <div style={st.linea}><span style={st.fine}>Propina</span><span style={st.fine}>{propina.toFixed(2)} €</span></div>}
      <div style={st.hr} />
      <div style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '0.4rem' }}>¡Gracias por su visita!</div>
    </>
  )
}

export default function Ticket({ tipo, mesa, persona, onClose }) {
  return (
    <div onClick={onClose} className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', maxHeight: '92vh' }}>
        <div className="ticket-print" style={st.papel}>
          {tipo === 'comanda' ? <Comanda mesa={mesa} /> : <Cuenta mesa={mesa} persona={tipo === 'persona' ? persona : null} />}
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => window.print()} style={st.btn('#f97316')}>🖨️ Imprimir</button>
          <button onClick={onClose} style={st.btn('#334155')}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const st = {
  papel: { background: '#fff', color: '#111', width: '300px', maxWidth: '80vw', padding: '1rem 1.1rem', fontFamily: '"Courier New", monospace', fontSize: '0.82rem', lineHeight: 1.45, overflowY: 'auto', borderRadius: '0.25rem', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.7)' },
  titulo: { textAlign: 'center', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '0.05em' },
  sub: { textAlign: 'center', fontSize: '0.78rem', color: '#444' },
  h2: { fontWeight: 800, marginTop: '0.3rem', marginBottom: '0.2rem' },
  hr: { borderTop: '1px dashed #999', margin: '0.5rem 0' },
  linea: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem' },
  mod: { fontSize: '0.74rem', color: '#666', paddingLeft: '0.5rem' },
  fine: { fontSize: '0.74rem', color: '#555' },
  btn: (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }),
}
