import path from 'path';

import { defineConfig } from 'vitest/config';

import { testStackEnv } from './tests/setup/test-env.js';

export default defineConfig({
  test: {
    // Point the suite at the Docker test stack unless told otherwise.
    env: testStackEnv(),
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/setup/global-setup.ts'],
    fileParallelism: false,
    // Mock native modules that require compilation
    alias: {
      'isolated-vm': path.resolve(__dirname, './__mocks__/isolated-vm.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Count every source file, not only the ones a test imports. See the
      // longer note in vitest.unit.config.ts: without this the percentage is
      // the tested subset measured against itself.
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
        // The full suite — unit, integration and compliance — measured over
        // all of `src/`. The previous 80 matched the bar in CLAUDE.md rather
        // than anything the suite achieved, and no workflow ran this config
        // with `--coverage`, so it never failed and never said so.
        //
        // A floor, not a target. 80% remains the goal; raise these as coverage
        // improves and never lower them for a new gap.
        lines: 52,
        functions: 54,
        branches: 45,
        statements: 52,
      },
    },
    include: [
      'src/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/compliance/**/*.test.ts',
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
