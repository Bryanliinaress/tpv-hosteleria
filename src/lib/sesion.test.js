import { describe, it, expect } from 'vitest'
import { resolverEmpleado, caducada, CADUCIDAD } from './sesion'
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

// ────────────────────────────────────────────────────────────────────────────
// Caducidad por inactividad.
//
// La sesión no caducaba nunca: el encargado entraba con su PIN, dejaba la
// tablet en la barra y quien la cogiera tenía Admin —caja, precios, borrar
// empleados, cerrar mesas sin cobrar—. Pero el plazo del camarero NO puede ser
// el mismo: pedirle el PIN cada diez minutos en pleno servicio acaba con un
// 0000 compartido, que es peor que no tener PIN.
// ────────────────────────────────────────────────────────────────────────────
describe('caducidad de la sesión', () => {
  const AHORA = 1_700_000_000_000
  const hace = (ms) => AHORA - ms

  it('al administrador se le cierra la sesión si deja la tablet quieta', () => {
    const s = { id: 'e2', rol: 'admin', visto: hace(CADUCIDAD.admin + 1000) }
    expect(caducada(s, AHORA)).toBe(true)
    expect(resolverEmpleado(PADRON, s, AHORA)).toBeNull()
  })

  it('al administrador que sigue usándola, no', () => {
    const s = { id: 'e2', rol: 'admin', visto: hace(60_000) }
    expect(caducada(s, AHORA)).toBe(false)
    expect(resolverEmpleado(PADRON, s, AHORA).nombre).toBe('Jefa')
  })

  it('el camarero aguanta el servicio entero sin volver a teclear el PIN', () => {
    const s = { id: 'e1', rol: 'camarero', visto: hace(6 * 60 * 60_000) }
    expect(caducada(s, AHORA)).toBe(false)
    expect(resolverEmpleado(PADRON, s, AHORA).nombre).toBe('María')
  })

  it('pero una tablet olvidada toda la noche sí se cierra', () => {
    const s = { id: 'e1', rol: 'camarero', visto: hace(CADUCIDAD.staff + 1000) }
    expect(caducada(s, AHORA)).toBe(true)
  })

  it('el plazo del admin es mucho más corto que el del camarero', () => {
    expect(CADUCIDAD.admin).toBeLessThan(CADUCIDAD.staff)
  })

  it('una sesión de una versión anterior (sin `visto`) no echa a nadie de golpe', () => {
    // El día que esto se despliega, nadie debería encontrarse la sesión cerrada
    // sin haber hecho nada: se le da por buena y el primer toque la pone al día.
    const s = { id: 'e2', rol: 'admin' }
    expect(caducada(s, AHORA)).toBe(false)
  })

  it('sin sesión, caducada', () => {
    expect(caducada(null, AHORA)).toBe(true)
    expect(caducada({}, AHORA)).toBe(true)
  })

  it('un rol falseado a la baja NO regala plazo al administrador', () => {
    // La trampa evidente: el admin se escribe `rol: camarero` en localStorage
    // para pasar de 5 minutos a 12 horas. El plazo sale del PADRÓN, así que
    // sigue caducando como lo que es.
    const s = { id: 'e2', rol: 'camarero', visto: hace(CADUCIDAD.admin + 1000) }
    expect(resolverEmpleado(PADRON, s, AHORA)).toBeNull()
  })

  it('un rol falseado al alza tampoco da permisos (seguía sin darlos)', () => {
    const s = { id: 'e1', rol: 'admin', visto: hace(60_000) }
    expect(resolverEmpleado(PADRON, s, AHORA).rol).toBe('camarero')
  })
})
