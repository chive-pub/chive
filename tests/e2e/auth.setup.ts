/**
 * E2E authentication setup.
 *
 * @remarks
 * This file sets up authentication state for E2E tests using Playwright's
 * recommended storageState pattern. It runs before all other tests and
 * saves the authenticated browser state to a file.
 *
 * @see https://playwright.dev/docs/auth
 */

import { test as setup } from '@playwright/test';
import path from 'path';

/**
 * Path to store authenticated state.
 */
export const STORAGE_STATE_PATH = path.join(import.meta.dirname, '.auth/user.json');

/**
 * Test user credentials for E2E tests.
 *
 * @remarks
 * In a real deployment, these would be read from environment variables
 * or a test secrets manager. For local development, we use a mock user.
 */
export const TEST_USER = {
  did: 'did:plc:e2etestuser123',
  handle: 'e2e-test.bsky.social',
  displayName: 'E2E Test User',
  description: 'Automated test user for Chive E2E tests',
  avatar: null,
  pdsEndpoint: 'https://bsky.social',
};

/**
 * Mock session metadata matching the ChiveUser/SessionMetadata types.
 */
const SESSION_METADATA = {
  did: TEST_USER.did,
  handle: TEST_USER.handle,
  displayName: TEST_USER.displayName,
  avatar: TEST_USER.avatar,
  pdsEndpoint: TEST_USER.pdsEndpoint,
  createdAt: Date.now(),
  lastActivity: Date.now(),
};

/**
 * Setup authentication for E2E tests.
 *
 * @remarks
 * This test runs once before all other tests in the authenticated project.
 * It sets up localStorage with session metadata that the app uses to
 * determine authentication state.
 *
 * For actual OAuth testing, you would:
 * 1. Navigate to the login page
 * 2. Complete the OAuth flow with a test PDS
 * 3. Wait for redirect back to the app
 *
 * For most E2E tests, we bypass OAuth and directly set session state.
 */
setup('authenticate', async ({ page }) => {
  // Navigate to the app first to set the correct origin for localStorage
  await page.goto('/');

  // Wait for the page to be ready
  await page.waitForLoadState('domcontentloaded');

  // Set up session metadata in localStorage
  await page.evaluate((metadata) => {
    localStorage.setItem('chive_session_metadata', JSON.stringify(metadata));
    // Mark as E2E test mode to enable auth bypass in API client
    localStorage.setItem('chive_e2e_skip_oauth', 'true');
  }, SESSION_METADATA);

  // Set up a mock access token cookie (if needed by the app)
  // Note: Real tokens would be httpOnly cookies set by the server
  await page.context().addCookies([
    {
      name: 'chive_auth_state',
      value: 'authenticated',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // Reload to pick up the auth state
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // Save the storage state for reuse in authenticated tests
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});

/**
 * Setup for tests that need to test unauthenticated flows.
 *
 * @remarks
 * This creates a clean state without authentication for testing
 * login flows, public pages, and auth-required redirects.
 */
setup('unauthenticated', async ({ page }) => {
  // Navigate to clear any existing state
  await page.goto('/');

  // Clear all storage and set E2E test marker
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Set marker to skip OAuth initialization in auth context
    localStorage.setItem('chive_e2e_skip_oauth', 'true');
  });

  // Clear cookies
  await page.context().clearCookies();

  // Save unauthenticated state
  await page.context().storageState({
    path: path.join(import.meta.dirname, '.auth/unauthenticated.json'),
  });
});
