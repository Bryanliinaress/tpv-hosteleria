// Parche puntual del guardarraíl de contrato. Se borra al terminar.
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/lib/v2/contrato.test.js'
let s = readFileSync(p, 'utf8')

const viejo = `  let m
  while ((m = re.exec(src))) if (/return \\{ ok/.test(m[2])) nombres.add(m[1])
  return [...nombres]
}`

const nuevo = `  let m
  while ((m = re.exec(src))) if (/return \\{ ok/.test(m[2])) nombres.add(m[1])
  // Flecha corta: \`nombre: (…) => ({ ok … })\`. Se escapaba del detector, y es
  // exactamente la misma trampa: la pantalla lee \`r.ok\` y en v2 le llega una
  // promesa, así que enseña un error falso habiendo funcionado.
  const flechaCorta = /^ {2}([a-zA-Z]+): (?:async )?\\([^)]*\\) => \\(\\{ ok/gm
  while ((m = flechaCorta.exec(src))) nombres.add(m[1])
  return [...nombres]
}

// Las que la DEMO ya declara \`async\` devuelven una promesa a los dos lados: la
// pantalla tiene que esperarlas, y olvidarse del \`await\` se rompe también en la
// demo, que es donde se ve enseguida. Esas no son el problema de abajo.
const asyncEnLaDemo = () => {
  const src = leer('src/store/useStore.js')
  return new Set([...src.matchAll(/^ {2}([a-zA-Z]+): async \\(/gm)].map(m => m[1]))
}`

if (!s.includes('flechaCorta')) {
  if (s.split(viejo).length !== 2) throw new Error('no encuentro el detector')
  s = s.replace(viejo, nuevo)
}

const viejo2 = `  it('ninguna es \`async\` en el backend real', () => {
    const v2 = fuenteV2()
    const rotas = []
    for (const nombre of accionesConRespuesta()) {`
const nuevo2 = `  it('ninguna es \`async\` en el backend real (salvo si la demo también lo es)', () => {
    const v2 = fuenteV2()
    const rotas = []
    const yaEsperadas = asyncEnLaDemo()
    for (const nombre of accionesConRespuesta()) {
      if (yaEsperadas.has(nombre)) continue`

if (!s.includes('yaEsperadas')) {
  if (s.split(viejo2).length !== 2) throw new Error('no encuentro el test de async')
  s = s.replace(viejo2, nuevo2)
}

writeFileSync(p, s)
console.log('contrato.test.js parcheado')
