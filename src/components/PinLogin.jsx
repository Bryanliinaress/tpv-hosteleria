import { useState, useEffect } from 'react'
import { useStore, empleadoPorPin } from '../store/useStore'
import { setSesion } from '../lib/sesion'
import { backendV2 } from '../lib/repo'
import { verificarPinV2 } from '../lib/v2'

// Pantalla de acceso con teclado numérico. `soloAdmin` exige rol admin.
// Al validar el PIN contra el padrón, abre sesión en el dispositivo.
export default function PinLogin({ soloAdmin = false, titulo }) {
  const { empleados, local } = useStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false) // false | 'pin' | 'tecnico'

  const pulsa = (d) => { setError(false); setPin(p => (p + d).slice(0, 4)) }
  const borra = () => { setError(false); setPin(p => p.slice(0, -1)) }

  // Al completar 4 dígitos, valida automáticamente.
  // v2: el PIN se verifica EN SERVIDOR contra su hash (nunca viaja el padrón).
  useEffect(() => {
    if (pin.length !== 4) return
    const resolver = backendV2
      ? verificarPinV2(pin, soloAdmin).catch(e => { console.warn('verificar_pin:', e); return { _fallo: e.codigo || e.message } })
      : Promise.resolve(empleadoPorPin(empleados, pin, soloAdmin))
    resolver.then(emp => {
      if (emp && !emp._fallo) { setSesion(emp) }
      else { setError(emp?._fallo ? 'tecnico' : 'pin'); setTimeout(() => setPin(''), 400) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.25rem' }}>
      <div className="anim-pop" style={{ width: '100%', maxWidth: '320px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.5rem 1.4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.1rem' }}>
          <div style={{ fontSize: '2rem' }}>{soloAdmin ? '🔐' : '🔑'}</div>
          {local?.nombre && <div style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 700, marginTop: '0.2rem' }}>{local.nombre}</div>}
          <h1 style={{ fontWeight: 800, fontSize: '1.2rem', marginTop: '0.1rem' }}>{titulo || (soloAdmin ? 'Acceso administrador' : 'Acceso personal')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>Introduce tu PIN</p>
        </div>

        {/* Puntos del PIN */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.7rem', marginBottom: '1.1rem' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: '0.9rem', height: '0.9rem', borderRadius: '9999px',
              background: error ? '#f43f5e' : pin.length > i ? 'var(--color-accent)' : 'transparent',
              border: `2px solid ${error ? '#f43f5e' : pin.length > i ? 'var(--color-accent)' : 'var(--color-border)'}`,
              transition: 'all 0.12s',
            }} />
          ))}
        </div>
        {error && <p style={{ textAlign: 'center', color: '#f43f5e', fontSize: '0.8rem', marginTop: '-0.6rem', marginBottom: '0.8rem' }}>
          {error === 'tecnico' ? 'No se pudo comprobar el PIN (conexión o sesión) — reintenta' : 'PIN incorrecto'}
        </p>}

        {/* Teclado */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} onClick={() => pulsa(d)} style={tecla}>{d}</button>
          ))}
          <div />
          <button onClick={() => pulsa('0')} style={tecla}>0</button>
          <button onClick={borra} style={{ ...tecla, fontSize: '1.3rem' }}>⌫</button>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--color-faint)', fontSize: '0.7rem', marginTop: '1.1rem' }}>
          Demo · admin <b style={{ color: 'var(--color-muted)' }}>1234</b> · camarero <b style={{ color: 'var(--color-muted)' }}>1111</b>
        </p>
      </div>
    </div>
  )
}

const tecla = {
  background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)', padding: '0.9rem 0', cursor: 'pointer', fontWeight: 700, fontSize: '1.3rem',
  boxShadow: 'var(--shadow-sm)',
}
