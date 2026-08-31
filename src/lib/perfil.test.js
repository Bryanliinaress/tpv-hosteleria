import { describe, it, expect } from 'vitest'
import { leerPerfil, cssDeMarca, aplicarMarca, urlLogo, nombreDeLocalPorDefecto, PERFIL_GENERICO, esDemo, urlPublica, urlDeMesa } from './perfil'

describe('leerPerfil', () => {
  it('sin perfil inyectado usa la marca genérica', () => {
    expect(leerPerfil(undefined)).toBe(PERFIL_GENERICO)
  })

  it('completa los huecos del perfil del local', () => {
    const p = leerPerfil(JSON.stringify({ slug: 'bar-manolo', nombre: 'Bar Manolo' }))
    expect(p.nombre).toBe('Bar Manolo')
    expect(p.emoji).toBe('🍽')
    expect(p.modulos).toEqual({})
  })

  it('un JSON roto no tumba la app', () => {
    expect(leerPerfil('{roto')).toBe(PERFIL_GENERICO)
  })
})

describe('cssDeMarca', () => {
  it('escribe una regla por tema', () => {
    const css = cssDeMarca({ colores: { acento: '#111111', acento2: '#222222', acentoClaro: '#333333' } })
    expect(css).toContain(':root{--color-accent:#111111;--color-accent-2:#222222}')
    expect(css).toContain(':root[data-theme="light"]{--color-accent:#333333}')
  })

  it('sin colores propios no genera CSS', () => {
    expect(cssDeMarca({ colores: {} })).toBe('')
  })
})

describe('aplicarMarca', () => {
  // documento mínimo: sin jsdom, solo lo que aplicarMarca toca
  const docFalso = () => {
    const head = { hijos: [], appendChild(el) { this.hijos.push(el); return el } }
    return {
      head,
      createElement: () => ({ textContent: '' }),
      getElementById: (id) => head.hijos.find(h => h.id === id) || null,
    }
  }

  it('reutiliza el mismo <style> en vez de acumularlos', () => {
    const doc = docFalso()
    const p = { colores: { acento: '#111111' } }
    aplicarMarca(p, doc)
    aplicarMarca(p, doc)
    expect(doc.head.hijos).toHaveLength(1)
    expect(doc.head.hijos[0].textContent).toContain('#111111')
  })

  it('no toca el documento si el local no trae colores', () => {
    const doc = docFalso()
    expect(aplicarMarca({ colores: {} }, doc)).toBeNull()
    expect(doc.head.hijos).toHaveLength(0)
  })
})

describe('urlLogo', () => {
  it('cuelga el logo del base del despliegue', () => {
    expect(urlLogo({ logo: 'logo.svg' }, '/bar-manolo/')).toBe('/bar-manolo/marca/logo.svg')
  })

  it('sin logo propio devuelve null', () => {
    expect(urlLogo({ logo: null }, '/')).toBeNull()
  })
})

// El ticket y el recibo salían con «Mi Local» hasta que el dueño rellenaba
// Admin → Local, aunque la instalación fuera de marca blanca y ya supiera de
// qué bar es. El nombre por defecto sale ahora del perfil.
describe('nombre por defecto del local', () => {
  it('una instalación de marca usa su nombre', () => {
    expect(nombreDeLocalPorDefecto(leerPerfil('{"slug":"casa-loli","nombre":"Casa Loli"}'))).toBe('Casa Loli')
  })

  it('la demo genérica NO se apropia del ticket', () => {
    expect(nombreDeLocalPorDefecto(leerPerfil(null))).toBe('Mi Local')
    expect(nombreDeLocalPorDefecto(undefined)).toBe('Mi Local')
  })
})

// La demo y un bar real salen del mismo código y sus enlaces se parecen
// (`/tpv-hosteleria/` y `/tpv-hosteleria/app/`). Pedir en la demo creyendo que
// es el bar significa que ese pedido no existe para nadie: hay que avisarlo.
describe('una demo tiene que saberse que es una demo', () => {
  it('el perfil de una demostración se marca', () => {
    expect(esDemo(leerPerfil('{"slug":"demo","nombre":"TPV","demo":true}'))).toBe(true)
  })

  it('el de un bar real, no', () => {
    expect(esDemo(leerPerfil('{"slug":"casa-loli","nombre":"Casa Loli"}'))).toBe(false)
    expect(esDemo(leerPerfil('{"slug":"casa-loli","nombre":"Casa Loli","demo":false}'))).toBe(false)
  })

  it('ante la duda, NO es demo (no vamos a poner ese aviso en un bar)', () => {
    expect(esDemo(leerPerfil(null))).toBe(false)
    expect(esDemo(undefined)).toBe(false)
    expect(esDemo(leerPerfil('{"slug":"x","nombre":"X","demo":"si"}'))).toBe(false)
  })

  it('la pestaña del navegador lo dice, que es donde uno se confunde', () => {
    const doc = { title: '', getElementById: () => null, head: { appendChild: (x) => x }, createElement: () => ({}) }
    aplicarMarca(leerPerfil('{"slug":"demo","nombre":"TPV Hostelería","demo":true}'), doc)
    expect(doc.title).toBe('DEMO · TPV Hostelería')

    aplicarMarca(leerPerfil('{"slug":"casa-loli","nombre":"Casa Loli"}'), doc)
    expect(doc.title).toBe('Casa Loli')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// La dirección que va DENTRO del QR de mesa.
//
// Se imprime una vez, se pega en la mesa y se queda ahí meses. Se construía con
// `window.location`, así que bastaba con abrir Admin desde una build local para
// imprimir doce pegatinas apuntando a `localhost`.
// ────────────────────────────────────────────────────────────────────────────
describe('la dirección pública del local', () => {
  const loc = { origin: 'http://localhost:5186' }

  it('manda la del perfil, no por dónde se haya abierto el panel', () => {
    const p = { ...PERFIL_GENERICO, url: 'https://bar-manolo.es/' }
    expect(urlPublica(p, loc, '/')).toBe('https://bar-manolo.es/')
  })

  it('le pone la barra final si el perfil la trae sin ella', () => {
    const p = { ...PERFIL_GENERICO, url: 'https://bar-manolo.es' }
    expect(urlPublica(p, loc, '/')).toBe('https://bar-manolo.es/')
  })

  it('respeta el subdirectorio del despliegue', () => {
    const p = { ...PERFIL_GENERICO, url: 'https://usuario.github.io/tpv-hosteleria/' }
    expect(urlPublica(p, loc, '/')).toBe('https://usuario.github.io/tpv-hosteleria/')
  })

  it('sin dirección propia se cae a la actual, que es lo que había antes', () => {
    expect(urlPublica(PERFIL_GENERICO, loc, '/')).toBe('http://localhost:5186/')
    expect(urlPublica(PERFIL_GENERICO, loc, '/tpv-hosteleria/')).toBe('http://localhost:5186/tpv-hosteleria/')
  })

  it('el QR de una mesa cuelga de ahí', () => {
    const p = { ...PERFIL_GENERICO, url: 'https://bar-manolo.es/' }
    expect(urlDeMesa('abc-123', p, loc, '/')).toBe('https://bar-manolo.es/#/mesa/abc-123')
  })

  it('y sin perfil sigue funcionando, aunque apunte a donde estés', () => {
    expect(urlDeMesa('abc-123', PERFIL_GENERICO, loc, '/')).toBe('http://localhost:5186/#/mesa/abc-123')
  })
})
