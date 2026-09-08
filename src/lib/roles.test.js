import { describe, it, expect } from 'vitest'
import { puedeAbrir, pantallaInicial, rolDe, nombreRol, ROLES, ROLES_ORDENADOS, PANTALLAS } from './roles'
import { revisarCambioEmpleado } from './personal'

// ────────────────────────────────────────────────────────────────────────────
// Quién abre qué. Es control de acceso: un fallo aquí no da error en pantalla,
// simplemente deja entrar a quien no debe. Antes había dos roles y «camarero»
// era en realidad «todo lo que no es Admin»: el PIN del cocinero, que acaba
// pegado en la pared de la plancha, abría el Mostrador — donde se cobra y se
// anula.
// ────────────────────────────────────────────────────────────────────────────
describe('qué abre cada rol', () => {
  it('cocina entra en las pantallas de producción', () => {
    expect(puedeAbrir('cocina', 'cocina')).toBe(true)
    expect(puedeAbrir('cocina', 'barra')).toBe(true)
    expect(puedeAbrir('cocina', 'print')).toBe(true)
  })

  it('cocina NO entra donde se cobra ni en Administración', () => {
    expect(puedeAbrir('cocina', 'camarero')).toBe(false)
    expect(puedeAbrir('cocina', 'pda')).toBe(false)
    expect(puedeAbrir('cocina', 'admin')).toBe(false)
  })

  // En un bar de dos personas sirve y mira la plancha la misma persona:
  // quitarle cocina al camarero sería romper lo que hoy funciona.
  it('el camarero conserva todo menos Administración', () => {
    for (const p of ['camarero', 'pda', 'cocina', 'barra', 'print']) {
      expect(puedeAbrir('camarero', p)).toBe(true)
    }
    expect(puedeAbrir('camarero', 'admin')).toBe(false)
  })

  it('el administrador entra en todo', () => {
    for (const p of Object.keys(PANTALLAS)) expect(puedeAbrir('admin', p)).toBe(true)
  })

  // Un rol desconocido —una fila vieja, un dedo torcido en la BBDD— no puede
  // acabar abriendo más de lo que abre el más común.
  it('un rol que no existe cae en camarero, no en administrador', () => {
    expect(rolDe('jefe_de_todo')).toBe('camarero')
    expect(puedeAbrir('jefe_de_todo', 'admin')).toBe(false)
    expect(nombreRol(undefined)).toBe('Camarero')
  })

  it('a cada rol se le puede ofrecer una pantalla suya', () => {
    for (const r of ROLES_ORDENADOS) {
      const p = pantallaInicial(r)
      expect(puedeAbrir(r, Object.keys(PANTALLAS).find(k => PANTALLAS[k] === p))).toBe(true)
    }
    expect(pantallaInicial('cocina').ruta).toBe('/cocina')
  })

  it('sin pantalla concreta vale cualquier empleado', () => {
    expect(puedeAbrir('cocina', undefined)).toBe(true)
  })

  it('todos los roles apuntan a pantallas que existen', () => {
    for (const r of Object.keys(ROLES)) {
      for (const p of ROLES[r].pantallas) expect(PANTALLAS[p]).toBeTruthy()
    }
  })
})

// La regla del último administrador se escribió comparando con 'camarero',
// cuando solo había dos roles. Con un tercero, bajar al último admin a cocina
// dejaba el local sin nadie que pudiera entrar en Administración.
describe('el último administrador', () => {
  const EMPLEADOS = [
    { id: 'a', nombre: 'Jefa', rol: 'admin', activo: true, pin: '1234' },
    { id: 'b', nombre: 'Luis', rol: 'camarero', activo: true, pin: '1111' },
  ]

  it('no se le puede bajar a cocina', () => {
    expect(revisarCambioEmpleado(EMPLEADOS, 'a', { rol: 'cocina' }).ok).toBe(false)
  })

  it('ni a camarero, ni desactivarlo', () => {
    expect(revisarCambioEmpleado(EMPLEADOS, 'a', { rol: 'camarero' }).ok).toBe(false)
    expect(revisarCambioEmpleado(EMPLEADOS, 'a', { activo: false }).ok).toBe(false)
  })

  it('a los demás sí', () => {
    expect(revisarCambioEmpleado(EMPLEADOS, 'b', { rol: 'cocina' }).ok).toBe(true)
  })

  it('con dos administradores, uno puede pasar a cocina', () => {
    const dos = [...EMPLEADOS, { id: 'c', nombre: 'Otro', rol: 'admin', activo: true, pin: '2222' }]
    expect(revisarCambioEmpleado(dos, 'a', { rol: 'cocina' }).ok).toBe(true)
  })
})
