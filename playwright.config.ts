import path from 'path';

import { defineConfig, devices } from '@playwright/test';

/**
 * Paths for authentication state files.
 */
const AUTH_STATE_DIR = path.join(import.meta.dirname, 'tests/e2e/.auth');
const AUTHENTICATED_STATE = path.join(AUTH_STATE_DIR, 'user.json');
const UNAUTHENTICATED_STATE = path.join(AUTH_STATE_DIR, 'unauthenticated.json');

/**
 * Playwright configuration for Chive E2E tests.
 *
 * @remarks
 * Uses the industry-standard authentication pattern with:
 * - Setup projects that run first to establish auth state
 * - Separate projects for authenticated and unauthenticated tests
 * - StorageState sharing across tests for efficiency
 *
 * @see https://playwright.dev/docs/auth
 * @see https://playwright.dev/docs/test-projects
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 30000,
  reporter: process.env.CI ? 'github' : 'html',

  // Global setup: seed test data before any tests run
  globalSetup: './tests/e2e/global.setup.ts',

  // Global settings
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Test projects with authentication handling
  projects: [
    // ============================================
    // SETUP PROJECTS - Run first to establish auth
    // ============================================
    {
      name: 'setup:auth',
      testMatch: /auth\.setup\.ts/,
      teardown: 'cleanup:auth',
    },

    // ============================================
    // AUTHENTICATED TESTS - Use saved auth state
    // ============================================
    {
      name: 'chromium:authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTHENTICATED_STATE,
      },
      dependencies: ['setup:auth'],
      testIgnore: ['**/auth.spec.ts', '**/auth.setup.ts', '**/home.spec.ts'],
    },
    // Firefox and WebKit only run in CI to speed up local development
    ...(process.env.CI
      ? [
          {
            name: 'firefox:authenticated',
            use: {
              ...devices['Desktop Firefox'],
              storageState: AUTHENTICATED_STATE,
            },
            dependencies: ['setup:auth'],
            testIgnore: ['**/auth.spec.ts', '**/auth.setup.ts', '**/home.spec.ts'],
          },
          {
            name: 'webkit:authenticated',
            use: {
              ...devices['Desktop Safari'],
              storageState: AUTHENTICATED_STATE,
            },
            dependencies: ['setup:auth'],
            testIgnore: ['**/auth.spec.ts', '**/auth.setup.ts', '**/home.spec.ts'],
          },
        ]
      : []),

    // ============================================
    // UNAUTHENTICATED TESTS - For auth flow and public page testing
    // ============================================
    {
      name: 'chromium:unauthenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: UNAUTHENTICATED_STATE,
      },
      dependencies: ['setup:auth'],
      testMatch: ['**/auth.spec.ts', '**/home.spec.ts'],
    },

    // ============================================
    // CLEANUP PROJECT
    // ============================================
    {
      name: 'cleanup:auth',
      testMatch: /global\.teardown\.ts/,
    },
  ],

  // Web server configuration
  // Industry-standard multi-server setup for full-stack E2E testing
  // - Backend API: Port 3001 (must start first)
  // - Frontend: Port 3000 (depends on API being ready)
  // Sets NEXT_PUBLIC_E2E_TEST=true to skip OAuth initialization in tests
  // See: https://playwright.dev/docs/test-webserver#multiple-web-servers
  webServer: [
    {
      // Backend API server
      command: 'pnpm dev:api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        // Disable rate limiting during E2E tests
        DISABLE_RATE_LIMITING: 'true',
        // Enable E2E auth bypass to allow testing without real OAuth tokens
        // This is standard practice for E2E testing OAuth-protected APIs
        ENABLE_E2E_AUTH_BYPASS: 'true',
        // Database credentials - use env vars if set (CI), otherwise defaults for local
        POSTGRES_USER: process.env.POSTGRES_USER ?? 'chive',
        POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'chive_test_password',
        POSTGRES_DB: process.env.POSTGRES_DB ?? 'chive',
        POSTGRES_HOST: process.env.POSTGRES_HOST ?? '127.0.0.1',
        POSTGRES_PORT: process.env.POSTGRES_PORT ?? '5432',
        DATABASE_URL:
          process.env.DATABASE_URL ??
          `postgresql://${process.env.POSTGRES_USER ?? 'chive'}:${process.env.POSTGRES_PASSWORD ?? 'chive_test_password'}@${process.env.POSTGRES_HOST ?? '127.0.0.1'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'chive'}`,
        NEO4J_USER: process.env.NEO4J_USER ?? 'neo4j',
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
        NEO4J_URI: process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687',
        REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
        ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL ?? 'http://127.0.0.1:9200',
      },
    },
    {
      // Frontend Next.js server (depends on API)
      command: 'pnpm --filter @chive/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      env: {
        ...process.env,
        NEXT_PUBLIC_E2E_TEST: 'true',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001',
      },
    },
  ],

  // Output directories
  outputDir: './tests/e2e/test-results',

  // Expect configuration
  expect: {
    timeout: 5000,
  },
});
