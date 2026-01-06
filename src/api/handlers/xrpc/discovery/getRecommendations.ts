/**
 * Handler for pub.chive.discovery.getRecommendations.
 *
 * @remarks
 * Returns personalized paper recommendations for the authenticated user
 * based on their research profile, claimed papers, and interaction history.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { RecommendationReasonType } from '../../../../types/interfaces/discovery.interface.js';
import {
  getRecommendationsParamsSchema,
  getRecommendationsResponseSchema,
  type GetRecommendationsParams,
  type GetRecommendationsResponse,
  type RecommendationExplanation,
} from '../../../schemas/discovery.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

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
 * Handler for pub.chive.discovery.getRecommendations.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Personalized recommendations with explanations
 *
 * @remarks
 * Uses multiple signals for recommendations:
 * - Research fields from user profile
 * - Citation patterns from claimed papers
 * - Collaborator networks
 * - Trending papers in user's fields
 *
 * Requires authentication to access user's personalization data.
 *
 * @public
 */
export async function getRecommendationsHandler(
  c: Context<ChiveEnv>,
  params: GetRecommendationsParams
): Promise<GetRecommendationsResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { discovery } = c.get('services');

  if (!user?.did) {
    throw new AuthenticationError('Authentication required to get recommendations');
  }

  if (!discovery) {
    throw new ServiceUnavailableError('Discovery service not available');
  }

  const did = user.did;
  logger.debug('Getting recommendations', { did, limit: params.limit, signals: params.signals });

  // Get recommendations from discovery service
  const result = await discovery.getRecommendationsForUser(did, {
    limit: params.limit,
    cursor: params.cursor,
    signals: params.signals,
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

  logger.info('Recommendations returned', {
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
 * Endpoint definition for pub.chive.discovery.getRecommendations.
 *
 * @public
 */
export const getRecommendationsEndpoint: XRPCEndpoint<
  GetRecommendationsParams,
  GetRecommendationsResponse
> = {
  method: 'pub.chive.discovery.getRecommendations' as never,
  type: 'query',
  description: 'Get personalized paper recommendations',
  inputSchema: getRecommendationsParamsSchema,
  outputSchema: getRecommendationsResponseSchema,
  handler: getRecommendationsHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
