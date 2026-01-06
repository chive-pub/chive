/**
 * Global teardown for E2E tests.
 *
 * @remarks
 * Cleans up any resources created during E2E test runs.
 * This runs after all test projects have completed.
 */

import { test as teardown } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_STATE_DIR = path.join(import.meta.dirname, '.auth');

teardown('cleanup auth state', async () => {
  // Clean up auth state files (optional; can be kept for debugging)
  if (process.env.CI) {
    try {
      if (fs.existsSync(AUTH_STATE_DIR)) {
        fs.rmSync(AUTH_STATE_DIR, { recursive: true });
      }
    } catch (error) {
      console.warn('Failed to clean up auth state:', error);
    }
  }
});
