import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { retencionDias, purgaActiva, RETENCION_POR_DEFECTO } from './privacidad'

// ────────────────────────────────────────────────────────────────────────────
// El plazo de conservación se dice en un solo sitio.
//
// Estaba escrito CINCO veces (`retencionDias ?? 30`): la purga de la demo, la
// del servidor, la pantalla de ajustes, el texto de Reservar y —al añadirla—
// la página de privacidad. Cuando una regla se escribe cinco veces, en este
// repo siempre acaba igual: una deja de coincidir. Y aquí la que mentiría es
// la que se le enseña al cliente diciendo cuánto guardas sus datos.
// ────────────────────────────────────────────────────────────────────────────

describe('el plazo de conservación de reservas', () => {
  it('usa el del local cuando es un número válido', () => {
    expect(retencionDias({ retencionDias: 7 })).toBe(7)
    expect(retencionDias({ retencionDias: '15' })).toBe(15)
  })

  it('cae al de por defecto si no hay nada configurado', () => {
    expect(retencionDias({})).toBe(RETENCION_POR_DEFECTO)
    expect(retencionDias(undefined)).toBe(RETENCION_POR_DEFECTO)
    expect(retencionDias(null)).toBe(RETENCION_POR_DEFECTO)
  })

  it('respeta el 0: «guardar indefinidamente» es una decisión del local', () => {
    // Purgar con 0 borraría reservas que el bar ha decidido conservar a
    // propósito. Lo dice su propio test desde antes que esto existiera.
    expect(retencionDias({ retencionDias: 0 })).toBe(0)
    expect(purgaActiva({ retencionDias: 0 })).toBe(false)
    expect(purgaActiva({ retencionDias: 30 })).toBe(true)
  })

  it('lo que no es un número sí cae al de por defecto', () => {
    expect(retencionDias({ retencionDias: -5 })).toBe(RETENCION_POR_DEFECTO)
    expect(retencionDias({ retencionDias: 'lo que sea' })).toBe(RETENCION_POR_DEFECTO)
    expect(retencionDias({ retencionDias: '' })).toBe(RETENCION_POR_DEFECTO)
  })

  it('no admite medio día', () => {
    expect(retencionDias({ retencionDias: 30.7 })).toBe(30)
  })
})

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

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

describe('nadie se escribe el plazo por su cuenta', () => {
  it('solo lib/privacidad.js sabe cuál es el plazo por defecto', () => {
    const culpables = fuentes(SRC)
      .filter(f => !f.endsWith(join('lib', 'privacidad.js')))
      .filter(f => /retencionDias\s*(\?\?|\|\|)\s*\d/.test(readFileSync(f, 'utf8')))
      .map(f => relative(SRC, f))

    expect(culpables, 'usa retencionDias() de lib/privacidad.js').toEqual([])
  })
})

describe('la página de privacidad', () => {
  const pagina = readFileSync(join(SRC, 'pages', 'legal', 'Privacidad.jsx'), 'utf8')

  it('enseña los huecos en vez de rellenarlos sola', () => {
    // Una política con un NIF inventado es peor que no tenerla.
    expect(pagina).toMatch(/pendiente de rellenar/)
    expect(pagina).toMatch(/function Falta/)
  })

  it('no trae ningún dato de un local escrito a mano', () => {
    expect(pagina).not.toMatch(/\b[A-Z]\d{8}\b/)            // un NIF
    expect(pagina).not.toMatch(/@(gmail|hotmail|outlook)\./) // un correo real
  })
})
