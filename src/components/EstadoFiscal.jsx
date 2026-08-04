import { useState, useEffect, useCallback } from 'react'
import { fiscalActivo, pendientesFiscales, reintentarPendientes } from '../lib/fiscal'
import { toast } from '../store/useUI'

// Aviso del estado de Verifactu en Admin → Tickets: qué tickets no han llegado
// a la AEAT y botón para reintentarlos. Si el registro fiscal no está activado,
// no se muestra nada.
export default function EstadoFiscal() {
  const [pendientes, setPendientes] = useState([])
  const [cargando, setCargando] = useState(false)

  const refrescar = useCallback(async () => {
    setPendientes(await pendientesFiscales())
  }, [])

  useEffect(() => { if (fiscalActivo) refrescar() }, [refrescar])

  if (!fiscalActivo) return null

  const reintentar = async () => {
    setCargando(true)
    const r = await reintentarPendientes()
    await refrescar()
    setCargando(false)
    toast(r?.procesados ? `Reintentados ${r.procesados} ticket(s)` : 'Nada que reintentar', 'info')
  }

  const conError = pendientes.filter(p => p.fiscal_estado === 'error')

  return (
    <div style={{
      background: pendientes.length ? 'var(--tint-warning-bg)' : 'var(--tint-success-bg)',
      color: pendientes.length ? 'var(--tint-warning-fg)' : 'var(--tint-success-fg)',
      border: `1px solid ${pendientes.length ? 'var(--tint-warning-bd)' : 'var(--tint-success-bd)'}`,
      borderRadius: 'var(--radius)', padding: '0.8rem 1rem', marginBottom: '1.25rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '1.1rem' }}>{pendientes.length ? '⚠️' : '✅'}</span>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
          {pendientes.length
            ? `${pendientes.length} ticket(s) sin registrar en Hacienda`
            : 'Todos los tickets registrados en Hacienda (Veri*Factu)'}
        </div>
        {conError.length > 0 && (
          <div style={{ fontSize: '0.78rem', marginTop: '0.2rem', opacity: 0.9 }}>
            Último motivo: {conError[0].fiscal_error || 'error desconocido'}
          </div>
        )}
      </div>
      {pendientes.length > 0 && (
        <button onClick={reintentar} disabled={cargando} style={{
          background: 'var(--color-accent)', color: '#fff', border: 'none',
          borderRadius: '0.5rem', padding: '0.5rem 0.9rem', cursor: cargando ? 'wait' : 'pointer',
          fontWeight: 700, fontSize: '0.82rem',
        }}>{cargando ? 'Enviando…' : '↻ Reintentar envío'}</button>
      )}
    </div>
  )
}
