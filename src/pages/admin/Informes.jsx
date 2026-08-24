import { METODO_LABEL, METODO_EMOJI } from '../../store/useStore'
import { importeLinea } from '../../lib/dinero'

// Informes de ventas del mes en curso a partir del historial de tickets.
// Gráficas ligeras hechas con CSS (sin librerías).
export default function Informes({ historial, moneda = '€' }) {
  const ahora = new Date()
  const delMes = historial.filter(r => {
    const d = new Date(r.cerradaEn)
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear()
  })

  // ── KPIs ───────────────────────────────────────────────
  const total = delMes.reduce((s, r) => s + r.total, 0)
  const propinas = delMes.reduce((s, r) => s + (r.propina || 0), 0)
  const comensales = delMes.reduce((s, r) => s + (r.personas?.length || 0), 0)
  const ticketMedio = delMes.length ? total / delMes.length : 0

  // ── Hoy ────────────────────────────────────────────────
  // El dueño mira esto desde el móvil a media tarde: «¿cómo va el día?» es la
  // pregunta, y antes había que deducirla del gráfico del mes.
  const hoyStr = ahora.toDateString()
  const deHoy = delMes.filter(r => new Date(r.cerradaEn).toDateString() === hoyStr)
  const totalHoy = deHoy.reduce((s, r) => s + r.total, 0)
  const propinasHoy = deHoy.reduce((s, r) => s + (r.propina || 0), 0)
  const medioHoy = deHoy.length ? totalHoy / deHoy.length : 0

  // ── Ventas por día ─────────────────────────────────────
  const porDia = {}
  delMes.forEach(r => { const d = new Date(r.cerradaEn).getDate(); porDia[d] = (porDia[d] || 0) + r.total })
  const dias = Object.keys(porDia).map(Number).sort((a, b) => a - b)
  const maxDia = Math.max(1, ...Object.values(porDia))

  // ── Top productos (unidades e importe) ─────────────────
  const prod = {}
  delMes.forEach(r => (r.personas || []).forEach(p => (p.items || []).forEach(i => {
    const e = (prod[i.nombre] ||= { uds: 0, imp: 0 })
    e.uds += i.cantidad; e.imp += importeLinea(i)
  })))
  const topProductos = Object.entries(prod).sort((a, b) => b[1].imp - a[1].imp).slice(0, 7)
  const maxProd = Math.max(1, ...topProductos.map(([, v]) => v.imp))

  // ── Por camarero y por método ──────────────────────────
  const porCamarero = {}
  delMes.forEach(r => { const c = r.cobradoPor || r.camarero || '—'; porCamarero[c] = (porCamarero[c] || 0) + r.total })
  const camareros = Object.entries(porCamarero).sort((a, b) => b[1] - a[1])
  const maxCam = Math.max(1, ...camareros.map(([, v]) => v))

  const porMetodo = {}
  delMes.forEach(r => Object.entries(r.pagos || {}).forEach(([k, v]) => { porMetodo[k] = (porMetodo[k] || 0) + v }))
  const metodos = Object.entries(porMetodo).sort((a, b) => b[1] - a[1])

  // ── Por hora del día ───────────────────────────────────
  const porHora = {}
  delMes.forEach(r => { const h = new Date(r.cerradaEn).getHours(); porHora[h] = (porHora[h] || 0) + r.total })
  const horas = Object.keys(porHora).map(Number).sort((a, b) => a - b)
  const maxHora = Math.max(1, ...Object.values(porHora))

  if (delMes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
        Aún no hay tickets este mes: los informes se llenan al cerrar mesas.
      </div>
    )
  }

  return (
    <div>
      {/* Hoy: lo primero que se mira desde el móvil */}
      <div style={{ ...card, marginBottom: '1rem', borderColor: 'var(--color-accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
          <h3 style={{ ...titulo, marginBottom: 0 }}>Hoy</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        <div style={{ fontWeight: 900, fontSize: 'clamp(1.9rem, 9vw, 2.6rem)', color: 'var(--color-accent)', lineHeight: 1 }}>
          {totalHoy.toFixed(2)} {moneda}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1.1rem', marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          <span><strong style={{ color: 'var(--color-text)' }}>{deHoy.length}</strong> tickets</span>
          <span>medio <strong style={{ color: 'var(--color-text)' }}>{medioHoy.toFixed(2)} {moneda}</strong></span>
          {propinasHoy > 0 && <span>propinas <strong style={{ color: 'var(--color-success)' }}>{propinasHoy.toFixed(2)} {moneda}</strong></span>}
        </div>
      </div>

      {/* KPIs del mes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { l: `Facturado (${ahora.toLocaleDateString('es-ES', { month: 'long' })})`, v: `${total.toFixed(2)} ${moneda}`, c: 'var(--color-accent)' },
          { l: 'Tickets', v: delMes.length, c: '#3b82f6' },
          { l: 'Ticket medio', v: `${ticketMedio.toFixed(2)} ${moneda}`, c: '#8b5cf6' },
          { l: 'Comensales', v: comensales, c: '#06b6d4' },
          { l: 'Propinas', v: `${propinas.toFixed(2)} ${moneda}`, c: '#10b981' },
        ].map(k => (
          <div key={k.l} style={{ ...card, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: k.c }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', textTransform: 'capitalize' }}>{k.l}</div>
            <div style={{ fontWeight: 800, fontSize: '1.35rem', color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 20rem), 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        {/* Ventas por día */}
        <div style={card}>
          <h3 style={titulo}>Ventas por día</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px' }}>
            {dias.map(d => (
              <div key={d} title={`Día ${d}: ${porDia[d].toFixed(2)} ${moneda}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ height: `${Math.max(4, porDia[d] / maxDia * 100)}%`, background: d === ahora.getDate() ? 'var(--color-success)' : 'linear-gradient(180deg, var(--color-accent-2), var(--color-accent))', borderRadius: '3px 3px 0 0' }} />
                {/* en un móvil no caben 31 etiquetas: se rotulan de 5 en 5 y hoy */}
                <div style={{ fontSize: '0.6rem', color: d === ahora.getDate() ? 'var(--color-success)' : 'var(--color-faint)', textAlign: 'center', marginTop: '2px', fontWeight: d === ahora.getDate() ? 800 : 400 }}>
                  {(dias.length <= 8 || d % 5 === 0 || d === ahora.getDate()) ? d : ' '}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top productos */}
        <div style={card}>
          <h3 style={titulo}>Top productos</h3>
          {topProductos.map(([nombre, v]) => (
            <Barra key={nombre} etiqueta={`${nombre} · ${v.uds} uds`} valor={v.imp} max={maxProd} color="#3b82f6" moneda={moneda} />
          ))}
        </div>

        {/* Por camarero */}
        <div style={card}>
          <h3 style={titulo}>Ventas por camarero</h3>
          {camareros.map(([c, v]) => (
            <Barra key={c} etiqueta={`👤 ${c}`} valor={v} max={maxCam} color="#10b981" moneda={moneda} />
          ))}
        </div>

        {/* Por método de pago */}
        <div style={card}>
          <h3 style={titulo}>Método de pago</h3>
          {metodos.map(([k, v]) => (
            <Barra key={k} etiqueta={`${METODO_EMOJI[k] || '💰'} ${METODO_LABEL[k] || k}`} valor={v} max={Math.max(1, ...metodos.map(([, x]) => x))} color="#8b5cf6" moneda={moneda} />
          ))}
        </div>

        {/* Por hora */}
        <div style={card}>
          <h3 style={titulo}>Ventas por hora</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '110px' }}>
            {horas.map(h => (
              <div key={h} title={`${h}:00 · ${porHora[h].toFixed(2)} ${moneda}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ height: `${Math.max(4, porHora[h] / maxHora * 100)}%`, background: 'linear-gradient(180deg, #22d3ee, #06b6d4)', borderRadius: '3px 3px 0 0' }} />
                <div style={{ fontSize: '0.6rem', color: 'var(--color-faint)', textAlign: 'center', marginTop: '2px' }}>{horas.length <= 10 || h % 2 === 0 ? `${h}h` : ' '}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Barra({ etiqueta, valor, max, color, moneda }) {
  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>{etiqueta}</span>
        <strong style={{ whiteSpace: 'nowrap' }}>{valor.toFixed(2)} {moneda}</strong>
      </div>
      <div style={{ background: 'var(--color-inset)', borderRadius: '9999px', height: '0.55rem', overflow: 'hidden' }}>
        <div style={{ width: `${valor / max * 100}%`, height: '100%', background: color, borderRadius: '9999px', transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }
const titulo = { fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }
