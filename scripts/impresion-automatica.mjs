// ────────────────────────────────────────────────────────────────────────────
// Impresión automática de comandas, SIN navegador.
//
// Antes, quien disparaba la impresión era una pantalla abierta (la Estación de
// impresión). En un bar eso es frágil: alguien cierra la pestaña, se bloquea el
// PC o se reinicia el navegador, y las comandas dejan de salir sin que nadie se
// entere hasta que cocina reclama.
//
// Esto se queda escuchando la base de datos y saca cada comanda nueva en cuanto
// aparece. Además, al arrancar imprime lo que quedó pendiente (el PC estaba
// apagado, hubo un corte de luz…), y no repite lo ya impreso: cada comanda se
// marca con `impresa_en` (migración 13).
//
// Arranque:
//   node scripts/impresion-automatica.mjs
// leyendo la configuración de `.env.puente` (ver docs/IMPRESION.md).
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { comandaESCPOS } from '../src/lib/escpos.js'
import { leerDestinos, impresoraDe, enviarConReintentos, enColaDe } from './lib/impresoras.mjs'
import { pasada as pasadaVigilante } from './lib/vigilante.mjs'
import { pasadaRecordatorios } from './lib/recordatorios.mjs'
import { paramsEmailJS } from '../src/lib/textosReserva.js'

const AQUI = dirname(fileURLToPath(import.meta.url))

// Configuración desde `.env.puente` (o del entorno, que manda)
function cargarEntorno() {
  // `.env.puente` primero (la config del servicio) y `.env` de respaldo, que es
  // donde viven las claves de EmailJS que usa el build. Lo que ya esté en el
  // entorno manda sobre los dos.
  for (const fichero of ['.env.puente', '.env']) {
    try {
      const txt = readFileSync(join(AQUI, '..', fichero), 'utf8')
      for (const linea of txt.split('\n')) {
        const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    } catch { /* sin ese fichero: se sigue con el siguiente */ }
  }
}
cargarEntorno()

const URL_SB = process.env.SUPABASE_URL
const CLAVE = process.env.SUPABASE_SERVICE_KEY
// Cuánto se espera para juntar en UN papel lo que entra a la vez: una mesa que
// pide cuatro platos son cuatro filas en la base, pero una sola comanda.
const AGRUPAR_MS = Number(process.env.AGRUPAR_MS || 1200)

if (!URL_SB || !CLAVE) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_KEY (ponlos en .env.puente)')
  process.exit(1)
}

const destinos = leerDestinos()
const sb = createClient(URL_SB, CLAVE, { auth: { persistSession: false } })

const hora = () => new Date().toLocaleTimeString('es-ES')
const log = (...m) => console.log(hora(), ...m)

// ── Que un fallo de impresión salga de este log ─────────────────────────────
//
// Este fichero lo lee alguien que ya sospecha. El bar no: por eso el fallo se
// escribe también en la base, donde `npm run salud` lo encuentra. Hasta ahora
// una impresora muerta solo se notaba porque no llegaba la comida.
//
// `caidas` evita repetir el aviso cada minuto por la misma impresora, y sirve
// para poder decir «ya vuelve a imprimir» cuando se arregla.
const caidas = new Set()

async function avisarCaida(impresora, mensaje) {
  if (caidas.has(impresora)) return          // ya avisado: la RPC ya lo cuenta
  caidas.add(impresora)
  log(`🚨 ${impresora} no está imprimiendo — queda anotado para «npm run salud»`)
  const { error } = await sb.rpc('registrar_incidencia', {
    p_clase: 'impresora', p_mensaje: `«${impresora}» no imprime: ${mensaje}`, p_pantalla: impresora,
  })
  if (error) log('⚠️  no pude anotar la incidencia:', error.message)
}

function avisarRecuperada(impresora) {
  if (!caidas.delete(impresora)) return
  log(`✓ ${impresora} vuelve a imprimir`)
}

// ── Datos de una comanda, listos para el papel ──────────────────────────────
async function detalleDe(ids) {
  const { data, error } = await sb
    .from('comandas')
    .select('id, destino, mesa_id, linea_id, hora_entrada, mesas(numero), lineas_pedido(nombre, cantidad, personalizacion, comensales(nombre))')
    .in('id', ids)
    .is('impresa_en', null)
  if (error) throw error
  return data || []
}

// La nota que lee cocina: pan, lo que se quita, lo que se añade y la indicación
const notaDe = (p = {}) => {
  const partes = []
  if (p.pan) partes.push(`${p.pan.nombreFormato} · ${p.pan.nombreTipo}`)
  if (p.quitados?.length) partes.push('SIN ' + p.quitados.join(', '))
  if (p.anadidos?.length) partes.push('CON ' + p.anadidos.join(', '))
  if (p.nota) partes.push(p.nota)
  return partes.join(' · ')
}

