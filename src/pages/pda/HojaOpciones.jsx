import { useState } from 'react'
import { normalizarExtra, etiquetasDe } from '../../store/useStore'
import { esMenu, menuCompleto, siguientePendiente, precioMenu, lineaDeMenu, alternarOpcion } from '../../lib/menuDia'

/**
 * Elegir las opciones de un producto antes de añadirlo: el formato y el pan de
 * un montadito, lo que se le quita o se le añade, o los platos de un menú.
 *
 * La usan la PDA (hoja que sube desde abajo, a una mano) y el Mostrador
 * (ventana centrada: en un monitor, una hoja de lado a lado es un cartel). Las
 * cuentas del precio estaban dentro de la PDA; aquí no se duplican.
 *
 * `onAnadir(config)` recibe la línea lista para `agregarItem`.
 */
export default function HojaOpciones({ carta, producto, onAnadir, onCerrar, centrado = false }) {
  const [pers, setPers] = useState(() => ({
    formato: (carta.formatos.find(f => producto.precios?.[f.id] != null) || carta.formatos[0])?.id,
    tipo: carta.tiposPan[0]?.id, quitados: [], anadidos: [], nota: '', elecciones: [],
  }))

  const etiquetas = etiquetasDe(carta)
  const extrasNorm = (carta.extras || []).map(normalizarExtra)
  const precioExtra = (nombre) => extrasNorm.find(x => x.nombre === nombre)?.precio || 0
  const menu = esMenu(producto)
  const precio = menu
    ? precioMenu(producto, pers.elecciones)
    : ((producto.precios?.[pers.formato] ?? 0) + (carta.tiposPan.find(t => t.id === pers.tipo)?.sup || 0) + pers.anadidos.reduce((s, n) => s + precioExtra(n), 0))
  // un menú a medias no se manda: cocina no sabría qué preparar
  const incompleto = !menuCompleto(producto, pers.elecciones)
  const falta = incompleto ? siguientePendiente(producto, pers.elecciones) : null
  const alternar = (clave, val) => setPers(s => ({ ...s, [clave]: s[clave].includes(val) ? s[clave].filter(x => x !== val) : [...s[clave], val] }))

  const anadir = () => {
    if (incompleto) return
    if (menu) { onAnadir(lineaDeMenu(producto, pers.elecciones, pers.nota)); return }
    const fmt = carta.formatos.find(f => f.id === pers.formato)
    const tp = carta.tiposPan.find(t => t.id === pers.tipo)
    onAnadir({
      productoId: producto.id, nombre: producto.nombre, precio, tipo: producto.tipo,
      pan: { formato: pers.formato, tipo: pers.tipo, nombreFormato: fmt?.nombre, nombreTipo: tp?.nombre },
      quitados: pers.quitados, anadidos: pers.anadidos, nota: pers.nota.trim(),
    })
  }

  const chip = { fontSize: centrado ? '0.88rem' : '0.78rem', padding: centrado ? '0.55rem 0.8rem' : '0.3rem 0.6rem', minHeight: centrado ? '44px' : undefined }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: centrado ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 70, padding: centrado ? '2rem' : 0, animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface)', width: '100%', maxWidth: centrado ? '640px' : '520px', maxHeight: centrado ? '85vh' : '88vh',
        display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)',
        ...(centrado
          ? { borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', animation: 'pop 0.18s ease both' }
          : { borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', borderBottom: 'none', boxShadow: '0 -22px 50px -20px rgba(0,0,0,0.8)', animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }),
      }}>
        <div style={{ padding: '1.1rem 1.1rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>
          {!centrado && <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'var(--color-border)', margin: '-0.15rem auto 0.7rem' }} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontWeight: 800, fontSize: centrado ? '1.25rem' : '1.1rem' }}>{producto.nombre}</h3>
            <button onClick={onCerrar} aria-label="Cerrar" style={btn('var(--color-surface-3)', cuadrado)}>✕</button>
          </div>
        </div>

        {/* cuerpo con scroll: el botón de añadir nunca se va de pantalla */}
        <div style={{ padding: '0.9rem 1.1rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Menú del día / combo: elegir de cada grupo (primero, segundo, postre) */}
          {menu && producto.menu.grupos.map((g, gi) => {
            const titulo = g.titulo || `Grupo ${gi + 1}`
            const elegidas = pers.elecciones.filter(e => e.grupo === titulo)
            return (
              <div key={gi} style={{ marginBottom: '0.7rem' }}>
                <p style={lbl}>
                  {titulo}
                  <span style={{ marginLeft: '0.4rem', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    {(g.max ?? 1) > 1 ? `(elige hasta ${g.max})` : ''}
                    {elegidas.length === 0 && <span style={{ color: 'var(--tint-warning-fg)' }}> · elige uno</span>}
                  </span>
                </p>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {(g.opciones || []).map((o, oi) => {
                    const sel = elegidas.some(e => e.opcion === o.nombre)
                    return (
                      <button key={oi} onClick={() => setPers(s => ({ ...s, elecciones: alternarOpcion({ ...g, titulo }, o, s.elecciones) }))}
                        style={btn(sel ? 'var(--color-accent)' : 'var(--color-surface-2)', { fontSize: '0.82rem', padding: '0.5rem 0.75rem', minHeight: centrado ? '44px' : undefined })}>
                        {o.nombre}{o.sup ? ` +${Number(o.sup).toFixed(2)} €` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {!menu && <>
            <p style={lbl}>{etiquetas.formatos}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
              {carta.formatos.filter(f => producto.precios?.[f.id] != null).map(f => (
                <button key={f.id} onClick={() => setPers(s => ({ ...s, formato: f.id }))} style={btn(pers.formato === f.id ? 'var(--color-accent)' : 'var(--color-surface-2)', { flex: 1, minWidth: '7rem', padding: '0.55rem', minHeight: centrado ? '48px' : undefined })}>{f.nombre} · {(producto.precios[f.id] ?? 0).toFixed(2)}€</button>
              ))}
            </div>
            <p style={lbl}>{etiquetas.tiposPan}</p>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              {carta.tiposPan.map(t => (
                <button key={t.id} onClick={() => setPers(s => ({ ...s, tipo: t.id }))} style={btn(pers.tipo === t.id ? '#7c3aed' : 'var(--color-surface-2)', chip)}>{t.nombre}{t.sup > 0 ? ` +${t.sup.toFixed(2)}€` : ''}</button>
              ))}
            </div>
          </>}

          {(producto.ingredientes || []).length > 0 && (
            <>
              <p style={lbl}>Lleva (toca para quitar)</p>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                {producto.ingredientes.map(ing => {
                  const q = pers.quitados.includes(ing)
                  return <button key={ing} onClick={() => alternar('quitados', ing)} style={btn(q ? '#7f1d1d' : 'var(--color-surface-3)', { ...chip, textDecoration: q ? 'line-through' : 'none' })}>{q ? '✕ ' : ''}{ing}</button>
                })}
              </div>
            </>
          )}

          {!menu && extrasNorm.length > 0 && <>
            <p style={lbl}>Añadir {etiquetas.extras.toLowerCase()}</p>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
              {extrasNorm.map(ex => {
                const on = pers.anadidos.includes(ex.nombre)
                return <button key={ex.nombre} onClick={() => alternar('anadidos', ex.nombre)} style={btn(on ? '#065f46' : 'var(--color-surface-2)', chip)}>{on ? '✓ ' : '+ '}{ex.nombre}{ex.precio > 0 ? ` +${ex.precio.toFixed(2)}€` : ''}</button>
              })}
            </div>
          </>}
        </div>

        <div style={{ padding: '0.85rem 1.1rem calc(0.85rem + env(safe-area-inset-bottom))', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={anadir} disabled={incompleto}
            style={btn(incompleto ? 'var(--color-surface-3)' : 'var(--color-accent)', { width: '100%', minHeight: '50px', fontSize: '0.95rem', cursor: incompleto ? 'not-allowed' : 'pointer' })}>
            {incompleto ? `Elige ${falta?.titulo || ''}` : `Añadir · ${precio.toFixed(2)} €`}
          </button>
        </div>
      </div>
    </div>
  )
}

const cuadrado = { width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }
const lbl = { fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }
const btn = (bg, extra = {}) => ({ background: bg, color: /surface|inset|transparent|none|tint-[a-z]+-bg/.test(bg) ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', ...extra })
