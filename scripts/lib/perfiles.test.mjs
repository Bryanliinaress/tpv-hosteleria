import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  listarLocales, cargarPerfil, normalizarPerfil, envDePerfil, aplicarEnv, perfilPublico,
} from './perfiles.mjs'

let dir
const escribir = (slug, perfil) => {
  mkdirSync(join(dir, slug), { recursive: true })
  writeFileSync(join(dir, slug, 'perfil.json'), typeof perfil === 'string' ? perfil : JSON.stringify(perfil))
}
const base = { marca: { nombre: 'Bar Manolo' }, supabase: { url: 'https://x.supabase.co', anonKey: 'k' } }

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'locales-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('listarLocales', () => {
  it('lista los locales reales y deja fuera plantillas y basura', () => {
    escribir('bar-manolo', base)
    escribir('_plantilla', base)
    mkdirSync(join(dir, 'sin-perfil'))
    expect(listarLocales(dir)).toEqual(['bar-manolo'])
  })

  it('devuelve vacío si aún no hay carpeta de locales', () => {
    expect(listarLocales(join(dir, 'no-existe'))).toEqual([])
  })
})

describe('cargarPerfil', () => {
  it('rellena los valores por defecto', () => {
    escribir('bar-manolo', base)
    const p = cargarPerfil('bar-manolo', dir)
    expect(p.slug).toBe('bar-manolo')
    expect(p.marca.emoji).toBe('🍽')
    expect(p.marca.colores.acento).toBe('#f97316')
    expect(p.backend).toBe('v2')
    expect(p.despliegue.base).toBe('/')
  })

  it('recorta el nombre corto de la PWA si no lo dan', () => {
    escribir('bar-manolo', { marca: { nombre: 'Restaurante La Buena Mesa' } })
    expect(cargarPerfil('bar-manolo', dir).marca.corto).toBe('Restaurante')
    escribir('bar-pepe', { marca: { nombre: 'Bar Pepe' } })
    expect(cargarPerfil('bar-pepe', dir).marca.corto).toBe('Bar Pepe')
  })

  it('respeta lo que trae el perfil', () => {
    escribir('bar-manolo', { ...base, marca: { nombre: 'Bar Manolo', emoji: '🍻', colores: { acento: '#123456' } }, backend: 'v1' })
    const p = cargarPerfil('bar-manolo', dir)
    expect(p.marca.emoji).toBe('🍻')
    expect(p.marca.colores.acento).toBe('#123456')
    expect(p.marca.colores.acento2).toBe('#fb923c')  // el resto sigue por defecto
    expect(p.backend).toBe('v1')
  })

  it('dice qué locales hay cuando el slug no existe', () => {
    escribir('bar-manolo', base)
    expect(() => cargarPerfil('bar-pepe', dir)).toThrow(/bar-manolo/)
  })

  it('avisa si el JSON está roto', () => {
    escribir('bar-manolo', '{ esto no es json')
    expect(() => cargarPerfil('bar-manolo', dir)).toThrow(/no es JSON válido/)
  })
})

describe('normalizarPerfil', () => {
  it('exige el nombre de la marca', () => {
    expect(() => normalizarPerfil({ marca: {} }, 'bar-manolo')).toThrow(/marca.nombre/)
  })

  it('rechaza colores que no son hex de 6 dígitos', () => {
    expect(() => normalizarPerfil({ marca: { nombre: 'X', colores: { acento: 'naranja' } } }, 'bar-manolo'))
      .toThrow(/acento/)
  })

  it('rechaza un slug que no coincide con la carpeta', () => {
    expect(() => normalizarPerfil({ slug: 'otro', marca: { nombre: 'X' } }, 'bar-manolo')).toThrow(/no coincide/)
  })

  it('rechaza slugs con formato inválido', () => {
    expect(() => normalizarPerfil({ marca: { nombre: 'X' } }, 'Bar Manolo')).toThrow(/minúsculas/)
  })
})

describe('envDePerfil', () => {
  it('traduce el perfil a variables del build', () => {
    escribir('bar-manolo', { ...base, despliegue: { base: '/bar/' }, fiscal: 'verifactu', modulos: { pagosOnline: true } })
    const env = envDePerfil(cargarPerfil('bar-manolo', dir))
    expect(env.VITE_SUPABASE_URL).toBe('https://x.supabase.co')
    expect(env.VITE_BASE).toBe('/bar/')
    expect(env.VITE_FISCAL).toBe('verifactu')
    expect(env.VITE_PAGOS_ONLINE).toBe('1')
    expect(JSON.parse(env.VITE_PERFIL).nombre).toBe('Bar Manolo')
  })

  it('omite los módulos apagados y lo que el perfil no define', () => {
    escribir('bar-manolo', base)
    const env = envDePerfil(cargarPerfil('bar-manolo', dir))
    expect(env.VITE_PAGOS_ONLINE).toBeUndefined()
    expect(env.VITE_FISCAL).toBeUndefined()
  })
})

describe('aplicarEnv', () => {
  it('no pisa lo que ya venga del entorno (secretos del workflow)', () => {
    escribir('bar-manolo', base)
    const destino = { VITE_SUPABASE_ANON_KEY: 'la-del-workflow' }
    aplicarEnv(cargarPerfil('bar-manolo', dir), destino)
    expect(destino.VITE_SUPABASE_ANON_KEY).toBe('la-del-workflow')
    expect(destino.VITE_SUPABASE_URL).toBe('https://x.supabase.co')
  })
})

describe('perfilPublico', () => {
  it('nunca expone claves al navegador', () => {
    escribir('bar-manolo', base)
    const pub = perfilPublico(cargarPerfil('bar-manolo', dir))
    expect(JSON.stringify(pub)).not.toContain('anonKey')
    expect(JSON.stringify(pub)).not.toContain('supabase')
    expect(pub.logo).toBeNull()
  })
})
