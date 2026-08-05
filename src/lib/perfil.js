// ────────────────────────────────────────────────────────────────────────────
// Marca del local en el navegador.
//
// El build inyecta VITE_PERFIL (lo escribe scripts/lib/perfiles.mjs a partir de
// `locales/<slug>/perfil.json`). Sin él la app arranca con la marca genérica,
// que es lo que ve la demo y lo que usan los tests.
// ────────────────────────────────────────────────────────────────────────────

export const PERFIL_GENERICO = {
  slug: 'generico',
  nombre: 'TPV Hostelería',
  descripcion: 'Demo de TPV para bar y restaurante: autopedido por QR, sala, cocina, caja y reservas — todo sincronizado en tiempo real.',
  emoji: '🍽',
  colores: {},
  logo: null,
  modulos: {},
}

/** Parsea el JSON inyectado en el build; si falta o está roto, marca genérica. */
export function leerPerfil(bruto) {
  if (!bruto) return PERFIL_GENERICO
  try {
    const p = JSON.parse(bruto)
    if (!p?.nombre) return PERFIL_GENERICO
    return { ...PERFIL_GENERICO, ...p, colores: p.colores || {}, modulos: p.modulos || {} }
  } catch {
    console.warn('VITE_PERFIL no es JSON válido; uso la marca genérica')
    return PERFIL_GENERICO
  }
}

export const perfil = leerPerfil(import.meta.env.VITE_PERFIL)

/** ¿Está activo un módulo opcional de este local? */
export const modulo = (nombre) => !!perfil.modulos[nombre]

/** URL del logo del local, o null si no tiene uno propio. */
export const urlLogo = (p = perfil, base = import.meta.env.BASE_URL) =>
  (p.logo ? `${base}marca/${p.logo}` : null)

/**
 * CSS con los colores del local. Va en un <style> al final del <head>, así que
 * gana a las variables de index.css sin tocarlas, y respeta los dos temas.
 */
export function cssDeMarca(p = perfil) {
  const c = p.colores || {}
  const reglas = (pares) => pares.filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(';')
  const oscuro = reglas([['--color-accent', c.acento], ['--color-accent-2', c.acento2]])
  const claro = reglas([['--color-accent', c.acentoClaro], ['--color-accent-2', c.acento2Claro]])
  const salida = []
  if (oscuro) salida.push(`:root{${oscuro}}`)
  if (claro) salida.push(`:root[data-theme="light"]{${claro}}`)
  return salida.join('')
}

/** Inyecta los colores del local en el documento. Idempotente. */
export function aplicarMarca(p = perfil, doc = document) {
  const css = cssDeMarca(p)
  if (!css) return null
  const id = 'marca-local'
  const el = doc.getElementById(id) || doc.head.appendChild(Object.assign(doc.createElement('style'), { id }))
  el.textContent = css
  return el
}
