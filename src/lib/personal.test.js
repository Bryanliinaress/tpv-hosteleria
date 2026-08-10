import { describe, it, expect } from 'vitest'
import { revisarNuevoEmpleado, revisarCambioEmpleado, revisarBajaEmpleado, esUltimoAdmin } from './personal'

// Estas reglas estaban solo en la demo. En la app real no se comprobaba nada:
// dos empleados podían acabar con el MISMO PIN (y el TPV no sabe quién ficha)
// o el dueño podía quedarse sin ningún administrador.
const PLANTILLA = [
  { id: 'a1', nombre: 'Bryan', pin: '1234', rol: 'admin', activo: true },
  { id: 'c1', nombre: 'Ana', pin: '1111', rol: 'camarero', activo: true },
]

describe('dar de alta a alguien', () => {
  it('acepta un alta normal y devuelve los datos limpios', () => {
    expect(revisarNuevoEmpleado(PLANTILLA, { nombre: '  Luis ', pin: '2222' }))
      .toMatchObject({ ok: true, nombre: 'Luis', pin: '2222' })
  })

  it('el PIN es de cuatro dígitos', () => {
    expect(revisarNuevoEmpleado(PLANTILLA, { nombre: 'Luis', pin: '12' }).ok).toBe(false)
    expect(revisarNuevoEmpleado(PLANTILLA, { nombre: 'Luis', pin: 'abcd' }).ok).toBe(false)
    expect(revisarNuevoEmpleado(PLANTILLA, { nombre: 'Luis', pin: '' }).ok).toBe(false)
  })

  it('dos personas no pueden compartir PIN', () => {
    const r = revisarNuevoEmpleado(PLANTILLA, { nombre: 'Luis', pin: '1111' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/ya está en uso/i)
  })

  it('hace falta un nombre', () => {
    expect(revisarNuevoEmpleado(PLANTILLA, { nombre: '   ', pin: '2222' }).ok).toBe(false)
  })
})

describe('siempre tiene que quedar un administrador', () => {
  it('no se borra al último admin', () => {
    const r = revisarBajaEmpleado(PLANTILLA, 'a1')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/administrador/i)
  })

  it('ni se le desactiva, ni se le baja a camarero', () => {
    expect(revisarCambioEmpleado(PLANTILLA, 'a1', { activo: false }).ok).toBe(false)
    expect(revisarCambioEmpleado(PLANTILLA, 'a1', { rol: 'camarero' }).ok).toBe(false)
  })

  it('con dos admins sí se puede quitar a uno', () => {
    const dos = [...PLANTILLA, { id: 'a2', nombre: 'Loli', pin: '3333', rol: 'admin', activo: true }]
    expect(revisarBajaEmpleado(dos, 'a1').ok).toBe(true)
    expect(esUltimoAdmin(dos, 'a1')).toBe(false)
  })

  it('un admin DESACTIVADO no cuenta como respaldo', () => {
    const conInactivo = [...PLANTILLA, { id: 'a3', nombre: 'Ex', pin: '4444', rol: 'admin', activo: false }]
    expect(revisarBajaEmpleado(conInactivo, 'a1').ok).toBe(false)
  })

  it('borrar a un camarero nunca se bloquea', () => {
    expect(revisarBajaEmpleado(PLANTILLA, 'c1').ok).toBe(true)
  })
})

describe('cambiar el PIN', () => {
  it('no se puede poner el de otro', () => {
    expect(revisarCambioEmpleado(PLANTILLA, 'c1', { pin: '1234' }).ok).toBe(false)
  })

  it('mantener el suyo propio es válido', () => {
    expect(revisarCambioEmpleado(PLANTILLA, 'c1', { pin: '1111' }).ok).toBe(true)
  })

  it('cambiar solo el nombre no toca el PIN', () => {
    expect(revisarCambioEmpleado(PLANTILLA, 'c1', { nombre: 'Ana María' }).ok).toBe(true)
  })
})
