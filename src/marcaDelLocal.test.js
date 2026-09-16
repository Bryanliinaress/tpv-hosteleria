import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// ────────────────────────────────────────────────────────────────────────────
// La marca la pone el LOCAL, no Marchando.
//
// Cada bar trae su acento en `locales/<slug>/perfil.json`, y toda la interfaz
// lo lee de `var(--color-accent)`. Pero en cinco sitios el naranja de Marchando
// (#f97316 / rgba(249,115,22,…)) estaba escrito a pelo: la portada, el cartel
// de onboarding, el calendario, la selección de mesas y los botones de
// Reservar. Con un bar de marca dorada —Casa Loli— salían resplandores
// naranjas debajo de botones dorados.
//
// Es el patrón de siempre en este repo: la misma regla escrita dos veces, y
// una de las dos deja de cumplirse. Aquí el token manda; si hace falta el
// acento translúcido, se mezcla con `color-mix`, no se copia el hex.
// ────────────────────────────────────────────────────────────────────────────

const AQUI = dirname(fileURLToPath(import.meta.url))
const NARANJA_MARCHANDO = /#f97316|249\s*,\s*115\s*,\s*22/i

function fuentes(dir) {
  const salida = []
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) { salida.push(...fuentes(ruta)); continue }
    if (!/\.(js|jsx)$/.test(entrada) || /\.test\.(js|jsx)$/.test(entrada)) continue
    salida.push(ruta)
  }
  return salida
}

describe('la marca del local', () => {
  it('no lleva el acento de Marchando escrito a pelo en ninguna pantalla', () => {
    const culpables = fuentes(AQUI)
      .filter(f => NARANJA_MARCHANDO.test(readFileSync(f, 'utf8')))
      .map(f => relative(AQUI, f))

    expect(culpables, 'usa var(--color-accent), o color-mix() si lo quieres translúcido').toEqual([])
  })

  it('la portada deja al logo del local su propia proporción', () => {
    const home = readFileSync(join(AQUI, 'pages', 'Home.jsx'), 'utf8')

    // Un logo de bar suele ser una palabra larga («Casa Loli»), no un cuadrado.
    // Metido en la caja cuadrada de 4,25rem quedaba a tres píxeles de alto.
    expect(home).toMatch(/width: 'auto'/)
    expect(home).not.toMatch(/<img[^>]*width: '100%', height: '100%'/)
  })
})
