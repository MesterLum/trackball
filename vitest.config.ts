import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 120000,
    // Covers the shared design and geometry code; the Svelte UI is covered by the browser tests.
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
});
