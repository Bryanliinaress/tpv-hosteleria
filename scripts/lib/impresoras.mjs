// ────────────────────────────────────────────────────────────────────────────
// Hablar con las impresoras del local: a quién le toca cada comanda y cómo se
// le mandan los bytes.
//
// Vive aparte del puente HTTP porque hay dos formas de disparar una impresión
// —el puente (lo pide el navegador) y el servicio automático (lo dispara la
// base de datos)— y las dos necesitan exactamente esto. Importar el puente
// entero levantaba un segundo servidor y chocaba con el que ya estaba.
// ────────────────────────────────────────────────────────────────────────────
import { Socket } from 'node:net'
import { spawn } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUERTO = Number(process.env.PUERTO || 9110)
const PUERTO_IMPRESORA = Number(process.env.PUERTO_IMPRESORA || 9100)

// Destino → impresora. `defecto` cubre lo que no encaje en ninguno.
export const leerDestinos = (env = process.env) => {
  const d = {
    cocina: env.IMPRESORA_COCINA || null,
    barra: env.IMPRESORA_BARRA || null,
    caja: env.IMPRESORA_CAJA || null,
    defecto: env.IMPRESORA || null,
  }
  // Con una sola impresora, todo va a ella; con varias, la primera hace de red
  // de seguridad para que nunca se pierda una comanda por un destino nuevo.
  if (!d.defecto) d.defecto = d.cocina || d.barra || d.caja || '192.168.1.50'
  return d
}

/** Qué impresora corresponde a un destino (nunca devuelve vacío). */
export const impresoraDe = (destinos, destino) => destinos[destino] || destinos.defecto

/** ¿Es una impresora de Windows compartida (\\PC\NOMBRE) o una IP de red? */
export const esImpresoraWindows = (destino) => /^\\\\/.test(String(destino || ''))

/**
 * ¿Es una impresora INSTALADA en este Windows, dicha por su nombre?
 *
 * Es el caso de una térmica USB: Windows le crea la cola («TPV-Termica») pero
 * compartirla exige permisos de administrador, y un bar no tiene por qué
 * tenerlos. Con el nombre a secas se le mandan los bytes igual, en crudo.
 * Se distingue de una dirección de red porque no lleva puntos ni dos puntos.
 */
export const esImpresoraLocal = (destino) => {
  const d = String(destino || '').trim()
  // ni barras (rutas y compartidas), ni puntos o dos puntos (IP y host:puerto):
  // un nombre de cola de Windows no lleva nada de eso
  return !!d && !/[\\/.:]/.test(d)
}

// ── Envío por red (TCP 9100) ────────────────────────────────────────────────
const enviarRed = (destino, datos) => new Promise((resolve, reject) => {
  const [host, puerto] = String(destino).split(':')
  const s = new Socket()
  let acabado = false
  const fin = (err) => {
    if (acabado) return
    acabado = true
    s.destroy()
    err ? reject(err) : resolve()
  }
  s.setTimeout(8000, () => fin(new Error('la impresora no responde')))
  s.on('error', fin)
  // `end` cierra cuando los bytes han salido de verdad; con `write` + destroy
  // inmediato, un ticket largo podía quedarse a medias
  s.on('close', () => fin())
  s.connect(Number(puerto) || PUERTO_IMPRESORA, host, () => s.end(datos))
})

// ── Envío a una impresora de Windows (copia en crudo, sin driver) ───────────
// `copy /b` manda los bytes tal cual: si pasaran por el driver, los comandos
// ESC/POS se convertirían en texto y saldría basura.
const enviarWindows = async (destino, datos) => {
  const tmp = join(tmpdir(), `tpv-${Date.now()}.prn`)
  await writeFile(tmp, datos)
  try {
    await new Promise((resolve, reject) => {
      const p = spawn('cmd', ['/c', 'copy', '/b', tmp, destino], { windowsHide: true })
      let err = ''
      p.stderr.on('data', (d) => { err += d })
      p.on('error', reject)
      p.on('close', (code) => code === 0 ? resolve() : reject(new Error(err.trim() || `copy devolvió ${code}`)))
    })
  } finally {
    await unlink(tmp).catch(() => {})
  }
}

// ── Envío a una impresora instalada en este Windows (por su nombre) ─────────
// Sin compartirla y sin ser administrador: se manda a la cola con datatype RAW
// (winspool), que es como se le habla a una térmica desde Windows.
const enviarLocal = async (nombre, datos) => {
  const tmp = join(tmpdir(), `tpv-${Date.now()}.prn`)
  await writeFile(tmp, datos)
  const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'imprimir-raw.ps1')
  try {
    await new Promise((resolve, reject) => {
      const p = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
        '-Impresora', nombre, '-Fichero', tmp], { windowsHide: true })
      let salida = ''
      p.stdout.on('data', (d) => { salida += d })
      p.stderr.on('data', (d) => { salida += d })
      p.on('error', reject)
      p.on('close', (code) => {
        if (code === 0 && /: ?ok:/.test(salida)) return resolve()
        reject(new Error(salida.trim() || `la impresora «${nombre}» no aceptó el trabajo`))
      })
    })
  } finally {
    await unlink(tmp).catch(() => {})
  }
}

export const enviar = (destino, datos) => {
  if (esImpresoraWindows(destino)) return enviarWindows(destino, datos)
  if (esImpresoraLocal(destino)) return enviarLocal(destino, datos)
  return enviarRed(destino, datos)
}

// ── Una cosa cada vez por impresora ─────────────────────────────────────────
// Dos comandas a la vez por el mismo socket salen mezcladas en el papel (o la
// segunda se pierde). En hora punta eso pasa. Cada impresora tiene su turno.
const colas = new Map()
export function enColaDe(impresora, tarea) {
  const previa = colas.get(impresora) || Promise.resolve()
  const actual = previa.then(tarea, tarea)
  colas.set(impresora, actual.then(() => {}, () => {}))
  return actual
}

// ── Reintentos ──────────────────────────────────────────────────────────────
// La térmica puede estar un segundo ocupada, o el cable flojo. Perder una
// comanda es un plato que no sale, así que se insiste antes de rendirse.
export async function enviarConReintentos(destino, datos, { intentos = 3, espera = 400, enviarFn = enviar, dormir } = {}) {
  const pausa = dormir || ((ms) => new Promise(r => setTimeout(r, ms)))
  let ultimo
  for (let i = 1; i <= intentos; i++) {
    try {
      return await enviarFn(destino, datos)
    } catch (e) {
      ultimo = e
      if (i < intentos) await pausa(espera * i)
    }
  }
  throw ultimo
}

