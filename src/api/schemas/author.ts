/**
 * Author API schemas.
 *
 * @remarks
 * Zod schemas for author-related API requests and responses.
 * Author profiles are resolved from user PDSes via identity resolution.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import { didSchema, paginationQuerySchema } from './common.js';

/**
 * Affiliation schema.
 *
 * @public
 */
export const affiliationSchema = z.object({
  name: z.string().describe('Organization name'),
  rorId: z.string().optional().describe('ROR ID (e.g., https://ror.org/02mhbdp94)'),
});

/**
 * Affiliation type.
 *
 * @public
 */
export type Affiliation = z.infer<typeof affiliationSchema>;

/**
 * Research keyword schema.
 *
 * @public
 */
export const keywordSchema = z.object({
  label: z.string().describe('Keyword label'),
  fastId: z.string().optional().describe('FAST subject heading ID'),
  wikidataId: z.string().optional().describe('Wikidata entity ID (e.g., Q12345)'),
});

/**
 * Research keyword type.
 *
 * @public
 */
export type Keyword = z.infer<typeof keywordSchema>;

/**
 * Author profile schema.
 *
 * @remarks
 * Profile data resolved from the user's PDS via identity resolution.
 * All fields except `did` are optional as they depend on PDS availability.
 *
 * @public
 */
export const authorProfileSchema = z.object({
  /**
   * Author's decentralized identifier.
   */
  did: didSchema,

  /**
   * Author's handle (e.g., "alice.bsky.social").
   */
  handle: z.string().optional().describe('Author handle'),

  /**
   * Display name from profile.
   */
  displayName: z.string().optional().describe('Display name'),

  /**
   * Avatar URL.
   */
  avatar: z.string().url().optional().describe('Avatar URL'),

  /**
   * Profile biography/description.
   */
  bio: z.string().optional().describe('Profile biography'),

  /**
   * Primary institutional affiliation (for display).
   */
  affiliation: z.string().optional().describe('Primary institutional affiliation'),

  /**
   * All institutional affiliations with optional ROR IDs.
   */
  affiliations: z.array(affiliationSchema).optional().describe('All institutional affiliations'),

  /**
   * ORCID identifier.
   */
  orcid: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)
    .optional()
    .describe('ORCID identifier'),

  /**
   * Personal website URL.
   */
  website: z.string().url().optional().describe('Personal website URL'),

  /**
   * PDS endpoint URL where the user's data lives.
   */
  pdsEndpoint: z.string().url().describe('User PDS endpoint'),

  /**
   * Research field IDs from knowledge graph.
   */
  fields: z.array(z.string()).optional().describe('Research field IDs'),

  /**
   * Alternative name forms for paper matching.
   */
  nameVariants: z
    .array(z.string())
    .optional()
    .describe('Alternative name forms (maiden name, transliterations, initials)'),

  /**
   * Past institutional affiliations with optional ROR IDs.
   */
  previousAffiliations: z
    .array(affiliationSchema)
    .optional()
    .describe('Previous institutional affiliations'),

  /**
   * Research topics and keywords with optional authority IDs.
   */
  researchKeywords: z
    .array(keywordSchema)
    .optional()
    .describe('Research keywords for content matching'),

  /**
   * Semantic Scholar author ID.
   */
  semanticScholarId: z.string().optional().describe('Semantic Scholar author ID'),

  /**
   * OpenAlex author ID.
   */
  openAlexId: z.string().optional().describe('OpenAlex author ID'),

  /**
   * Google Scholar profile ID.
   */
  googleScholarId: z.string().optional().describe('Google Scholar profile ID'),

  /**
   * arXiv author identifier.
   */
  arxivAuthorId: z.string().optional().describe('arXiv author ID'),

  /**
   * OpenReview profile ID.
   */
  openReviewId: z.string().optional().describe('OpenReview profile ID'),

  /**
   * DBLP author identifier.
   */
  dblpId: z.string().optional().describe('DBLP author ID'),

  /**
   * Scopus author ID.
   */
  scopusAuthorId: z.string().optional().describe('Scopus author ID'),
});

