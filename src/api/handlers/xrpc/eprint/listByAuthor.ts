/**
 * XRPC handler for pub.chive.eprint.listByAuthor.
 *
 * @remarks
 * Lists all eprints by a specific author DID with pagination.
 * Supports sorting by date or view count.
 *
 * **ATProto Compliance:**
 * - Returns pdsUrl for each result
 * - Index data only (rebuildable from firehose)
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/listByAuthor.js';
import type { DID } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import { normalizeFieldUri } from '../../../../utils/at-uri.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.eprint.listByAuthor.
 *
 * @public
 */
export const listByAuthor: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { eprint } = c.get('services');
    const logger = c.get('logger');

    // Validate required parameter
    if (!params.did) {
      throw new ValidationError('Missing required parameter: did', 'did');
    }

    logger.debug('Listing eprints by author', {
      did: params.did,
      limit: params.limit,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });

    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
    const limit = params.limit ?? 50;

    // Map lexicon sortBy values to storage interface values
    const sortByMap: Record<string, 'createdAt' | 'indexedAt' | 'title'> = {
      indexedAt: 'indexedAt',
      publishedAt: 'createdAt',
      updatedAt: 'createdAt',
    };
    const mappedSortBy = sortByMap[params.sortBy] ?? 'createdAt';
    const mappedSortOrder: 'asc' | 'desc' = params.sortOrder === 'asc' ? 'asc' : 'desc';

    const results = await eprint.getEprintsByAuthor(params.did as DID, {
      limit,
      offset,
      sortBy: mappedSortBy,
      sortOrder: mappedSortOrder,
    });

    const hasMore = offset + results.eprints.length < results.total;

    // Collect all unique author DIDs that need avatar fetching
    const allAuthorDids = new Set<string>();
    for (const p of results.eprints) {
      for (const author of p.authors ?? []) {
        if (author.did && !author.avatarUrl) {
          allAuthorDids.add(author.did);
        }
      }
    }

    // Fetch avatars from Bluesky API
    const avatarMap = new Map<string, { handle?: string; avatar?: string }>();
    if (allAuthorDids.size > 0) {
      const dids = Array.from(allAuthorDids);
      const batchSize = 25;
      for (let i = 0; i < dids.length; i += batchSize) {
        const batch = dids.slice(i, i + batchSize);
        try {
          const urlParams = new URLSearchParams();
          for (const did of batch) {
            urlParams.append('actors', did);
          }
          const profileResponse = await fetch(
            `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${urlParams.toString()}`,
            {
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(5000),
            }
          );

          if (profileResponse.ok) {
            const data = (await profileResponse.json()) as {
              profiles: { did: string; handle?: string; avatar?: string }[];
            };
            for (const profile of data.profiles) {
              avatarMap.set(profile.did, { handle: profile.handle, avatar: profile.avatar });
            }
          }
        } catch {
          // Silently ignore avatar fetch failures
        }
      }
    }

    // Resolve UUID field labels from Neo4j at response time.
    // During indexing, labels may fall back to UUIDs if Neo4j was unavailable.
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuidFieldIds = new Set<string>();
    for (const p of results.eprints) {
      for (const f of p.fields ?? []) {
        if (UUID_PATTERN.test(f.label)) {
          uuidFieldIds.add(f.id ?? f.label);
        }
      }
    }

    let nodeMap = new Map<string, { label: string }>();
    if (uuidFieldIds.size > 0) {
      try {
        const { nodeRepository } = c.get('services');
        nodeMap = await nodeRepository.getNodesByIds([...uuidFieldIds]);
      } catch (err) {
        logger.warn('Failed to resolve UUID field labels from Neo4j', {
          error: err instanceof Error ? err.message : 'Unknown error',
          uuidCount: uuidFieldIds.size,
        });
      }
    }

    const response: OutputSchema = {
      eprints: results.eprints.map((p) => ({
        uri: p.uri,
        cid: p.cid,
        title: p.title,
        abstract: p.abstractPlainText,
        authors: (p.authors ?? []).map((author) => {
          const profile = author.did ? avatarMap.get(author.did) : undefined;
          return {
            // Only include did if it's a valid DID (not empty string)
            ...(author.did ? { did: author.did } : {}),
            handle: author.handle ?? profile?.handle,
            displayName: author.name,
            avatarUrl: author.avatarUrl ?? profile?.avatar,
          };
        }),
        fields: p.fields?.map((f) => {
          const fieldId = f.id ?? f.label;
          const label = UUID_PATTERN.test(f.label)
            ? (nodeMap.get(fieldId)?.label ?? f.label)
            : f.label;
          return {
            uri: normalizeFieldUri(f.uri),
            label,
            id: f.id,
          };
        }),
        indexedAt: p.indexedAt.toISOString(),
        publishedAt: p.createdAt.toISOString(),
      })),
      cursor: hasMore ? String(offset + results.eprints.length) : undefined,
      total: results.total,
    };

    logger.info('Author eprints listed', {
      did: params.did,
      count: response.eprints.length,
      total: results.total,
    });

    return { encoding: 'application/json', body: response };
  },
};
