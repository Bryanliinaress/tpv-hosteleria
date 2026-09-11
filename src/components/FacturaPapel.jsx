import { QRCodeSVG } from 'qrcode.react'
import { numeroDeFactura } from '../lib/factura'

const euros = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

/**
 * La factura, tal como se imprime en A4 y se ve desde el enlace del correo.
 *
 * Solo pinta: la usan el modal de Admin/Mostrador y la página pública. Lleva lo
 * que exige una factura completa (RD 1619/2012, art. 6): número y serie, fecha,
 * emisor y destinatario con NIF y domicilio, descripción, base, tipo y cuota
 * por cada tipo de IVA, y total. Y dice a qué ticket sustituye, que es lo que
 * explica por qué el mismo gasto no aparece dos veces.
 *
 * Colores fijos, no del tema: es un papel, y en modo oscuro tiene que seguir
 * siendo blanco con letra negra.
 */
export default function FacturaPapel({ factura: f }) {
  const e = f.emisor || {}
  const c = f.cliente || {}
  return (
    <div style={papel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.6rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{e.razonSocial || e.nombre}</div>
          {e.razonSocial && e.nombre && e.razonSocial !== e.nombre && <div style={gris}>{e.nombre}</div>}
          <div style={gris}>NIF {e.cif}</div>
          {e.direccion && <div style={gris}>{e.direccion}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '0.06em' }}>FACTURA</div>
          <div style={{ fontWeight: 700 }}>Nº {numeroDeFactura(f)}</div>
          <div style={gris}>Fecha de expedición: {fecha(f.expedidaEn)}</div>
        </div>
      </div>

      <div style={{ border: '1px solid #d4d4d8', borderRadius: '6px', padding: '0.7rem 0.9rem', marginBottom: '1.4rem' }}>
        <div style={etiqueta}>Cliente</div>
        <div style={{ fontWeight: 700 }}>{c.nombre}</div>
        <div>NIF {c.nif}</div>
        <div>{c.direccion}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #18181b', textAlign: 'left' }}>
            <th style={th}>Concepto</th>
            <th style={{ ...th, textAlign: 'right' }}>Cant.</th>
            <th style={{ ...th, textAlign: 'right' }}>Precio</th>
            <th style={{ ...th, textAlign: 'right' }}>IVA</th>
            <th style={{ ...th, textAlign: 'right' }}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {(f.lineas || []).map((l, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e4e4e7' }}>
              <td style={td}>{l.nombre}</td>
              <td style={{ ...td, ...cifra }}>{Number(l.cantidad)}</td>
              <td style={{ ...td, ...cifra }}>{euros(l.precio)}</td>
              <td style={{ ...td, ...cifra }}>{Number(l.ivaPct)} %</td>
              <td style={{ ...td, ...cifra }}>{euros(l.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* En la cabecera no cabe «Precio (IVA incluido)» en un móvil: se dice una vez aquí. */}
      <p style={{ fontSize: '0.72rem', color: '#71717a', margin: '-0.8rem 0 1.2rem' }}>Precios con IVA incluido.</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ maxWidth: '20rem' }}>
          {f.fiscalEstado === 'enviado' && f.fiscalUrl && (
            <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
              <QRCodeSVG value={f.fiscalUrl} size={84} />
              <div style={{ fontSize: '0.72rem', color: '#52525b' }}>
                <div style={{ fontWeight: 800, color: '#18181b' }}>VERI*FACTU</div>
                Factura verificable en la sede electrónica de la AEAT
              </div>
            </div>
          )}
          {e.ticketNumero != null && (
            <p style={{ fontSize: '0.75rem', color: '#52525b', marginTop: '0.6rem' }}>
              Emitida en sustitución de la factura simplificada {e.serieTickets || 'TPV'}-{e.ticketNumero} del {fecha(e.ticketFecha)}.
            </p>
          )}
        </div>

        <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '16rem' }}>
          <tbody>
            {(f.desglose || []).map((d, i) => (
              <tr key={i}>
                <td style={td}>Base imponible al {Number(d.ivaPct)} %</td>
                <td style={{ ...td, textAlign: 'right' }}>{euros(d.base)}</td>
              </tr>
            )).concat((f.desglose || []).map((d, i) => (
              <tr key={`c${i}`}>
                <td style={td}>Cuota IVA {Number(d.ivaPct)} %</td>
                <td style={{ ...td, textAlign: 'right' }}>{euros(d.cuota)}</td>
              </tr>
            )))}
            <tr style={{ borderTop: '2px solid #18181b' }}>
              <td style={{ ...td, fontWeight: 900, fontSize: '1.05rem' }}>TOTAL</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 900, fontSize: '1.05rem' }}>{euros(f.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// El margen crece con la pantalla: 2rem en un A4 o un monitor, 1rem en un
// móvil, donde cada píxel del lateral se lo quita a la tabla de líneas.
const papel = { background: '#fff', color: '#18181b', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', padding: 'clamp(1rem, 4vw, 2rem)', lineHeight: 1.45 }
const cifra = { textAlign: 'right', whiteSpace: 'nowrap' }
const gris = { color: '#52525b', fontSize: '0.88rem' }
const etiqueta = { fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', marginBottom: '0.2rem' }
const th = { padding: '0.45rem 0.3rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const td = { padding: '0.4rem 0.3rem' }
