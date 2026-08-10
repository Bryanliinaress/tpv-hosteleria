import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tr } from './i18n'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Pantallas que ve el cliente: son las únicas que se traducen (la carta la
// escribe el local en su idioma).
const PANTALLAS = [
  'src/pages/cliente/CartaCliente.jsx',
  'src/pages/reservar/Reservar.jsx',
]

const clavesDelDiccionario = () => {
  const dic = readFileSync(join(RAIZ, 'src/lib/i18n.js'), 'utf8')
  const claves = new Set()
  for (const linea of dic.split('\n')) {
    const m = linea.match(/^\s*'(.+?)':\s*'/)
    if (m) claves.add(m[1])
  }
  return claves
}

// Reconoce `t('texto')` y también `t('texto con {hueco}', { hueco: x })`.
// Con la versión anterior, cualquier texto con parámetros se leía mal y su
// traducción podía faltar sin que nadie se enterara.
const textosUsados = (fichero) => {
  const src = readFileSync(join(RAIZ, fichero), 'utf8')
  return [...src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'\s*[,)]/g)].map(m => m[1])
}

describe('traducción de las pantallas del cliente', () => {
  it('no queda ningún texto sin traducir al inglés', () => {
    const claves = clavesDelDiccionario()
    const faltan = []
    for (const pantalla of PANTALLAS) {
      for (const texto of textosUsados(pantalla)) {
        if (!claves.has(texto)) faltan.push(`${pantalla}: «${texto}»`)
      }
    }
    // Si esto falla, añade la traducción en src/lib/i18n.js — un turista
    // estaba viendo esa frase en español.
    expect(faltan).toEqual([])
  })

  it('el diccionario no tiene traducciones vacías', () => {
    const dic = readFileSync(join(RAIZ, 'src/lib/i18n.js'), 'utf8')
    const vacias = [...dic.matchAll(/^\s*'(.+?)':\s*''/gm)].map(m => m[1])
    expect(vacias).toEqual([])
  })
})

describe('tr', () => {
  it('en español devuelve la clave tal cual', () => {
    expect(tr('es', 'Mi pedido')).toBe('Mi pedido')
  })

  it('en inglés traduce', () => {
    expect(tr('en', 'Mi pedido')).toBe('My order')
  })

  it('un texto sin traducir se muestra igual, no vacío', () => {
    expect(tr('en', 'Texto que no existe')).toBe('Texto que no existe')
  })
})

// El test de arriba solo mira lo que YA pasa por t(). El agujero real es el
// texto escrito directamente en el JSX: la pantalla de reservas estuvo entera
// en español y nadie se enteró, porque no llamaba a t() ni una vez.
describe('no queda texto en español fuera de t()', () => {
  // Palabras que aparecen en el JSX y no son texto para el cliente
  const PERMITIDO = [
    /^[\d\s.,:/·+×€%-]*$/,          // números, importes, separadores
    /^[A-Z]{2,}$/,                   // siglas
  ]
  const sospechosos = (fichero) => {
    const src = readFileSync(join(RAIZ, fichero), 'utf8')
    const fuera = []
    // atributos que el usuario lee
    for (const m of src.matchAll(/(placeholder|aria-label|title)="([^"]*[áéíóúñÁÉÍÓÚÑ¿¡][^"]*)"/g)) {
      fuera.push(`${m[1]}="${m[2]}"`)
    }
    // texto plano entre etiquetas JSX
    for (const m of src.matchAll(/>\s*([A-ZÁÉÍÓÚÑ¿¡][^<>{}\n]{3,80})\s*</g)) {
      const txt = m[1].trim()
      if (!PERMITIDO.some(r => r.test(txt))) fuera.push(`texto: ${txt}`)
    }
    return fuera
  }

  for (const pantalla of PANTALLAS) {
    it(`${pantalla} habla el idioma del cliente`, () => {
      expect(sospechosos(pantalla)).toEqual([])
    })
  }
})
