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
        // These sit below the 80% line / 100%-critical-path bar stated in
        // CLAUDE.md. They were lowered to match what the suite actually
        // achieved and the gap was never recorded anywhere but this TODO, so
        // the stated bar and the enforced one have disagreed since.
        //
        // Treat these as a ratchet, not as the target: raise them as coverage
        // improves rather than lowering them to accommodate a new gap. The
        // frontend equivalent lives in web/vitest.config.ts and is further
        // behind still.
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
