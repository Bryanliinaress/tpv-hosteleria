import { useState } from 'react'
import { loginLocal } from '../../lib/v2'
import { useStore } from '../../store/useStore'

// Login del LOCAL (v2): una vez por dispositivo, con el email del encargado.
// Después el personal cambia de usuario con su PIN (PinLogin), como siempre.
export default function LoginLocal({ onOk }) {
  const local = useStore(s => s.local)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const entrar = async (e) => {
    e.preventDefault()
    setError(''); setCargando(true)
    try {
      await loginLocal(email.trim(), pass)
      onOk?.()
    } catch (ex) {
      setError(/invalid/i.test(ex.message) ? 'Email o contraseña incorrectos' : 'No se pudo iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <form onSubmit={entrar} className="anim-pop" style={{ width: '100%', maxWidth: '360px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.75rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.2rem' }}>🏪</div>
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem', marginTop: '0.25rem' }}>Conectar este dispositivo</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Inicia sesión con la cuenta del local{local?.nombre ? ` (${local.nombre})` : ''}. Solo hace falta una vez por dispositivo.
          </p>
        </div>
        <label style={etiqueta}>Email del local</label>
        <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
               placeholder="encargado@milocal.com" style={inp} autoComplete="username" />
        <label style={etiqueta}>Contraseña</label>
        <input type="password" required value={pass} onChange={e => setPass(e.target.value)}
               placeholder="••••••••" style={inp} autoComplete="current-password" />
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}
        <button type="submit" disabled={cargando} style={{
          width: '100%', background: 'var(--color-accent)', color: '#fff', border: 'none',
          borderRadius: '0.6rem', padding: '0.8rem', cursor: cargando ? 'wait' : 'pointer',
          fontWeight: 700, fontSize: '0.95rem',
        }}>{cargando ? 'Conectando…' : 'Conectar dispositivo'}</button>
      </form>
    </div>
  )
}

const etiqueta = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.3rem' }
const inp = { width: '100%', background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.7rem 0.85rem', color: 'var(--color-text)', fontSize: '0.95rem', marginBottom: '0.9rem' }
