/**
 * Handler for pub.chive.discovery.getForYou.
 *
 * @remarks
 * Returns the personalized "For You" feed for the authenticated user.
 * Similar to getRecommendations but uses all enabled signals from user's
 * discovery settings and is optimized for the main feed experience.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import { AuthenticationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { RecommendationReasonType } from '../../../../types/interfaces/discovery.interface.js';
import {
  getRecommendationsResponseSchema,
  type GetRecommendationsResponse,
  type RecommendationExplanation,
} from '../../../schemas/discovery.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Input schema for getForYou.
 */
const getForYouParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20).describe('Number of items to return'),
  cursor: z.string().optional().describe('Pagination cursor'),
});

type GetForYouParams = z.infer<typeof getForYouParamsSchema>;

/**
 * Maps interface explanation types to schema explanation types.
 */
function mapExplanationType(
  interfaceType: RecommendationReasonType
): RecommendationExplanation['type'] {
  const typeMap: Record<RecommendationReasonType, RecommendationExplanation['type']> = {
    'semantic-similarity': 'semantic',
    'citation-overlap': 'citation',
    'field-match': 'fields',
    collaborator: 'collaborator',
    trending: 'trending',
    'concept-match': 'concept',
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
 * Handler for pub.chive.discovery.getForYou.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Personalized "For You" feed
 *
 * @remarks
 * Uses all enabled signals from user's discovery settings:
 * - Research fields from user profile
 * - Citation patterns from claimed papers
 * - Collaborator networks
 * - Trending papers in user's fields
 *
 * Requires authentication to access user's personalization data.
 *
 * @public
 */
export async function getForYouHandler(
  c: Context<ChiveEnv>,
  params: GetForYouParams
): Promise<GetRecommendationsResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { discovery } = c.get('services');

  if (!user?.did) {
    throw new AuthenticationError('Authentication required to get For You feed');
  }

  if (!discovery) {
    throw new ServiceUnavailableError('Discovery service not available');
  }

  const did = user.did;
  logger.debug('Getting For You feed', { did, limit: params.limit });

  // For You uses all signals by default (respects user settings internally)
  const result = await discovery.getRecommendationsForUser(did, {
    limit: params.limit,
    cursor: params.cursor,
    signals: ['fields', 'citations', 'collaborators', 'trending'],
  });

  // Map to response format
  const recommendations = result.recommendations.map((r) => ({
    uri: r.uri as string,
    title: r.title,
    abstract: r.abstract,
    authors: r.authors?.map((a) => ({ name: a.name })),
    categories: r.categories ? [...r.categories] : undefined,
    publicationDate: formatDate(r.publicationDate),
    score: r.score,
    explanation: {
      type: mapExplanationType(r.explanation.type),
      text: r.explanation.text,
      weight: r.explanation.weight,
      data: r.explanation.data
        ? {
            similarPaperTitle: r.explanation.data.similarPaperTitle,
            sharedCitations: r.explanation.data.sharedCitations,
            matchingConcepts: r.explanation.data.matchingConcepts
              ? [...r.explanation.data.matchingConcepts]
              : undefined,
          }
        : undefined,
    },
  }));

  logger.info('For You feed returned', {
    did,
    count: recommendations.length,
    hasMore: result.hasMore,
  });

  return {
    recommendations,
    cursor: result.cursor,
    hasMore: result.hasMore,
  };
}

/**
 * Endpoint definition for pub.chive.discovery.getForYou.
 *
 * @public
 */
export const getForYouEndpoint: XRPCEndpoint<GetForYouParams, GetRecommendationsResponse> = {
  method: 'pub.chive.discovery.getForYou' as never,
  type: 'query',
  description: 'Get personalized For You feed',
  inputSchema: getForYouParamsSchema,
  outputSchema: getRecommendationsResponseSchema,
  handler: getForYouHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
