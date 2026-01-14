/**
 * Discovery API schemas.
 *
 * @remarks
 * Zod schemas for discovery-related XRPC endpoints.
 * Discovery provides personalized recommendations, related papers,
 * and citation network data for Chive eprints.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Recommendation explanation schema.
 */
export const recommendationExplanationSchema = z.object({
  type: z.enum(['semantic', 'citation', 'concept', 'collaborator', 'fields', 'trending']),
  text: z.string(),
  weight: z.number().min(0).max(1),
  data: z
    .object({
      similarPaperTitle: z.string().optional(),
      sharedCitations: z.number().int().optional(),
      matchingConcepts: z.array(z.string()).optional(),
    })
    .optional(),
});

export type RecommendationExplanation = z.infer<typeof recommendationExplanationSchema>;

/**
 * Recommended eprint schema.
 */
export const recommendedEprintSchema = z.object({
  uri: z.string(),
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(z.object({ name: z.string() })).optional(),
  categories: z.array(z.string()).optional(),
  publicationDate: z.string().optional(),
  score: z.number().min(0).max(1),
  explanation: recommendationExplanationSchema,
});

export type RecommendedEprint = z.infer<typeof recommendedEprintSchema>;

/**
 * Related eprint schema with relationship type.
 */
export const relatedEprintSchema = z.object({
  uri: z.string(),
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(z.object({ name: z.string() })).optional(),
  categories: z.array(z.string()).optional(),
  publicationDate: z.string().optional(),
  score: z.number().min(0).max(1),
  relationshipType: z.enum([
    'cites',
    'cited-by',
    'co-cited',
    'semantically-similar',
    'same-author',
    'same-topic',
  ]),
  explanation: z.string(),
});

export type RelatedEprint = z.infer<typeof relatedEprintSchema>;

/**
 * Citation relationship schema.
 */
export const citationSchema = z.object({
  citingUri: z.string(),
  citedUri: z.string(),
  isInfluential: z.boolean().optional(),
  source: z.string(),
  discoveredAt: z.string().datetime().optional(),
});

export type Citation = z.infer<typeof citationSchema>;

/**
 * Enrichment data schema.
 */
export const enrichmentDataSchema = z.object({
  uri: z.string(),
  semanticScholarId: z.string().optional(),
  openAlexId: z.string().optional(),
  citationCount: z.number().int().optional(),
  influentialCitationCount: z.number().int().optional(),
  referencesCount: z.number().int().optional(),
  concepts: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.string(),
        wikidataId: z.string().optional(),
        score: z.number().optional(),
      })
    )
    .optional(),
  topics: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.string(),
        subfield: z.string().optional(),
        field: z.string().optional(),
        domain: z.string().optional(),
        score: z.number().optional(),
      })
    )
    .optional(),
  lastEnrichedAt: z.string().datetime().optional(),
});

export type EnrichmentData = z.infer<typeof enrichmentDataSchema>;

// ============================================================================
// getRecommendations Endpoint
// ============================================================================

/**
 * Parameters for getRecommendations.
 */
export const getRecommendationsParamsSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Maximum number of recommendations'),
  cursor: z.string().optional().describe('Pagination cursor'),
  signals: z
    .array(z.enum(['fields', 'citations', 'collaborators', 'trending']))
    .optional()
    .describe('Signal types to include'),
});

export type GetRecommendationsParams = z.infer<typeof getRecommendationsParamsSchema>;

/**
 * Response for getRecommendations.
 */
export const getRecommendationsResponseSchema = z.object({
  recommendations: z.array(recommendedEprintSchema),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type GetRecommendationsResponse = z.infer<typeof getRecommendationsResponseSchema>;

// ============================================================================
// getSimilar Endpoint
// ============================================================================

/**
 * Parameters for getSimilar.
 */
export const getSimilarParamsSchema = z.object({
  uri: z.string().describe('AT URI of the eprint'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe('Maximum number of similar papers'),
  includeTypes: z
    .array(z.enum(['semantic', 'citation', 'topic', 'author']))
    .optional()
    .describe('Types of relationships to include'),
});

export type GetSimilarParams = z.infer<typeof getSimilarParamsSchema>;

/**
 * Response for getSimilar.
 */
export const getSimilarResponseSchema = z.object({
  eprint: z.object({
    uri: z.string(),
    title: z.string(),
  }),
  related: z.array(relatedEprintSchema),
});

export type GetSimilarResponse = z.infer<typeof getSimilarResponseSchema>;

// ============================================================================
// getCitations Endpoint
// ============================================================================

/**
 * Parameters for getCitations.
 */
export const getCitationsParamsSchema = z.object({
  uri: z.string().describe('AT URI of the eprint'),
  direction: z.enum(['citing', 'cited-by', 'both']).default('both').describe('Citation direction'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum number of citations'),
  cursor: z.string().optional().describe('Pagination cursor'),
  onlyInfluential: z.coerce.boolean().default(false).describe('Only return influential citations'),
});

export type GetCitationsParams = z.infer<typeof getCitationsParamsSchema>;

/**
 * Response for getCitations.
 */
export const getCitationsResponseSchema = z.object({
  eprint: z.object({
    uri: z.string(),
    title: z.string(),
  }),
  counts: z.object({
    citedByCount: z.number().int(),
    referencesCount: z.number().int(),
    influentialCitedByCount: z.number().int(),
  }),
  citations: z.array(citationSchema),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type GetCitationsResponse = z.infer<typeof getCitationsResponseSchema>;

// ============================================================================
// getEnrichment Endpoint
// ============================================================================

/**
 * Parameters for getEnrichment.
 */
export const getEnrichmentParamsSchema = z.object({
  uri: z.string().describe('AT URI of the eprint'),
});

export type GetEnrichmentParams = z.infer<typeof getEnrichmentParamsSchema>;

/**
 * Response for getEnrichment.
 */
export const getEnrichmentResponseSchema = z.object({
  enrichment: enrichmentDataSchema.nullable(),
  available: z.boolean().describe('Whether enrichment data is available'),
});

export type GetEnrichmentResponse = z.infer<typeof getEnrichmentResponseSchema>;

// ============================================================================
// recordInteraction Endpoint (for feedback loop)
// ============================================================================

/**
 * Parameters for recordInteraction.
 */
export const recordInteractionParamsSchema = z.object({
  eprintUri: z.string().describe('AT URI of the eprint'),
  type: z.enum(['view', 'click', 'endorse', 'dismiss', 'claim']).describe('Interaction type'),
  recommendationId: z.string().optional().describe('ID of recommendation that led here'),
});

export type RecordInteractionParams = z.infer<typeof recordInteractionParamsSchema>;

/**
 * Response for recordInteraction.
 */
export const recordInteractionResponseSchema = z.object({
  recorded: z.boolean(),
});

export type RecordInteractionResponse = z.infer<typeof recordInteractionResponseSchema>;
