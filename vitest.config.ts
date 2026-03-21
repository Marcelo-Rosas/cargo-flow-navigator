import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: [
      'tests/e2e/**',
      'e2e/**',
      'src/lib/__tests__/tsp-solver.test.ts',
      'tests/dre-operacional.test.ts',
      'tests/kanban-dnd.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/modules/**'],
      exclude: ['src/lib/__tests__/**'],
      reporter: ['text', 'text-summary'],
    },
  },
});
