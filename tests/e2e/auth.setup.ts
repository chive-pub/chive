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
  // Seed the session before any page script runs.
  //
  // This used to navigate first and then call `page.evaluate` to write
  // localStorage, which raced the app's own startup: the landing page
  // redirects, `evaluate` landed mid-navigation, and the setup died with
  // "Execution context was destroyed". A later `page.reload()` had two further
  // failure modes — the default `waitUntil: 'load'` never resolves, because
  // with a session present the app opens a Server-Sent Events stream and an
  // EventSource does not complete; and with `domcontentloaded` the app's own
  // redirect aborted the reload outright.
  //
  // `addInitScript` runs before page scripts on every navigation, so the app
  // boots already holding the session and there is nothing left to race. It
  // also removes the need to reload at all.
  //
  // All 509 tests in the suite depend on this project, so each of those
  // failures skipped the entire E2E run rather than reporting anything.
  await page.context().addInitScript((metadata) => {
    window.localStorage.setItem('chive_session_metadata', JSON.stringify(metadata));
    // Enables the auth bypass in the API client. The frontend refuses to honour
    // this in production builds; see web/lib/api/e2e-bypass-guard.
    window.localStorage.setItem('chive_e2e_skip_oauth', 'true');
  }, SESSION_METADATA);

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

  // Boot once so anything the app normalizes at startup is captured below.
  //
  // `commit` resolves as soon as the navigation commits, before a client-side
  // redirect can abort the wait; the settle after it is best-effort for the
  // same reason, since redirecting mid-wait is the expected case here.
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForLoadState('domcontentloaded').catch(() => {
    // Redirected while settling. The session is already in place.
  });

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
