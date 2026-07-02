// Genera los iconos PWA (PNG) sin dependencias: un "plato" con los colores de
// la marca. Uso: node scripts/gen-icons.mjs  → escribe public/icon-*.png
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, draw) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filtro none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Mezcla suave entre colores por distancia (antialias)
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, t))))
const BG = [15, 23, 42, 255]       // slate
const ORANGE = [249, 115, 22, 255] // acento
const CREAM = [253, 186, 116, 255] // acento claro

function plato(x, y, size) {
  const c = size / 2
  const d = Math.hypot(x - c, y - c) / size // distancia normalizada
  // esquinas redondeadas del fondo (radio 22%)
  const rad = 0.22 * size
  const ex = Math.max(0, Math.abs(x - c) - (c - rad)), ey = Math.max(0, Math.abs(y - c) - (c - rad))
  if (Math.hypot(ex, ey) > rad) return [0, 0, 0, 0]
  let col = BG
  const anillo = (rIn, rOut, color) => { if (d >= rIn && d <= rOut) col = mix(col, color, 3 - Math.abs((d - (rIn + rOut) / 2) / ((rOut - rIn) / 2)) * 0) }
  // borde exterior del plato
  if (d > 0.30 && d < 0.365) col = ORANGE
  // plato interior
  if (d < 0.16) col = CREAM
  if (d < 0.10) col = ORANGE
  return col
}

mkdirSync('public', { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, png(size, plato))
  console.log(`public/icon-${size}.png`)
}
