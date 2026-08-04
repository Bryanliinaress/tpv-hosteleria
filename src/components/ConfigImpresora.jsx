import { useState } from 'react'
import { config, guardarConfig, elegirImpresoraUSB, imprimirPrueba, usbDisponible, MODOS } from '../lib/impresora'
import { toast } from '../store/useUI'

// Configuración de impresión por dispositivo (cada terminal puede imprimir
// distinto: la barra por USB, cocina por red…). Vive en Admin → Ajustes.
export default function ConfigImpresora() {
  const [cfg, setCfg] = useState(config)
  const [probando, setProbando] = useState(false)

  const cambiar = (c) => { guardarConfig(c); setCfg(config()) }

  const conectarUSB = async () => {
    try {
      const nombre = await elegirImpresoraUSB()
      setCfg(config())
      toast(`Impresora conectada: ${nombre}`, 'success')
    } catch (e) {
      if (!/cancel/i.test(e.message)) toast(e.message, 'error')
    }
  }

  const probar = async () => {
    setProbando(true)
    const r = await imprimirPrueba()
    setProbando(false)
    if (r.via === 'navegador' || r.via === 'ninguna') toast('Revisa la configuración de la impresora', 'error')
    else toast('Ticket de prueba enviado', 'success')
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1.25rem' }}>
      <h3 style={{ fontWeight: 800, marginBottom: '0.3rem' }}>🖨️ Impresión</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: '0.9rem' }}>
        Cómo imprime <strong>este dispositivo</strong>. Con ESC/POS la comanda sale al instante,
        sin diálogo, y con corte automático.
      </p>

      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.9rem' }}>
        {Object.entries(MODOS).map(([id, nombre]) => {
          const activo = cfg.modo === id
          const noDisponible = id === 'usb' && !usbDisponible()
          return (
            <button key={id} onClick={() => !noDisponible && cambiar({ modo: id })} disabled={noDisponible}
              style={{
                textAlign: 'left', padding: '0.7rem 0.9rem', borderRadius: '0.6rem', cursor: noDisponible ? 'not-allowed' : 'pointer',
                background: activo ? 'var(--tint-success-bg)' : 'var(--color-surface-2)',
                color: activo ? 'var(--tint-success-fg)' : 'var(--color-text)',
                border: `1px solid ${activo ? 'var(--tint-success-bd)' : 'var(--color-border)'}`,
                opacity: noDisponible ? 0.55 : 1,
              }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{activo ? '✓ ' : ''}{nombre}</div>
              <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>
                {id === 'navegador' && 'Compatible con cualquier impresora con driver. Requiere Chrome en modo kiosko para no mostrar el diálogo.'}
                {id === 'usb' && (noDisponible ? 'Tu navegador no permite USB directo: usa Chrome o Edge.' : (cfg.usbNombre || 'Impresora térmica conectada por USB a este equipo.'))}
                {id === 'puente' && 'Impresora de red (Ethernet) a través del puente local. Ver docs/IMPRESION.md.'}
              </div>
            </button>
          )
        })}
      </div>

      {cfg.modo === 'usb' && (
        <button onClick={conectarUSB} style={btn}>🔌 Elegir impresora USB</button>
      )}

      {cfg.modo === 'puente' && (
        <div style={{ marginBottom: '0.6rem' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.25rem' }}>
            Dirección del puente
          </label>
          <input value={cfg.puenteUrl || ''} onChange={e => cambiar({ puenteUrl: e.target.value })}
            placeholder="http://192.168.1.50:9110"
            style={{ width: '100%', background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.6rem 0.8rem', color: 'var(--color-text)', fontSize: '0.9rem' }} />
        </div>
      )}

      <button onClick={probar} disabled={probando || cfg.modo === 'navegador'} style={{ ...btn, opacity: cfg.modo === 'navegador' ? 0.5 : 1 }}>
        {probando ? 'Enviando…' : '🧾 Imprimir ticket de prueba'}
      </button>
    </div>
  )
}

const btn = {
  background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem',
  padding: '0.6rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', marginRight: '0.5rem',
}
