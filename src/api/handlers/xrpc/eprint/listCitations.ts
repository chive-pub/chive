/**
 * XRPC handler for pub.chive.eprint.listCitations.
 *
 * @remarks
 * Lists citations for an eprint, combining auto-extracted citations
 * from external sources (Semantic Scholar, Crossref, GROBID) and
 * user-provided citations from the ATProto firehose.
 *
 * **ATProto Compliance:**
 * - Returns indexed data only
 * - Never writes to user PDS
 * - Index data rebuildable from firehose and external sources
 *
 * @packageDocumentation
 * @public
 */

import { withSpan } from '../../../../observability/tracer.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { EprintCitationQueryOptions } from '../../../../types/interfaces/storage.interface.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Default number of citations per page.
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum number of citations per page.
 */
const MAX_LIMIT = 100;

/**
 * Output schema for listCitations.
 *
 * @public
 */
export interface ListCitationsOutput {
  citations: CitationView[];
  cursor?: string;
  total?: number;
}

/**
 * Individual citation view in the response.
 */
interface CitationView {
  uri?: string;
  title: string;
  doi?: string;
  arxivId?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  chiveUri?: string;
  citationType?: string;
  context?: string;
  source: string;
  confidence?: number;
  isInfluential?: boolean;
  createdAt?: string;
}

/**
 * Query parameters for listCitations.
 *
 * @public
 */
export interface ListCitationsParams {
  eprintUri: string;
  source?: string;
  limit?: number;
  cursor?: string;
}

/**
 * XRPC method for pub.chive.eprint.listCitations.
 *
 * @remarks
 * Returns a paginated list of citations for a specific eprint.
 * Supports filtering by source type (all, user, auto).
 *
 * @public
 */
export const listCitations: XRPCMethod<ListCitationsParams, void, ListCitationsOutput> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<ListCitationsOutput>> => {
    const { eprint } = c.get('services');
    const logger = c.get('logger');

    return withSpan('xrpc.listCitations', async () => {
      if (!params.eprintUri) {
        throw new ValidationError('Missing required parameter: eprintUri', 'eprintUri');
      }

      const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      const offset = params.cursor ? parseInt(params.cursor, 10) : 0;

      // Validate source parameter
      const validSources = ['all', 'user', 'auto'];
      const source = (params.source ?? 'all') as EprintCitationQueryOptions['source'];
      if (!validSources.includes(source ?? 'all')) {
        throw new ValidationError(
          `Invalid source parameter: ${params.source}. Must be one of: ${validSources.join(', ')}`,
          'source'
        );
      }

      logger.debug('Listing citations', {
        eprintUri: params.eprintUri,
        source,
        limit,
        cursor: params.cursor,
      });

      const result = await eprint.getCitationsForEprint(params.eprintUri as AtUri, {
        limit,
        offset,
        source,
      });

      const citations: CitationView[] = result.citations.map((citation) => ({
        uri: citation.userRecordUri ?? undefined,
        title: citation.title ?? '',
        doi: citation.doi ?? undefined,
        arxivId: citation.arxivId ?? undefined,
        authors: citation.authors ? [...citation.authors] : undefined,
        year: citation.year ?? undefined,
        venue: citation.venue ?? undefined,
        chiveUri: citation.chiveMatchUri ?? undefined,
        citationType: citation.citationType ?? undefined,
        context: citation.context ?? undefined,
        source: citation.source,
        confidence: citation.confidence > 0 ? citation.confidence : undefined,
        isInfluential: citation.isInfluential ?? undefined,
        createdAt: citation.extractedAt.toISOString(),
      }));

      const hasMore = offset + citations.length < result.total;
      const nextCursor = hasMore ? String(offset + citations.length) : undefined;

      const response: ListCitationsOutput = {
        citations,
        cursor: nextCursor,
        total: result.total,
      };

      logger.info('Citations listed', {
        eprintUri: params.eprintUri,
        source,
        count: citations.length,
        total: result.total,
      });

      return { encoding: 'application/json', body: response };
    });
  },
};
