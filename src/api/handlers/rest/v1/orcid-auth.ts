/**
 * REST API v1 ORCID OAuth callback handler.
 *
 * @remarks
 * Handles browser redirects from ORCID after the user authorizes (or denies)
 * the OAuth request. Exchanges the authorization code for a token, extracts
 * the verified ORCID, updates the authors_index, and redirects to the frontend
 * completion page.
 *
 * This is a REST route (not XRPC) because it handles HTTP redirects from an
 * external OAuth provider.
 *
 * @packageDocumentation
 * @public
 */

import type { Hono } from 'hono';

import { getOrcidConfig } from '../../../../config/orcid.js';
import type { ChiveEnv } from '../../../types/context.js';

/**
 * Resolves the frontend base URL for redirect targets.
 */
function getFrontendUrl(): string {
  if (process.env.NEXT_PUBLIC_URL) return process.env.NEXT_PUBLIC_URL;
  if (process.env.WEB_URL) return process.env.WEB_URL;
  if (process.env.DOMAIN) return `https://${process.env.DOMAIN}`;
  return 'http://localhost:3000';
}

/**
 * Builds a frontend redirect URL for the ORCID completion page.
 *
 * @param status - 'success' or 'error'
 * @param params - additional query parameters
 * @returns full redirect URL
 */
function buildRedirectUrl(
  status: 'success' | 'error',
  params: Record<string, string> = {}
): string {
  const url = new URL(`${getFrontendUrl()}/auth/orcid/complete`);
  url.searchParams.set('status', status);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * ORCID token exchange response.
 */
interface OrcidTokenResponse {
  orcid: string;
  name: string;
  access_token: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Registers ORCID OAuth callback routes.
 *
 * @param app - Hono application
 *
 * @remarks
 * Routes:
 * - `GET /v1/auth/orcid/callback` - ORCID OAuth redirect callback
 *
 * @public
 */
export function registerOrcidAuthRoutes(app: Hono<ChiveEnv>): void {
  app.get('/v1/auth/orcid/callback', async (c) => {
    const logger = c.get('logger');
    const redis = c.get('redis');
    const pool = c.get('pool');

    try {
      const error = c.req.query('error');
      const code = c.req.query('code');
      const state = c.req.query('state');

      // User denied access at ORCID
      if (error) {
        logger.info('ORCID OAuth denied by user', { error });
        return c.redirect(buildRedirectUrl('error', { message: 'Access denied' }));
      }

      // Missing required params
      if (!code || !state) {
        logger.warn('ORCID callback missing code or state');
        return c.redirect(buildRedirectUrl('error', { message: 'Missing parameters' }));
      }

      // Look up state in Redis (single-use)
      const stateKey = `orcid:oauth:state:${state}`;
      const stateValue = await redis.get(stateKey);

      if (!stateValue) {
        logger.warn('ORCID OAuth state not found or expired', { state: state.substring(0, 8) });
        return c.redirect(buildRedirectUrl('error', { message: 'Session expired' }));
      }

      // Parse state and delete (single-use)
      const { did } = JSON.parse(stateValue) as { did: string };
      await redis.del(stateKey);

      // Exchange code for token
      const config = getOrcidConfig();
      const tokenResponse = await fetch(`${config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        logger.error('ORCID token exchange failed', undefined, {
          status: tokenResponse.status,
          did,
        });
        return c.redirect(buildRedirectUrl('error', { message: 'Token exchange failed' }));
      }

      const tokenData = (await tokenResponse.json()) as OrcidTokenResponse;

      if (tokenData.error || !tokenData.orcid) {
        logger.error('ORCID token response contained error', undefined, {
          orcidError: tokenData.error,
          errorDescription: tokenData.error_description,
          did,
        });
        return c.redirect(buildRedirectUrl('error', { message: 'ORCID verification failed' }));
      }

      const { orcid } = tokenData;

      if (!pool) {
        logger.error('PostgreSQL pool not available for ORCID verification');
        return c.redirect(buildRedirectUrl('error', { message: 'Internal error' }));
      }

      // Record the verification durably first. `authors_index` is rebuilt from
      // the firehose, so a verification stored only there is lost the next time
      // the author's profile is indexed — and, for an author who has not been
      // indexed yet, the UPDATE below matches no rows and the verification used
      // to be discarded outright with a log line claiming indexing would pick
      // it up. Nothing persisted it, so nothing could.
      //
      // An ORCID iD identifies one researcher, so a second DID claiming one
      // already verified is rejected rather than silently reassigned.
      try {
        await pool.query(
          `INSERT INTO orcid_verifications (did, orcid, verified_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (did) DO UPDATE SET orcid = EXCLUDED.orcid, verified_at = NOW()`,
          [did, orcid]
        );
      } catch (insertError) {
        const message = insertError instanceof Error ? insertError.message : String(insertError);
        if (message.includes('orcid_verifications_orcid_unique')) {
          logger.warn('ORCID already verified by a different account', { did, orcid });
          return c.redirect(
            buildRedirectUrl('error', {
              message: 'This ORCID iD is already linked to another account',
            })
          );
        }
        throw insertError;
      }

      // Denormalized copy for queries that read the author index.
      const updateResult = await pool.query(
        `UPDATE authors_index SET orcid = $1, orcid_verified_at = NOW() WHERE did = $2`,
        [orcid, did]
      );

      if (updateResult.rowCount === 0) {
        // Not indexed yet. The verification is safe in orcid_verifications and
        // the indexing path reads it when the author's row is first written.
        logger.info('ORCID verified before the author was indexed; stored for indexing', {
          did,
          orcid,
        });
      }

      logger.info('ORCID verification completed', { did, orcid });

      // Invalidate cached profile so the next fetch reflects verification
      await redis.del(`chive:author:profile:${did}`);

      return c.redirect(buildRedirectUrl('success', { orcid }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ORCID callback handler error', error);
      return c.redirect(buildRedirectUrl('error', { message: 'Internal error' }));
    }
  });
}
