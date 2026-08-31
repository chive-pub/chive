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
import type { AtUri, DID } from '../../../../types/atproto.js';
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
    // The contribution-type filter goes to the service, not applied here after
    // the page has already been cut: filtering a page after pagination left
    // `total`, `hasMore` and `cursor` describing a different set than the items.
    const result = await review.listEndorsementsByUser(params.endorserDid as DID, {
      limit: params.limit,
      cursor: params.cursor,
      contributionType: params.contributionType,
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

    // Fetch the eprint titles in one query rather than one per endorsement.
    // A user with a page of 50 endorsements previously cost 50 round-trips to
    // read 50 titles.
    //
    // A failure here loses the titles for the page rather than the page: an
    // endorsement is still worth returning without the title of the paper it
    // is about, and the eprint may genuinely have been deleted.
    let eprintsByUri = new Map<AtUri, Awaited<ReturnType<typeof eprint.getEprint>>>();
    try {
      eprintsByUri = await eprint.getEprints(result.items.map((item) => item.eprintUri));
    } catch (error) {
      logger.warn('Could not fetch eprint titles for endorsements', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // No longer async: the eprint fetch is hoisted above, so nothing in here
    // awaits and Promise.all would only add a tick.
    const endorsementsWithTitles = result.items.map((item) => {
      const eprintTitle = eprintsByUri.get(item.eprintUri)?.title;

      return {
        uri: item.uri,
        // The CID is stored at index time and now selected; it was previously
        // reported as the literal string 'placeholder', which no client could
        // use for the optimistic-concurrency writes the lexicon intends.
        cid: item.cid ?? '',
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
    });

    const response: OutputSchema = {
      endorsements: endorsementsWithTitles,
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
