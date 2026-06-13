import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // Los tests de resolvers levantan MongoDB en memoria: márgenes amplios.
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