/** Agrupa por mesa y destino: un papel por cada, no uno por plato. */
export function agrupar(comandas) {
  const grupos = new Map()
  for (const k of comandas) {
    const destino = k.destino || 'cocina'
    const clave = `${k.mesa_id}|${destino}`
    const g = grupos.get(clave) || { destino, mesa: k.mesas?.numero ?? '?', ids: [], lineas: [] }
    g.ids.push(k.id)
    g.lineas.push({
      cantidad: k.lineas_pedido?.cantidad ?? 1,
      nombre: k.lineas_pedido?.nombre ?? '(producto)',
      nota: notaDe(k.lineas_pedido?.personalizacion),
      persona: k.lineas_pedido?.comensales?.nombre || '',
    })
    grupos.set(clave, g)
  }
  return [...grupos.values()]
}

async function imprimirGrupo(g) {
  const impresora = impresoraDe(destinos, g.destino)
  const bytes = Buffer.from(comandaESCPOS({
    mesa: g.mesa,
    destino: g.destino.toUpperCase(),
    lineas: g.lineas,
  }))
  try {
    await enColaDe(impresora, () => enviarConReintentos(impresora, bytes))
  } catch (e) {
    await avisarCaida(impresora, e.message)
    throw e
  }
  avisarRecuperada(impresora)
  // Solo se marca DESPUÉS de que la impresora CONFIRME que el trabajo salió de
  // la cola: si falla, sigue pendiente y se reintenta. Mejor repetir una comanda
  // que perderla —y mucho mejor que darla por impresa sin que salga papel.
  const { error } = await sb.from('comandas').update({ impresa_en: new Date().toISOString() }).in('id', g.ids)
  if (error) log('⚠️  impresa pero no pude marcarla:', error.message)
  log(`🖨  mesa ${g.mesa} → ${g.destino} (${impresora}) · ${g.lineas.length} línea(s)`)
}

// ── Cola de entrada: se juntan las que llegan a la vez ──────────────────────
let pendientes = new Set()
let temporizador = null

async function vaciar() {
  const ids = [...pendientes]
  pendientes = new Set()
  if (!ids.length) return
  try {
    const comandas = await detalleDe(ids)
    if (!comandas.length) return          // ya impresas por otro lado
    for (const g of agrupar(comandas)) {
      try { await imprimirGrupo(g) } catch (e) { log('❌ no se pudo imprimir:', e.message) }
    }
  } catch (e) {
    log('❌ error al leer las comandas:', e.message)
  }
}

function encolar(id) {
  pendientes.add(id)
  clearTimeout(temporizador)
  temporizador = setTimeout(vaciar, AGRUPAR_MS)
}

// ── Lo que quedó sin imprimir (arranque) ────────────────────────────────────
async function recuperarPendientes() {
  const { data, error } = await sb
    .from('comandas')
    .select('id, hora_entrada')
    .is('impresa_en', null)
    .order('hora_entrada', { ascending: true })
    .limit(50)
  if (error) return log('❌ no pude consultar lo pendiente:', error.message)
  if (!data?.length) return log('✓ no hay comandas pendientes')
  log(`recuperando ${data.length} comanda(s) que no llegaron a imprimirse`)
  data.forEach(k => pendientes.add(k.id))
  await vaciar()
}

// ── Arranque ────────────────────────────────────────────────────────────────
console.log('Impresión automática de comandas')
for (const [k, v] of Object.entries(destinos)) if (v) console.log(`  ${k.padEnd(8)} → ${v}`)

await recuperarPendientes()

sb.channel('comandas-impresion')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comandas' }, (payload) => {
    if (payload.new?.id) encolar(payload.new.id)
  })
  .subscribe((estado) => {
    if (estado === 'SUBSCRIBED') log('escuchando comandas nuevas · las imprimo solas')
    else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') log('⚠️  conexión perdida, reintentando…')
  })

// Red de seguridad: si la conexión en vivo se cae sin avisar, cada minuto se
// mira si quedó algo sin imprimir. Un bar no puede perder una comanda.
setInterval(() => { recuperarPendientes().catch(() => {}) }, 60_000)

// ── El vigilante de Hacienda ────────────────────────────────────────────────
//
// Va en ESTE proceso porque es el único que corre desatendido en el PC del bar,
// y ese PC está encendido justo cuando hace falta: mientras se sirve. Con
// Verifacti un ticket solo se registra el día que se emitió, así que reintentar
// «cuando alguien abra el panel» es reintentar demasiado tarde.
const VIGILANTE_MS = Number(process.env.VIGILANTE_MS || 10 * 60_000)

