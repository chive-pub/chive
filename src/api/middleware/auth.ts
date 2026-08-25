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
import { authMetrics } from '../../observability/prometheus-registry.js';
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
/**
 * Extracts the lexicon method an XRPC request targets.
 *
 * @param path - Request path
 * @returns The NSID for an XRPC route, or undefined for any other path
 *
 * @remarks
 * XRPC routes are mounted as `/xrpc/<nsid>`, so the method name is the segment
 * after the prefix. REST routes have no lexicon method and pass undefined,
 * which leaves the token's scope unchecked for them — they are not what `lxm`
 * scopes.
 *
 * @public
 */
export function lexiconMethodForPath(path: string): string | undefined {
  const prefix = '/xrpc/';
  if (!path.startsWith(prefix)) {
    return undefined;
  }

  const nsid = path.slice(prefix.length).split('/')[0]?.split('?')[0];
  return nsid && nsid.length > 0 ? nsid : undefined;
}

/**
 * Refuses to start a production process that enables the E2E auth bypass.
 *
 * @throws Error when `ENABLE_E2E_AUTH_BYPASS` is `true` while `NODE_ENV` is
 *   `production`
 *
 * @remarks
 * The bypass turns `X-E2E-Auth-Did` and `X-E2E-Auth-Admin` into an
 * unauthenticated route to full administrative access, and both header names
 * are in the production CORS allowlist. The middleware already ignores the
 * variable outside development, but silently ignoring it would leave an
 * operator believing the bypass is active — or, worse, leave the flag set in a
 * deploy that a later refactor honours again. Failing the boot makes the
 * misconfiguration impossible to miss.
 *
 * @public
 */
export function assertNoAuthBypassInProduction(env: NodeJS.ProcessEnv = process.env): void {
  if (env.ENABLE_E2E_AUTH_BYPASS === 'true' && env.NODE_ENV === 'production') {
    throw new Error(
      'ENABLE_E2E_AUTH_BYPASS is set in production. This header-based bypass grants ' +
        'full admin access and must never be enabled outside development or E2E runs. ' +
        'Unset it and redeploy.'
    );
  }
}

export function authenticateServiceAuth(
  verifier: IServiceAuthVerifier,
  authzService: IAuthorizationService
): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    // E2E test bypass: when enabled, accept X-E2E-Auth-Did header.
    // This is standard practice for E2E testing OAuth-protected APIs, but it
    // hands out full admin from a request header — `X-E2E-Auth-Admin: true` —
    // and the header names sit in the production CORS allowlist. An env var is
    // the only thing that stood between a misconfigured deploy and an open
    // admin door, so the bypass is additionally compiled out of production by
    // NODE_ENV. `assertNoAuthBypassInProduction` refuses to boot a production
    // process that sets it, rather than starting up silently ignoring it.
    const e2eAuthBypass =
      process.env.ENABLE_E2E_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
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
      authMetrics.attemptsTotal.inc({ method: 'service_auth', result: 'anonymous' });
      await next();
      return;
    }

    const logger = c.get('logger');
    const endTimer = authMetrics.duration.startTimer({ method: 'service_auth' });

    try {
      // Verify the service auth JWT against the method actually being called.
      //
      // The `lxm` claim scopes a service auth token to one lexicon method. The
      // verifier has always supported checking it, but the method was never
      // passed, so the claim was decoded, copied into `user.scopes` — which
      // nothing reads — and never enforced. A token minted for
      // `pub.chive.metrics.recordView` was therefore accepted at
      // `pub.chive.admin.deleteContent`: any holder of any valid token could
      // call any endpoint their roles allowed, which is the whole point of the
      // claim.
      //
      // A token carrying no `lxm` is unscoped and still verifies; passing the
      // NSID only tightens tokens that declared a scope. Non-XRPC routes have
      // no lexicon method, so nothing is passed for them.
      const result = await verifier.verify(token, lexiconMethodForPath(c.req.path));

      if (!result) {
        // Invalid token; log and continue as anonymous
        logger.debug('Invalid or expired service auth token');
        authMetrics.attemptsTotal.inc({ method: 'service_auth', result: 'failure' });
        endTimer();
        await next();
        return;
      }

      // Build authenticated user from service auth result
      // Look up roles from authorization service (Redis-backed)
      const roles = await authzService.getRoles(result.did);
      const isAdmin = roles.includes('admin');
      const isAlphaTester = roles.includes('alpha-tester') || isAdmin;
      const isPremium = roles.includes('premium') || isAdmin;

      const user: AuthenticatedUser = {
        did: result.did,
        handle: undefined, // Service auth doesn't include handle
        isAdmin,
        isPremium,
        isAlphaTester,
        scopes: result.lxm ? [result.lxm] : [],
        sessionId: undefined, // Service auth is stateless
        tokenId: undefined, // Service auth JWTs may have jti
      };

      c.set('user', user);

      // Update logger context with user info
      const userLogger = logger.child({
        userId: user.did,
      });
      c.set('logger', userLogger);

      authMetrics.attemptsTotal.inc({ method: 'service_auth', result: 'success' });
      endTimer();

      await next();
    } catch (error) {
      // Verification error; log and continue as anonymous
      logger.warn('Service auth verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      authMetrics.attemptsTotal.inc({ method: 'service_auth', result: 'failure' });
      endTimer();
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
