import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { backendV2 } from '../lib/repo'
import { toast, pedirTexto, confirmar } from '../store/useUI'
import { useStore } from '../store/useStore'
import { PANTALLAS } from '../lib/roles'

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
  // La plantilla, para poder decir de quién es cada aparato. Los que ya no
  // están de turno también salen: un aparato puede seguir siendo suyo.
  const empleados = useStore(s => s.empleados)

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

  // El PIN se pide AQUÍ y lo comprueba el servidor. Con dispositivos
  // autorizados la sesión es del aparato, no de una persona, así que el PIN es
  // lo único que dice quién está delante. Dar o quitar acceso al TPV es raro y
  // delicado: que cueste un gesto más está bien.
  const conPin = async (texto, fn) => {
    const pin = ((await pedirTexto({ titulo: 'PIN de encargado', mensaje: texto, placeholder: '4 dígitos', confirmar: 'Continuar' })) ?? '').trim()
    if (!pin) return null
    const { error } = await fn(pin)
    if (error) {
      toast(/pin_no_admin/.test(error.message) ? 'Ese PIN no es de un encargado' : 'No se pudo completar', 'error')
      return false
    }
    return true
  }

  const autorizar = async (d) => {
    const nombre = ((await pedirTexto({ titulo: '¿Qué aparato es?', mensaje: 'El nombre es para reconocerlo luego en esta lista.', valor: d.nombre, confirmar: 'Seguir' })) ?? '').trim()
    setOcupado(d.id)
    const ok = await conPin('PIN de encargado para autorizarlo:', (pin) =>
      supabase.rpc('aprobar_dispositivo', { p_id: d.id, p_nombre: nombre || null, p_pin: pin }))
    setOcupado(null)
    if (ok) { toast('Dispositivo autorizado — entrará solo en unos segundos', 'success'); cargar() }
  }

  const revocar = async (d) => {
    if (!await confirmar({ titulo: `¿Quitarle el acceso a «${d.nombre}»?`, mensaje: 'Dejará de entrar inmediatamente. Si hace falta, tendrá que pedir permiso otra vez.', peligro: true, confirmar: 'Quitar acceso' })) return
    setOcupado(d.id)
    const ok = await conPin('PIN de encargado para quitarle el acceso:', (pin) =>
      supabase.rpc('revocar_dispositivo', { p_id: d.id, p_pin: pin }))
    setOcupado(null)
    if (ok) { toast('Acceso retirado', 'success'); cargar() }
  }

  // El nombre se ponía una sola vez, al autorizarlo. Con cuatro tablets
  // iguales llamadas «Tablet», el encargado no sabe a cuál le está quitando el
  // acceso — y quitarle el acceso a la de cocina en mitad de un servicio se
  // nota.
  const renombrar = async (d) => {
    const nombre = ((await pedirTexto({ titulo: 'Nombre del aparato', mensaje: 'Para reconocerlo en esta lista.', valor: d.nombre, confirmar: 'Guardar' })) ?? '').trim()
    if (!nombre || nombre === d.nombre) return
    setOcupado(d.id)
    const ok = await conPin('Para cambiarle el nombre:', (pin) =>
      supabase.rpc('renombrar_dispositivo', { p_id: d.id, p_nombre: nombre, p_pin: pin }))
    setOcupado(null)
    if (ok) { toast('Nombre cambiado', 'success'); cargar() }
  }

  // De quién es el aparato. Es INFORMACIÓN, no permisos: quien identifica a la
  // persona sigue siendo el PIN. Con cuatro tablets iguales, saber a quién le
  // quitas el acceso al revocar una es la diferencia entre hacerlo tranquilo y
  // dejar a alguien tirado en mitad de un servicio.
  const asignar = async (d, empleadoId) => {
    setOcupado(d.id)
    const ok = await conPin(empleadoId ? 'Para asignarle el aparato:' : 'Para dejarlo sin asignar:', (pin) =>
      supabase.rpc('asignar_dispositivo', { p_id: d.id, p_empleado: empleadoId || null, p_pin: pin }))
    setOcupado(null)
    if (ok) {
      const quien = empleados.find(e => e.id === empleadoId)?.nombre
      toast(quien ? `«${d.nombre}» es de ${quien}` : `«${d.nombre}» queda sin asignar`, 'success')
      cargar()
    }
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
            <div style={{ fontSize: '1.3rem' }}>{EMOJI_PANTALLA[d.ultima_pantalla] || '🖥'}</div>
            {/* `flex: 1` a secas dejaba la columna del texto en dos letras por
                línea con los dos botones al lado, en 375 px. Con una base de
                11rem, los botones se bajan solos a la línea de abajo. */}
            <div style={{ flex: '1 1 11rem', minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{d.nombre}</div>
              {/* Para qué se usa: lo apunta el propio aparato al abrir una
                  pantalla. Un nombre dice lo que alguien quiso; esto, lo que
                  hace. */}
              <div style={sub}>
                {d.ultima_pantalla
                  ? <>Se usa en <b style={{ color: 'var(--color-text-2)' }}>{PANTALLAS[d.ultima_pantalla]?.label || d.ultima_pantalla}</b> · </>
                  : <>Sin usar todavía · </>}
                última vez {fecha(d.ultimo_uso)}
              </div>
              {/* De quién es. Con cuatro tablets iguales, el nombre no basta:
                  esto es lo que dice a quién dejas sin aparato al revocar. */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.76rem', color: 'var(--color-muted)' }}>
                👤 De
                <select value={d.empleado_id || ''} disabled={ocupado === d.id}
                  onChange={e => asignar(d, e.target.value)}
                  style={{ background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.4rem', padding: '0.25rem 0.4rem', color: 'var(--color-text)', fontSize: '0.76rem', maxWidth: '11rem' }}>
                  <option value="">nadie en concreto</option>
                  {empleados.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}{e.activo ? '' : ' (sin turno)'}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              <button disabled={ocupado === d.id} onClick={() => renombrar(d)} title="Cambiar el nombre" style={btnSuave}>
                {ocupado === d.id ? '…' : '✏️ Nombre'}
              </button>
              <button disabled={ocupado === d.id} onClick={() => revocar(d)} style={btnPeligro}>
                {ocupado === d.id ? '…' : 'Quitar acceso'}
              </button>
            </div>
          </div>
        ))}
      </section>

      <p style={{ ...sub, lineHeight: 1.6 }}>
        Cada aparato se autoriza una sola vez y lo conserva. Después, quien lo
        use entra con <b>su PIN</b>: eso es lo que distingue a un camarero de un
        encargado. Si un aparato se pierde, quítale el acceso aquí y dejará de
        entrar en el momento.
        <br /><br />
        Decir <b>de quién</b> es un aparato sirve para saber a quién dejas sin
        él al quitarle el acceso: <b>no le da los permisos de esa persona</b>.
        Quien entra sigue siendo quien teclea el PIN.
      </p>
    </div>
  )
}

const titulo = { fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }
const globo = { background: 'var(--color-accent)', color: '#fff', borderRadius: '9999px', fontSize: '0.72rem', padding: '0.1rem 0.5rem' }
const vacio = { color: 'var(--color-muted)', fontSize: '0.85rem', lineHeight: 1.5 }
const sub = { color: 'var(--color-muted)', fontSize: '0.76rem' }
const fila = {
  display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.8rem 0.9rem',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)', marginBottom: '0.6rem',
}
const btnBase = { border: 'none', borderRadius: '0.5rem', padding: '0.55rem 0.9rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0 }
const btnPrimario = { ...btnBase, background: 'var(--color-accent)', color: '#fff' }
const btnPeligro = { ...btnBase, background: 'var(--color-surface-3)', color: 'var(--color-danger)' }
const btnSuave = { ...btnBase, background: 'var(--color-surface-3)', color: 'var(--color-text)' }

// La misma cara que lleva cada pantalla en su cabecera, para reconocerla de un
// vistazo en la lista.
const EMOJI_PANTALLA = {
  cocina: '🍳', barra: '🍺', camarero: '🧾', pda: '📟', print: '🖨️', admin: '🛠',
}
