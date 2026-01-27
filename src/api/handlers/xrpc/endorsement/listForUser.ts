/**
 * XRPC handler for pub.chive.endorsement.listForUser.
 *
 * @remarks
 * Lists endorsements given by a specific user.
 *
 * @packageDocumentation
 * @public
 */

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/endorsement/listForUser.js';
import type { DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.endorsement.listForUser.
 *
 * @public
 */
export const listForUser: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const redis = c.get('redis');
    const { review, eprint } = c.get('services');
    const didResolver = new DIDResolver({ redis, logger });

    logger.debug('Listing endorsements for user', {
      endorserDid: params.endorserDid,
      contributionType: params.contributionType,
      limit: params.limit,
      cursor: params.cursor,
    });

    // Get paginated endorsements from service
    const result = await review.listEndorsementsByUser(params.endorserDid as DID, {
      limit: params.limit,
      cursor: params.cursor,
    });

    // Resolve handle and avatar for the endorser (same user for all results)
    let endorserHandle = params.endorserDid;
    let endorserAvatar: string | undefined;

    try {
      const [didDoc, pdsEndpoint] = await Promise.all([
        didResolver.resolveDID(params.endorserDid as DID),
        didResolver.getPDSEndpoint(params.endorserDid as DID),
      ]);

      if (didDoc?.alsoKnownAs) {
        const handleEntry = didDoc.alsoKnownAs.find((aka: string) => aka.startsWith('at://'));
        if (handleEntry) {
          endorserHandle = handleEntry.replace('at://', '');
        }
      }

      if (pdsEndpoint) {
        try {
          const profileResponse = await fetch(
            `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(params.endorserDid)}&collection=app.bsky.actor.profile&rkey=self`,
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
              endorserAvatar = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(params.endorserDid)}&cid=${profileData.value.avatar.ref.$link}`;
            }
          }
        } catch {
          // Profile fetch failed, continue without avatar
        }
      }
    } catch (error) {
      logger.warn('Failed to resolve handle for endorser', { did: params.endorserDid, error });
    }

    // Fetch eprint titles for each endorsement
    const endorsementsWithTitles = await Promise.all(
      result.items.map(async (item) => {
        let eprintTitle: string | undefined;
        try {
          const eprintData = await eprint.getEprint(item.eprintUri);
          eprintTitle = eprintData?.title;
        } catch {
          // Eprint may have been deleted
        }

        return {
          uri: item.uri,
          cid: 'placeholder', // CID not stored in index
          eprintUri: item.eprintUri,
          eprintTitle,
          endorser: {
            did: item.endorser,
            handle: endorserHandle,
            avatar: endorserAvatar,
          },
          contributions: [...item.contributions],
          comment: item.comment,
          createdAt: item.createdAt.toISOString(),
        };
      })
    );

    // Filter by contribution type if specified
    let endorsements = endorsementsWithTitles;
    if (params.contributionType) {
      endorsements = endorsements.filter((e) =>
        e.contributions.includes(params.contributionType as string)
      );
    }

    const response: OutputSchema = {
      endorsements,
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: result.total,
    };

    logger.info('Endorsements listed for user', {
      endorserDid: params.endorserDid,
      count: response.endorsements.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
