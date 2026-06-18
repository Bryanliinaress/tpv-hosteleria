import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En build (GitHub Pages) la app se sirve bajo /tpv-hosteleria/.
// En desarrollo se mantiene en la raíz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tpv-hosteleria/' : '/',
  plugins: [react(), tailwindcss()],
}))
