import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { toast, confirmar } from '../../store/useUI'

// Configuración inicial del local en 5 pasos (identidad → sala → personal →
// carta → listo). Pensado para dejar un bar operativo en ~15 minutos.
export default function Onboarding() {
  const navigate = useNavigate()
  const { local, updateLocal, configurarSala, vaciarCarta, carta, empleados, addEmpleado, updateEmpleado, removeEmpleado } = useStore()
  const [paso, setPaso] = useState(0)

  // Paso identidad (borrador local para no sincronizar en cada tecla)
  const [ident, setIdent] = useState({ nombre: local.nombre === 'Mi Local' ? '' : local.nombre, subtitulo: local.subtitulo || '', ivaPct: local.ivaPct ?? 10, moneda: local.moneda || '€' })

  // Paso sala
  const zonasIniciales = () => {
    const porZona = {}
    useStore.getState().mesas.forEach(m => {
      const z = (porZona[m.zona] ||= { nombre: m.zona, mesas: 0, capacidad: m.capacidad })
      z.mesas++
    })
    const arr = Object.values(porZona)
    return arr.length ? arr : [{ nombre: 'Sala', mesas: 8, capacidad: 4 }]
  }
  const [zonas, setZonas] = useState(zonasIniciales)

  // Paso personal
  const [nuevoEmp, setNuevoEmp] = useState({ nombre: '', pin: '', rol: 'camarero' })

  const PASOS = ['Local', 'Sala', 'Personal', 'Carta', 'Listo']

  const siguienteIdentidad = () => {
    if (!ident.nombre.trim()) { toast('Ponle nombre a tu local', 'error'); return }
    updateLocal({ nombre: ident.nombre.trim(), subtitulo: ident.subtitulo.trim(), ivaPct: ident.ivaPct, moneda: ident.moneda })
    setPaso(1)
  }

  const siguienteSala = () => {
    const r = configurarSala(zonas)
    if (!r.ok) { toast(r.error, 'error'); return }
    toast(`Sala configurada: ${r.total} mesas`, 'success')
    setPaso(2)
  }

  const crearEmpleado = () => {
    const r = addEmpleado(nuevoEmp)
    if (!r.ok) { toast(r.error, 'error'); return }
    setNuevoEmp({ nombre: '', pin: '', rol: 'camarero' })
  }

  const vaciar = async () => {
    if (await confirmar({ titulo: 'Carta vacía', mensaje: `Se quitarán los ${carta.productos.length} productos de ejemplo (las categorías y ajustes se conservan). ¿Continuar?`, peligro: true, confirmar: 'Vaciar carta' })) {
      vaciarCarta()
      toast('Carta vaciada: añade tus productos en Admin → Carta', 'success')
    }
  }

  const terminar = () => {
    updateLocal({ onboarded: true })
    toast('¡Tu TPV está listo! 🚀', 'success')
    navigate('/admin')
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', minHeight: '100vh', padding: '2rem 1.25rem' }}>
      {/* Cabecera + progreso */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '2.5rem' }}>🚀</div>
        <h1 style={{ fontWeight: 800, fontSize: '1.5rem' }}>Configura tu local</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>En 15 minutos tienes el TPV funcionando.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.8rem' }}>
          {PASOS.map((p, i) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: paso === i ? '1.6rem' : '0.5rem', height: '0.5rem', borderRadius: '9999px', background: i <= paso ? '#f97316' : '#334155', transition: 'all 0.2s' }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-faint)', marginTop: '0.35rem' }}>Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}</div>
      </div>

      <div className="anim-fade" style={card}>
        {/* 1 · Identidad */}
        {paso === 0 && (
          <>
            <h2 style={titulo}>🏪 Tu local</h2>
            <label style={lbl}>Nombre del local *</label>
            <input value={ident.nombre} onChange={e => setIdent(s => ({ ...s, nombre: e.target.value }))} placeholder="Bar Manolo" autoFocus style={inp} />
            <label style={lbl}>Subtítulo (aparece en el ticket)</label>
            <input value={ident.subtitulo} onChange={e => setIdent(s => ({ ...s, subtitulo: e.target.value }))} placeholder="Bar · Cafetería" style={inp} />
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>IVA incluido (%)</label>
                <input value={ident.ivaPct} onChange={e => setIdent(s => ({ ...s, ivaPct: e.target.value }))} type="number" min="0" style={inp} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Moneda</label>
                <input value={ident.moneda} onChange={e => setIdent(s => ({ ...s, moneda: e.target.value }))} style={inp} />
              </div>
            </div>
            <p style={nota}>El resto (dirección, CIF, pie del ticket…) lo puedes completar luego en Admin → 🏪 Local.</p>
            <button onClick={siguienteIdentidad} style={btnPrimario}>Continuar →</button>
          </>
        )}

        {/* 2 · Sala */}
        {paso === 1 && (
          <>
            <h2 style={titulo}>🍽 Tu sala</h2>
            <p style={nota}>Zonas del local y cuántas mesas tiene cada una. Los QR de mesa se generan solos.</p>
            {zonas.map((z, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.6rem' }}>
                <div style={{ flex: 2 }}>
                  <label style={lbl}>Zona</label>
                  <input value={z.nombre} onChange={e => setZonas(a => a.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} placeholder="Terraza" style={{ ...inp, marginBottom: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Mesas</label>
                  <input value={z.mesas} onChange={e => setZonas(a => a.map((x, j) => j === i ? { ...x, mesas: e.target.value } : x))} type="number" min="0" style={{ ...inp, marginBottom: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Plazas</label>
                  <input value={z.capacidad} onChange={e => setZonas(a => a.map((x, j) => j === i ? { ...x, capacidad: e.target.value } : x))} type="number" min="1" style={{ ...inp, marginBottom: 0 }} />
                </div>
                <button onClick={() => setZonas(a => a.filter((_, j) => j !== i))} disabled={zonas.length <= 1} style={{ background: 'none', border: 'none', color: zonas.length <= 1 ? 'var(--color-faint)' : '#f43f5e', cursor: zonas.length <= 1 ? 'not-allowed' : 'pointer', fontSize: '1rem', paddingBottom: '0.6rem' }}>🗑️</button>
              </div>
            ))}
            <button onClick={() => setZonas(a => [...a, { nombre: '', mesas: 4, capacidad: 4 }])} style={btnSuave}>+ Añadir zona</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--color-muted)', margin: '0.8rem 0' }}>
              <span>Total</span><strong style={{ color: '#f97316' }}>{zonas.reduce((s, z) => s + (Number(z.mesas) || 0), 0)} mesas · {zonas.reduce((s, z) => s + (Number(z.mesas) || 0) * (Number(z.capacidad) || 0), 0)} plazas</strong>
            </div>
            <Nav atras={() => setPaso(0)} siguiente={siguienteSala} />
          </>
        )}

        {/* 3 · Personal */}
        {paso === 2 && (
          <>
            <h2 style={titulo}>👥 Tu equipo</h2>
            <p style={nota}>Cada empleado entra con su PIN de 4 dígitos. Necesitas al menos un administrador.</p>
            {empleados.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <input value={e.nombre} onChange={ev => updateEmpleado(e.id, { nombre: ev.target.value })} style={{ ...inp, marginBottom: 0, flex: 2 }} />
                <span style={{ fontSize: '0.72rem', color: e.rol === 'admin' ? '#a78bfa' : 'var(--color-muted)', width: '4.5rem' }}>{e.rol === 'admin' ? '🔐 Admin' : '👤 Camarero'}</span>
                <span style={{ fontSize: '0.82rem', letterSpacing: '0.15em', fontWeight: 700 }}>{e.pin}</span>
                <button onClick={() => { const r = removeEmpleado(e.id); if (!r.ok) toast(r.error, 'error') }} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}>🗑️</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginTop: '0.8rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 120px' }}>
                <label style={lbl}>Nombre</label>
                <input value={nuevoEmp.nombre} onChange={e => setNuevoEmp(s => ({ ...s, nombre: e.target.value }))} style={{ ...inp, marginBottom: 0 }} />
              </div>
              <div style={{ flex: '1 1 80px' }}>
                <label style={lbl}>PIN</label>
                <input value={nuevoEmp.pin} onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) setNuevoEmp(s => ({ ...s, pin: e.target.value })) }} inputMode="numeric" maxLength={4} placeholder="0000" style={{ ...inp, marginBottom: 0, letterSpacing: '0.2em' }} />
              </div>
              <select value={nuevoEmp.rol} onChange={e => setNuevoEmp(s => ({ ...s, rol: e.target.value }))} style={{ ...inp, marginBottom: 0, flex: '1 1 110px', width: 'auto' }}>
                <option value="camarero">Camarero</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={crearEmpleado} style={{ ...btnSuave, marginBottom: 0 }}>+ Añadir</button>
            </div>
            <Nav atras={() => setPaso(1)} siguiente={() => setPaso(3)} />
          </>
        )}

        {/* 4 · Carta */}
        {paso === 3 && (
          <>
            <h2 style={titulo}>📋 Tu carta</h2>
            <p style={nota}>Puedes empezar con la carta de ejemplo y editarla, o partir de cero. Los productos se gestionan en Admin → Carta (con formatos, alérgenos y extras).</p>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              <div style={{ ...opcion, borderColor: '#10b981' }}>
                <div style={{ fontWeight: 700 }}>✅ Mantener la carta actual</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{carta.productos.length} productos de ejemplo (bar/cafetería) listos para editar.</div>
              </div>
              <button onClick={vaciar} disabled={carta.productos.length === 0} style={{ ...opcion, cursor: carta.productos.length ? 'pointer' : 'not-allowed', textAlign: 'left', opacity: carta.productos.length ? 1 : 0.5 }}>
                <div style={{ fontWeight: 700 }}>🗑️ Empezar con la carta vacía</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Quita los productos de ejemplo; añades los tuyos después.</div>
              </button>
            </div>
            <Nav atras={() => setPaso(2)} siguiente={() => setPaso(4)} />
          </>
        )}

        {/* 5 · Listo */}
        {paso === 4 && (
          <>
            <h2 style={titulo}>🎉 ¡Todo listo!</h2>
            <div style={{ background: '#0f172a', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', fontSize: '0.88rem' }}>
              <Fila k="🏪 Local" v={useStore.getState().local.nombre} />
              <Fila k="🍽 Mesas" v={`${useStore.getState().mesas.length} (${[...new Set(useStore.getState().mesas.map(m => m.zona))].join(', ')})`} />
              <Fila k="👥 Personal" v={`${empleados.filter(e => e.activo).length} empleados`} />
              <Fila k="📋 Carta" v={`${carta.productos.length} productos`} />
            </div>
            <p style={nota}>Siguientes pasos: imprime los <strong>QR de mesa</strong> (Admin → 📱 QR Codes) y completa dirección/CIF en Admin → 🏪 Local. La estación de impresión está en /print (guía en docs/IMPRESION.md).</p>
            <button onClick={terminar} style={btnPrimario}>🚀 Abrir mi TPV</button>
            <button onClick={() => setPaso(3)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem', width: '100%' }}>← Volver</button>
          </>
        )}
      </div>
    </div>
  )
}

const Nav = ({ atras, siguiente }) => (
  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
    <button onClick={atras} style={{ ...btnSuave, flex: 1, marginBottom: 0 }}>← Atrás</button>
    <button onClick={siguiente} style={{ ...btnPrimario, flex: 2, marginTop: 0 }}>Continuar →</button>
  </div>
)
const Fila = ({ k, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
    <span style={{ color: 'var(--color-muted)' }}>{k}</span><strong>{v}</strong>
  </div>
)

const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.4rem', boxShadow: 'var(--shadow)' }
const titulo = { fontWeight: 800, fontSize: '1.15rem', marginBottom: '0.75rem' }
const lbl = { display: 'block', fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }
const inp = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', color: 'var(--color-text)', fontSize: '0.92rem', width: '100%', marginBottom: '0.7rem' }
const nota = { fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.9rem', lineHeight: 1.5 }
const btnPrimario = { width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.85rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', marginTop: '0.5rem', boxShadow: '0 6px 16px -8px rgba(249,115,22,0.8)' }
const btnSuave = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.55rem', padding: '0.5rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }
const opcion = { background: '#0f172a', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.9rem', color: 'var(--color-text)' }
