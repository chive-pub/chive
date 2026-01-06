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

import type { ServiceAuthVerifier } from '../../auth/service-auth/index.js';
import { AuthenticationError, AuthorizationError } from '../../types/errors.js';
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
 * @example
 * ```typescript
 * const verifier = new ServiceAuthVerifier({
 *   logger,
 *   config: { serviceDid: 'did:web:chive.pub' },
 * });
 *
 * app.use('*', authenticateServiceAuth(verifier));
 * ```
 *
 * @param verifier - ATProto service auth verifier
 * @returns Hono middleware handler
 *
 * @public
 */
export function authenticateServiceAuth(
  verifier: ServiceAuthVerifier
): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('authorization');
    const token = extractBearerToken(authHeader);

    // No token; continue as anonymous
    if (!token) {
      await next();
      return;
    }

    const logger = c.get('logger');

    try {
      // Get the lexicon method from the request path for lxm verification
      // XRPC paths are like /xrpc/pub.chive.claiming.findClaimable
      const path = c.req.path;
      const lxm = path.startsWith('/xrpc/') ? path.slice(6) : undefined;

      // Verify the service auth JWT
      const result = await verifier.verify(token, lxm);

      if (!result) {
        // Invalid token; log and continue as anonymous
        logger.debug('Invalid or expired service auth token');
        await next();
        return;
      }

      // Build authenticated user from service auth result
      // Note: Service auth JWTs don't have scopes; all authenticated users
      // have base permissions. Admin/premium status should be looked up separately.
      const user: AuthenticatedUser = {
        did: result.did,
        handle: undefined, // Service auth doesn't include handle
        isAdmin: false, // TODO: Look up from user registry
        isPremium: false, // TODO: Look up from user registry
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
