/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

/**
 * Vitest global type declarations.
 *
 * @remarks
 * This file enables TypeScript to recognize Vitest's global test functions
 * (describe, it, expect, vi, beforeEach, afterEach) without explicit imports.
 * These globals are available because vitest.config.ts has `globals: true`.
 *
 * It also includes jest-dom matchers (toBeInTheDocument, toHaveClass, etc.)
 * which are extended onto vitest's expect in tests/setup.ts.
 */

import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = unknown> extends TestingLibraryMatchers<T, void> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, void> {}
}
