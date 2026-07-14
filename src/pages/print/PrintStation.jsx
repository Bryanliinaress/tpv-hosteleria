import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import BotonSalir from '../../components/BotonSalir'

// Estación de impresión automática. Pensada para un PC en cocina/barra con la
// impresora térmica como predeterminada y Chrome en modo "kiosk-printing"
// (imprime sin diálogo). Detecta cada pedido nuevo y lanza su comanda.
export default function PrintStation() {
  const { pedidosCocina, pedidosBarra } = useStore()
  const [estacion, setEstacion] = useState(() => localStorage.getItem('tpv-print-estacion') || 'cocina') // cocina | barra | ambas
  const [auto, setAuto] = useState(true)
  const [cola, setCola] = useState([])     // tickets por imprimir
  const [log, setLog] = useState([])       // últimos impresos (para ver)
  const seen = useRef(new Set(JSON.parse(localStorage.getItem('tpv-print-seen') || '[]')))
  const inicial = useRef(false)
  const imprimiendo = useRef(false)

  const relevantes = estacion === 'cocina' ? pedidosCocina : estacion === 'barra' ? pedidosBarra : [...pedidosCocina, ...pedidosBarra]

  const guardarSeen = () => localStorage.setItem('tpv-print-seen', JSON.stringify([...seen.current].slice(-300)))

  // Al abrir (o cambiar de estación) marca lo ya existente como visto: solo se
  // imprime lo que llegue a partir de ahora.
  useEffect(() => {
    relevantes.forEach(p => seen.current.add(p.id))
    guardarSeen()
    inicial.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estacion])

  // Detecta pedidos nuevos y los encola agrupados por mesa.
  useEffect(() => {
    if (!inicial.current) return
    const nuevos = relevantes.filter(p => !seen.current.has(p.id))
    if (nuevos.length === 0) return
    nuevos.forEach(p => seen.current.add(p.id))
    guardarSeen()
    if (!auto) return
    const grupos = {}
    nuevos.forEach(p => { (grupos[p.mesaId] ||= []).push(p) })
    const tickets = Object.values(grupos).map(items => ({ id: 'tk' + Date.now() + items[0].mesaId, mesaNumero: items[0].mesaNumero, items, hora: new Date().toISOString() }))
    setCola(c => [...c, ...tickets])
    setLog(l => [...tickets, ...l].slice(0, 25))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidosCocina, pedidosBarra])

  // Imprime la cola de uno en uno.
  useEffect(() => {
    if (cola.length === 0 || imprimiendo.current) return
    imprimiendo.current = true
    const t = setTimeout(() => {
      try { window.print() } catch { /* sin impresora */ }
      setTimeout(() => { setCola(c => c.slice(1)); imprimiendo.current = false }, 700)
    }, 250)
    return () => clearTimeout(t)
  }, [cola])

  const actual = cola[0]

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="no-print" style={{ maxWidth: '640px', margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <h1 style={{ fontWeight: 800, fontSize: '1.35rem', marginBottom: '0.25rem' }}>🖨️ Estación de impresión</h1>
          <BotonSalir />
        </div>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Imprime las comandas automáticamente al entrar pedidos nuevos.</p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[{ id: 'cocina', t: '🍳 Cocina' }, { id: 'barra', t: '🍺 Barra' }, { id: 'ambas', t: '📋 Ambas' }].map(o => (
            <button key={o.id} onClick={() => { setEstacion(o.id); localStorage.setItem('tpv-print-estacion', o.id) }} style={btn(estacion === o.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { flex: 1 })}>{o.t}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button onClick={() => setAuto(a => !a)} style={btn(auto ? '#10b981' : 'var(--color-surface-3)', { flex: 1 })}>{auto ? '🟢 Auto-impresión ON' : '⚪ Auto-impresión OFF'}</button>
          <button onClick={() => { const ult = relevantes.slice(-1); if (ult.length) setCola(c => [...c, { id: 'test' + Date.now(), mesaNumero: ult[0].mesaNumero, items: [ult[0]], hora: new Date().toISOString() }]) }} style={btn('var(--color-surface-2)')}>Imprimir prueba</button>
        </div>

        <div style={{ background: 'var(--tint-warning-bg)', border: '1px solid var(--tint-warning-bd)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--tint-warning-fg)', marginBottom: '1.25rem' }}>
          ℹ️ Para impresión <strong>sin diálogo</strong>: abre esta página en el PC de la barra/cocina con Chrome iniciado con <code>--kiosk-printing</code> y la impresora térmica como predeterminada.
        </div>

        <h2 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>Últimas comandas {cola.length > 0 && <span style={{ color: 'var(--color-accent)' }}>· {cola.length} en cola</span>}</h2>
        {log.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Esperando pedidos…</p>}
        {log.map(t => (
          <div key={t.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem 0.8rem', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Mesa {t.mesaNumero} · {t.items.map(i => `${i.cantidad}× ${i.nombre}`).join(', ')}</span>
            <button onClick={() => setCola(c => [...c, { ...t, id: 'r' + Date.now() }])} style={btn('var(--color-surface-2)', { padding: '0.25rem 0.6rem', fontSize: '0.75rem' })}>↻ Reimprimir</button>
          </div>
        ))}
      </div>

      {/* Comanda que se imprime (solo esto sale por la impresora) */}
      {actual && (
        <div className="ticket-print" style={{ background: '#fff', color: '#111', width: '300px', padding: '1rem 1.1rem', fontFamily: '"Courier New", monospace', fontSize: '0.85rem', lineHeight: 1.45 }}>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.2rem' }}>COMANDA</div>
          <div style={{ textAlign: 'center', fontSize: '0.78rem' }}>Mesa {actual.mesaNumero} · {new Date(actual.hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ borderTop: '1px dashed #999', margin: '0.5rem 0' }} />
          {actual.items.map((it, i) => (
            <div key={i} style={{ marginBottom: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{it.cantidad}× {it.nombre}</span>
                <span>[{it.personaNombre}]</span>
              </div>
              {it.nota && <div style={{ fontSize: '0.76rem', color: '#444', paddingLeft: '0.5rem' }}>{it.nota}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const btn = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
