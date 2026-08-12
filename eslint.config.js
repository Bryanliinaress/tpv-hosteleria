import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-demo']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      // en eslint-plugin-react-hooks ≥5.2 el preset flat es 'recommended-latest'
      // (antes vivía en configs.flat.recommended, que ya no existe y rompía el lint)
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    // sin el plugin de React, no-unused-vars no ve que <Componente /> lo usa
    plugins: { react },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
    },
  },
  // ficheros de Node (config y scripts): sus globals son otros
  {
    files: ['vite.config.js', 'scripts/**/*.{js,mjs}', 'supabase/functions/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  // tests: globals de Vitest
  {
    files: ['**/*.test.{js,jsx}', 'src/test/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
])
