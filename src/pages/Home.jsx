import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import TemaToggle from '../components/TemaToggle'
import { perfil, urlLogo, esDemo } from '../lib/perfil'
import { PRODUCTO } from '../lib/producto'

const grupos = (mesa1) => [
  {
    titulo: 'Cliente',
    roles: [
      { label: 'Mesa 1 (QR)', path: `/mesa/${mesa1}`, emoji: '📱', color: 'var(--color-info)', desc: 'Carta y autopedido desde el móvil' },
      { label: 'Reservar mesa', path: '/reservar', emoji: '📅', color: '#0ea5e9', desc: 'Reserva online estilo CoverManager' },
    ],
  },
  {
    titulo: 'Personal de sala',
    roles: [
      { label: 'PDA Camarero', path: '/pda', emoji: '📟', color: '#06b6d4', desc: 'Móvil de mano: avisos y mesas' },
      { label: 'Mostrador · TPV', path: '/camarero', emoji: '🧑‍🍳', color: 'var(--color-warning)', desc: 'Terminal fijo: sala, pedidos y cobro' },
    ],
  },
  {
    titulo: 'Producción',
    roles: [
      { label: 'Pantalla Cocina', path: '/cocina', emoji: '🍳', color: 'var(--color-success)', desc: 'KDS — pedidos de comida' },
      { label: 'Pantalla Barra', path: '/barra', emoji: '🍺', color: 'var(--color-danger)', desc: 'KDS — pedidos de bebida' },
      { label: 'Estación de impresión', path: '/print', emoji: '🖨️', color: '#94a3b8', desc: 'Imprime comandas en automático' },
    ],
  },
  {
    titulo: 'Gestión',
    roles: [
      { label: 'Panel Admin', path: '/admin', emoji: '🛠', color: '#8b5cf6', desc: 'Carta, mesas, caja y estadísticas' },
    ],
  },
]

export default function Home() {
  const navigate = useNavigate()
  const local = useStore(s => s.local)
  // el id de la primera mesa depende del backend (v1: 'mesa-1'; v2: uuid real)
  const mesa1 = useStore(s => s.mesas[0]?.id) || 'mesa-1'
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3.5rem 1.5rem 3rem' }}>
      <div className="anim-fade" style={{ width: '100%', maxWidth: '980px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <TemaToggle />
        </div>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
          {/* Con logo, el titular dice el PRODUCTO, no el bar: el logo ya
              dice de quién es la casa y repetirlo debajo era decir «Casa Loli»
              dos veces seguidas. Sin logo, el titular sigue siendo el nombre
              del local, que si no no aparecería en ninguna parte. */}
          {/* El logo manda su proporción: el de un bar suele ser una palabra
              larga («Casa Loli»), no un cuadrado. Metido en una caja cuadrada
              de 68 px, el texto quedaba a tres píxeles de alto e ilegible. Con
              la altura fija y el ancho libre, un logo cuadrado sigue saliendo
              cuadrado y uno alargado se extiende. El marco solo se pinta
              cuando NO hay logo: una palabra enmarcada no queda bien. */}
          {urlLogo()
            ? <img
                src={urlLogo()} alt={perfil.nombre}
                style={{
                  display: 'block', margin: '0 auto 1.1rem',
                  height: '4.25rem', width: 'auto',
                  maxWidth: 'min(20rem, 72vw)', objectFit: 'contain',
                }}
              />
            : <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '4.25rem', height: '4.25rem', fontSize: '2.25rem', marginBottom: '1.1rem',
                background: 'linear-gradient(145deg, color-mix(in srgb, var(--color-accent) 18%, transparent), color-mix(in srgb, var(--color-accent) 4%, transparent))',
                border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
                borderRadius: '1.25rem',
                boxShadow: '0 10px 30px -10px color-mix(in srgb, var(--color-accent) 50%, transparent)',
                overflow: 'hidden',
              }}>{perfil.emoji}</div>}
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 2.75rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05,
            background: 'linear-gradient(120deg, var(--color-text) 25%, var(--color-accent))', WebkitBackgroundClip: 'text',
            backgroundClip: 'text', color: 'transparent', marginBottom: '0.6rem',
          }}>{urlLogo() ? PRODUCTO : perfil.nombre}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '1rem', maxWidth: '34rem', margin: '0 auto' }}>
            {perfil.descripcion}
          </p>
        </div>

        {/* Banner de configuración inicial */}
        {!local?.onboarded && (
          <button onClick={() => navigate('/setup')} style={{
            display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', textAlign: 'left',
            background: 'linear-gradient(120deg, color-mix(in srgb, var(--color-accent) 16%, transparent), color-mix(in srgb, var(--color-accent) 5%, transparent))',
            border: '1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)', borderRadius: 'var(--radius-lg)',
            padding: '1.1rem 1.3rem', cursor: 'pointer', marginBottom: '1.75rem',
            boxShadow: '0 10px 30px -12px color-mix(in srgb, var(--color-accent) 40%, transparent)',
          }}>
            <span style={{ fontSize: '1.8rem' }}>🚀</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 800, color: 'var(--color-text)' }}>Configura tu local en 15 minutos</span>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-muted)' }}>Nombre, sala, personal y carta — el asistente te guía paso a paso.</span>
            </span>
            <span style={{ color: 'var(--color-accent)', fontSize: '1.2rem' }}>→</span>
          </button>
        )}

        {/* Grupos de roles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {grupos(mesa1).map(g => (
            <div key={g.titulo}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-faint)', marginBottom: '0.75rem', paddingLeft: '0.15rem' }}>
                {g.titulo}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.9rem' }}>
                {g.roles.map(r => (
                  <button
                    key={r.path}
                    onClick={() => navigate(r.path)}
                    style={{
                      position: 'relative', overflow: 'hidden',
                      background: 'var(--color-surface)',
                      border: `1px solid var(--color-border)`,
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.25rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                    }}
                    onMouseEnter={e => { const c = e.currentTarget; c.style.transform = 'translateY(-4px)'; c.style.borderColor = r.color; c.style.boxShadow = `0 16px 34px -14px ${r.color}99` }}
                    onMouseLeave={e => { const c = e.currentTarget; c.style.transform = 'none'; c.style.borderColor = 'var(--color-border)'; c.style.boxShadow = 'var(--shadow-sm)' }}
                  >
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '2.75rem', height: '2.75rem', fontSize: '1.4rem', marginBottom: '0.85rem',
                      background: `${r.color}1f`, borderRadius: '0.75rem',
                    }}>{r.emoji}</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.2rem', fontSize: '0.98rem' }}>{r.label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', lineHeight: 1.4 }}>{r.desc}</div>
                    {/* La flecha es un adorno, no información: el color de la tarjeta ya
                        lo dice el icono. En claro, ese color al 55% se quedaba en 2,4
                        de contraste. */}
                    <span style={{ position: 'absolute', top: '1.1rem', right: '1.2rem', color: 'var(--color-muted)', fontSize: '1.1rem' }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: '2.75rem', fontSize: '0.75rem', color: 'var(--color-faint)', textAlign: 'center' }}>
          v{__VERSION__}{esDemo() ? ' · Demostración' : ''}
        </p>
      </div>
    </div>
  )
}
