import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// En build (GitHub Pages) la demo se sirve bajo /tpv-hosteleria/ y la APP REAL
// (backend v2) bajo /tpv-hosteleria/app/ (VITE_BASE la fija el workflow).
// En desarrollo se mantiene en la raíz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE || '/tpv-hosteleria/') : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'TPV Hostelería',
        short_name: 'TPV',
        description: 'TPV para bar y restaurante: autopedido QR, sala, cocina, caja y reservas.',
        lang: 'es',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0f172a',
        background_color: '#0b1120',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
