import { useState, useEffect } from 'react'
import { useEmpleadoActual, clearSesion } from '../lib/sesion'
import PinLogin from './PinLogin'
import { backendV2 } from '../lib/repo'
import { haySesionLocal } from '../lib/v2'
import { anotarPantalla } from '../lib/v2/dispositivo'
import LoginLocal from '../pages/login/LoginLocal'
import PedirAcceso from '../pages/login/PedirAcceso'
import { esLocalMontado } from '../lib/perfil'
import { puedeAbrir, pantallaInicial, nombreRol, PANTALLAS } from '../lib/roles'

// Envuelve una pantalla y exige sesión de personal. `pantalla` dice CUÁL es
// (una clave de `PANTALLAS`): quién la abre lo decide el rol, en `lib/roles.js`.
// Sin `pantalla`, vale cualquier empleado activo.
// En v2, ANTES del PIN el dispositivo debe estar conectado al local (Supabase
// Auth) — una vez por dispositivo.
export default function Protegido({ pantalla, children }) {
  const emp = useEmpleadoActual()
  const [sesionLocal, setSesionLocal] = useState(backendV2 ? null : true) // null = comprobando
  useEffect(() => {
    if (backendV2) haySesionLocal().then(setSesionLocal)
  }, [])

  // Deja anotado para qué se usa este aparato. Con cuatro tablets iguales, lo
  // que las distingue no es el nombre que alguien tecleó una vez: es que una
  // lleva semanas abierta en el KDS de cocina.
  useEffect(() => {
    if (backendV2 && sesionLocal) anotarPantalla(pantalla)
  }, [pantalla, sesionLocal])

  if (backendV2 && sesionLocal === null) return null            // comprobando sesión
  if (backendV2 && !sesionLocal) {
    // En un bar ya montado no hay credenciales que teclear: el aparato pide
    // permiso y lo autoriza el encargado. El login con correo y contraseña
    // solo queda para el build genérico, que es el que da de alta un negocio
    // desde cero.
    return esLocalMontado()
      ? <PedirAcceso onOk={() => setSesionLocal(true)} />
      : <LoginLocal onOk={() => setSesionLocal(true)} />
  }

  // Sin nadie identificado: el teclado del PIN.
  if (!emp) return <PinLogin soloAdmin={pantalla === 'admin'} />

  // Identificado pero sin permiso. Volver a enseñar el teclado del PIN sería
  // decirle «vuelve a escribirlo» a quien ya lo ha escrito bien: el cocinero
  // lo teclearía tres veces antes de entender que su PIN no abre el Mostrador.
  if (!puedeAbrir(emp.rol, pantalla)) return <SinPermiso emp={emp} pantalla={pantalla} />

  return children
}

function SinPermiso({ emp, pantalla }) {
  const suya = pantallaInicial(emp.rol)
  const nombrePantalla = PANTALLAS[pantalla]?.label || 'esta pantalla'
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: '1.5rem', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem' }}>🔒</div>
        <h1 style={{ fontWeight: 800, fontSize: '1.2rem', margin: '0.5rem 0' }}>{nombrePantalla} no es para tu PIN</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Has entrado como <strong>{emp.nombre}</strong> ({nombreRol(emp.rol)}).
          Si te hace falta, que un encargado te cambie el rol en Admin → Personal.
        </p>
        <a href={`#${suya.ruta}`} style={{ display: 'block', background: 'var(--color-accent)', color: '#fff', borderRadius: '0.55rem', padding: '0.8rem', marginTop: '1rem', textDecoration: 'none', fontWeight: 700 }}>
          Ir a {suya.label}
        </a>
        <button onClick={() => { clearSesion(); window.location.reload() }}
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.55rem', padding: '0.7rem', marginTop: '0.5rem', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
          Entrar con otro PIN
        </button>
      </div>
    </div>
  )
}
