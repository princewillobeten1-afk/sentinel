import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
    // Default `forks` pool hangs on worker startup for jsdom-environment
    // test files (`// @vitest-environment jsdom`, added Sprint 31 — Item 10)
    // on this Windows dev machine — `threads` avoids it and runs the full
    // suite equally reliably.
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'server-only': path.resolve(__dirname, './lib/empty-mock.js'),
    },
  },
});
