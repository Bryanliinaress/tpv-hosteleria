import { useEmpleadoActual, clearSesion } from '../lib/sesion'

// Chip con el empleado conectado + botón de cerrar sesión, para las cabeceras
// de las pantallas de personal. `oscuro` para las pantallas KDS (fondo negro).
export default function BotonSalir({ oscuro = false }) {
  const emp = useEmpleadoActual()
  if (!emp) return null
  return (
    <button
      onClick={clearSesion}
      title="Cerrar sesión"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        background: oscuro ? 'rgba(255,255,255,0.06)' : 'var(--color-surface-2)',
        color: oscuro ? '#e2e8f0' : 'var(--color-text)',
        border: `1px solid ${oscuro ? 'rgba(255,255,255,0.12)' : 'var(--color-border)'}`,
        borderRadius: '9999px', padding: '0.3rem 0.7rem', cursor: 'pointer',
        fontSize: '0.78rem', fontWeight: 600,
      }}
    >
      <span style={{ opacity: 0.85 }}>{emp.rol === 'admin' ? '🔐' : '👤'} {emp.nombre}</span>
      <span style={{ opacity: 0.7 }}>⎋</span>
    </button>
  )
}
