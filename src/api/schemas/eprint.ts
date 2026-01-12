/**
 * Eprint API schemas.
 *
 * @remarks
 * Zod schemas for eprint-related API requests and responses.
 * All eprint responses include pdsUrl for ATProto compliance.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import {
  atUriSchema,
  didSchema,
  cidSchema,
  paginationQuerySchema,
  searchQuerySchema,
} from './common.js';

/**
 * PDS source information schema.
 *
 * @remarks
 * Provides transparency about where data originates.
 * Enables verification and credible exit.
 *
 * @public
 */
export const eprintSourceInfoSchema = z.object({
  pdsEndpoint: z.string().url().describe('User PDS endpoint'),
  recordUrl: z.string().url().describe('Direct URL to fetch authoritative record'),
  blobUrl: z.string().url().optional().describe('Direct URL to fetch PDF blob from PDS'),
  lastVerifiedAt: z.string().datetime().optional().describe('Last time Chive verified with PDS'),
  stale: z.boolean().describe('True if not verified in > 7 days'),
});

/**
 * PDS source information type.
 *
 * @public
 */
export type EprintSourceInfo = z.infer<typeof eprintSourceInfoSchema>;

/**
 * Blob reference schema.
 *
 * @public
 */
export const blobRefSchema = z.object({
  $type: z.literal('blob'),
  ref: cidSchema.describe('CID of blob'),
  mimeType: z.string().describe('MIME type'),
  size: z.number().int().describe('Size in bytes'),
});

/**
 * Supplementary category values.
 */
const supplementaryCategorySchema = z.enum([
  'appendix',
  'figure',
  'table',
  'dataset',
  'code',
  'notebook',
  'video',
  'audio',
  'presentation',
  'protocol',
  'questionnaire',
  'other',
]);

/**
 * Supplementary material item schema.
 *
 * @public
 */
export const supplementaryMaterialSchema = z.object({
  blob: blobRefSchema.describe('Blob reference'),
  label: z.string().describe('Display label'),
  description: z.string().optional().describe('Material description'),
  category: supplementaryCategorySchema.describe('Material category'),
  detectedFormat: z.string().optional().describe('Auto-detected format'),
  order: z.number().int().describe('Display order'),
});

/**
 * Supplementary material type.
 *
 * @public
 */
export type SupplementaryMaterialResponse = z.infer<typeof supplementaryMaterialSchema>;

/**
 * Eprint metrics schema.
 *
 * @public
 */
export const eprintMetricsSchema = z.object({
  views: z.number().int().describe('Total view count'),
  downloads: z.number().int().describe('Total download count'),
  endorsements: z.number().int().optional().describe('Endorsement count'),
});

/**
 * Field reference schema.
 *
 * @public
 */
export const fieldRefSchema = z.object({
  id: z.string().optional().describe('Field ID'),
  uri: z.string().describe('Field URI'),
  name: z.string().describe('Field name'),
  parentUri: z.string().optional().describe('Parent field URI'),
});

/**
 * Author affiliation schema for responses.
 *
 * @public
 */
export const authorAffiliationRefSchema = z.object({
  name: z.string().describe('Organization name'),
  rorId: z.string().optional().describe('ROR ID'),
  department: z.string().optional().describe('Department or division'),
});

/**
 * Author affiliation ref type.
 *
 * @public
 */
export type AuthorAffiliationRef = z.infer<typeof authorAffiliationRefSchema>;

/**
 * Contribution degree schema.
 *
 * @remarks
 * Following CRediT taxonomy conventions for degree modifiers.
 *
 * @public
 */
export const contributionDegreeSchema = z.enum(['lead', 'equal', 'supporting']);

/**
 * Contribution degree type.
 *
 * @public
 */
export type ContributionDegree = z.infer<typeof contributionDegreeSchema>;

/**
 * Author contribution schema for responses.
 *
 * @public
 */
export const authorContributionRefSchema = z.object({
  typeUri: atUriSchema.describe('AT-URI to contribution type'),
  typeId: z.string().optional().describe('Contribution type ID'),
  typeLabel: z.string().optional().describe('Human-readable label'),
  degree: contributionDegreeSchema.describe('Contribution degree'),
});

/**
 * Author contribution ref type.
 *
 * @public
 */
export type AuthorContributionRef = z.infer<typeof authorContributionRefSchema>;

/**
 * Full author reference schema for responses.
 *
 * @remarks
 * Includes all author metadata for display purposes.
 *
 * @public
 */
