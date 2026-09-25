import { defineConfig } from 'vitest/config'

// Network checks are explicit; npm test stays offline and needs no credentials.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
  },
})
