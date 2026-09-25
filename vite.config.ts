import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/scripts/data/**',
        '**/aerarium-backup-*.json',
      ],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: [
        'src/domain/**/*.test.ts',
        'src/domain/__fixtures__/**',
        'src/domain/types.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
    },
  },
})