async function vigilar() {
  try {
    const r = await pasadaVigilante({
      listar: async () => {
        const { data, error } = await sb
          .from('tickets')
          .select('id, numero, fiscal_estado, fiscal_intentos, cerrado_en')
          .in('fiscal_estado', ['pendiente', 'error'])
        if (error) throw error
        return data
      },
      // Ticket a ticket, no en lote: el lote saca el local del JWT y exige una
      // sesión de personal que este proceso no tiene. La vía por ticket no la
      // necesita, así que no hay que relajar nada de la función.
      reintentar: async (lista) => {
        let ok = 0
        for (const t of lista) {
          const res = await fetch(`${URL_SB}/functions/v1/registrar-fiscal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: CLAVE },
            body: JSON.stringify({ ticketId: t.id }),
          })
          if (res.ok) ok++
        }
        log(`🧾 reintento fiscal · ${ok}/${lista.length} registrado(s)`)
      },
      avisar: async (mensaje) => {
        await sb.rpc('registrar_incidencia', { p_clase: 'fiscal', p_mensaje: mensaje, p_pantalla: 'Hacienda' })
      },
      log,
    })
    if (!r.reintentados && !r.perdidos) log('🧾 todo registrado en Hacienda')
  } catch (e) {
    log('⚠️  el vigilante fiscal no pudo comprobar:', e.message)
  }
}


vigilar()
setInterval(() => { vigilar().catch(() => {}) }, VIGILANTE_MS)

// ── Recordatorios de reserva ────────────────────────────────────────────────
//
// Existían la plantilla y un botón «🔔 Recordar», pero había que pulsarlo
// reserva por reserva: en un bar eso no pasa. Y la nota de privacidad que el
// cliente acepta al reservar promete «(confirmación, cambios y recordatorio)»,
// así que no mandarlo no es solo perder una mesa.
// EmailJS bloquea de fábrica las llamadas que no vienen de un navegador. Hay
// que habilitarlo en su panel (Account → Security) y, en cuanto se habilita, la
// clave PÚBLICA sola permitiría mandar correos desde cualquier sitio: por eso
// se manda también la PRIVADA como `accessToken`, que es la forma que ellos
// documentan para servidor. Sin `EMAILJS_PRIVATE_KEY` funciona igual, pero
// conviene ponerla.
const EMAILJS = {
  service: process.env.VITE_EMAILJS_SERVICE_ID || process.env.EMAILJS_SERVICE_ID,
  template: process.env.VITE_EMAILJS_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID,
  key: process.env.VITE_EMAILJS_PUBLIC_KEY || process.env.EMAILJS_PUBLIC_KEY,
  privada: process.env.EMAILJS_PRIVATE_KEY || null,
}
const RECORDATORIO_HORAS = Number(process.env.RECORDATORIO_HORAS || 4)

function urlDelPerfil(slug) {
  if (!slug) return null
  try {
    const p = JSON.parse(readFileSync(join(AQUI, '..', 'locales', slug, 'perfil.json'), 'utf8'))
    const u = p?.despliegue?.url
    return u ? (u.endsWith('/') ? u : `${u}/`) : null
  } catch { return null }
}

let avisadoSinCorreo = false
async function recordar() {
  if (!EMAILJS.service || !EMAILJS.template || !EMAILJS.key) {
    // Callarse aquí sería repetir el fallo de la impresión: algo que no
    // funciona y no lo dice. Se avisa una vez, no en cada pasada.
    if (!avisadoSinCorreo) {
      avisadoSinCorreo = true
      log('📧 recordatorios apagados: faltan las claves de EmailJS (VITE_EMAILJS_* en .env.puente o .env)')
    }
    return
  }
  try {
    const { data: loc } = await sb.from('locales').select('nombre, slug, config').limit(1).single()
    // La dirección del bar sale de su perfil, igual que el QR de mesa: nunca de
    // por dónde se haya abierto algo.
    const urlPublica = process.env.URL_PUBLICA || urlDelPerfil(loc?.slug) || ''
    await pasadaRecordatorios({
      horas: RECORDATORIO_HORAS,
      listar: async () => {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
        const { data, error } = await sb
          .from('reservas')
          .select('id, nombre, email, fecha, hora, personas, zona, estado, token, creada_en, recordatorio_en')
          .gte('fecha', hoy.toISOString().slice(0, 10))
          .eq('estado', 'confirmada')
          .is('recordatorio_en', null)
        if (error) throw error
        return data
      },
      enviar: async (r) => {
        const enlace = urlPublica && r.token ? `${urlPublica}#/reservar?r=${r.id}&t=${r.token}` : null
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: EMAILJS.service, template_id: EMAILJS.template, user_id: EMAILJS.key,
            ...(EMAILJS.privada ? { accessToken: EMAILJS.privada } : {}),
            template_params: paramsEmailJS('recordatorio', r, { nombreLocal: loc?.nombre || 'el restaurante', enlace }),
          }),
        })
        if (!res.ok) throw new Error(`EmailJS ${res.status}: ${(await res.text()).slice(0, 120)}`)
      },
      // Solo DESPUÉS de que salga: marcar un correo que falló es perderlo.
      marcar: async (r) => { await sb.from('reservas').update({ recordatorio_en: new Date().toISOString() }).eq('id', r.id) },
      log,
    })
  } catch (e) {
    log('⚠️  los recordatorios no pudieron comprobarse:', e.message)
  }
}

recordar()
setInterval(() => { recordar().catch(() => {}) }, VIGILANTE_MS)
