/**
 * XRPC handler for pub.chive.author.initiateOrcidVerification.
 *
 * @remarks
 * Initiates the ORCID OAuth verification flow by generating a random state
 * parameter, storing it in Redis, and returning the ORCID authorization URL
 * for the frontend to redirect to.
 *
 * @packageDocumentation
 * @public
 */

import crypto from 'node:crypto';

import { getOrcidConfig } from '../../../../config/orcid.js';
import type { OutputSchema } from '../../../../lexicons/generated/types/pub/chive/author/initiateOrcidVerification.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Initiates ORCID OAuth verification for the authenticated user.
 *
 * @remarks
 * Generates a cryptographic state parameter, stores the user's DID in Redis
 * keyed by that state (with a 10-minute TTL), and returns the full ORCID
 * authorization URL. The frontend redirects the user to this URL, and ORCID
 * redirects back to the REST callback handler after authorization.
 *
 * @public
 */
export const initiateOrcidVerification: XRPCMethod<void, void, OutputSchema> = {
  type: 'procedure',
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<OutputSchema>> => {
    const user = c.get('user');
    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    let config;
    try {
      config = getOrcidConfig();
    } catch {
      throw new ValidationError('ORCID OAuth not configured', 'orcid', 'not_configured');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const redis = c.get('redis');

    await redis.set(`orcid:oauth:state:${state}`, JSON.stringify({ did: user.did }), 'EX', 600);

    const authorizeUrl = `${config.baseUrl}/oauth/authorize?client_id=${config.clientId}&response_type=code&scope=/authenticate&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}`;

    return { encoding: 'application/json', body: { authorizeUrl } };
  },
};
