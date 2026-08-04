// Puente de impresión: recibe bytes ESC/POS por HTTP y los manda a la
// impresora térmica de red (puerto 9100). Se ejecuta en cualquier PC del
// local; el navegador no puede abrir sockets TCP, por eso hace falta.
//
//   IMPRESORA=192.168.1.50 node scripts/puente-impresion.mjs
//
// Después, en Admin → Ajustes → Impresión: "Puente de red" y la dirección
// que imprime este script al arrancar.
import { createServer } from 'node:http'
import { Socket } from 'node:net'

const IMPRESORA = process.env.IMPRESORA || '192.168.1.50'
const PUERTO_IMPRESORA = Number(process.env.PUERTO_IMPRESORA || 9100)
const PUERTO = Number(process.env.PUERTO || 9110)

const enviar = (datos) => new Promise((resolve, reject) => {
  const s = new Socket()
  const fin = (err) => { s.destroy(); err ? reject(err) : resolve() }
  s.setTimeout(5000, () => fin(new Error('la impresora no responde')))
  s.on('error', fin)
  s.connect(PUERTO_IMPRESORA, IMPRESORA, () => s.write(datos, () => fin()))
})

createServer(async (req, res) => {
  // el TPV corre en otro origen (GitHub Pages): hace falta CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  if (req.url === '/estado') {
    return res.writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ ok: true, impresora: `${IMPRESORA}:${PUERTO_IMPRESORA}` }))
  }

  if (req.method !== 'POST' || req.url !== '/imprimir') {
    return res.writeHead(404).end('Usa POST /imprimir')
  }

  const trozos = []
  for await (const t of req) trozos.push(t)
  try {
    await enviar(Buffer.concat(trozos))
    console.log(new Date().toLocaleTimeString(), `→ ${trozos.reduce((s, t) => s + t.length, 0)} bytes impresos`)
    res.writeHead(200).end('ok')
  } catch (e) {
    console.error('fallo de impresión:', e.message)
    res.writeHead(502).end(e.message)
  }
}).listen(PUERTO, () => {
  console.log(`Puente de impresión escuchando en http://localhost:${PUERTO}`)
  console.log(`Imprimiendo en ${IMPRESORA}:${PUERTO_IMPRESORA}`)
  console.log('En Admin → Ajustes → Impresión, elige "Puente de red" y pon esta dirección')
  console.log('(usa la IP de este PC en la red del local, no localhost, si el TPV va en otro equipo)')
})
