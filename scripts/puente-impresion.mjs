// Puente de impresión: recibe bytes ESC/POS por HTTP y los saca por la
// impresora que toque. Se ejecuta en cualquier PC del local; el navegador no
// puede abrir sockets TCP ni hablar con el spooler, por eso hace falta.
//
// UNA impresora (lo más simple):
//   IMPRESORA=192.168.1.50 node scripts/puente-impresion.mjs
//
// VARIAS impresoras, una por destino (cocina, barra y caja):
//   IMPRESORA_COCINA=TPV-Cocina IMPRESORA_BARRA=TPV-Barra \n//     node scripts/puente-impresion.mjs
//
// Los destinos y el envío viven en scripts/lib/impresoras.mjs (los comparte con
// la impresión automática). Aquí solo está el servidor HTTP.
//
// Después, en Admin → Ajustes → Impresión: "Puente de red" y la dirección que
// imprime este script al arrancar.
import { createServer } from 'node:http'

const PUERTO = Number(process.env.PUERTO || 9110)
import { leerDestinos, impresoraDe, enColaDe, enviarConReintentos } from './lib/impresoras.mjs'

export { leerDestinos, impresoraDe, enColaDe, enviarConReintentos } from './lib/impresoras.mjs'
export { esImpresoraWindows, esImpresoraLocal, enviar } from './lib/impresoras.mjs'

// ── Servidor ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  const destinos = leerDestinos()

  createServer(async (req, res) => {
    // el TPV corre en otro origen (GitHub Pages): hace falta CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    // El TPV se sirve por HTTPS y este puente vive en la red del local. Para
    // eso, el navegador (Private Network Access) pide permiso explícito antes
    // de dejar que una web pública hable con un equipo de tu red: sin esta
    // cabecera, Chrome bloquea la impresión y no sale ninguna comanda.
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
    res.setHeader('Access-Control-Max-Age', '86400')   // no preguntar en cada comanda
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
      const datos = Buffer.concat(trozos)
      await enColaDe(impresora, () => enviarConReintentos(impresora, datos))
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
