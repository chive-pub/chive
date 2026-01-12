/**
 * Handler for pub.chive.discovery.getSimilar.
 *
 * @remarks
 * Returns related papers for a given eprint based on citation patterns,
 * semantic similarity, and topic overlap.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
import type {
  RelatedEprintRelationship,
  RelatedEprintSignal,
} from '../../../../types/interfaces/discovery.interface.js';
import {
  getSimilarParamsSchema,
  getSimilarResponseSchema,
  type GetSimilarParams,
  type GetSimilarResponse,
  type RelatedEprint as SchemaRelatedEprint,
} from '../../../schemas/discovery.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Maps includeTypes param to RelatedEprintSignal array.
 */
function mapIncludeTypesToSignals(
  includeTypes?: readonly ('semantic' | 'citation' | 'topic' | 'author')[]
): RelatedEprintSignal[] | undefined {
  if (!includeTypes || includeTypes.length === 0) {
    return undefined;
  }
  const signalMap: Record<'semantic' | 'citation' | 'topic' | 'author', RelatedEprintSignal> = {
    semantic: 'semantic',
    citation: 'citations',
    topic: 'topics',
    author: 'authors',
  };
  return includeTypes.map((t) => signalMap[t]);
}

/**
 * Maps interface relationship types to schema relationship types.
 */
function mapRelationshipType(
  interfaceType: RelatedEprintRelationship
): SchemaRelatedEprint['relationshipType'] {
  const typeMap: Record<RelatedEprintRelationship, SchemaRelatedEprint['relationshipType']> = {
    cites: 'cites',
    'cited-by': 'cited-by',
    'co-cited': 'co-cited',
    'same-author': 'same-author',
    'similar-topics': 'same-topic',
    'semantically-similar': 'semantically-similar',
  };
  return typeMap[interfaceType];
}

/**
 * Formats a date value to ISO string.
 */
function formatDate(date: Date | string | undefined): string | undefined {
  if (date === undefined) {
    return undefined;
  }
  if (date instanceof Date) {
    return date.toISOString();
  }
  return date;
}

/**
 * Handler for pub.chive.discovery.getSimilar.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Related papers with relationship types
 *
 * @remarks
 * Finds related papers using multiple signals:
 * - Citation relationships (cites/cited-by/co-cited)
 * - Semantic similarity (SPECTER2 embeddings)
 * - Topic overlap (OpenAlex concepts)
 * - Same author papers
 *
 * Does not require authentication, but may provide better results
 * with user context.
 *
 * @public
 */
export async function getSimilarHandler(
  c: Context<ChiveEnv>,
  params: GetSimilarParams
): Promise<GetSimilarResponse> {
  const logger = c.get('logger');
  const { discovery, eprint } = c.get('services');

  logger.debug('Getting similar papers', { uri: params.uri, limit: params.limit });

  if (!discovery) {
    throw new ServiceUnavailableError('Discovery service not available');
  }

  // Get the source eprint
  const sourceEprint = await eprint.getEprint(params.uri as AtUri);
  if (!sourceEprint) {
    throw new NotFoundError('Eprint not found', params.uri);
  }

  // Get related papers from discovery service
  const related = await discovery.findRelatedEprints(params.uri as AtUri, {
    limit: params.limit,
    signals: mapIncludeTypesToSignals(params.includeTypes),
  });

  // Map to response format
  const relatedPapers = related.map((r) => ({
    uri: r.uri as string,
    title: r.title,
    abstract: r.abstract,
    authors: r.authors?.map((a) => ({ name: a.name })),
    categories: r.categories ? [...r.categories] : undefined,
    publicationDate: formatDate(r.publicationDate),
    score: r.score,
    relationshipType: mapRelationshipType(r.relationshipType),
    explanation: r.explanation,
  }));

  logger.info('Similar papers returned', {
    uri: params.uri,
    count: relatedPapers.length,
  });

  return {
    eprint: {
      uri: params.uri,
      title: sourceEprint.title,
    },
    related: relatedPapers,
  };
}

/**
 * Endpoint definition for pub.chive.discovery.getSimilar.
 *
 * @public
 */
export const getSimilarEndpoint: XRPCEndpoint<GetSimilarParams, GetSimilarResponse> = {
  method: 'pub.chive.discovery.getSimilar' as never,
  type: 'query',
  description: 'Get related papers for a eprint',
  inputSchema: getSimilarParamsSchema,
  outputSchema: getSimilarResponseSchema,
  handler: getSimilarHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
