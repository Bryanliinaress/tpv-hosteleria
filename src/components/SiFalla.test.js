import { describe, it, expect } from 'vitest'
import { esChunkQueNoLlega } from './SiFalla'

// ────────────────────────────────────────────────────────────────────────────
// Distinguir «trozo de la app que no llega» de «error de verdad» importa
// porque el mensaje es distinto: lo primero se arregla recargando y no es
// culpa de nadie (pasa al recargar una pestaña vieja después de un despliegue);
// lo segundo hay que contarlo.
//
// Los navegadores no se ponen de acuerdo en el texto, así que hay que
// reconocerlos todos: si uno se escapa, el camarero lee «esta pantalla se ha
// quedado atascada» cuando lo único que pasa es que hay versión nueva.
// ────────────────────────────────────────────────────────────────────────────
describe('trozo de la app que no llega', () => {
  const casos = [
    ['Chrome', { name: 'ChunkLoadError', message: 'Loading chunk 42 failed.' }],
    ['Vite/ESM', { message: 'Failed to fetch dynamically imported module: https://…/assets/PanelAdmin-abc.js' }],
    ['Firefox', { message: 'error loading dynamically imported module' }],
    ['Safari', { message: 'Importing a module script failed.' }],
  ]
  for (const [navegador, e] of casos) {
    it(`lo reconoce en ${navegador}`, () => expect(esChunkQueNoLlega(e)).toBe(true))
  }

  it('un error de verdad NO se confunde con una versión nueva', () => {
    expect(esChunkQueNoLlega(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false)
  })

  it('aguanta un error sin mensaje sin romperse', () => {
    expect(esChunkQueNoLlega(null)).toBe(false)
    expect(esChunkQueNoLlega({})).toBe(false)
  })
})
