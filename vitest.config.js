import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // El mismo global que inyecta vite.config.js: sin él, cualquier test que
  // renderice la portada se cae con «__VERSION__ is not defined».
  define: { __VERSION__: '"0.0.0-test"' },
  // El plugin de React es para los tests de PANTALLA: sin él, el JSX de un
  // test llega crudo y falla con «React is not defined».
  plugins: [react()],
  test: {
    // Por defecto Node: la mayoría de los tests son lógica pura, el store, o
    // leen el SQL como texto, y así corren rápido. Los de pantalla piden jsdom
    // en su propia cabecera (`@vitest-environment jsdom`).
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
  },
})
