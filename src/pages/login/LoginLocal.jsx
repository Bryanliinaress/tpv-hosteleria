import { useState } from 'react'
import { loginLocal, registrarCuenta, miLocal, crearLocal } from '../../lib/v2'
import { useStore } from '../../store/useStore'

// Puerta de entrada del personal (v2): iniciar sesión con la cuenta del local
// o registrar un negocio nuevo. Una vez por dispositivo; después se usa el PIN.
export default function LoginLocal({ onOk }) {
  const local = useStore(s => s.local)
  const [modo, setModo] = useState('entrar')      // entrar | registrar | crear-local
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [nombreLocal, setNombreLocal] = useState('')
  const [pinAdmin, setPinAdmin] = useState('1234')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const traducir = (m) => {
    if (/invalid login/i.test(m)) return 'Email o contraseña incorrectos'
    if (/already registered/i.test(m)) return 'Ese email ya tiene cuenta: inicia sesión'
    if (/password/i.test(m) && /6/.test(m)) return 'La contraseña debe tener al menos 6 caracteres'
    if (/ya_tiene_local/.test(m)) return 'Esta cuenta ya tiene un local'
    if (/pin_corto/.test(m)) return 'El PIN debe tener al menos 4 dígitos'
    if (/nombre_requerido/.test(m)) return 'Escribe el nombre del local'
    return 'No se pudo completar la operación'
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError(''); setAviso(''); setCargando(true)
    try {
      if (modo === 'entrar') {
        await loginLocal(email.trim(), pass)
        // si la cuenta aún no tiene local, se pide crearlo
        const yaTiene = await miLocal().catch(() => null)
        if (!yaTiene) { setModo('crear-local'); return }
        onOk?.()
      } else if (modo === 'registrar') {
        const { requiereConfirmacion } = await registrarCuenta(email.trim(), pass)
        if (requiereConfirmacion) {
          setAviso('Te hemos enviado un email para confirmar la cuenta. Confírmalo y vuelve a entrar.')
          setModo('entrar')
        } else {
          setModo('crear-local')
        }
      } else {
        await crearLocal(nombreLocal.trim(), pinAdmin.trim())
        onOk?.()
      }
    } catch (ex) {
      setError(traducir(ex.codigo || ex.message || ''))
    } finally {
      setCargando(false)
    }
  }

  const titulos = {
    entrar: ['🏪', 'Conectar este dispositivo', `Inicia sesión con la cuenta del local${local?.nombre ? ` (${local.nombre})` : ''}. Solo hace falta una vez por dispositivo.`],
    registrar: ['🚀', 'Crear cuenta', 'Da de alta tu negocio. Después configurarás la sala y la carta.'],
    'crear-local': ['🍽', 'Tu local', 'Ponle nombre a tu negocio y elige el PIN del encargado.'],
  }
  const [emoji, titulo, subtitulo] = titulos[modo]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <form onSubmit={enviar} className="anim-pop" style={{ width: '100%', maxWidth: '380px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '1.75rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.2rem' }}>{emoji}</div>
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem', marginTop: '0.25rem' }}>{titulo}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>{subtitulo}</p>
        </div>

        {modo !== 'crear-local' ? (
          <>
            <label style={etiqueta}>Email {modo === 'registrar' ? 'del negocio' : 'del local'}</label>
            <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                   placeholder="encargado@milocal.com" style={inp} autoComplete="username" />
            <label style={etiqueta}>Contraseña</label>
            <input type="password" required value={pass} onChange={e => setPass(e.target.value)}
                   placeholder="••••••••" style={inp}
                   autoComplete={modo === 'registrar' ? 'new-password' : 'current-password'} />
          </>
        ) : (
          <>
            <label style={etiqueta}>Nombre del local</label>
            <input required autoFocus value={nombreLocal} onChange={e => setNombreLocal(e.target.value)}
                   placeholder="Bar Manolo" maxLength={60} style={inp} />
            <label style={etiqueta}>PIN del encargado (4 dígitos)</label>
            <input required value={pinAdmin} onChange={e => setPinAdmin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                   inputMode="numeric" placeholder="1234" style={inp} />
          </>
        )}

        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}
        {aviso && <p style={{ color: 'var(--tint-success-fg)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>✅ {aviso}</p>}

        <button type="submit" disabled={cargando} style={{
          width: '100%', background: 'var(--color-accent)', color: '#fff', border: 'none',
          borderRadius: '0.6rem', padding: '0.8rem', cursor: cargando ? 'wait' : 'pointer',
          fontWeight: 700, fontSize: '0.95rem',
        }}>
          {cargando ? 'Un momento…'
            : modo === 'entrar' ? 'Conectar dispositivo'
            : modo === 'registrar' ? 'Crear cuenta'
            : 'Crear mi local'}
        </button>

        {modo !== 'crear-local' && (
          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.9rem' }}>
            {modo === 'entrar' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button type="button" onClick={() => { setModo(modo === 'entrar' ? 'registrar' : 'entrar'); setError(''); setAviso('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.82rem' }}>
              {modo === 'entrar' ? 'Da de alta tu negocio' : 'Inicia sesión'}
            </button>
          </p>
        )}
      </form>
    </div>
  )
}

const etiqueta = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.3rem' }
const inp = { width: '100%', background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.7rem 0.85rem', color: 'var(--color-text)', fontSize: '0.95rem', marginBottom: '0.9rem' }
