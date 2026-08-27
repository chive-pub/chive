import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/pre-deployment/**/*.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 300000, // 5 minutes for real PDS communication
    hookTimeout: 60000,
    // Run sequentially: these tests drive real services and share state.
    //
    // This was `poolOptions.forks.singleFork`, which Vitest 4 removed. Nothing
    // typechecked this file, so the key sat here being ignored and the suite
    // has been running in parallel forks against shared state ever since the
    // upgrade — exactly what the setting was here to prevent.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
  },
});
