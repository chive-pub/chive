/**
 * XRPC method for pub.chive.discovery.getRecommendations.
 *
 * @remarks
 * Returns personalized paper recommendations for the authenticated user
 * based on their research profile, claimed papers, and interaction history.
 * When 'graph' signal is included, adds co-citation and PageRank-based
 * recommendations from the knowledge graph.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  RecommendationExplanation,
  RecommendedEprint,
} from '../../../../lexicons/generated/types/pub/chive/discovery/getRecommendations.js';
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
 * Maps graph recommendation reasons to explanation types.
 */
function mapGraphReasonToExplanationType(reason: string): RecommendationExplanation['type'] {
  switch (reason) {
    case 'similar-fields':
      return 'fields';
    case 'cited-by-interests':
      return 'citation';
    case 'coauthor-network':
      return 'collaborator';
    case 'trending-in-field':
      return 'trending';
    case 'similar-content':
    default:
      return 'semantic';
  }
}

/**
 * XRPC method for pub.chive.discovery.getRecommendations.
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
export const getRecommendations: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { discovery, recommendationService } = c.get('services');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required to get recommendations');
    }

    if (!discovery) {
      throw new ServiceUnavailableError('Discovery service not available');
    }

    const did = user.did;
    // Cast to array type - lexicon allows single value but handler expects array
    const signals = (params.signals ?? []) as (
      | 'fields'
      | 'citations'
      | 'collaborators'
      | 'trending'
      | 'graph'
    )[];
    const includeGraph = signals.includes('graph');

    logger.debug('Getting recommendations', {
      did,
      limit: params.limit,
      signals,
      includeGraph,
    });

    // Get standard recommendations from discovery service
    // Filter out 'graph' signal since discovery service doesn't know about it
    const discoverySignals = signals.filter(
      (s): s is 'fields' | 'citations' | 'collaborators' | 'trending' => s !== 'graph'
    );
    const result = await discovery.getRecommendationsForUser(did, {
      limit: params.limit,
      cursor: params.cursor,
      signals: discoverySignals.length > 0 ? discoverySignals : undefined,
    });

    // Map discovery recommendations to response format
    const recommendations: RecommendedEprint[] = result.recommendations.map((r) => ({
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

    // Add graph-based recommendations if requested and service available
    if (includeGraph && recommendationService) {
      try {
        const graphRecs = await recommendationService.getPersonalized(
          did as never,
          params.limit ?? 20
        );

        // Add graph recommendations that aren't already in the list
        const existingUris = new Set(recommendations.map((r) => r.uri));

        for (const rec of graphRecs) {
          if (!existingUris.has(rec.uri)) {
            recommendations.push({
              uri: rec.uri as string,
              title: rec.title,
              abstract: rec.abstract,
              authors: rec.authors?.map((name) => ({ name })),
              categories: rec.relatedFields,
              publicationDate: undefined,
              score: rec.score,
              explanation: {
                type: mapGraphReasonToExplanationType(rec.reason),
                text:
                  rec.reason === 'similar-fields'
                    ? `Matches your research fields`
                    : rec.reason === 'cited-by-interests'
                      ? `Cited by papers you've engaged with`
                      : rec.reason === 'coauthor-network'
                        ? `From your coauthor network`
                        : rec.reason === 'trending-in-field'
                          ? `Trending in your research areas`
                          : `Recommended based on content similarity`,
                weight: rec.score,
                data: undefined,
              },
            });
            existingUris.add(rec.uri);
          }
        }

        // Re-sort by score
        recommendations.sort((a, b) => b.score - a.score);

        logger.debug('Added graph recommendations', {
          graphCount: graphRecs.length,
          totalCount: recommendations.length,
        });
      } catch (error) {
        // Log but don't fail if graph recommendations unavailable
        logger.warn('Failed to get graph recommendations', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Limit to requested count
    const limitedRecs = recommendations.slice(0, params.limit ?? 20);

    logger.info('Recommendations returned', {
      did,
      count: limitedRecs.length,
      hasMore: result.hasMore || recommendations.length > limitedRecs.length,
    });

    return {
      encoding: 'application/json',
      body: {
        recommendations: limitedRecs,
        cursor: result.cursor,
        hasMore: result.hasMore,
      },
    };
  },
};
