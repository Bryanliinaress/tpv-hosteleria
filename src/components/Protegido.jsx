import { useEmpleadoActual } from '../lib/sesion'
import PinLogin from './PinLogin'

// Envuelve una pantalla y exige sesión de personal. `rol="admin"` exige
// administrador; por defecto vale cualquier empleado activo (camarero o admin).
export default function Protegido({ rol = 'staff', children }) {
  const emp = useEmpleadoActual()
  const ok = emp && (rol !== 'admin' || emp.rol === 'admin')
  if (!ok) return <PinLogin soloAdmin={rol === 'admin'} />
  return children
}
