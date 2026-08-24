import { Component } from 'react'
import { registrar } from '../lib/incidencias'

// ────────────────────────────────────────────────────────────────────────────
// La red de seguridad de la pantalla.
//
// No había ninguna: un fallo de render en cualquier sitio dejaba la tablet EN
// BLANCO en mitad del servicio, sin nada que tocar y sin decir qué hacer. Con
// las rutas cargadas por `lazy()` pasa lo mismo cuando un trozo de la app no
// llega —justo lo que ocurre al recargar una pestaña vieja después de un
// despliegue: el index que tiene en memoria pide ficheros que ya no existen.
//
// Los dos casos se arreglan distinto y por eso se distinguen:
//   · trozo que no carga → recargar trae la versión nueva y se acabó;
//   · error de verdad    → recargar suele bastar, pero conviene poder salir a
//                          la pantalla de inicio sin quedarse encerrado.
// ────────────────────────────────────────────────────────────────────────────

const esChunkQueNoLlega = (e) => {
  const m = `${e?.name || ''} ${e?.message || ''}`
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(m)
}

export default class SiFalla extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error, info) {
    // Que quede en la consola del aparato…
    console.error('Pantalla caída:', error, info?.componentStack)
    // …y también en la base del local, para no depender de que alguien llame.
    // Un trozo que no llega no es una avería: es una versión nueva.
    if (!esChunkQueNoLlega(error)) registrar('render', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const chunk = esChunkQueNoLlega(error)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: '26rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{chunk ? '🔄' : '⚠️'}</div>
          <h1 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: '0.5rem' }}>
            {chunk ? 'Hay una versión nueva' : 'Esta pantalla se ha quedado atascada'}
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            {chunk
              ? 'La app se ha actualizado mientras la tenías abierta. Recarga y sigues donde estabas.'
              : 'No se ha perdido nada de lo que ya estaba enviado. Recarga y continúa; si vuelve a pasar, avisa.'}
          </p>
          <button onClick={() => window.location.reload()} style={{
            width: '100%', background: 'var(--color-accent)', color: '#fff', border: 'none',
            borderRadius: '0.625rem', padding: '0.9rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
          }}>Recargar</button>
          {!chunk && (
            <button onClick={() => { window.location.hash = '#/'; window.location.reload() }} style={{
              width: '100%', background: 'none', color: 'var(--color-muted)', border: 'none',
              padding: '0.75rem', fontSize: '0.85rem', cursor: 'pointer',
            }}>Volver al inicio</button>
          )}
          <details style={{ marginTop: '0.75rem', textAlign: 'left' }}>
            <summary style={{ color: 'var(--color-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>Detalle técnico</summary>
            <pre style={{ fontSize: '0.7rem', color: 'var(--color-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '0.4rem' }}>
              {String(error?.message || error)}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}

export { esChunkQueNoLlega }
