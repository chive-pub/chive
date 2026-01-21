/**
 * Get current user's Chive profile handler.
 *
 * @remarks
 * Returns the authenticated user's pub.chive.actor.profile record.
 * Requires authentication since it accesses the user's own profile.
 *
 * @packageDocumentation
 * @public
 */

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/actor/getMyProfile.js';
import type { DID } from '../../../../types/atproto.js';
import { AuthenticationError, NotFoundError } from '../../../../types/errors.js';
import type { ILogger } from '../../../../types/interfaces/logger.interface.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Fetches the user's Chive profile from their PDS.
 */
async function fetchChiveProfileFromPDS(
  did: DID,
  pdsEndpoint: string,
  logger: ILogger
): Promise<OutputSchema | null> {
  try {
    const profileUrl = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=pub.chive.actor.profile&rkey=self`;

    const response = await fetch(profileUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      logger.debug('Chive profile fetch failed', { did, status: response.status });
      return null;
    }

    const data = (await response.json()) as { value?: OutputSchema };
    if (!data.value) {
      return null;
    }

    return data.value;
  } catch (error) {
    logger.debug('Chive profile fetch error', {
      did,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * XRPC method for pub.chive.actor.getMyProfile.
 *
 * @public
 */
export const getMyProfile: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    const did = user.did;
    const redis = c.get('redis');
    logger.debug('Fetching my Chive profile', { did });

    // Resolve DID to get PDS endpoint
    const didResolver = new DIDResolver({ redis, logger });
    const pdsEndpoint = await didResolver.getPDSEndpoint(did);

    if (!pdsEndpoint) {
      throw new NotFoundError('PDS endpoint', did);
    }

    const profile = await fetchChiveProfileFromPDS(did, pdsEndpoint, logger);

    if (!profile) {
      // Return empty profile if none exists (user can create one)
      return { encoding: 'application/json', body: {} };
    }

    return { encoding: 'application/json', body: profile };
  },
};
