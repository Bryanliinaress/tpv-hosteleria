import { describe, it, expect } from 'vitest'
import { resolverEmpleado } from './sesion'
import { empleadoPorPin } from '../store/useStore'

// ────────────────────────────────────────────────────────────────────────────
// Control de acceso del personal. La sesión vive en el dispositivo, así que
// NO puede ser la fuente de la verdad: manda siempre el padrón del local.
// ────────────────────────────────────────────────────────────────────────────

const PADRON = [
  { id: 'e1', nombre: 'María', rol: 'camarero', pin: '1111', activo: true },
  { id: 'e2', nombre: 'Jefa', rol: 'admin', pin: '1234', activo: true },
  { id: 'e3', nombre: 'Antiguo', rol: 'admin', pin: '9999', activo: false },
]

describe('resolverEmpleado', () => {
  it('devuelve al empleado del padrón', () => {
    expect(resolverEmpleado(PADRON, { id: 'e1' }).nombre).toBe('María')
  })

  it('un rol falseado en el dispositivo NO da permisos', () => {
    // alguien edita localStorage y se pone rol admin
    const forjada = { id: 'e1', nombre: 'María', rol: 'admin' }
    expect(resolverEmpleado(PADRON, forjada).rol).toBe('camarero')
  })

  it('un empleado desactivado pierde el acceso al instante', () => {
    expect(resolverEmpleado(PADRON, { id: 'e3' })).toBeNull()
  })

  it('un empleado borrado del padrón pierde el acceso', () => {
    expect(resolverEmpleado(PADRON, { id: 'borrado' })).toBeNull()
  })

  it('sin sesión, nadie', () => {
    expect(resolverEmpleado(PADRON, null)).toBeNull()
    expect(resolverEmpleado(PADRON, {})).toBeNull()
  })

  it('sin padrón cargado tampoco cuela', () => {
    expect(resolverEmpleado([], { id: 'e1' })).toBeNull()
    expect(resolverEmpleado(undefined, { id: 'e1' })).toBeNull()
  })
})

describe('empleadoPorPin', () => {
  it('encuentra por PIN', () => {
    expect(empleadoPorPin(PADRON, '1111').nombre).toBe('María')
  })

  it('el PIN de un empleado desactivado no abre', () => {
    expect(empleadoPorPin(PADRON, '9999')).toBeNull()
  })

  it('las pantallas de admin exigen rol admin', () => {
    expect(empleadoPorPin(PADRON, '1111', true)).toBeNull()   // camarero
    expect(empleadoPorPin(PADRON, '1234', true).nombre).toBe('Jefa')
  })

  it('un PIN que no existe no devuelve a nadie', () => {
    expect(empleadoPorPin(PADRON, '0000')).toBeNull()
    expect(empleadoPorPin(PADRON, '')).toBeNull()
  })
})
