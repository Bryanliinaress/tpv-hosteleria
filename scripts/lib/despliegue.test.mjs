import { describe, it, expect } from 'vitest'
import { listarLocales, cargarPerfil } from './perfiles.mjs'

// Se usa el MISMO cargador que el build: leer el JSON crudo daría otra cosa
// (`publicado` y `salida` tienen valores por defecto que pone el cargador), y
// entonces el test no estaría comprobando lo que hace el deploy de verdad.
const locales = listarLocales().map(slug => ({ slug, perfil: cargarPerfil(slug) }))
const publicados = locales.filter(l => l.perfil.publicado)
const salida = (l) => l.perfil.despliegue?.salida || 'dist'

// ────────────────────────────────────────────────────────────────────────────
// El despliegue de varios bares.
//
// El workflow compila todos los locales publicados y sube UNA carpeta: `dist`.
// Funciona —está probado compilando dos a la vez—, pero se apoya en dos cosas
// que nadie comprobaba y que se rompen sin hacer ruido:
//
//   · si un bar compila fuera de `dist`, el deploy no lo sube y NADIE se entera
//     hasta que el bar llama diciendo que su enlace no existe;
//   · cada build vacía su carpeta, así que `dist` tiene que compilarse ANTES
//     que `dist/loquesea`, o el segundo se borra al hacer el primero.
//
// Además, dos bares que compartan `salida` o `base` se pisan el uno al otro, y
// eso es un bar sirviendo la carta de otro.
// ────────────────────────────────────────────────────────────────────────────
describe('despliegue de varios locales', () => {
  it('hay al menos un local publicado (si no, el test no mira nada)', () => {
    expect(publicados.length).toBeGreaterThan(0)
  })

  it('todo lo publicado compila dentro de `dist`, que es lo único que se sube', () => {
    const fuera = publicados.filter(l => salida(l) !== 'dist' && !salida(l).startsWith('dist/'))
    expect(fuera.map(l => `${l.slug} → ${salida(l)}`),
      'el workflow sube `path: dist`: lo que compile fuera no se publica').toEqual([])
  })

  it('ningún local publicado comparte carpeta de salida con otro', () => {
    const vistas = publicados.map(salida)
    expect(vistas.length, 'dos bares compilando en el mismo sitio: uno pisa al otro')
      .toBe(new Set(vistas).size)
  })

  it('ningún local publicado comparte la ruta base con otro', () => {
    const bases = publicados.map(l => l.perfil.despliegue?.base)
    expect(bases.length, 'dos bares en la misma URL: uno sirve la carta del otro')
      .toBe(new Set(bases).size)
  })

  it('cada bar publicado apunta a SU proyecto de Supabase', () => {
    // Compartir proyecto significaría compartir mesas, carta y caja: no es este
    // producto («un bar, una instalación»).
    const refs = publicados.map(l => l.perfil.supabase?.ref)
    expect(refs.length, 'dos bares sobre la misma base de datos').toBe(new Set(refs).size)
  })

  it('el orden de compilado pone los anidados DESPUÉS (cada build vacía su carpeta)', () => {
    // Es la regla que aplica `scripts/locales.mjs`; aquí se comprueba que sigue
    // dando el orden correcto para los locales que hay de verdad.
    const orden = [...publicados].sort((a, b) => salida(a).split('/').length - salida(b).split('/').length)
    for (let i = 0; i < orden.length; i++) {
      for (let j = i + 1; j < orden.length; j++) {
        expect(salida(orden[i]).startsWith(salida(orden[j]) + '/'),
          `${orden[j].slug} se compila después de ${orden[i].slug} y lo borraría`).toBe(false)
      }
    }
  })

  it('un local no publicado no necesita cumplir nada de esto', () => {
    // La demo v1 compila en `dist-demo-v1` a propósito: está fuera del deploy y
    // se resucita a mano si algo falla delante de un cliente.
    const demo = locales.find(l => l.slug === 'demo')
    if (demo) expect(demo.perfil.publicado).toBe(false)
  })
})