/**
 * Author profile type.
 *
 * @public
 */
export type AuthorProfile = z.infer<typeof authorProfileSchema>;

/**
 * Author metrics schema.
 *
 * @remarks
 * Aggregated metrics for an author across all their preprints.
 *
 * @public
 */
export const authorMetricsSchema = z.object({
  /**
   * Total number of preprints authored.
   */
  totalPreprints: z.number().int().describe('Total preprints authored'),

  /**
   * Total view count across all preprints.
   */
  totalViews: z.number().int().describe('Total views across all preprints'),

  /**
   * Total download count across all preprints.
   */
  totalDownloads: z.number().int().describe('Total downloads across all preprints'),

  /**
   * Total endorsements received.
   */
  totalEndorsements: z.number().int().describe('Total endorsements received'),

  /**
   * Total reviews written by this author.
   */
  totalReviews: z.number().int().optional().describe('Total reviews written'),

  /**
   * h-index (optional, requires citation data).
   */
  hIndex: z.number().int().optional().describe('h-index if citation data available'),
});

/**
 * Author metrics type.
 *
 * @public
 */
export type AuthorMetrics = z.infer<typeof authorMetricsSchema>;

/**
 * Get author profile query params schema.
 *
 * @public
 */
export const getAuthorProfileParamsSchema = z.object({
  /**
   * Author's DID.
   */
  did: didSchema.describe('Author DID to retrieve profile for'),
});

/**
 * Get author profile params type.
 *
 * @public
 */
export type GetAuthorProfileParams = z.infer<typeof getAuthorProfileParamsSchema>;

/**
 * Author profile response schema.
 *
 * @remarks
 * Returns profile information and aggregated metrics for an author.
 *
 * @public
 */
export const authorProfileResponseSchema = z.object({
  /**
   * Author profile data.
   */
  profile: authorProfileSchema.describe('Author profile information'),

  /**
   * Aggregated author metrics.
   */
  metrics: authorMetricsSchema.describe('Author metrics across all preprints'),
});

/**
 * Author profile response type.
 *
 * @public
 */
export type AuthorProfileResponse = z.infer<typeof authorProfileResponseSchema>;

/**
 * List authors query params schema.
 *
 * @public
 */
export const listAuthorsParamsSchema = paginationQuerySchema.extend({
  /**
   * Filter by affiliation.
   */
  affiliation: z.string().optional().describe('Filter by affiliation'),

  /**
   * Sort order.
   */
  sort: z.enum(['preprints', 'views', 'recent']).default('preprints').describe('Sort order'),
});

/**
 * List authors params type.
 *
 * @public
 */
export type ListAuthorsParams = z.infer<typeof listAuthorsParamsSchema>;

/**
 * Author summary schema (for list views).
 *
 * @public
 */
export const authorSummarySchema = z.object({
  /**
   * Author's DID.
   */
  did: didSchema,

  /**
   * Author's handle.
   */
  handle: z.string().optional().describe('Author handle'),

  /**
   * Display name.
   */
  displayName: z.string().optional().describe('Display name'),

  /**
   * Avatar URL.
   */
  avatar: z.string().url().optional().describe('Avatar URL'),

  /**
   * Preprint count.
   */
  preprintCount: z.number().int().describe('Number of preprints'),

  /**
   * Total views.
   */
  totalViews: z.number().int().describe('Total views'),
});

/**
 * Author summary type.
 *
 * @public
 */
export type AuthorSummary = z.infer<typeof authorSummarySchema>;

/**
 * Authors list response schema.
 *
 * @public
 */
export const authorsListResponseSchema = z.object({
  /**
   * List of author summaries.
   */
  authors: z.array(authorSummarySchema).describe('Author list'),

  /**
   * Pagination cursor.
   */
  cursor: z.string().optional().describe('Cursor for next page'),

  /**
   * Whether more results exist.
   */
  hasMore: z.boolean().describe('Whether more results exist'),

  /**
   * Total count.
   */
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Authors list response type.
 *
 * @public
 */
export type AuthorsListResponse = z.infer<typeof authorsListResponseSchema>;
