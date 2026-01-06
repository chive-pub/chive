import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run migrations and setup before compliance tests
    globalSetup: ['./tests/setup/global-setup.ts'],
    // Compliance tests must run sequentially
    fileParallelism: false,
    include: ['tests/compliance/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.turbo'],
    // Compliance tests must pass 100% (no coverage check needed)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@web': path.resolve(__dirname, './web'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
