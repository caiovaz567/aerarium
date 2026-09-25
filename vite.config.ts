import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    // Seção 10.3. The service worker only keeps the app shell; Supabase calls
    // (financial data) always go to the network and are never cached.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Aerarium',
        short_name: 'Aerarium',
        description: 'Suas finanças, mês a mês.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0D0F15',
        background_color: '#0D0F15',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change less than the app, so they get their own files.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            {
              name: 'vendor',
              test: /node_modules[\\/](@tanstack|date-fns)[\\/]/,
            },
          ],
        },
      },
    },
  },
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
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
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
