import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')

// ────────────────────────────────────────────────────────────────────────────
// Lo que corre en NODE PURO, fuera del navegador.
//
// El servicio de impresión (`scripts/impresion-automatica.mjs`) importa código
// de `src/lib/`. Y ahí hay una diferencia que no perdona: **Vite resuelve
// `./dinero`, Node no**. Un import sin extensión compila, pasa el lint, pasa
// los tests del navegador… y tira el servicio de impresión al arrancar con
// ERR_MODULE_NOT_FOUND. El bar se queda sin imprimir y nadie se entera hasta
// que llega una comanda.
//
// Pasó de verdad al meter `dinero.js` en `escpos.js`.
// ────────────────────────────────────────────────────────────────────────────

// Ficheros de src/ que importan los scripts de Node.
function importadosPorScripts() {
  const dir = join(RAIZ, 'scripts')
  const scripts = readdirSync(dir).filter(f => f.endsWith('.mjs'))
  const objetivo = new Set()
  for (const f of scripts) {
    const src = readFileSync(join(dir, f), 'utf8')
    for (const m of src.matchAll(/from\s+'\.\.\/(src\/[^']+)'/g)) objetivo.add(m[1])
  }
  return [...objetivo]
}

// Sigue la cadena: lo que importa un fichero de src/, y lo que importa ese…
function cadenaCompleta(entradas) {
  const vistos = new Set()
  const pendientes = [...entradas]
  while (pendientes.length) {
    const f = pendientes.pop()
    if (vistos.has(f)) continue
    vistos.add(f)
    let src
    try { src = leer(f) } catch { continue }
    for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
      const rel = m[1]
      const base = join(dirname(f), rel).replace(/\\/g, '/')
      pendientes.push(base.endsWith('.js') ? base : `${base}.js`)
    }
  }
  return [...vistos]
}

describe('lo que corre en Node puro', () => {
  const entradas = importadosPorScripts()

  it('algún script de Node importa código de src/ (si no, esto no mira nada)', () => {
    expect(entradas.length).toBeGreaterThan(0)
  })

  it('esos ficheros y su cadena importan SIEMPRE con extensión .js', () => {
    const sinExtension = []
    for (const f of cadenaCompleta(entradas)) {
      let src
      try { src = leer(f) } catch { continue }
      for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
        if (!m[1].endsWith('.js')) sinExtension.push(`${f} → ${m[1]}`)
      }
    }
    expect(sinExtension,
      'Vite lo resuelve pero Node no: el servicio de impresión moriría al arrancar')
      .toEqual([])
  })

  it('y de hecho se pueden importar desde Node', async () => {
    // La prueba definitiva: si esto carga, el servicio de impresión arranca.
    for (const f of entradas) {
      await expect(import(`../../${f}`), `${f} no se puede importar desde Node`).resolves.toBeTruthy()
    }
  })
})
