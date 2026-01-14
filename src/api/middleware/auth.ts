/**
 * ATProto Service Authentication Middleware.
 *
 * @remarks
 * Implements the industry standard ATProto service authentication pattern.
 * Verifies service auth JWTs signed by user's atproto signing key.
 *
 * Authentication flow:
 * 1. User authenticates via ATProto OAuth in browser
 * 2. User's PDS issues a service auth JWT for Chive (via getServiceAuth)
 * 3. Frontend sends JWT in Authorization header
 * 4. This middleware verifies JWT against user's DID document
 *
 * @see {@link https://docs.bsky.app/docs/advanced-guides/service-auth | ATProto Service Auth}
 * @packageDocumentation
 * @public
 */

import type { MiddlewareHandler } from 'hono';

import type { IServiceAuthVerifier } from '../../auth/service-auth/index.js';
import type { DID } from '../../types/atproto.js';
import { AuthenticationError, AuthorizationError } from '../../types/errors.js';
import type { IAuthorizationService } from '../../types/interfaces/authorization.interface.js';
import type { ChiveEnv, AuthenticatedUser } from '../types/context.js';

/**
 * Extracts Bearer token from Authorization header.
 *
 * @param header - Authorization header value
 * @returns Token string or null if not present/invalid format
 */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] ?? null;
}

/**
 * Creates ATProto service auth middleware.
 *
 * @remarks
 * Extracts Bearer token from Authorization header and verifies it
 * as an ATProto service auth JWT. Sets authenticated user in context
 * if valid token present.
 *
 * By default, authentication is optional - requests without tokens
 * continue as anonymous. Use `requireAuth()` for mandatory auth.
 *
 * **E2E Testing Support:**
 * When `ENABLE_E2E_AUTH_BYPASS=true` and the `X-E2E-Auth-Did` header is set,
 * authentication is bypassed and the user is set from the header. This is
 * standard practice for E2E testing OAuth-protected APIs.
 *
 * @example
 * ```typescript
 * const verifier = new ServiceAuthVerifier({
 *   logger,
 *   config: { serviceDid: 'did:web:chive.pub' },
 * });
 *
 * app.use('*', authenticateServiceAuth(verifier, authzService));
 * ```
 *
 * @param verifier - ATProto service auth verifier
 * @param authzService - Authorization service for role lookup
 * @returns Hono middleware handler
 *
 * @public
 */
export function authenticateServiceAuth(
  verifier: IServiceAuthVerifier,
  authzService: IAuthorizationService
): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    // E2E test bypass: when enabled, accept X-E2E-Auth-Did header
    // This is standard practice for E2E testing OAuth-protected APIs
    const e2eAuthBypass = process.env.ENABLE_E2E_AUTH_BYPASS === 'true';
    const e2eAuthDid = c.req.header('x-e2e-auth-did');

    if (e2eAuthBypass && e2eAuthDid) {
      const logger = c.get('logger');
      logger.debug('E2E auth bypass: setting user from header', { did: e2eAuthDid });

      // Create authenticated user with alpha tester access for E2E tests
      const user: AuthenticatedUser = {
        did: e2eAuthDid as DID,
        handle: c.req.header('x-e2e-auth-handle'),
        isAdmin: c.req.header('x-e2e-auth-admin') === 'true',
        isPremium: false,
        isAlphaTester: true, // E2E test users are always alpha testers
        scopes: [],
        sessionId: undefined,
        tokenId: undefined,
      };

      c.set('user', user);
      await next();
      return;
    }

    const authHeader = c.req.header('authorization');
    const token = extractBearerToken(authHeader);

    // No token; continue as anonymous
    if (!token) {
      await next();
      return;
    }

    const logger = c.get('logger');

    try {
      // Verify the service auth JWT
      // Note: We don't enforce lxm (lexicon method) matching because not all
      // PDS implementations include lxm in service auth tokens. The token is
      // still validated against the user's DID document signing key.
      const result = await verifier.verify(token);

      if (!result) {
        // Invalid token; log and continue as anonymous
        logger.debug('Invalid or expired service auth token');
        await next();
        return;
      }

      // Build authenticated user from service auth result
      // Look up roles from authorization service (Redis-backed)
      const roles = await authzService.getRoles(result.did);
      const isAdmin = roles.includes('admin');
      const isAlphaTester = roles.includes('alpha-tester') || isAdmin;
      const isPremium = roles.includes('premium' as never) || isAdmin;

      const user: AuthenticatedUser = {
        did: result.did,
        handle: undefined, // Service auth doesn't include handle
        isAdmin,
        isPremium,
        isAlphaTester,
        scopes: [], // Service auth doesn't use scopes
        sessionId: undefined, // Service auth is stateless
        tokenId: undefined, // Service auth JWTs may have jti
      };

      c.set('user', user);

      // Update logger context with user info
      const userLogger = logger.child({
        userId: user.did,
      });
      c.set('logger', userLogger);

      await next();
    } catch (error) {
      // Verification error; log and continue as anonymous
      logger.warn('Service auth verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await next();
    }
  };
}

/**
 * Middleware that requires authentication.
 *
 * @remarks
 * Throws AuthenticationError if no valid token is present.
 * Should be applied after `authenticateServiceAuth()` middleware.
 *
 * @example
 * ```typescript
 * app.use('/xrpc/pub.chive.claiming.*', requireAuth());
 * ```
 *
 * @returns Hono middleware handler
 *
 * @public
 */
export function requireAuth(): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    await next();
  };
}

/**
 * Middleware that requires admin role.
 *
 * @remarks
 * Throws AuthorizationError if user is not an admin.
 * Should be applied after `authenticateServiceAuth()` and `requireAuth()`.
 *
 * @example
 * ```typescript
 * app.use('/xrpc/pub.chive.admin.*', requireAuth(), requireAdmin());
 * ```
 *
 * @returns Hono middleware handler
 *
 * @public
 */
export function requireAdmin(): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!user.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    await next();
  };
}

/**
 * Middleware that requires alpha tester role.
 *
 * @remarks
 * Throws AuthorizationError if user is not an alpha tester.
 * Admins are automatically granted alpha tester access.
 * Should be applied after `authenticateServiceAuth()` and `requireAuth()`.
 *
 * @example
 * ```typescript
 * app.use('/xrpc/pub.chive.eprint.*', requireAuth(), requireAlphaTester());
 * ```
 *
 * @returns Hono middleware handler
 *
 * @public
 */
export function requireAlphaTester(): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!user.isAlphaTester) {
      throw new AuthorizationError('Alpha tester access required', 'alpha-tester');
    }

    await next();
  };
}
