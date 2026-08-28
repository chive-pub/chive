import path from 'path';

import { defineConfig } from 'vitest/config';

import { testStackEnv } from './tests/setup/test-env.js';

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
    // Point the suite at the Docker test stack unless told otherwise.
    env: testStackEnv(),
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
      // Count every source file, not only the ones a test happens to import.
      // Without this, v8 measures the tested subset against itself: a large
      // module with no test at all simply left the denominator, so coverage
      // could rise by deleting a test or fall by writing the first one for a
      // big file. The percentage below is therefore of all of `src/`.
      include: ['src/**/*.ts'],
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
        // Measured over all of `src/`, which is the first time these numbers
        // have meant that. The previous 70 was a percentage of the files a
        // test imported, and roughly a third of the tree was outside that set;
        // measured properly the same suite covers 46% of lines. Nothing got
        // worse here — the figure was always this, and the earlier one was
        // reporting a subset against itself.
        //
        // These sit far below the 80% line / 100%-critical-path bar stated in
        // CLAUDE.md. That bar remains the target; these are a floor.
        //
        // Treat them as a ratchet: raise them as coverage improves, never
        // lower them to accommodate a new gap. The frontend equivalent lives
        // in web/vitest.config.ts and is further behind still.
        lines: 49,
        functions: 52,
        branches: 44,
        statements: 49,
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
