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
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
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
