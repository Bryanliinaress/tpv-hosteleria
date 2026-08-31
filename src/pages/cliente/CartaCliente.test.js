import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ────────────────────────────────────────────────────────────────────────────
// Cobrar da por hecho que se ha pedido.
//
// La cuenta que ve el cliente incluye las líneas que la cocina aún no ha
// recibido, así que se podía añadir un plato, ir directo a Pagar, pagarlo por
// Stripe y marcharse: **el dinero entra y la comida no existe para nadie**.
//
// Se arregló enviando ANTES de cobrar (`enviarSiFalta`). Este test existe para
// que un cuarto camino de cobro no se lo salte: es fácil añadir un botón nuevo
// y no acordarse.
// ────────────────────────────────────────────────────────────────────────────
const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'CartaCliente.jsx'), 'utf8')

// El cuerpo de una función `const nombre = async (...) => { ... }`
function cuerpoDe(nombre) {
  const i = src.indexOf(`const ${nombre} = `)
  if (i < 0) return null
  const abre = src.indexOf('{', i)
  let n = 0
  for (let j = abre; j < src.length; j++) {
    if (src[j] === '{') n++
    else if (src[j] === '}' && --n === 0) return src.slice(abre, j + 1)
  }
  return null
}

describe('todo lo que cobra manda primero a la cocina', () => {
  for (const fn of ['pagarOnline', 'pagarTodoOnline', 'pedirCuentaConEnvio']) {
    it(`${fn} no cobra sin enviar lo pendiente`, () => {
      const cuerpo = cuerpoDe(fn)
      expect(cuerpo, `no encuentro ${fn}`).toBeTruthy()
      expect(cuerpo).toContain('enviarSiFalta')
    })
  }

  it('y si el envío falla, no se sigue cobrando', () => {
    for (const fn of ['pagarOnline', 'pagarTodoOnline', 'pedirCuentaConEnvio']) {
      expect(cuerpoDe(fn)).toMatch(/if\s*\(!\(await enviarSiFalta\(\)\)\)\s*return/)
    }
  })

  // Ningún botón puede llamar a `pedirCuenta(mesaId)` a pelo saltándose el envío.
  it('no queda ningún `pedirCuenta` suelto en un botón', () => {
    expect(src).not.toMatch(/onClick=\{[^}]*[^a-zA-Z]pedirCuenta\(mesaId\)/)
  })
})
