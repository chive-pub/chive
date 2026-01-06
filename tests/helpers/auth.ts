/**
 * Test authentication helpers.
 *
 * @remarks
 * Provides utilities for testing authenticated endpoints without
 * requiring real ATProto service auth tokens.
 *
 * **Industry Standard Approach:**
 * - Unit tests: Mock context directly (c.get('user'))
 * - Integration tests: Use test middleware that injects mock users
 *
 * @packageDocumentation
 */

import type { MiddlewareHandler } from 'hono';

import type { ChiveEnv, AuthenticatedUser } from '@/api/types/context.js';
import type { DID } from '@/types/atproto.js';

/**
 * Test user for authenticated endpoint testing.
 */
export interface TestUser {
  did: DID;
  handle?: string;
  isAdmin?: boolean;
  isPremium?: boolean;
}

/**
 * Default test users for common scenarios.
 */
export const TEST_USERS = {
  /** Regular authenticated user */
  regular: {
    did: 'did:plc:testuser123' as DID,
    handle: 'testuser.test',
    isAdmin: false,
    isPremium: false,
  } as TestUser,

  /** Admin user */
  admin: {
    did: 'did:plc:adminuser456' as DID,
    handle: 'admin.test',
    isAdmin: true,
    isPremium: true,
  } as TestUser,

  /** Premium user */
  premium: {
    did: 'did:plc:premiumuser789' as DID,
    handle: 'premium.test',
    isAdmin: false,
    isPremium: true,
  } as TestUser,
} as const;

/**
 * Creates a test authentication middleware that injects a mock user.
 *
 * @remarks
 * Use this in integration tests to bypass real ATProto service auth
 * while still testing the full request/response cycle.
 *
 * @example
 * ```typescript
 * const app = createServer(config);
 *
 * // Add test auth middleware before running tests
 * app.use('*', createTestAuthMiddleware(TEST_USERS.regular));
 *
 * // Now requests will have authenticated user
 * const res = await app.request('/xrpc/pub.chive.claiming.startClaimFromExternal', {
 *   method: 'POST',
 *   body: JSON.stringify({ source: 'arxiv', externalId: '2401.12345' }),
 * });
 * expect(res.status).toBe(200);
 * ```
 *
 * @param user - Test user to inject, or null for anonymous
 * @returns Hono middleware that sets the user in context
 */
export function createTestAuthMiddleware(user: TestUser | null): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    if (user) {
      const authenticatedUser: AuthenticatedUser = {
        did: user.did,
        handle: user.handle,
        isAdmin: user.isAdmin ?? false,
        isPremium: user.isPremium ?? false,
        scopes: [],
        sessionId: 'test-session-id',
        tokenId: 'test-token-id',
      };
      c.set('user', authenticatedUser);
    }
    await next();
  };
}

/**
 * Creates a test user with custom properties.
 *
 * @param overrides - Properties to override
 * @returns Test user object
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    ...TEST_USERS.regular,
    ...overrides,
  };
}

/**
 * Header name for test-only user injection.
 *
 * @remarks
 * In test environments, you can also use this header to specify
 * which test user to authenticate as.
 *
 * @example
 * ```typescript
 * const res = await app.request('/xrpc/...', {
 *   headers: {
 *     [TEST_USER_HEADER]: 'did:plc:testuser123',
 *   },
 * });
 * ```
 */
export const TEST_USER_HEADER = 'X-Test-User-DID';

/**
 * Creates a middleware that reads test user from header.
 *
 * @remarks
 * This is an alternative to createTestAuthMiddleware that allows
 * different users per request via headers.
 *
 * **WARNING**: Only use in test environment!
 *
 * @returns Hono middleware
 */
export function createHeaderBasedTestAuthMiddleware(): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    const testUserDid = c.req.header(TEST_USER_HEADER);

    if (testUserDid) {
      const authenticatedUser: AuthenticatedUser = {
        did: testUserDid as DID,
        handle: undefined,
        isAdmin: testUserDid.includes('admin'),
        isPremium: testUserDid.includes('premium'),
        scopes: [],
        sessionId: 'test-session-id',
        tokenId: 'test-token-id',
      };
      c.set('user', authenticatedUser);
    }

    await next();
  };
}
