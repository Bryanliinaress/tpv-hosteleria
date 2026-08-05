import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { cargarPerfil, aplicarEnv, ficherosDeMarca, rutaDeMarca } from './scripts/lib/perfiles.mjs'

// ── Perfil de local ─────────────────────────────────────────────────────────
// Un solo producto, una instalación por bar: `LOCAL=casa-loli npm run build`
// compila con la marca, el dominio y el Supabase de ese local (locales/<slug>/).
// Sin LOCAL se compila el genérico, como siempre (lo que haya en .env).
// Ojo: aplicarEnv() NO pisa lo que ya venga del entorno, para que el workflow
// pueda inyectar secretos por encima del perfil versionado.
const perfil = process.env.LOCAL ? cargarPerfil(process.env.LOCAL) : null
if (perfil) aplicarEnv(perfil)

const marca = {
  nombre: perfil?.marca.nombre || 'TPV Hostelería',
  corto: perfil?.marca.corto || 'TPV',
  descripcion: perfil?.marca.descripcion || 'TPV para bar y restaurante: autopedido QR, sala, cocina, caja y reservas.',
  fondo: perfil?.marca.colores.fondo || '#0b1120',
  tema: perfil?.marca.colores.tema || '#0f172a',
}

// Los ficheros propios del local (logo e iconos) se sirven bajo `marca/` para
// no chocar con los genéricos de public/.
const ficheros = perfil ? ficherosDeMarca(perfil) : []
const tieneIconos = ficheros.includes('icon-192.png') && ficheros.includes('icon-512.png')
const icono = (n) => (tieneIconos ? `marca/icon-${n}.png` : `icon-${n}.png`)

function pluginMarca() {
  return {
    name: 'tpv-marca-local',
    // En dev servimos los ficheros del perfil desde su carpeta.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const f = perfil && req.url?.match(/^\/marca\/([^/?#]+)/)?.[1]
        const ruta = f && rutaDeMarca(perfil, f)
        if (!ruta) return next()
        res.setHeader('Content-Type', f.endsWith('.svg') ? 'image/svg+xml' : 'image/png')
        res.end(readFileSync(ruta))
      })
    },
    // En build los emitimos como assets del bundle.
    generateBundle() {
      for (const f of ficheros) {
        this.emitFile({ type: 'asset', fileName: `marca/${f}`, source: readFileSync(rutaDeMarca(perfil, f)) })
      }
    },
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, `<title>${marca.nombre}</title>`)
        .replace(/(<meta name="description" content=)"[^"]*"/, `$1"${marca.descripcion}"`)
        .replace(/(<meta name="theme-color" content=)"[^"]*"/, `$1"${marca.tema}"`)
        .replace(/(rel="icon"[^>]*href=")[^"]*"/, `$1./${icono(192)}"`)
        .replace(/(rel="apple-touch-icon" href=")[^"]*"/, `$1./${icono(192)}"`)
    },
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE || '/tpv-hosteleria/') : '/',
  plugins: [
    react(),
    tailwindcss(),
    pluginMarca(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: marca.nombre,
        short_name: marca.corto,
        description: marca.descripcion,
        lang: 'es',
        display: 'standalone',
        orientation: 'any',
        theme_color: marca.tema,
        background_color: marca.fondo,
        icons: [
          { src: icono(192), sizes: '192x192', type: 'image/png' },
          { src: icono(512), sizes: '512x512', type: 'image/png' },
          { src: icono(512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precachea el shell (HTML/JS/CSS/iconos). Los datos siguen viniendo de
        // Supabase: la app abre sin red, pero necesita conexión para sincronizar.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: undefined, // SPA con HashRouter: index.html ya cubre todo
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
}))
