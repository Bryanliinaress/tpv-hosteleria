import { useUI } from '../store/useUI'

// Botón para alternar tema claro/oscuro. La preferencia es por dispositivo
// (se guarda en localStorage) y afecta a todas las pantallas de este equipo.
export default function TemaToggle({ compacto = false }) {
  const tema = useUI(s => s.tema)
  const toggleTema = useUI(s => s.toggleTema)
  const claro = tema === 'claro'
  return (
    <button
      onClick={toggleTema}
      title={claro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      aria-label={claro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: compacto ? 0 : '0.5rem',
        background: 'var(--color-surface-2)', color: 'var(--color-text)',
        border: '1px solid var(--color-border)', borderRadius: '9999px',
        padding: compacto ? '0.5rem' : '0.5rem 0.9rem', cursor: 'pointer',
        fontSize: '0.85rem', fontWeight: 600, lineHeight: 1,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span style={{ fontSize: '1.05rem' }}>{claro ? '🌙' : '☀️'}</span>
      {!compacto && <span>{claro ? 'Modo oscuro' : 'Modo claro'}</span>}
    </button>
  )
}
