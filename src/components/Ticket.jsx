import { useStore } from '../store/useStore'
import { QRCodeSVG } from 'qrcode.react'

// Modificadores de una línea (pan, sin/con, nota) en una sola cadena
const descr = (item) => {
  const p = []
  if (item.pan) p.push(`${item.pan.nombreFormato}/${item.pan.nombreTipo}`)
  if (item.quitados?.length) p.push('SIN ' + item.quitados.join(', '))
  if (item.anadidos?.length) p.push('CON ' + item.anadidos.join(', '))
  if (item.nota) p.push('"' + item.nota + '"')
  return p.join(' · ')
}

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

// Consolida las líneas: misma descripción, extras y precio → una sola fila
function consolidar(personas) {
  const filas = new Map()
  personas.forEach(p => p.items.forEach(it => {
    const extra = descr(it)
    const clave = `${it.nombre}|${extra}|${it.precio}`
    const f = filas.get(clave) || { nombre: it.nombre, extra, precio: it.precio, uds: 0 }
    f.uds += it.cantidad
    filas.set(clave, f)
  }))
  return [...filas.values()]
}

// Ticket de cuenta estilo térmico profesional: cabecera fiscal, columnas
// DESCRIPCIÓN/UDS/PRECIO/IMPORTE, base+IVA, comensales, estado de pago,
// mesa/zona y QR (reseña o carta).
function Cuenta({ mesa, persona, local }) {
  const personas = persona ? [persona] : mesa.personas
  const filas = consolidar(personas)
  const total = personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
  const propina = personas.reduce((s, p) => s + (p.propina || 0), 0)
  const ivaPct = local?.ivaPct ?? 10
  const base = total / (1 + ivaPct / 100)
  const mon = local?.moneda || '€'
  const pagado = personas.length > 0 && personas.every(p => p.pagado)
  const nCom = personas.length
  const f = (n) => n.toFixed(2)
  const urlQR = local?.urlResena || `${window.location.origin}${window.location.pathname}#/mesa/${mesa.id}`

  return (
    <>
      {/* Cabecera fiscal */}
      <div style={st.titulo}>{local?.nombre || 'Mi Local'}</div>
      <div style={st.sub}>Razón Social: {local?.razonSocial || local?.nombre || '—'}</div>
      {local?.cif && <div style={st.sub}>N.I.F.: {local.cif}</div>}
      {local?.direccion && <div style={st.sub}>Dirección: {local.direccion}</div>}
      {(local?.direccionFiscal || local?.direccion) && <div style={st.sub}>Dirección fiscal: {local?.direccionFiscal || local?.direccion}</div>}
      {local?.telefono && <div style={st.sub}>Teléfono: {local.telefono}</div>}

      <div style={{ margin: '0.6rem 0 0.2rem' }}>
        {mesa.camarero && <div>Pedido por: Staff - {mesa.camarero}</div>}
        <div>Hora: {new Date().toLocaleString('sv-SE')}</div>
        {persona && <div>Cliente: {persona.nombre}</div>}
      </div>

      {/* Tabla de líneas */}
      <div style={st.hrDoble} />
      <div style={{ ...st.cab4, fontWeight: 700 }}>
        <span>DESCRIPCIÓN</span><span style={st.num}>UDS</span><span style={st.num}>PRECIO</span><span style={st.num}>IMPORTE</span>
      </div>
      <div style={st.hr} />
      {filas.map((l, i) => (
        <div key={i} style={{ marginBottom: '0.15rem' }}>
          <div style={st.cab4}>
            <span style={{ textTransform: 'uppercase' }}>{l.nombre}</span>
            <span style={st.num}>{l.uds}</span>
            <span style={st.num}>{f(l.precio)}</span>
            <span style={st.num}>{f(l.precio * l.uds)}</span>
          </div>
          {l.extra && <div style={st.mod}>{l.extra}</div>}
        </div>
      ))}
      {filas.length === 0 && <div style={st.mod}>sin consumo</div>}

      {/* Totales */}
      <div style={st.hr} />
      <div style={st.der}>Base: <b>{f(base)}</b></div>
      <div style={st.der}>Total IVA ({ivaPct}%): <b>{f(total - base)}</b></div>
      <div style={{ ...st.der, fontSize: '1.35rem', fontWeight: 800, margin: '0.2rem 0' }}>Total: {f(total)} {mon}</div>
      <div style={st.der}>Comensales: {nCom}</div>
      {nCom > 1 && <div style={st.der}>Por comensal: {f(total / nCom)}</div>}
      {propina > 0 && <div style={st.der}>Propina: {f(propina)} {mon}</div>}

      {/* Estado de pago */}
      <div style={st.hrDoble} />
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.08em', margin: '0.2rem 0' }}>
        {pagado ? 'PAGADO' : 'PENDIENTE DE PAGO'}
      </div>
      <div style={st.hrDoble} />

      {/* Mesa y zona */}
      <div style={{ textAlign: 'center', margin: '0.4rem 0' }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Mesa {mesa.numero}</div>
        {mesa.zona && <div>{mesa.zona}</div>}
      </div>

      {/* QR */}
      <div style={st.hr} />
      <div style={{ textAlign: 'center', fontSize: '0.76rem' }}>
        {local?.urlResena ? 'Escanea este QR para valorar nuestro servicio' : 'Escanea este QR para ver la carta y pedir'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
        <QRCodeSVG value={urlQR} size={110} />
      </div>

      {/* Pie */}
      <div style={st.hr} />
      <div style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '0.3rem', whiteSpace: 'pre-wrap' }}>
        {local?.pieTicket || '¡Gracias por su visita!'}
      </div>
    </>
  )
}

export default function Ticket({ tipo, mesa, persona, onClose }) {
  const local = useStore(s => s.local)
  return (
    <div onClick={onClose} className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', maxHeight: '92vh' }}>
        <div className="ticket-print" style={st.papel}>
          {tipo === 'comanda' ? <Comanda mesa={mesa} /> : <Cuenta mesa={mesa} persona={tipo === 'persona' ? persona : null} local={local} />}
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => window.print()} style={st.btn('var(--color-accent)')}>🖨️ Imprimir</button>
          <button onClick={onClose} style={st.btn('var(--color-surface-3)', 'var(--color-text)')}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const st = {
  papel: { background: '#fff', color: '#111', width: '320px', maxWidth: '82vw', padding: '1rem 1.1rem', fontFamily: '"Courier New", monospace', fontSize: '0.8rem', lineHeight: 1.4, overflowY: 'auto', borderRadius: '0.25rem', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.7)' },
  titulo: { textAlign: 'center', fontWeight: 800, fontSize: '1.35rem', letterSpacing: '0.03em' },
  sub: { textAlign: 'center', fontSize: '0.74rem', color: '#333' },
  h2: { fontWeight: 800, marginTop: '0.3rem', marginBottom: '0.2rem' },
  hr: { borderTop: '1px dashed #999', margin: '0.45rem 0' },
  hrDoble: { borderTop: '3px double #111', margin: '0.45rem 0' },
  linea: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem' },
  cab4: { display: 'grid', gridTemplateColumns: '1fr 2.2rem 3.2rem 3.6rem', gap: '0.25rem', fontSize: '0.76rem' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  der: { textAlign: 'right', fontSize: '0.8rem' },
  mod: { fontSize: '0.7rem', color: '#666', paddingLeft: '0.5rem' },
  btn: (bg, color = '#fff') => ({ background: bg, color, border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }),
}
