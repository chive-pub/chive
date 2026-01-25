import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/pre-deployment/**/*.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 120000, // 2 minutes for script execution
    hookTimeout: 60000,
    // Run sequentially since scripts may modify shared state
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
