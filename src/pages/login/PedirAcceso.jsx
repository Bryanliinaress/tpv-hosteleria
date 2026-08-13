import { useState, useEffect, useRef } from 'react'
import { pedirAcceso, comprobarAcceso, secretoGuardado, olvidarDispositivo } from '../../lib/v2/dispositivo'
import { useStore } from '../../store/useStore'

// ────────────────────────────────────────────────────────────────────────────
// Lo que ve un aparato que todavía no está autorizado.
//
// Antes aquí se pedía el correo y la contraseña del local. Ahora enseña un
// código y espera: el encargado lo autoriza desde su panel y esta pantalla se
// va sola, sin que nadie toque nada. El primero de todos lo autoriza quien
// monta el bar, desde el terminal (`scripts/autorizar-dispositivo.mjs`).
//
// Se hace UNA VEZ por aparato; después entra cada persona con su PIN.
// ────────────────────────────────────────────────────────────────────────────
export default function PedirAcceso({ onOk }) {
  const local = useStore(s => s.local)
  const [codigo, setCodigo] = useState(secretoGuardado()?.codigo || null)
  const [estado, setEstado] = useState('cargando')   // cargando | esperando | error
  const [detalle, setDetalle] = useState('')
  const parar = useRef(false)

  useEffect(() => {
    parar.current = false

    const pedirSiHaceFalta = async () => {
      if (secretoGuardado()?.secreto) return
      const { codigo } = await pedirAcceso()
      setCodigo(codigo)
    }

    const ciclo = async () => {
      try {
        await pedirSiHaceFalta()
        setEstado('esperando')
      } catch (e) {
        setEstado('error')
        setDetalle(e.message || 'No se pudo pedir el acceso')
        return
      }
      while (!parar.current) {
        const r = await comprobarAcceso()
        if (parar.current) return
        if (r === 'aprobado') { onOk?.(); return }
        // Al revocarlo o caducar, el secreto ya no vale: se pide otro y sale un
        // código nuevo, en vez de quedarse esperando algo que nunca llegará.
        if (r === 'revocado' || r === 'desconocido') {
          try {
            const { codigo } = await pedirAcceso()
            setCodigo(codigo)
          } catch { /* se reintenta en la vuelta siguiente */ }
        }
        await new Promise(r => setTimeout(r, 4000))
      }
    }
    ciclo()
    return () => { parar.current = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reintentar = () => { olvidarDispositivo(); window.location.reload() }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="anim-pop" style={{
        width: '100%', maxWidth: '400px', background: 'var(--color-surface)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)', padding: '2rem 1.6rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.4rem' }}>🔗</div>
        <h1 style={{ fontWeight: 800, fontSize: '1.25rem', marginTop: '0.3rem' }}>
          Conectar este dispositivo
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.88rem', marginTop: '0.4rem', lineHeight: 1.5 }}>
          {local?.nombre ? <>Enséñale este código al encargado de <b>{local.nombre}</b>.</> : 'Enséñale este código al encargado.'}
          {' '}Lo autoriza desde <b>Admin → Dispositivos</b> y esta pantalla se irá sola.
        </p>

        {estado === 'error' ? (
          <>
            <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', margin: '1.4rem 0 0.8rem' }}>
              ⚠️ {detalle}
            </p>
            <button onClick={reintentar} style={boton}>Reintentar</button>
          </>
        ) : (
          <>
            <div style={{
              margin: '1.5rem 0 0.5rem', fontSize: '2.6rem', fontWeight: 800,
              letterSpacing: '0.28em', color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums',
            }}>
              {codigo ? `${codigo.slice(0, 3)} ${codigo.slice(3)}` : '· · ·  · · ·'}
            </div>
            <p style={{ color: 'var(--color-faint)', fontSize: '0.78rem' }}>
              {estado === 'cargando' ? 'Pidiendo acceso…' : 'Esperando a que lo autoricen…'}
            </p>
            <p style={{ color: 'var(--color-faint)', fontSize: '0.72rem', marginTop: '1.6rem', lineHeight: 1.5 }}>
              Se hace una sola vez en cada aparato. Después, cada persona entra
              con su PIN.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const boton = {
  width: '100%', background: 'var(--color-accent)', color: '#fff', border: 'none',
  borderRadius: '0.6rem', padding: '0.8rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
}
