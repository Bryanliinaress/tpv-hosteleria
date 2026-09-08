// ────────────────────────────────────────────────────────────────────────────
// Qué abre cada rol.
//
// Había dos roles, Administrador y Camarero, y «camarero» era en realidad
// «todo lo que no es Admin»: el mismo PIN abría el Mostrador —donde se cobra y
// se anula— y la pantalla de cocina. En un bar con cocinero eso no vale: el
// cocinero necesita el KDS y nada más, y su PIN acaba pegado en la pared de la
// plancha.
//
// La tabla `empleados` ya admitía 'cocina' desde la primera migración; lo que
// faltaba era la regla y poder elegirlo.
//
// Vive aquí, en un solo sitio, porque lo miran tres: las rutas, el panel de
// personal y el aviso de «tu PIN no abre esta pantalla». Escrito tres veces,
// dos acabarían diciendo otra cosa — y en un control de acceso eso significa
// que alguien entra donde no debe.
// ────────────────────────────────────────────────────────────────────────────

/** Las pantallas de personal, por su ruta. */
export const PANTALLAS = {
  camarero: { label: 'Mostrador', ruta: '/camarero' },
  pda: { label: 'PDA', ruta: '/pda' },
  cocina: { label: 'Cocina', ruta: '/cocina' },
  barra: { label: 'Barra', ruta: '/barra' },
  print: { label: 'Impresión', ruta: '/print' },
  admin: { label: 'Administración', ruta: '/admin' },
}

// El camarero conserva cocina y barra a propósito: en un bar de dos personas
// es la misma persona la que sirve y la que mira la plancha, y quitárselo
// sería estropear lo que hoy funciona para arreglar lo que falta.
export const ROLES = {
  admin: {
    label: 'Administrador',
    emoji: '🔐',
    desc: 'Todo, incluido el panel de administración',
    pantallas: ['camarero', 'pda', 'cocina', 'barra', 'print', 'admin'],
  },
  camarero: {
    label: 'Camarero',
    emoji: '👤',
    desc: 'Sala, pedidos y cobro. No entra en Administración',
    pantallas: ['camarero', 'pda', 'cocina', 'barra', 'print'],
  },
  cocina: {
    label: 'Cocina',
    emoji: '🍳',
    desc: 'Solo las pantallas de producción: no cobra ni anula',
    pantallas: ['cocina', 'barra', 'print'],
  },
}

/** Lista para los desplegables, en orden de menos a más permisos. */
export const ROLES_ORDENADOS = ['cocina', 'camarero', 'admin']

/** El rol, o el de camarero si viene uno que no conocemos. */
export const rolDe = (rol) => ROLES[rol] ? rol : 'camarero'

/** Cómo se llama ese rol en pantalla. */
export const nombreRol = (rol) => ROLES[rolDe(rol)].label

/** ¿Este rol abre esa pantalla? */
export function puedeAbrir(rol, pantalla) {
  if (!pantalla || pantalla === 'staff') return true   // cualquier empleado activo
  return ROLES[rolDe(rol)].pantallas.includes(pantalla)
}

/** La primera pantalla que sí abre: a dónde mandarlo cuando llama a la que no. */
export function pantallaInicial(rol) {
  const suyas = ROLES[rolDe(rol)].pantallas
  return PANTALLAS[suyas[0]]
}
