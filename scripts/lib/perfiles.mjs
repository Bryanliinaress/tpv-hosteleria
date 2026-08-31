// ────────────────────────────────────────────────────────────────────────────
// Perfiles de local — un producto, N instalaciones.
//
// Cada bar vive en `locales/<slug>/perfil.json`: su marca, su dominio, su
// proyecto de Supabase y qué módulos lleva. El código es el mismo para todos;
// lo único que cambia es el perfil con el que se compila:
//
//     LOCAL=casa-loli npm run build
//
// Este módulo lo usan tanto vite.config.js (para inyectar el entorno y la
// marca en el build) como los scripts de alta y de redespliegue.
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DIR_LOCALES = join(RAIZ, 'locales')

// Los directorios que empiezan por «_» son plantillas, no locales reales.
const esLocal = (nombre, dir) => !nombre.startsWith('_') && !nombre.startsWith('.') &&
  statSync(join(dir, nombre)).isDirectory() && existsSync(join(dir, nombre, 'perfil.json'))

/** Slugs de todos los locales dados de alta, en orden alfabético. */
export function listarLocales(dirLocales = DIR_LOCALES) {
  if (!existsSync(dirLocales)) return []
  return readdirSync(dirLocales).filter(n => esLocal(n, dirLocales)).sort()
}

const HEX = /^#[0-9a-fA-F]{6}$/
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

const PREDET = {
  emoji: '🍽',
  descripcion: 'Carta, pedidos y reservas.',
  colores: {
    acento: '#f97316', acento2: '#fb923c',        // tema oscuro
    acentoClaro: '#c2410c', acento2Claro: '#ea580c', // tema claro
    fondo: '#0b1120',                                 // fondo de arranque (PWA)
    tema: '#0f172a',                                  // barra del navegador / PWA
  },
}

/**
 * Valida y normaliza un perfil ya leído de disco. Devuelve el perfil completo
 * (con los valores por defecto rellenados) o lanza con un mensaje que dice
 * exactamente qué falta.
 */
export function normalizarPerfil(bruto, slug) {
  const err = (m) => { throw new Error(`locales/${slug}/perfil.json — ${m}`) }
  if (!bruto || typeof bruto !== 'object') err('no contiene un objeto JSON')
  if (bruto.slug && bruto.slug !== slug) err(`el campo "slug" (${bruto.slug}) no coincide con la carpeta (${slug})`)
  if (!SLUG.test(slug)) err('el slug debe ser minúsculas, números y guiones (ej. "bar-manolo")')

  const marca = bruto.marca || {}
  if (!marca.nombre) err('falta marca.nombre (el nombre que verá el cliente)')

  const colores = { ...PREDET.colores, ...(marca.colores || {}) }
  for (const [k, v] of Object.entries(colores)) {
    if (!HEX.test(v)) err(`marca.colores.${k} debe ser un color hex de 6 dígitos (recibido: ${v})`)
  }

  const supabase = bruto.supabase || {}
  const despliegue = bruto.despliegue || {}

  return {
    slug,
    marca: {
      nombre: marca.nombre,
      // nombre bajo el icono de la PWA: 12 caracteres como mucho
      corto: marca.corto || (marca.nombre.length <= 12 ? marca.nombre : marca.nombre.split(' ')[0].slice(0, 12)),
      descripcion: marca.descripcion || PREDET.descripcion,
      emoji: marca.emoji || PREDET.emoji,
      colores,
    },
    despliegue: {
      base: despliegue.base || '/',
      url: despliegue.url || null,
      // carpeta del build; por defecto cada local en la suya
      salida: despliegue.salida || `dist/${slug}`,
    },
    supabase: {
      ref: supabase.ref || null,
      url: supabase.url || null,
      anonKey: supabase.anonKey || null,
    },
    backend: bruto.backend || 'v2',
    // Una instalación de DEMOSTRACIÓN: los pedidos no son de nadie. Se avisa en
    // pantalla porque su enlace se parece mucho al de un bar de verdad y
    // confundirlos significa pedir en el sitio equivocado.
    demo: bruto.demo === true,
    // ¿Entra en el despliegue? Un local con `publicado: false` sigue dado de
    // alta —se compila nombrándolo a mano— pero no sale del deploy. Tener dos
    // enlaces vivos que se parecen no es una ventaja: durante meses se pidió
    // en la demo esperando que saliera por la impresora del bar.
    publicado: bruto.publicado !== false,
    fiscal: bruto.fiscal || null,
    modulos: { ...(bruto.modulos || {}) },
  }
}

