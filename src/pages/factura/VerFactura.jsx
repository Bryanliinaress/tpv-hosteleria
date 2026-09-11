import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import FacturaPapel from '../../components/FacturaPapel'
import { numeroDeFactura } from '../../lib/factura'

/**
 * La factura desde el enlace del correo: `#/factura?t=<token>`.
 *
 * La abre el cliente —o su gestoría— sin sesión, en el móvil o en el
 * ordenador, para verla, imprimirla o guardarla como PDF desde el propio
 * diálogo de imprimir. El servidor solo devuelve la factura de ese token.
 *
 * En la demo no hay servidor: se busca en las facturas del propio navegador,
 * que es donde se emitió.
 */
export default function VerFactura() {
  const [params] = useSearchParams()
  const token = params.get('t') || ''
  const [estado, setEstado] = useState({ cargando: true, factura: null })

  useEffect(() => {
    let vivo = true
    const local = (useStore.getState().facturas || []).find(f => f.token === token)
    if (local || !supabase || token.length < 32) {
      setEstado({ cargando: false, factura: local || null })
      return
    }
    supabase.rpc('factura_por_token', { p_token: token }).then(({ data }) => {
      if (vivo) setEstado({ cargando: false, factura: data || null })
    }).catch(() => { if (vivo) setEstado({ cargando: false, factura: null }) })
    return () => { vivo = false }
  }, [token])

  useEffect(() => {
    if (estado.factura) document.title = `Factura ${numeroDeFactura(estado.factura)}`
  }, [estado.factura])

  if (estado.cargando) return <div style={centro}>Cargando la factura…</div>
  if (!estado.factura) {
    return (
      <div style={centro}>
        <div style={{ fontSize: '2.5rem' }}>🧾</div>
        <h1 style={{ fontWeight: 800, fontSize: '1.2rem', margin: '0.5rem 0' }}>No encontramos esta factura</h1>
        <p style={{ color: '#52525b', maxWidth: '26rem' }}>Comprueba que el enlace está completo. Si lo copiaste del correo, a veces se corta al final: pide al local que te la reenvíe.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#e4e4e7', padding: '1rem' }}>
      <div className="no-print" style={{ maxWidth: '820px', margin: '0 auto 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, color: '#18181b' }}>Factura {numeroDeFactura(estado.factura)}</div>
        <button onClick={() => window.print()} style={{ background: '#18181b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1rem', fontWeight: 700, cursor: 'pointer' }}>
          🖨️ Imprimir o guardar en PDF
        </button>
      </div>
      <div className="factura-print" style={{ maxWidth: '820px', margin: '0 auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', borderRadius: '6px', overflow: 'hidden' }}>
        <FacturaPapel factura={estado.factura} />
      </div>
    </div>
  )
}

const centro = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', background: '#fafafa', color: '#18181b' }
