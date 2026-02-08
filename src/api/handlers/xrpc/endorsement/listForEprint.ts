/**
 * XRPC handler for pub.chive.endorsement.listForEprint.
 *
 * @remarks
 * Lists endorsements for a specific eprint.
 *
 * @packageDocumentation
 * @public
 */

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/endorsement/listForEprint.js';
import type { AtUri, DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Endorser profile info resolved from DID.
 */
interface EndorserInfo {
  handle: string;
  avatar?: string;
}

/**
 * Resolves endorser handle and avatar from DID.
 */
async function resolveEndorserInfo(
  did: string,
  didResolver: DIDResolver,
  logger: { warn: (msg: string, ctx: Record<string, unknown>) => void }
): Promise<EndorserInfo> {
  let handle = did;
  let avatar: string | undefined;

  try {
    const [didDoc, pdsEndpoint] = await Promise.all([
      didResolver.resolveDID(did as DID),
      didResolver.getPDSEndpoint(did as DID),
    ]);

    // Extract handle from alsoKnownAs
    if (didDoc?.alsoKnownAs) {
      const handleEntry = didDoc.alsoKnownAs.find((aka: string) => aka.startsWith('at://'));
      if (handleEntry) {
        handle = handleEntry.replace('at://', '');
      }
    }

    // Fetch avatar from profile
    if (pdsEndpoint) {
      try {
        const profileResponse = await fetch(
          `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`,
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
            avatar = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${profileData.value.avatar.ref.$link}`;
          }
        }
      } catch {
        // Profile fetch failed, continue without avatar
      }
    }
  } catch (error) {
    logger.warn('Failed to resolve endorser info', { did, error });
  }

  return { handle, avatar };
}

/**
 * XRPC method for pub.chive.endorsement.listForEprint.
 *
 * @public
 */
export const listForEprint: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const redis = c.get('redis');
    const reviewService = c.get('services').review;
    const didResolver = new DIDResolver({ redis, logger });

    logger.debug('Listing endorsements for eprint', {
      eprintUri: params.eprintUri,
      contributionType: params.contributionType,
      limit: params.limit,
      cursor: params.cursor,
    });

    // Get paginated endorsements from service
    const result = await reviewService.listEndorsementsForEprint(params.eprintUri as AtUri, {
      limit: params.limit,
      cursor: params.cursor,
    });

    // Get summary for this eprint
    const summary = await reviewService.getEndorsementSummary(params.eprintUri as AtUri);

    // Resolve handles and avatars for all endorsers in parallel
    const endorserDids = [...new Set(result.items.map((item) => item.endorser))];
    const infoMap = new Map<string, EndorserInfo>();

    await Promise.all(
      endorserDids.map(async (did) => {
        const info = await resolveEndorserInfo(did, didResolver, logger);
        infoMap.set(did, info);
      })
    );

    // Map service results to API format
    let endorsements = result.items.map((item) => {
      const info = infoMap.get(item.endorser) ?? { handle: item.endorser };
      return {
        uri: item.uri,
        cid: (item as { cid?: string }).cid ?? 'placeholder',
        eprintUri: item.eprintUri,
        endorser: {
          did: item.endorser,
          handle: info.handle,
          avatar: info.avatar,
        },
        contributions: [...item.contributions],
        comment: item.comment,
        createdAt: item.createdAt.toISOString(),
      };
    });

    // Filter by contribution type if specified
    if (params.contributionType) {
      const filterType = params.contributionType;
      endorsements = endorsements.filter((e) => e.contributions.includes(filterType));
    }

    const response: OutputSchema = {
      endorsements,
      summary: {
        total: summary.total,
        endorserCount: summary.endorserCount,
        byType: summary.byType,
      },
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: result.total,
    };

    logger.info('Endorsements listed for eprint', {
      eprintUri: params.eprintUri,
      count: response.endorsements.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
