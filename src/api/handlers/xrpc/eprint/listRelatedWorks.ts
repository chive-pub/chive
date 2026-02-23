/**
 * XRPC handler for pub.chive.eprint.listRelatedWorks.
 *
 * @remarks
 * Lists user-curated related work links for an eprint. Each link
 * connects two eprints with a typed relationship (related, extends,
 * replicates, contradicts, reviews, is-supplement-to).
 *
 * The response includes the target eprint's title when available,
 * resolved from the eprints index.
 *
 * **ATProto Compliance:**
 * - Returns indexed data only
 * - Never writes to user PDS
 * - Index data rebuildable from firehose
 *
 * @packageDocumentation
 * @public
 */

import { withSpan } from '../../../../observability/tracer.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Default number of related works per page.
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum number of related works per page.
 */
const MAX_LIMIT = 100;

/**
 * Output schema for listRelatedWorks.
 *
 * @public
 */
export interface ListRelatedWorksOutput {
  relatedWorks: RelatedWorkView[];
  cursor?: string;
  total?: number;
}

/**
 * Individual related work view in the response.
 */
interface RelatedWorkView {
  uri: string;
  sourceEprintUri: string;
  targetEprintUri: string;
  targetTitle?: string;
  relationType: string;
  description?: string;
  curatorDid: string;
  createdAt: string;
}

/**
 * Query parameters for listRelatedWorks.
 *
 * @public
 */
export interface ListRelatedWorksParams {
  eprintUri: string;
  limit?: number;
  cursor?: string;
}

/**
 * XRPC method for pub.chive.eprint.listRelatedWorks.
 *
 * @remarks
 * Returns a paginated list of user-curated related works for a specific eprint.
 * Includes the target eprint title when available in the index.
 *
 * @public
 */
export const listRelatedWorks: XRPCMethod<ListRelatedWorksParams, void, ListRelatedWorksOutput> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<ListRelatedWorksOutput>> => {
    const { eprint } = c.get('services');
    const logger = c.get('logger');

    return withSpan('xrpc.listRelatedWorks', async () => {
      if (!params.eprintUri) {
        throw new ValidationError('Missing required parameter: eprintUri', 'eprintUri');
      }

      const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      const offset = params.cursor ? parseInt(params.cursor, 10) : 0;

      logger.debug('Listing related works', {
        eprintUri: params.eprintUri,
        limit,
        cursor: params.cursor,
      });

      const result = await eprint.getRelatedWorksForEprint(params.eprintUri as AtUri, {
        limit,
        offset,
      });

      // Resolve target eprint titles from the index
      const relatedWorks: RelatedWorkView[] = await Promise.all(
        result.relatedWorks.map(async (rw) => {
          let targetTitle: string | undefined;
          try {
            const targetEprint = await eprint.getEprint(rw.targetEprintUri);
            targetTitle = targetEprint?.title;
          } catch {
            // Silently ignore title resolution failures
          }

          return {
            uri: rw.uri,
            sourceEprintUri: rw.sourceEprintUri,
            targetEprintUri: rw.targetEprintUri,
            targetTitle,
            relationType: rw.relationshipType,
            description: rw.description ?? undefined,
            curatorDid: rw.curatorDid,
            createdAt: rw.createdAt.toISOString(),
          };
        })
      );

      const hasMore = offset + relatedWorks.length < result.total;
      const nextCursor = hasMore ? String(offset + relatedWorks.length) : undefined;

      const response: ListRelatedWorksOutput = {
        relatedWorks,
        cursor: nextCursor,
        total: result.total,
      };

      logger.info('Related works listed', {
        eprintUri: params.eprintUri,
        count: relatedWorks.length,
        total: result.total,
      });

      return { encoding: 'application/json', body: response };
    });
  },
};
