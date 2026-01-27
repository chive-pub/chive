/**
 * XRPC handler for pub.chive.endorsement.getUserEndorsement.
 *
 * @remarks
 * Gets a user's endorsement for a specific eprint.
 *
 * @packageDocumentation
 * @public
 */

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type {
  QueryParams,
  EndorsementView,
} from '../../../../lexicons/generated/types/pub/chive/endorsement/getUserEndorsement.js';
import type { AtUri, DID } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.endorsement.getUserEndorsement.
 *
 * @public
 */
export const getUserEndorsement: XRPCMethod<QueryParams, void, EndorsementView> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<EndorsementView>> => {
    const logger = c.get('logger');
    const redis = c.get('redis');
    const reviewService = c.get('services').review;
    const didResolver = new DIDResolver({ redis, logger });

    logger.debug('Getting user endorsement', {
      eprintUri: params.eprintUri,
      userDid: params.userDid,
    });

    // Get user's endorsement from ReviewService
    const endorsement = await reviewService.getEndorsementByUser(
      params.eprintUri as AtUri,
      params.userDid as DID
    );

    if (!endorsement) {
      throw new NotFoundError('Endorsement', `user=${params.userDid}, eprint=${params.eprintUri}`);
    }

    // Resolve handle and avatar for the endorser
    let handle: string = endorsement.endorser;
    let avatar: string | undefined;

    try {
      const [didDoc, pdsEndpoint] = await Promise.all([
        didResolver.resolveDID(endorsement.endorser),
        didResolver.getPDSEndpoint(endorsement.endorser),
      ]);

      if (didDoc?.alsoKnownAs) {
        const handleEntry = didDoc.alsoKnownAs.find((aka: string) => aka.startsWith('at://'));
        if (handleEntry) {
          handle = handleEntry.replace('at://', '');
        }
      }

      if (pdsEndpoint) {
        try {
          const profileResponse = await fetch(
            `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(endorsement.endorser)}&collection=app.bsky.actor.profile&rkey=self`,
            {
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(3000),
            }
          );

          if (profileResponse.ok) {
            const profileData = (await profileResponse.json()) as {
              value?: {
                avatar?: { ref?: { $link?: string } };
              };
            };

            if (profileData.value?.avatar?.ref?.$link) {
              avatar = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(endorsement.endorser)}&cid=${profileData.value.avatar.ref.$link}`;
            }
          }
        } catch {
          // Profile fetch failed, continue without avatar
        }
      }
    } catch (error) {
      logger.warn('Failed to resolve handle for endorser', { did: endorsement.endorser, error });
    }

    // Map to API format using generated types
    const response: EndorsementView = {
      uri: endorsement.uri,
      cid: (endorsement as { cid?: string }).cid ?? 'placeholder',
      eprintUri: endorsement.eprintUri,
      endorser: {
        did: endorsement.endorser,
        handle,
        avatar,
      },
      contributions: [...endorsement.contributions],
      comment: endorsement.comment,
      createdAt: endorsement.createdAt.toISOString(),
    };

    logger.info('User endorsement returned', {
      eprintUri: params.eprintUri,
      userDid: params.userDid,
      uri: response.uri,
    });

    return { encoding: 'application/json', body: response };
  },
};
