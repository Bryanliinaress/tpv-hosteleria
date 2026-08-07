// Puente de impresión: recibe bytes ESC/POS por HTTP y los saca por la
// impresora que toque. Se ejecuta en cualquier PC del local; el navegador no
// puede abrir sockets TCP ni hablar con el spooler, por eso hace falta.
//
// UNA impresora (lo más simple):
//   IMPRESORA=192.168.1.50 node scripts/puente-impresion.mjs
//
// VARIAS impresoras, una por destino (cocina, barra y caja):
//   IMPRESORA_COCINA=192.168.1.50 IMPRESORA_BARRA=192.168.1.51 \
//     IMPRESORA_CAJA=192.168.1.52 node scripts/puente-impresion.mjs
//
// Cada destino puede ser:
//   · una IP (impresora de red)         → 192.168.1.50  ó  192.168.1.50:9100
//   · una impresora de Windows          → \\localhost\TM-T20   (compartida)
//
// Lo segundo es lo que resuelve el caso de DOS IMPRESORAS USB EN EL MISMO PC:
// se comparten en Windows (clic derecho → Propiedades → Compartir) y aquí se
// ponen sus nombres. Las comandas de cocina salen por una y las de barra por
// la otra sin tocar nada más.
//
// Después, en Admin → Ajustes → Impresión: "Puente de red" y la dirección que
// imprime este script al arrancar.
import { createServer } from 'node:http'
import { Socket } from 'node:net'
import { spawn } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

// ── Envío por red (TCP 9100) ────────────────────────────────────────────────
const enviarRed = (destino, datos) => new Promise((resolve, reject) => {
  const [host, puerto] = String(destino).split(':')
  const s = new Socket()
  const fin = (err) => { s.destroy(); err ? reject(err) : resolve() }
  s.setTimeout(5000, () => fin(new Error('la impresora no responde')))
  s.on('error', fin)
  s.connect(Number(puerto) || PUERTO_IMPRESORA, host, () => s.write(datos, () => fin()))
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

export const enviar = (destino, datos) =>
  esImpresoraWindows(destino) ? enviarWindows(destino, datos) : enviarRed(destino, datos)

// ── Servidor ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  const destinos = leerDestinos()

  createServer(async (req, res) => {
    // el TPV corre en otro origen (GitHub Pages): hace falta CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (req.method === 'OPTIONS') return res.writeHead(204).end()

    const url = new URL(req.url, 'http://localhost')

    if (url.pathname === '/estado') {
      return res.writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ ok: true, destinos }))
    }

    if (req.method !== 'POST' || url.pathname !== '/imprimir') {
      return res.writeHead(404).end('Usa POST /imprimir[?destino=cocina|barra|caja]')
    }

    const destino = url.searchParams.get('destino') || 'defecto'
    const impresora = impresoraDe(destinos, destino)

    const trozos = []
    for await (const t of req) trozos.push(t)
    try {
      await enviar(impresora, Buffer.concat(trozos))
      const bytes = trozos.reduce((s, t) => s + t.length, 0)
      console.log(new Date().toLocaleTimeString(), `→ ${bytes} bytes a ${destino} (${impresora})`)
      res.writeHead(200).end('ok')
    } catch (e) {
      console.error(`fallo de impresión en ${destino} (${impresora}):`, e.message)
      res.writeHead(502).end(e.message)
    }
  }).listen(PUERTO, () => {
    console.log(`Puente de impresión escuchando en http://localhost:${PUERTO}`)
    for (const [k, v] of Object.entries(destinos)) if (v) console.log(`  ${k.padEnd(8)} → ${v}`)
    console.log('En Admin → Ajustes → Impresión, elige "Puente de red" y pon esta dirección')
    console.log('(usa la IP de este PC en la red del local, no localhost, si el TPV va en otro equipo)')
  })
}
