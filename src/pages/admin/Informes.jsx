import { useEffect, useState } from 'react'
import { useStore, METODO_LABEL, METODO_EMOJI } from '../../store/useStore'
import { PERIODOS, rangoDe, nombreDe } from '../../lib/periodos'

// ────────────────────────────────────────────────────────────────────────────
// Informes de ventas.
//
// Los calcula el SERVIDOR (`informe_ventas`), no el navegador. Antes se hacían
// sobre el historial descargado, y eso traía dos cosas:
//
//   · solo se veía el mes en curso —y desde que el historial va por ventana, ni
//     eso: el día 1 de mes esta pantalla salía vacía—;
//   · las devoluciones ensuciaban los rankings: una rectificativa aparecía como
//     un producto llamado «Devolución (IVA 10%)», sumaba un comensal que nunca
//     existió y contaba como ticket, hundiendo el medio.
//
// Gráficas con CSS, sin librerías: esto se abre en el móvil del dueño a media
// tarde y no vale la pena cargar 200 kB para cuatro barras.
// ────────────────────────────────────────────────────────────────────────────

export default function Informes({ moneda = '€' }) {
  const informeVentas = useStore(s => s.informeVentas)
  const [periodo, setPeriodo] = useState('hoy')
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    const { desde, hasta } = rangoDe(periodo)
    informeVentas({ desde, hasta }).then(r => {
      if (!vigente) return          // el usuario ya cambió de periodo
      setDatos(r); setCargando(false)
    })
    return () => { vigente = false }
  }, [periodo, informeVentas])

  const f = (n) => `${Number(n || 0).toFixed(2)} ${moneda}`
  const r = datos?.resumen

  return (
    <div>
      {/* Periodo: lo primero, porque cambia todo lo de debajo */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)} style={{
            background: periodo === p.id ? 'var(--color-accent)' : 'var(--color-surface-2)',
            color: periodo === p.id ? '#fff' : 'var(--color-text)',
            border: `1px solid ${periodo === p.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: '9999px', padding: '0.4rem 0.9rem', minHeight: '40px',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: periodo === p.id ? 700 : 500,
          }}>{p.etiqueta}</button>
        ))}
        {datos && (
          <button onClick={() => descargarCSV(datos, periodo, moneda)} style={{
            marginLeft: 'auto', background: 'var(--color-surface-2)', color: 'var(--color-muted)',
            border: '1px solid var(--color-border)', borderRadius: '0.5rem',
            padding: '0.4rem 0.8rem', minHeight: '40px', cursor: 'pointer', fontSize: '0.8rem',
          }}>⭳ CSV</button>
        )}
      </div>

      {cargando && <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Calculando…</p>}

      {!cargando && !datos && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
          Los informes necesitan el backend real: en la demo no hay ventas que resumir.
        </div>
      )}

      {!cargando && datos && r && r.tickets === 0 && r.devoluciones === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
          Sin ventas en {nombreDe(periodo)}.
        </div>
      )}

      {!cargando && datos && r && (r.tickets > 0 || r.devoluciones > 0) && (<>
        {/* La cifra grande: lo que se queda el bar */}
        <div style={{ ...card, marginBottom: '1rem', borderColor: 'var(--color-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <h3 style={{ ...titulo, marginBottom: 0, textTransform: 'capitalize' }}>{nombreDe(periodo)}</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-faint)' }}>{datos.zona}</span>
          </div>
          <div style={{ fontWeight: 900, fontSize: 'clamp(1.9rem, 9vw, 2.6rem)', color: 'var(--color-accent)', lineHeight: 1 }}>
            {f(r.neto)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1.1rem', marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            <span><strong style={{ color: 'var(--color-text)' }}>{r.tickets}</strong> tickets</span>
            <span>medio <strong style={{ color: 'var(--color-text)' }}>{f(r.medio)}</strong></span>
            <span><strong style={{ color: 'var(--color-text)' }}>{r.comensales}</strong> comensales</span>
            {r.propinas > 0 && <span>propinas <strong style={{ color: '#10b981' }}>{f(r.propinas)}</strong></span>}
          </div>
          {/* Las devoluciones no se esconden: es dinero que salió */}
          {r.devuelto > 0 && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: 'var(--tint-warning-fg)' }}>
              ↩ {r.devoluciones} devolución(es) · −{f(r.devuelto)} · vendido {f(r.bruto)} antes de devolver
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 20rem), 1fr))', gap: '1.25rem', alignItems: 'start' }}>
          <Grafico titulo="Ventas por hora" datos={datos.por_hora} clave="hora"
            etiqueta={h => `${h}h`} moneda={moneda} color="linear-gradient(180deg, #22d3ee, #06b6d4)" />

          <Grafico titulo="Ventas por día" datos={datos.por_dia} clave="dia"
            etiqueta={d => new Date(`${d}T00:00:00`).getDate()} moneda={moneda}
            color="linear-gradient(180deg, var(--color-accent-2), var(--color-accent))" />

          <Lista titulo="Top productos" filas={(datos.por_producto || []).slice(0, 8)}
            etiqueta={p => `${p.nombre} · ${Number(p.uds)} uds`} color="#3b82f6" moneda={moneda} />

          <Lista titulo="Ventas por camarero" pie="Quien atendió la mesa"
            filas={datos.por_camarero} color="#10b981" moneda={moneda}
            etiqueta={c => `👤 ${c.nombre} · ${c.tickets} tickets`} />

          <Lista titulo="Cobrado por" pie="Quien estaba en la caja al cerrar"
            filas={datos.por_cobrador} color="#f59e0b" moneda={moneda}
            etiqueta={c => `💶 ${c.nombre} · ${c.tickets} tickets`} />

          <Lista titulo="Método de pago" filas={datos.por_metodo} color="#8b5cf6" moneda={moneda}
            etiqueta={m => `${METODO_EMOJI[m.metodo] || '💰'} ${METODO_LABEL[m.metodo] || m.metodo}`} />
        </div>
      </>)}
    </div>
  )
}

// Barras verticales para lo que va en orden (horas, días).
function Grafico({ titulo: t, datos, clave, etiqueta, moneda, color }) {
  const filas = datos || []
  if (!filas.length) return null
  const max = Math.max(1, ...filas.map(x => Math.abs(Number(x.importe))))
  return (
    <div style={card}>
      <h3 style={titulo}>{t}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px' }}>
        {filas.map(x => (
          <div key={x[clave]} title={`${etiqueta(x[clave])} · ${Number(x.importe).toFixed(2)} ${moneda} · ${x.tickets} tickets`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ height: `${Math.max(4, Math.abs(Number(x.importe)) / max * 100)}%`, background: color, borderRadius: '3px 3px 0 0' }} />
            <div style={{ fontSize: '0.6rem', color: 'var(--color-faint)', textAlign: 'center', marginTop: '2px' }}>
              {filas.length <= 12 ? etiqueta(x[clave]) : ' '}
            </div>
          </div>
        ))}
      </div>
      {filas.length > 12 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--color-faint)' }}>
          <span>{etiqueta(filas[0][clave])}</span><span>{etiqueta(filas[filas.length - 1][clave])}</span>
        </div>
      )}
    </div>
  )
}

// Barras horizontales para rankings.
function Lista({ titulo: t, filas, etiqueta, color, moneda, pie }) {
  const xs = filas || []
  if (!xs.length) return null
  const max = Math.max(1, ...xs.map(x => Math.abs(Number(x.importe))))
  return (
    <div style={card}>
      <h3 style={{ ...titulo, marginBottom: pie ? '0.15rem' : '0.75rem' }}>{t}</h3>
      {pie && <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.65rem' }}>{pie}</p>}
      {xs.map((x, i) => (
        <div key={i} style={{ marginBottom: '0.55rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>{etiqueta(x)}</span>
            <strong style={{ whiteSpace: 'nowrap' }}>{Number(x.importe).toFixed(2)} {moneda}</strong>
          </div>
          <div style={{ background: 'var(--color-inset)', borderRadius: '9999px', height: '0.55rem', overflow: 'hidden' }}>
            <div style={{ width: `${Math.abs(Number(x.importe)) / max * 100}%`, height: '100%', background: color, borderRadius: '9999px', transition: 'width 0.3s' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// El CSV es para llevárselo al gestor, así que va con `;` y BOM: Excel en
// español abre bien así y con comas mete todo en una columna.
function descargarCSV(datos, periodo, moneda) {
  const filas = [['Informe', nombreDe(periodo)], ['Moneda', moneda], []]
  const bloque = (titulo, cabecera, xs, fila) => {
    filas.push([titulo], cabecera)
    for (const x of xs || []) filas.push(fila(x))
    filas.push([])
  }
  const r = datos.resumen
  bloque('Resumen', ['Concepto', 'Valor'], [
    ['Tickets', r.tickets], ['Vendido', r.bruto], ['Devuelto', r.devuelto],
    ['Neto', r.neto], ['Propinas', r.propinas], ['Comensales', r.comensales], ['Ticket medio', r.medio],
  ], x => x)
  bloque('Productos', ['Producto', 'Uds', 'Importe'], datos.por_producto, p => [p.nombre, p.uds, p.importe])
  bloque('Camarero (atendió)', ['Camarero', 'Tickets', 'Importe', 'Propinas'], datos.por_camarero, c => [c.nombre, c.tickets, c.importe, c.propinas])
  bloque('Cobrado por', ['Persona', 'Tickets', 'Importe'], datos.por_cobrador, c => [c.nombre, c.tickets, c.importe])
  bloque('Por hora', ['Hora', 'Tickets', 'Importe'], datos.por_hora, h => [`${h.hora}:00`, h.tickets, h.importe])
  bloque('Por día', ['Día', 'Tickets', 'Importe'], datos.por_dia, d => [d.dia, d.tickets, d.importe])
  bloque('Método de pago', ['Método', 'Importe'], datos.por_metodo, m => [METODO_LABEL[m.metodo] || m.metodo, m.importe])

  const csv = filas.map(f => f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `informe-${periodo}.csv`; a.click()
  URL.revokeObjectURL(url)
}

const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }
const titulo = { fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }
