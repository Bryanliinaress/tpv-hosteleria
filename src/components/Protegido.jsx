import { useState, useEffect } from 'react'
import { useEmpleadoActual } from '../lib/sesion'
import PinLogin from './PinLogin'
import { backendV2 } from '../lib/repo'
import { haySesionLocal } from '../lib/v2'
import LoginLocal from '../pages/login/LoginLocal'

// Envuelve una pantalla y exige sesión de personal. `rol="admin"` exige
// administrador; por defecto vale cualquier empleado activo (camarero o admin).
// En v2, ANTES del PIN el dispositivo debe estar conectado al local (Supabase
// Auth) — una vez por dispositivo.
export default function Protegido({ rol = 'staff', children }) {
  const emp = useEmpleadoActual()
  const [sesionLocal, setSesionLocal] = useState(backendV2 ? null : true) // null = comprobando
  useEffect(() => {
    if (backendV2) haySesionLocal().then(setSesionLocal)
  }, [])

  if (backendV2 && sesionLocal === null) return null            // comprobando sesión
  if (backendV2 && !sesionLocal) return <LoginLocal onOk={() => setSesionLocal(true)} />

  const ok = emp && (rol !== 'admin' || emp.rol === 'admin')
  if (!ok) return <PinLogin soloAdmin={rol === 'admin'} />
  return children
}
