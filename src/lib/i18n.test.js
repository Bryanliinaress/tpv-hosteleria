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

const textosUsados = (fichero) => {
  const src = readFileSync(join(RAIZ, fichero), 'utf8')
  return [...src.matchAll(/\bt\('(.+?)'\)/g)].map(m => m[1])
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
