import { useStore } from '../../store/useStore'
import BotonSalir from '../../components/BotonSalir'
import ColaKDS from '../../components/ColaKDS'
import { useAvisoNuevos } from '../../components/useAvisoNuevos'
import { useReloj } from '../../components/useReloj'

const ESTADO = {
  espera: { label: '⏸ En espera', color: '#64748b', next: 'recibido', nextLabel: '▶ Marchar ya' },
  recibido: { label: 'Recibido', color: 'var(--color-warning)', next: 'preparando', nextLabel: 'Preparar' },
  preparando: { label: 'Preparando...', color: 'var(--color-info)', next: 'listo', nextLabel: '✅ Listo' },
  listo: { label: 'Listo ✅', color: 'var(--color-success)', next: null, nextLabel: null },
}

export default function PantallaKDS() {
  const { pedidosCocina, actualizarEstadoCocina } = useStore()
  const activos = pedidosCocina.filter(p => p.estado !== 'listo')
  const listos = pedidosCocina.filter(p => p.estado === 'listo')
  // Una comanda que solo «aparece» puede estar minutos sin que nadie la vea:
  // el cocinero está en la plancha, de espaldas. Suena y destella.
  const { sonido, alternarSonido, destello } = useAvisoNuevos(activos)
  // Cuelga de una pared: si nadie la toca, el reloj y los «hace X min» se
  // quedaban congelados en la hora del último cambio.
  useReloj()

  return (
    <div className="force-dark" style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 'var(--alto-aviso, 0px)', zIndex: 10, background: 'linear-gradient(180deg, var(--tint-success-bg), var(--tint-success-bg))', borderBottom: `2px solid ${destello ? 'var(--color-success)' : 'var(--tint-success-bd)'}`, boxShadow: destello ? '0 0 28px -4px var(--color-success)' : '0 8px 24px -12px rgba(0,0,0,0.7)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'box-shadow 0.25s ease, border-color 0.25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '4px', height: '2.5rem', borderRadius: '9999px', background: 'var(--color-success)', boxShadow: '0 0 14px var(--color-success)' }} />
          <div>
            <h1 style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--color-success)', letterSpacing: '0.02em' }}>🍳 COCINA</h1>
            <p style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>{activos.length} en cola · {listos.length} {listos.length === 1 ? 'listo' : 'listos'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {destello && (
            <span className="pulse-attn" style={{ background: 'var(--color-success)', color: '#04120c', fontWeight: 900, fontSize: '0.85rem', borderRadius: '9999px', padding: '0.35rem 0.9rem', whiteSpace: 'nowrap' }}>
              🔔 COMANDA NUEVA
            </span>
          )}
          <button onClick={alternarSonido} title={sonido ? 'Silenciar el aviso' : 'Activar el aviso'}
            aria-label={sonido ? 'Silenciar el aviso' : 'Activar el aviso'}
            style={{ background: 'transparent', border: '1px solid var(--tint-success-bd)', color: 'var(--color-success)', borderRadius: '0.5rem', minWidth: '2.75rem', minHeight: '2.75rem', fontSize: '1.1rem', cursor: 'pointer' }}>
            {sonido ? '🔔' : '🔕'}
          </button>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <BotonSalir oscuro />
        </div>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
        {/* Columna pendientes */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
            En cola ({activos.length})
          </h2>
          <ColaKDS pedidos={activos} estados={ESTADO} acento="var(--color-success)" onAvanzar={actualizarEstadoCocina} />
        </div>

        {/* Columna listos */}
        {listos.length > 0 && (
          <div style={{ width: '240px' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Listos ({listos.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {listos.map(p => (
                <div key={p.id} style={{ background: 'var(--tint-success-bg)', border: '1px solid var(--tint-success-bd)', borderRadius: '0.625rem', padding: '0.75rem', opacity: 0.85 }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '0.9rem' }}>M{p.mesaNumero} — {p.personaNombre}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>{p.cantidad}× {p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
