import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default defineConfig([
  globalIgnores([
    'dist/**',
    'coverage/**',
    'docs/referencia/**',
    'scripts/data/**',
    'supabase/.temp/**',
    'test-results/**',
    'playwright-report/**',
    '.artifacts/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    files: ['*.{js,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
])
