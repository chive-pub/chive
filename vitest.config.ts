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
    // This suite talks to PostgreSQL, Elasticsearch, Neo4j and Redis over the
    // network. Vitest's 5s default is sized for pure functions, so a slow CI
    // runner turned an ordinary test into a failed build: on the v0.11.0
    // release run, `tracks PDS source for staleness detection` timed out at
    // 5000ms with 5509 of 5513 passing, in a run where Elasticsearch and Neo4j
    // both reported slow starts. The same file passes locally in 697ms.
    //
    // The unit config deliberately keeps the 5s default, so a genuine hang in
    // code with no I/O still fails fast there.
    testTimeout: 30_000,
    // Setup migrates and seeds four datastores; container start dominates.
    hookTimeout: 120_000,
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