/** Lee `locales/<slug>/perfil.json` y lo normaliza. */
export function cargarPerfil(slug, dirLocales = DIR_LOCALES) {
  const dir = join(dirLocales, slug)
  const fichero = join(dir, 'perfil.json')
  if (!existsSync(fichero)) {
    const hay = listarLocales(dirLocales)
    throw new Error(`No existe el local "${slug}" (falta ${fichero}).` +
      (hay.length ? ` Locales dados de alta: ${hay.join(', ')}.` : ' Aún no hay ninguno: copia locales/_plantilla/.'))
  }
  let bruto
  try {
    bruto = JSON.parse(readFileSync(fichero, 'utf8'))
  } catch (e) {
    throw new Error(`locales/${slug}/perfil.json no es JSON válido — ${e.message}`)
  }
  const perfil = normalizarPerfil(bruto, slug)
  perfil.dir = dir
  return perfil
}

/**
 * Variables de entorno que implica un perfil. Lo que ya venga en el entorno
 * MANDA sobre el perfil: así el workflow puede inyectar secretos sin tocar los
 * ficheros versionados.
 */
export function envDePerfil(perfil) {
  const env = {}
  const poner = (k, v) => { if (v !== null && v !== undefined && v !== '') env[k] = String(v) }
  poner('VITE_BASE', perfil.despliegue.base)
  poner('VITE_SUPABASE_URL', perfil.supabase.url)
  poner('VITE_SUPABASE_ANON_KEY', perfil.supabase.anonKey)
  poner('VITE_BACKEND', perfil.backend)
  poner('VITE_FISCAL', perfil.fiscal)
  if (perfil.modulos.pagosOnline) env.VITE_PAGOS_ONLINE = '1'
  env.VITE_PERFIL = JSON.stringify(perfilPublico(perfil))
  return env
}

/** Aplica el entorno del perfil sin pisar lo que ya estuviera definido. */
export function aplicarEnv(perfil, destino = process.env) {
  for (const [k, v] of Object.entries(envDePerfil(perfil))) {
    if (destino[k] === undefined || destino[k] === '') destino[k] = v
  }
  return destino
}

/** La parte del perfil que viaja al navegador (marca y módulos, nunca claves). */
export function perfilPublico(perfil) {
  return {
    slug: perfil.slug,
    nombre: perfil.marca.nombre,
    descripcion: perfil.marca.descripcion,
    emoji: perfil.marca.emoji,
    colores: perfil.marca.colores,
    logo: ficherosDeMarca(perfil).find(f => f.startsWith('logo.')) || null,
    demo: perfil.demo === true,
    modulos: perfil.modulos,
    // La dirección pública del local. Viaja al navegador porque los QR de mesa
    // se imprimen desde Admin y NO pueden depender de por dónde se haya abierto
    // el panel: con `window.location` bastaba con entrar desde una build local
    // para imprimir doce pegatinas apuntando a `localhost` y pegarlas en las
    // mesas. No es un secreto: es la URL que ya se reparte impresa.
    url: perfil.despliegue.url || null,
  }
}

// Ficheros de marca del local (logo e iconos de la PWA). Se sirven bajo
// `<base>marca/…` para no chocar con los de public/, que son los genéricos.
const MARCA_VALIDA = /^(logo\.(svg|png)|icon-(192|512)\.png)$/

export function ficherosDeMarca(perfil) {
  const dir = perfil.dir && join(perfil.dir, 'marca')
  if (!dir || !existsSync(dir)) return []
  return readdirSync(dir).filter(f => MARCA_VALIDA.test(f)).sort()
}

export function rutaDeMarca(perfil, fichero) {
  if (!MARCA_VALIDA.test(fichero)) return null
  const ruta = join(perfil.dir, 'marca', fichero)
  return existsSync(ruta) ? ruta : null
}
