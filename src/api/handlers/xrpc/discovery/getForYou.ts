/**
 * XRPC method for pub.chive.discovery.getForYou.
 *
 * @remarks
 * Returns the personalized "For You" feed for the authenticated user.
 * Similar to getRecommendations but uses all enabled signals from user's
 * discovery settings and is optimized for the main feed experience.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  RecommendationExplanation,
} from '../../../../lexicons/generated/types/pub/chive/discovery/getForYou.js';
import { AuthenticationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { RecommendationReasonType } from '../../../../types/interfaces/discovery.interface.js';
// Use generated types from lexicons
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

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
 * XRPC method for pub.chive.discovery.getForYou.
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
export const getForYou: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
    const limit = params.limit ?? 20;
    logger.debug('Getting For You feed', { did, limit });

    // For You uses all signals by default (respects user settings internally)
    const result = await discovery.getRecommendationsForUser(did, {
      limit,
      cursor: params.cursor,
      signals: ['fields', 'citations', 'collaborators', 'trending'],
    });

    // Map to response format
    // Lexicon expects score/weight as integers 0-1000 (scaled from 0-1)
    const recommendations = result.recommendations.map((r) => ({
      uri: r.uri as string,
      title: r.title,
      abstract: r.abstract,
      authors: r.authors?.map((a) => ({ name: a.name })),
      categories: r.categories ? [...r.categories] : undefined,
      publicationDate: formatDate(r.publicationDate),
      score: Math.round((r.score ?? 0) * 1000),
      explanation: {
        type: mapExplanationType(r.explanation.type),
        text: r.explanation.text,
        weight: Math.round((r.explanation.weight ?? 0) * 1000),
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
      encoding: 'application/json',
      body: {
        recommendations,
        cursor: result.cursor,
        hasMore: result.hasMore,
      },
    };
  },
};