export const eprintAuthorRefSchema = z.object({
  did: didSchema.optional().describe('Author DID if they have an ATProto account'),
  name: z.string().describe('Author display name'),
  orcid: z.string().optional().describe('ORCID identifier'),
  email: z.string().email().optional().describe('Contact email'),
  order: z.number().int().describe('Position in author list (1-indexed)'),
  affiliations: z.array(authorAffiliationRefSchema).describe('Author affiliations'),
  contributions: z.array(authorContributionRefSchema).describe('CRediT-based contributions'),
  isCorrespondingAuthor: z.boolean().describe('Whether this is a corresponding author'),
  isHighlighted: z.boolean().describe('Whether author is highlighted (co-first, co-last)'),
  // Enriched data from profile (if DID exists)
  handle: z.string().optional().describe('Author handle if available'),
  avatarUrl: z.string().url().optional().describe('Avatar URL if available'),
});

/**
 * Eprint author ref type.
 *
 * @public
 */
export type EprintAuthorRef = z.infer<typeof eprintAuthorRefSchema>;

/**
 * Eprint summary schema (for list views).
 *
 * @public
 */
export const eprintSummarySchema = z.object({
  uri: atUriSchema,
  cid: cidSchema,
  title: z.string().describe('Eprint title'),
  abstract: z.string().max(500).describe('Truncated abstract'),
  authors: z.array(eprintAuthorRefSchema).describe('All authors with contributions'),
  submittedBy: didSchema.describe('DID of human user who submitted'),
  paperDid: didSchema.optional().describe('Paper DID if paper has its own PDS'),
  fields: z.array(fieldRefSchema).optional().describe('Subject fields'),
  license: z.string().describe('License identifier'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  indexedAt: z.string().datetime().describe('Index timestamp'),
  // ATProto compliance: source information for verification and credible exit
  source: eprintSourceInfoSchema.describe('PDS source information'),
  metrics: eprintMetricsSchema.optional().describe('Engagement metrics'),
});

/**
 * Eprint summary type.
 *
 * @public
 */
export type EprintSummary = z.infer<typeof eprintSummarySchema>;

/**
 * Full eprint response schema.
 *
 * @remarks
 * Complete eprint data including version history and full metadata.
 * Always includes pdsUrl for ATProto compliance.
 *
 * @public
 */
export const eprintResponseSchema = z.object({
  uri: atUriSchema,
  cid: cidSchema,
  title: z.string().describe('Eprint title'),
  abstract: z.string().describe('Full abstract'),
  authors: z.array(eprintAuthorRefSchema).describe('All authors with contributions'),
  submittedBy: didSchema.describe('DID of human user who submitted'),
  paperDid: didSchema.optional().describe('Paper DID if paper has its own PDS'),
  document: blobRefSchema.describe('Document blob reference'),
  documentFormat: z.string().optional().describe('Document format (pdf, docx, etc.)'),
  supplementary: z
    .array(supplementaryMaterialSchema)
    .optional()
    .describe('Supplementary materials'),
  fields: z.array(fieldRefSchema).optional().describe('Subject fields'),
  keywords: z.array(z.string()).optional().describe('Keywords'),
  license: z.string().describe('License identifier'),
  doi: z.string().optional().describe('DOI if assigned'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
  indexedAt: z.string().datetime().describe('Index timestamp'),

  // ATProto compliance: source information for verification and credible exit
  source: eprintSourceInfoSchema.describe('PDS source information'),

  // Enriched data
  metrics: eprintMetricsSchema.optional().describe('Engagement metrics'),
  versions: z
    .array(
      z.object({
        version: z.number().int(),
        cid: cidSchema,
        createdAt: z.string().datetime(),
        changelog: z.string().optional(),
      })
    )
    .optional()
    .describe('Version history'),
});

/**
 * Full eprint response type.
 *
 * @public
 */
export type EprintResponse = z.infer<typeof eprintResponseSchema>;

/**
 * Get eprint submission query params schema.
 *
 * @public
 */
export const getSubmissionParamsSchema = z.object({
  uri: atUriSchema.describe('Eprint AT URI'),
});

/**
 * Get eprint submission params type.
 *
 * @public
 */
export type GetSubmissionParams = z.infer<typeof getSubmissionParamsSchema>;

/**
 * List eprints by author query params schema.
 *
 * @public
 */
export const listByAuthorParamsSchema = paginationQuerySchema.extend({
  did: didSchema.describe('Author DID'),
  sort: z.enum(['date', 'views']).default('date').describe('Sort order'),
});

/**
 * List by author params type.
 *
 * @public
 */
export type ListByAuthorParams = z.infer<typeof listByAuthorParamsSchema>;

/**
 * Search eprints query params schema.
 *
 * @public
 */
export const searchEprintsParamsSchema = searchQuerySchema.extend({
  field: z.string().optional().describe('Filter by field URI'),
  author: didSchema.optional().describe('Filter by author DID'),
  license: z.string().optional().describe('Filter by license'),
  dateFrom: z.string().datetime().optional().describe('Filter by date range start'),
  dateTo: z.string().datetime().optional().describe('Filter by date range end'),
});

/**
 * Search eprints params type.
 *
 * @public
 */
export type SearchEprintsParams = z.infer<typeof searchEprintsParamsSchema>;

/**
 * Eprint list response schema.
 *
 * @public
 */
export const eprintListResponseSchema = z.object({
  eprints: z.array(eprintSummarySchema).describe('Eprint list'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Eprint list response type.
 *
 * @public
 */
export type EprintListResponse = z.infer<typeof eprintListResponseSchema>;

/**
 * Search results response schema.
 *
 * @public
 */
export const searchResultsResponseSchema = z.object({
  hits: z
    .array(
      eprintSummarySchema.extend({
        score: z.number().optional().describe('Relevance score'),
        highlights: z
          .record(z.string(), z.array(z.string()))
          .optional()
          .describe('Search highlights'),
      })
    )
    .describe('Search results'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().describe('Total matching results'),
  facets: z
    .record(
      z.string(),
      z.array(
        z.object({
          value: z.string(),
          count: z.number().int(),
        })
      )
    )
    .optional()
    .describe('Facet counts'),
  impressionId: z
    .string()
    .uuid()
    .optional()
    .describe('Impression ID for click tracking (LTR training data)'),
});

/**
 * Search results response type.
 *
 * @public
 */
export type SearchResultsResponse = z.infer<typeof searchResultsResponseSchema>;

/**
 * Author affiliation schema for eprint submission.
 *
 * @public
 */
export const eprintAuthorAffiliationSchema = z.object({
  name: z.string().min(1).max(300).describe('Organization name'),
  rorId: z.string().max(100).optional().describe('ROR ID (e.g., https://ror.org/02mhbdp94)'),
  department: z.string().max(200).optional().describe('Department or division'),
});

/**
 * Author affiliation type.
 *
 * @public
 */
export type EprintAuthorAffiliation = z.infer<typeof eprintAuthorAffiliationSchema>;

/**
 * Author contribution schema for eprint submission.
 *
 * @public
 */
export const eprintAuthorContributionSchema = z.object({
  typeUri: atUriSchema.describe('AT-URI to contribution type from knowledge graph'),
  typeId: z.string().max(50).optional().describe('Contribution type ID (e.g., conceptualization)'),
  typeLabel: z.string().max(100).optional().describe('Human-readable label'),
  degree: contributionDegreeSchema.default('equal').describe('Contribution degree modifier'),
});

/**
 * Author contribution type.
 *
 * @public
 */
export type EprintAuthorContribution = z.infer<typeof eprintAuthorContributionSchema>;

/**
 * Full author input schema for eprint submission.
 *
 * @remarks
 * Supports both ATProto users (with DID) and external collaborators (without DID).
 *
 * @public
 */
export const eprintAuthorInputSchema = z.object({
  did: didSchema.optional().describe('Author DID if they have an ATProto account'),
  name: z.string().min(1).max(200).describe('Author display name'),
  orcid: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)
    .optional()
    .describe('ORCID identifier'),
  email: z.string().email().max(254).optional().describe('Contact email (for external authors)'),
  order: z.number().int().min(1).describe('Position in author list (1-indexed)'),
  affiliations: z
    .array(eprintAuthorAffiliationSchema)
    .max(10)
    .default([])
    .describe('Author affiliations'),
  contributions: z
    .array(eprintAuthorContributionSchema)
    .max(14)
    .default([])
    .describe('CRediT-based contributions'),
  isCorrespondingAuthor: z
    .boolean()
    .default(false)
    .describe('Whether this is a corresponding author'),
  isHighlighted: z
    .boolean()
    .default(false)
    .describe('Whether author is highlighted (co-first, co-last)'),
});

/**
 * Author input type.
 *
 * @public
 */
export type EprintAuthorInput = z.infer<typeof eprintAuthorInputSchema>;

/**
 * Facet dimension enum.
 *
 * @public
 */
export const facetDimensionSchema = z.enum([
  'personality',
  'matter',
  'energy',
  'space',
  'time',
  'form',
  'topical',
]);

/**
 * Facet input schema for eprint classification.
 *
 * @public
 */
export const eprintFacetInputSchema = z.object({
  dimension: facetDimensionSchema.describe('PMEST/FAST facet dimension'),
  value: z.string().min(1).max(200).describe('Facet value'),
});

/**
 * Facet input type.
 *
 * @public
 */
export type EprintFacetInput = z.infer<typeof eprintFacetInputSchema>;

/**
 * Create eprint submission input schema.
 *
 * @remarks
 * Input for creating a new eprint submission. The document must be uploaded
 * to the user's PDS first, and the BlobRef provided here references that blob.
 *
 * @public
 */
export const createSubmissionInputSchema = z.object({
  title: z.string().min(1).max(500).describe('Eprint title'),
  abstract: z.string().min(1).max(10000).describe('Abstract/summary'),
  authors: z
    .array(eprintAuthorInputSchema)
    .min(1)
    .max(100)
    .describe('Author list with contributions and affiliations'),
  paperDid: didSchema
    .optional()
    .describe('Paper DID if paper has its own PDS (submittedBy set server-side from auth)'),
  document: blobRefSchema.describe('BlobRef to uploaded PDF in user/paper PDS'),
  fieldNodes: z.array(atUriSchema).optional().describe('Field node URIs for categorization'),
  keywords: z
    .array(z.string().min(1).max(100))
    .max(20)
    .optional()
    .describe('Keywords for discovery'),
  facets: z.array(eprintFacetInputSchema).optional().describe('Faceted classification'),
  license: z.string().max(50).optional().describe('License identifier (e.g., CC-BY-4.0)'),
  doi: z.string().max(100).optional().describe('External DOI if already assigned'),
});

/**
 * Create submission input type.
 *
 * @public
 */
export type CreateSubmissionInput = z.infer<typeof createSubmissionInputSchema>;

/**
 * Create submission response schema.
 *
 * @public
 */
export const createSubmissionResponseSchema = z.object({
  uri: atUriSchema.describe('AT URI of created eprint record'),
  cid: cidSchema.describe('CID of created record'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

/**
 * Create submission response type.
 *
 * @public
 */
export type CreateSubmissionResponse = z.infer<typeof createSubmissionResponseSchema>;

// =============================================================================
// Contribution Type Schemas (Governance)
// =============================================================================

/**
 * Semantic match type for external mappings.
 *
 * @public
 */
export const semanticMatchTypeSchema = z.enum([
  'exact-match',
  'close-match',
  'broad-match',
  'narrow-match',
]);

/**
 * Semantic match type.
 *
 * @public
 */
export type SemanticMatchType = z.infer<typeof semanticMatchTypeSchema>;

/**
 * External system identifier for contribution type mappings.
 *
 * @public
 */
export const contributionMappingSystemSchema = z.enum(['credit', 'cro', 'scoro', 'pro']);

/**
 * Contribution mapping system type.
 *
 * @public
 */
export type ContributionMappingSystem = z.infer<typeof contributionMappingSystemSchema>;

/**
 * External mapping to ontology or standard.
 *
 * @public
 */
export const contributionTypeExternalMappingSchema = z.object({
  system: contributionMappingSystemSchema.describe('External system identifier'),
  identifier: z.string().describe('Identifier in the external system'),
  uri: z.string().url().optional().describe('Full URI in the external system'),
  matchType: semanticMatchTypeSchema.optional().describe('Type of semantic match'),
});

/**
 * Contribution type external mapping type.
 *
 * @public
 */
export type ContributionTypeExternalMapping = z.infer<typeof contributionTypeExternalMappingSchema>;

/**
 * Authority record status.
 *
 * @public
 */
export const contributionTypeStatusSchema = z.enum(['established', 'provisional', 'deprecated']);

/**
 * Contribution type status type.
 *
 * @public
 */
export type ContributionTypeStatus = z.infer<typeof contributionTypeStatusSchema>;

/**
 * Contribution type authority record schema.
 *
 * @remarks
 * Response schema for contribution types stored in Governance PDS.
 *
 * @public
 */
export const contributionTypeSchema = z.object({
  uri: atUriSchema.describe('AT URI of the contribution type record'),
  id: z.string().describe('Contribution type identifier'),
  label: z.string().describe('Human-readable label'),
  description: z.string().describe('Detailed description'),
  externalMappings: z
    .array(contributionTypeExternalMappingSchema)
    .describe('Links to external ontologies'),
  status: contributionTypeStatusSchema.describe('Authority record status'),
  proposalUri: atUriSchema.optional().describe('Proposal that created this type'),
  deprecatedBy: atUriSchema.optional().describe('Type that supersedes this one'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
});

/**
 * Contribution type type.
 *
 * @public
 */
export type ContributionType = z.infer<typeof contributionTypeSchema>;

/**
 * Contribution type list response schema.
 *
 * @public
 */
export const contributionTypeListResponseSchema = z.object({
  types: z.array(contributionTypeSchema).describe('Contribution types'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
});

/**
 * Contribution type list response type.
 *
 * @public
 */
export type ContributionTypeListResponse = z.infer<typeof contributionTypeListResponseSchema>;

/**
 * Proposal type for contribution type changes.
 *
 * @public
 */
export const contributionTypeProposalTypeSchema = z.enum(['create', 'update', 'deprecate']);

/**
 * Contribution type proposal type.
 *
 * @public
 */
export type ContributionTypeProposalType = z.infer<typeof contributionTypeProposalTypeSchema>;

/**
 * Vote tally schema.
 *
 * @public
 */
export const proposalVoteTallySchema = z.object({
  approve: z.number().int().describe('Number of approve votes'),
  reject: z.number().int().describe('Number of reject votes'),
  total: z.number().int().describe('Total number of votes'),
  expertVotes: z.number().int().describe('Number of expert votes'),
  quorumMet: z.boolean().describe('Whether quorum has been met'),
  thresholdsMet: z.boolean().describe('Whether all thresholds have been met'),
});

/**
 * Proposal vote tally type.
 *
 * @public
 */
export type ProposalVoteTally = z.infer<typeof proposalVoteTallySchema>;

/**
 * Proposal status.
 *
 * @public
 */
export const contributionTypeProposalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'expired',
]);

/**
 * Contribution type proposal status type.
 *
 * @public
 */
export type ContributionTypeProposalStatus = z.infer<typeof contributionTypeProposalStatusSchema>;

/**
 * Contribution type proposal response schema.
 *
 * @public
 */
export const contributionTypeProposalSchema = z.object({
  uri: atUriSchema.describe('AT URI of the proposal record'),
  proposer: didSchema.describe('DID of the proposer'),
  proposalType: contributionTypeProposalTypeSchema.describe('Type of proposal'),
  typeId: z.string().optional().describe('Existing type ID (for updates/deprecations)'),
  proposedId: z.string().describe('Proposed type identifier'),
  proposedLabel: z.string().describe('Human-readable label'),
  proposedDescription: z.string().optional().describe('Detailed description'),
  externalMappings: z
    .array(contributionTypeExternalMappingSchema)
    .describe('Links to external ontologies'),
  rationale: z.string().describe('Justification for proposal'),
  supersedes: atUriSchema.optional().describe('Type to be deprecated'),
  status: contributionTypeProposalStatusSchema.describe('Current proposal status'),
  voteTally: proposalVoteTallySchema.optional().describe('Current vote tally'),
  createdAt: z.string().datetime().describe('Proposal creation timestamp'),
  votingDeadline: z.string().datetime().optional().describe('Voting deadline'),
});

/**
 * Contribution type proposal type.
 *
 * @public
 */
export type ContributionTypeProposal = z.infer<typeof contributionTypeProposalSchema>;

/**
 * Contribution type proposal list response schema.
 *
 * @public
 */
export const contributionTypeProposalListResponseSchema = z.object({
  proposals: z.array(contributionTypeProposalSchema).describe('Proposals'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Contribution type proposal list response type.
 *
 * @public
 */
export type ContributionTypeProposalListResponse = z.infer<
  typeof contributionTypeProposalListResponseSchema
>;

/**
 * Create contribution type proposal input schema.
 *
 * @public
 */
export const createContributionTypeProposalInputSchema = z.object({
  proposalType: contributionTypeProposalTypeSchema.describe('Type of proposal'),
  typeId: z.string().max(50).optional().describe('Existing type ID (for updates/deprecations)'),
  proposedId: z.string().min(1).max(50).describe('Proposed type identifier'),
  proposedLabel: z.string().min(1).max(100).describe('Human-readable label'),
  proposedDescription: z.string().max(1000).optional().describe('Detailed description'),
  externalMappings: z
    .array(
      z.object({
        system: contributionMappingSystemSchema,
        identifier: z.string().min(1).max(100),
        uri: z.string().url().optional(),
      })
    )
    .max(10)
    .default([])
    .describe('Links to external ontologies'),
  rationale: z.string().min(1).max(2000).describe('Justification for proposal'),
  supersedes: atUriSchema.optional().describe('Type to be deprecated'),
});

/**
 * Create contribution type proposal input type.
 *
 * @public
 */
export type CreateContributionTypeProposalInput = z.infer<
  typeof createContributionTypeProposalInputSchema
>;
