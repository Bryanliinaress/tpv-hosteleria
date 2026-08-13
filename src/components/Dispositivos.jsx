import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { backendV2 } from '../lib/repo'
import { toast } from '../store/useUI'

// ────────────────────────────────────────────────────────────────────────────
// Admin → Dispositivos: quién puede entrar al TPV de este bar.
//
// Un aparato nuevo enseña un código de 6 dígitos y espera; aquí aparece y se
// autoriza con un botón. Y lo que faltaba hasta ahora: se puede QUITAR — una
// tablet perdida deja de entrar en el momento, porque al revocarla se borra su
// cuenta y su sesión muere con ella.
// ────────────────────────────────────────────────────────────────────────────
export default function Dispositivos() {
  const [lista, setLista] = useState(null)
  const [ocupado, setOcupado] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('dispositivos_del_local')
    if (error) { toast('No se pudieron cargar los dispositivos', 'error'); return }
    setLista(data || [])
  }, [])

  useEffect(() => {
    if (!backendV2) return
    cargar()
    // Alguien está delante del aparato esperando: conviene que salga solo.
    const t = setInterval(cargar, 5000)
    return () => clearInterval(t)
  }, [cargar])

  if (!backendV2) {
    return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
      Los dispositivos se gestionan en la versión con servidor.
    </p>
  }

  const autorizar = async (d) => {
    setOcupado(d.id)
    const nombre = (prompt('¿Qué aparato es? (para reconocerlo luego)', d.nombre) ?? '').trim()
    const { error } = await supabase.rpc('aprobar_dispositivo', { p_id: d.id, p_nombre: nombre || null })
    setOcupado(null)
    if (error) { toast(error.message.includes('solo_admin') ? 'Solo un administrador puede autorizar' : 'No se pudo autorizar', 'error'); return }
    toast('Dispositivo autorizado — entrará solo en unos segundos', 'success')
    cargar()
  }

  const revocar = async (d) => {
    if (!confirm(`¿Quitarle el acceso a «${d.nombre}»?\n\nDejará de entrar inmediatamente. Si hace falta, tendrá que pedir permiso otra vez.`)) return
    setOcupado(d.id)
    const { error } = await supabase.rpc('revocar_dispositivo', { p_id: d.id })
    setOcupado(null)
    if (error) { toast(error.message.includes('solo_admin') ? 'Solo un administrador puede quitar el acceso' : 'No se pudo quitar', 'error'); return }
    toast('Acceso retirado', 'success')
    cargar()
  }

  if (lista === null) return <p style={{ color: 'var(--color-muted)' }}>Cargando…</p>

  const pendientes = lista.filter(d => d.estado === 'pendiente')
  const activos = lista.filter(d => d.estado === 'aprobado')

  const fecha = (t) => t ? new Date(t).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '640px' }}>
      <section>
        <h3 style={titulo}>Esperando permiso {pendientes.length > 0 && <span style={globo}>{pendientes.length}</span>}</h3>
        {!pendientes.length ? (
          <p style={vacio}>
            Nadie ha pedido acceso. Abre el TPV en el aparato que quieras conectar
            y aquí aparecerá su código.
          </p>
        ) : pendientes.map(d => (
          <div key={d.id} style={fila}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>
              {String(d.codigo).slice(0, 3)} {String(d.codigo).slice(3)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{d.nombre}</div>
              <div style={sub}>pidió acceso {fecha(d.creado_en)}</div>
            </div>
            <button disabled={ocupado === d.id} onClick={() => autorizar(d)} style={btnPrimario}>
              {ocupado === d.id ? '…' : 'Autorizar'}
            </button>
          </div>
        ))}
      </section>

      <section>
        <h3 style={titulo}>Con acceso ({activos.length})</h3>
        {!activos.length ? (
          <p style={vacio}>Todavía no hay ningún dispositivo autorizado.</p>
        ) : activos.map(d => (
          <div key={d.id} style={fila}>
            <div style={{ fontSize: '1.3rem' }}>🖥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{d.nombre}</div>
              <div style={sub}>desde {fecha(d.aprobado_en)} · último uso {fecha(d.ultimo_uso)}</div>
            </div>
            <button disabled={ocupado === d.id} onClick={() => revocar(d)} style={btnPeligro}>
              {ocupado === d.id ? '…' : 'Quitar acceso'}
            </button>
          </div>
        ))}
      </section>

      <p style={{ ...sub, lineHeight: 1.6 }}>
        Cada aparato se autoriza una sola vez y lo conserva. Después, quien lo
        use entra con <b>su PIN</b>: eso es lo que distingue a un camarero de un
        encargado. Si un aparato se pierde, quítale el acceso aquí y dejará de
        entrar en el momento.
      </p>
    </div>
  )
}

const titulo = { fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }
const globo = { background: 'var(--color-accent)', color: '#fff', borderRadius: '9999px', fontSize: '0.72rem', padding: '0.1rem 0.5rem' }
const vacio = { color: 'var(--color-muted)', fontSize: '0.85rem', lineHeight: 1.5 }
const sub = { color: 'var(--color-muted)', fontSize: '0.76rem' }
const fila = {
  display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.8rem 0.9rem',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)', marginBottom: '0.6rem',
}
const btnBase = { border: 'none', borderRadius: '0.5rem', padding: '0.55rem 0.9rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0 }
const btnPrimario = { ...btnBase, background: 'var(--color-accent)', color: '#fff' }
const btnPeligro = { ...btnBase, background: 'var(--color-surface-3)', color: 'var(--color-danger)' }
