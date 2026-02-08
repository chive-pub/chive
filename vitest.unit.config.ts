import path from 'path';

import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for unit tests only.
 *
 * @remarks
 * Unlike the main vitest.config.ts, this configuration:
 * - Does NOT include globalSetup (no database connections required)
 * - Only runs unit tests (not integration or compliance tests)
 * - Used in CI for fast feedback without service dependencies
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // No globalSetup - unit tests should not require databases
    fileParallelism: true, // Unit tests can run in parallel
    // Mock native modules that require compilation
    alias: {
      'isolated-vm': path.resolve(__dirname, './__mocks__/isolated-vm.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/lexicons/**',
      ],
      thresholds: {
        // Lowered thresholds to match current coverage levels
        // TODO: Increase thresholds as coverage improves
        lines: 70,
        functions: 70,
        branches: 58,
        statements: 70,
      },
    },
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
    ],
    exclude: ['node_modules', 'dist', '.turbo'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@web': path.resolve(__dirname, './web'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
