// ────────────────────────────────────────────────────────────────────────────
// El vigilante del bar.
//
// Reintenta solo lo que quedó sin registrar en Hacienda, y deja constancia de
// lo que ya no tiene arreglo.
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// Verifacti compone el registro y lo remite en una sola llamada, y el campo
// `fecha_expedicion` no puede ser cualquiera. Si el envío falla un martes por
// la tarde —AEAT caída, un corte de red— y nadie lo atiende a tiempo, ese
// ticket NO ENTRA NUNCA.
//
// ── La ventana son DOS días, no uno (confirmado por Verifacti el 18/09/2026)
// «Para acomodar posibles errores, nuestra API permite generar registros con
// fecha del día anterior a la fecha actual.»
//
// Antes aquí se daba por perdido todo lo que no fuera de hoy, y se estaban
// tirando tickets que aún entraban. Importa sobre todo el día que el bar abre
// después de cerrar: un lunes, lo del domingo todavía se salva.
//
// El reintento ya existía (`reintentarPendientes`), pero solo corría «al abrir
// Admin o a mano». Es decir: dependía de que alguien se acordara, justo el día
// que hay que acordarse. En la demo se acumularon cinco así sin que nadie lo
// provocara.
//
// ── Por qué vive aquí ───────────────────────────────────────────────────────
// Va dentro del proceso de impresión porque es el ÚNICO que corre desatendido
// en el PC del bar, y ese PC está encendido exactamente cuando hace falta:
// mientras el bar sirve, que es cuando se emiten los tickets y el único momento
// en que un reintento puede funcionar. Un cron en el servidor sería más
// elegante, pero necesitaría la URL del proyecto escrita en una migración que
// comparten todos los bares.
// ────────────────────────────────────────────────────────────────────────────

/** Fecha local en formato YYYY-MM-DD (no UTC: el día del bar es el suyo). */
export function diaLocal(fecha = new Date()) {
  const d = new Date(fecha)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** El día anterior a uno dado, en YYYY-MM-DD. El constructor de Date normaliza
 *  el día 0 y el mes -1, así que el 1 de marzo y el 1 de enero salen bien. */
export function diaAnterior(dia = diaLocal()) {
  const [a, m, d] = dia.split('-').map(Number)
  return diaLocal(new Date(a, m - 1, d - 1))
}

/**
 * Reparte los tickets sin registrar entre los que aún se pueden salvar y los
 * que ya no.
 *
 * Lo de HOY y lo de AYER se reintenta —es lo que admite la API—. Lo anterior no
 * entra ya, por mucho que se insista: eso hay que decirlo, no seguir
 * intentándolo en silencio.
 */
export function clasificar(tickets = [], hoy = diaLocal()) {
  // `fiscal_intentos < 10` es el mismo tope que usa el reintento en lote de la
  // Edge Function: un ticket que la AEAT rechaza por lo que sea no puede
  // reintentarse para siempre.
  const sinRegistrar = (tickets || []).filter(
    t => t && (t.fiscal_estado === 'pendiente' || t.fiscal_estado === 'error') &&
         (t.fiscal_intentos ?? 0) < 10)
  const ventana = [hoy, diaAnterior(hoy)]
  const aTiempo = sinRegistrar.filter(t => ventana.includes(diaLocal(t.cerrado_en)))
  const perdidos = sinRegistrar.filter(t => !ventana.includes(diaLocal(t.cerrado_en)))
  return { sinRegistrar, aTiempo, perdidos }
}

/** El aviso que se guarda cuando hay tickets que ya no se pueden registrar. */
export const mensajePerdidos = (perdidos = []) =>
  `${perdidos.length} ticket(s) llevan más de un día sin registrarse en Hacienda y ya no pueden entrar: ` +
  perdidos.slice(0, 5).map(t => `nº ${t.numero} (${diaLocal(t.cerrado_en)})`).join(', ') +
  (perdidos.length > 5 ? `, y ${perdidos.length - 5} más` : '')

/**
 * Una pasada del vigilante.
 *
 * Se reintenta ticket a ticket (`{ ticketId }` de la Edge Function) y no en
 * lote: el lote saca el local del JWT y exige una sesión de personal, que un
 * proceso desatendido no tiene. La vía por ticket no la necesita —el uuid del
 * ticket es el secreto— así que no hay que tocar nada de la función ni relajar
 * su seguridad.
 *
 * `deps` se inyecta para poder probarlo sin red: { listar, reintentar, avisar, log }.
 */
export async function pasada({ listar, reintentar, avisar, log = () => {}, hoy = diaLocal() }) {
  const tickets = await listar()
  const { aTiempo, perdidos } = clasificar(tickets, hoy)

  if (aTiempo.length) {
    log(`🧾 ${aTiempo.length} ticket(s) de hoy o de ayer sin registrar: reintentando`)
    await reintentar(aTiempo)
  }

  if (perdidos.length) {
    // `registrar_incidencia` agrupa por mensaje y cuenta las veces, así que
    // repetirlo cada pasada no llena la tabla: solo sube el contador.
    log(`🚨 ${perdidos.length} ticket(s) ya no pueden registrarse — queda anotado`)
    await avisar(mensajePerdidos(perdidos))
  }

  return { reintentados: aTiempo.length, perdidos: perdidos.length }
}
