/**
 * XRPC method for pub.chive.discovery.getSimilar.
 *
 * @remarks
 * Returns related papers for a given eprint based on citation patterns,
 * semantic similarity, and topic overlap. Supports graph-based analysis
 * including co-citation and bibliographic coupling.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  RelatedEprint as SchemaRelatedEprint,
} from '../../../../lexicons/generated/types/pub/chive/discovery/getSimilar.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
import type {
  RelatedEprintRelationship,
  RelatedEprintSignal,
} from '../../../../types/interfaces/discovery.interface.js';
import { toLexiconAbstract } from '../../../../utils/rich-text.js';
// Use generated types from lexicons
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

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
    'bibliographic-coupling': 'bibliographic-coupling',
    'same-author': 'same-author',
    'similar-topics': 'same-topic',
    'semantically-similar': 'semantically-similar',
    'collaborative-filtering': 'collaborative-filtering',
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
 * XRPC method for pub.chive.discovery.getSimilar.
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
export const getSimilar: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { discovery, eprint, recommendationService } = c.get('services');

    // Lexicon codegen produces a union of string | string[] for array query params.
    // When a single value is sent, the XRPC parser passes a plain string, not an array.
    type IncludeType =
      | 'semantic'
      | 'citation'
      | 'topic'
      | 'author'
      | 'co-citation'
      | 'bibliographic-coupling'
      | 'collaborative';
    const rawIncludeTypes = params.includeTypes;
    const includeTypes: IncludeType[] = Array.isArray(rawIncludeTypes)
      ? (rawIncludeTypes as IncludeType[])
      : rawIncludeTypes
        ? [rawIncludeTypes as IncludeType]
        : [];
    const includeGraphTypes = includeTypes.some(
      (t) => t === 'co-citation' || t === 'bibliographic-coupling'
    );
    const includeCollaborative = includeTypes.includes('collaborative');
    const standardTypes = includeTypes.filter(
      (t) => t !== 'co-citation' && t !== 'bibliographic-coupling' && t !== 'collaborative'
    );

    logger.debug('Getting similar papers', {
      uri: params.uri,
      limit: params.limit,
      includeTypes,
      includeGraphTypes,
    });

    if (!discovery) {
      throw new ServiceUnavailableError('Discovery service not available');
    }

    // Get the source eprint
    const sourceEprint = await eprint.getEprint(params.uri as AtUri);
    if (!sourceEprint) {
      throw new NotFoundError('Eprint', params.uri);
    }

    // Get related papers from discovery service (for standard types)
    // Use defensive error handling - return empty array if discovery fails
    let related: Awaited<ReturnType<typeof discovery.findRelatedEprints>> = [];
    try {
      // Build signals array from standard types + collaborative
      const mappedSignals = mapIncludeTypesToSignals(
        standardTypes.length > 0 ? standardTypes : undefined
      );
      let signals: RelatedEprintSignal[] | undefined = mappedSignals;
      if (includeCollaborative) {
        signals = signals ? [...signals, 'collaborative'] : ['collaborative'];
      }
      // Build weights from params if any are provided
      const hasWeights =
        params.weightSemantic !== undefined ||
        params.weightCoCitation !== undefined ||
        params.weightConceptOverlap !== undefined ||
        params.weightAuthorNetwork !== undefined ||
        params.weightCollaborative !== undefined;
      const weights = hasWeights
        ? {
            semantic: params.weightSemantic,
            coCitation: params.weightCoCitation,
            conceptOverlap: params.weightConceptOverlap,
            authorNetwork: params.weightAuthorNetwork,
            collaborative: params.weightCollaborative,
          }
        : undefined;

      related = await discovery.findRelatedEprints(params.uri as AtUri, {
        limit: params.limit,
        signals,
        weights,
      });
    } catch (error) {
      logger.warn('Discovery service failed, returning empty related papers', {
        uri: params.uri,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue with empty array instead of failing
    }

    // Map to response format
    // Lexicon expects score as integer 0-1000 (scaled from 0-1)
    const relatedPapers: SchemaRelatedEprint[] = related.map((r) => ({
      uri: r.uri as string,
      title: r.title,
      abstract: toLexiconAbstract(
        r.abstract && typeof r.abstract === 'object' && 'items' in r.abstract
          ? r.abstract
          : undefined
      ),
      authors: r.authors?.map((a) => ({ name: a.name })),
      categories: r.categories ? [...r.categories] : undefined,
      publicationDate: formatDate(r.publicationDate),
      score: Math.round((r.score ?? 0) * 1000),
      relationshipType: mapRelationshipType(r.relationshipType),
      explanation: r.explanation,
    }));

    // Add graph-based similarity if requested and service available
    if (includeGraphTypes && recommendationService) {
      try {
        const graphSimilar = await recommendationService.getSimilar(
          params.uri as AtUri,
          params.limit ?? 5
        );
        const existingUris = new Set(relatedPapers.map((r) => r.uri));

        for (const paper of graphSimilar) {
          if (!existingUris.has(paper.uri)) {
            // Filter by requested graph types
            const matchesType =
              (includeTypes.includes('co-citation') && paper.reason === 'co-citation') ||
              (includeTypes.includes('bibliographic-coupling') &&
                paper.reason === 'bibliographic-coupling') ||
              (!includeTypes.includes('co-citation') &&
                !includeTypes.includes('bibliographic-coupling'));

            if (matchesType) {
              // Graph similarity is 0-1, scale to 0-1000 for lexicon
              relatedPapers.push({
                uri: paper.uri,
                title: paper.title,
                abstract: undefined,
                authors: paper.authors?.map((name) => ({ name })),
                categories: undefined,
                publicationDate: undefined,
                score: Math.round((paper.similarity ?? 0) * 1000),
                relationshipType:
                  paper.reason === 'bibliographic-coupling' ? 'bibliographic-coupling' : 'co-cited',
                explanation:
                  paper.reason === 'co-citation'
                    ? `Frequently cited together (${paper.sharedCiters ?? 0} shared citers)`
                    : `Share ${paper.sharedReferences ?? 0} common references`,
                sharedReferences: paper.sharedReferences,
                sharedCiters: paper.sharedCiters,
              });
              existingUris.add(paper.uri);
            }
          }
        }

        // Re-sort by score
        relatedPapers.sort((a, b) => b.score - a.score);

        logger.debug('Added graph similarity results', {
          graphCount: graphSimilar.length,
          totalCount: relatedPapers.length,
        });
      } catch (error) {
        // Log but don't fail if graph similarity unavailable
        logger.warn('Failed to get graph similarity', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Limit to requested count
    const limitedPapers = relatedPapers.slice(0, params.limit ?? 5);

    logger.info('Similar papers returned', {
      uri: params.uri,
      count: limitedPapers.length,
    });

    return {
      encoding: 'application/json',
      body: {
        eprint: {
          uri: params.uri,
          title: sourceEprint.title,
        },
        related: limitedPapers,
      },
    };
  },
};
