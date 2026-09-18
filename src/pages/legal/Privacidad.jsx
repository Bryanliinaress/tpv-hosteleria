import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { retencionDias, purgaActiva } from '../../lib/privacidad'

/**
 * `/privacidad` — la política de privacidad del local.
 *
 * El art. 13 del RGPD obliga a decir quién trata los datos, para qué, con qué
 * base legal, cuánto los guarda y cómo se ejercen los derechos, y a decirlo
 * ANTES de pedirlos. Hasta ahora ese texto vivía en `docs/RGPD.md`, que no lo
 * lee ningún cliente.
 *
 * El texto sale de ahí. Lo que cambia por local —responsable, NIF, dirección y
 * correo— lo pone el propio local en Admin › Local y llega hasta aquí por
 * `config_publica` (migración 54), que es pública: esta página la abre gente
 * sin sesión.
 *
 * ⚠️ Lo que falte se dice que falta. Un bar recién montado no tiene el NIF
 * puesto, y una política de privacidad con un NIF inventado es peor que no
 * tenerla: aquí sale «pendiente de rellenar» y el dueño lo ve en su propia
 * página.
 */
export default function Privacidad() {
  const local = useStore(s => s.local)
  const cfgReservas = useStore(s => s.reservasConfig)
  const dias = retencionDias(cfgReservas)
  const purga = purgaActiva(cfgReservas)
  const p = local?.privacidad || {}

  // Con sesión de personal el dato está en el local directamente; sin sesión
  // llega ya masticado en `privacidad`. Se admiten los dos.
  const responsable = p.responsable || local?.razonSocial || local?.nombre || ''
  const nif = p.nif || local?.cif || ''
  const direccion = p.direccion || local?.direccionFiscal || local?.direccion || ''
  const email = p.email || local?.emailRgpd || ''

  useEffect(() => { document.title = `Privacidad · ${local?.nombre || ''}`.trim() }, [local?.nombre])

  return (
    <div style={pagina}>
      <div style={caja}>
        <Link to="/" style={volver}>← Volver</Link>
        <h1 style={titulo}>Protección de datos</h1>
        <p style={sub}>{local?.nombre || 'Este local'}</p>

        <Seccion titulo="Responsable">
          <Dato etiqueta="Quién" valor={responsable} />
          <Dato etiqueta="NIF" valor={nif} />
          <Dato etiqueta="Dirección" valor={direccion} />
          <Dato etiqueta="Contacto" valor={email} />
        </Seccion>

        <Seccion titulo="Qué datos tratamos y para qué">
          <ul style={lista}>
            <li><b>Reservas</b>: nombre, email y teléfono, para gestionar tu reserva, confirmártela y avisarte de cambios.</li>
            <li><b>Pedido en mesa</b>: el nombre que escribes al unirte a la mesa, para distinguir las comandas y dividir la cuenta.</li>
            <li><b>Pago con tarjeta</b>: lo procesa Stripe; nosotros no vemos tu número de tarjeta.</li>
            <li><b>Facturación</b>: si pides factura, los datos que nos des para emitirla.</li>
          </ul>
        </Seccion>

        <Seccion titulo="Base legal">
          <p style={parrafo}>
            La gestión de tu reserva o pedido (art. 6.1.b RGPD) y las obligaciones
            fiscales de facturación (art. 6.1.c RGPD).
          </p>
        </Seccion>

        <Seccion titulo="Cuánto los guardamos">
          <p style={parrafo}>
            {/* Con el plazo a 0 el local ha decidido guardarlas indefinidamente.
                Decir «a los 0 días» sería justo lo contrario de lo que pasa. */}
            {purga
              ? <>Los datos de reserva se eliminan automáticamente a los <b>{dias} días</b> de la fecha de la reserva. </>
              : <>Los datos de reserva se conservan mientras sigan siendo necesarios para gestionar tus reservas; puedes pedir su supresión cuando quieras. </>}
            Los del pedido se eliminan al cerrar la mesa. Los justificantes de
            venta se conservan los años que exige la normativa fiscal.
          </p>
        </Seccion>

        <Seccion titulo="Dónde están">
          <p style={parrafo}>
            En servidores de la Unión Europea (Irlanda). Los pagos con tarjeta
            los procesa Stripe y el registro fiscal se remite a la Agencia
            Tributaria. No hay decisiones automatizadas ni elaboración de
            perfiles, y no cedemos datos a terceros salvo obligación legal.
          </p>
        </Seccion>

        <Seccion titulo="Tus derechos">
          <p style={parrafo}>
            Puedes ejercer acceso, rectificación, supresión, oposición,
            limitación y portabilidad escribiendo a{' '}
            {email
              ? <a href={`mailto:${email}`} style={enlace}>{email}</a>
              : <Falta texto="el correo de contacto, pendiente de rellenar" />}.
            Si crees que no te hemos atendido bien, puedes reclamar ante la{' '}
            <a href="https://www.aepd.es" target="_blank" rel="noreferrer" style={enlace}>AEPD</a>.
          </p>
        </Seccion>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <section style={{ marginTop: '1.6rem' }}>
      <h2 style={h2}>{titulo}</h2>
      {children}
    </section>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <p style={{ ...parrafo, margin: '0.25rem 0' }}>
      <span style={{ color: 'var(--color-muted)' }}>{etiqueta}: </span>
      {valor ? <b>{valor}</b> : <Falta texto="pendiente de rellenar" />}
    </p>
  )
}

/** Un hueco sin rellenar se enseña como hueco. Nunca se rellena solo. */
function Falta({ texto }) {
  return (
    <span style={{
      color: 'var(--color-warning, #d97706)', fontWeight: 700,
      fontSize: '0.88em',
    }}>⚠️ {texto}</span>
  )
}

const pagina = { minHeight: '100dvh', padding: '1.5rem 1rem 3rem', display: 'flex', justifyContent: 'center' }
const caja = { width: '100%', maxWidth: '44rem' }
const volver = { color: 'var(--color-muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }
const titulo = { fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900, letterSpacing: '-0.02em', margin: '1rem 0 0.2rem' }
const sub = { color: 'var(--color-muted)', margin: 0, fontSize: '1rem' }
const h2 = { fontSize: '1.02rem', fontWeight: 800, margin: '0 0 0.45rem', color: 'var(--color-accent)' }
const parrafo = { lineHeight: 1.6, margin: 0, color: 'var(--color-text)' }
const lista = { lineHeight: 1.6, margin: 0, paddingLeft: '1.1rem', color: 'var(--color-text)' }
const enlace = { color: 'var(--color-accent)', fontWeight: 600 }
