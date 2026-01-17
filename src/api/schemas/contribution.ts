/**
 * Contribution type API schemas.
 *
 * @remarks
 * Zod schemas for CRediT-based contribution type API requests
 * and responses, including governance proposals.
 *
 * @packageDocumentation
 * @public
 */

import { z } from './base.js';
import { atUriSchema, didSchema, paginationQuerySchema } from './common.js';

// =============================================================================
// Contribution Type Schemas
// =============================================================================

/**
 * External mapping system schema.
 *
 * @public
 */
export const contributionMappingSystemSchema = z
  .enum(['credit', 'cro', 'scoro', 'pro'])
  .describe('External ontology system');

/**
 * Semantic match type schema.
 *
 * @public
 */
export const semanticMatchTypeSchema = z
  .enum(['exact-match', 'close-match', 'broad-match', 'narrow-match'])
  .describe('Semantic match type');

/**
 * External mapping schema.
 *
 * @public
 */
export const contributionExternalMappingSchema = z.object({
  system: contributionMappingSystemSchema,
  identifier: z.string().describe('Identifier in external system'),
  uri: z.string().url().optional().describe('Full URI in external system'),
  matchType: semanticMatchTypeSchema.optional(),
});

/**
 * External mapping type.
 *
 * @public
 */
export type ContributionExternalMapping = z.infer<typeof contributionExternalMappingSchema>;

/**
 * Contribution type status schema.
 *
 * @public
 */
export const contributionTypeStatusSchema = z
  .enum(['established', 'provisional', 'deprecated'])
  .describe('Contribution type status');

/**
 * Contribution type schema.
 *
 * @public
 */
export const contributionTypeSchema = z.object({
  uri: atUriSchema.describe('AT URI of contribution type record'),
  id: z.string().describe('Type identifier (e.g., "conceptualization")'),
  label: z.string().describe('Human-readable label'),
  description: z.string().describe('Detailed description'),
  externalMappings: z.array(contributionExternalMappingSchema).describe('External ontology links'),
  status: contributionTypeStatusSchema,
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
export type ContributionTypeResponse = z.infer<typeof contributionTypeSchema>;

/**
 * Contribution type summary schema (for lists).
 *
 * @public
 */
export const contributionTypeSummarySchema = z.object({
  uri: atUriSchema,
  id: z.string(),
  label: z.string(),
  description: z.string(),
  status: contributionTypeStatusSchema,
});

/**
 * Contribution type summary type.
 *
 * @public
 */
export type ContributionTypeSummary = z.infer<typeof contributionTypeSummarySchema>;

// =============================================================================
// List Contribution Types
// =============================================================================

/**
 * List contribution types params schema.
 *
 * @public
 */
export const listContributionTypesParamsSchema = paginationQuerySchema.extend({
  status: contributionTypeStatusSchema.optional().describe('Filter by status'),
  search: z.string().max(100).optional().describe('Search in labels and descriptions'),
});

/**
 * List contribution types params type.
 *
 * @public
 */
export type ListContributionTypesParams = z.infer<typeof listContributionTypesParamsSchema>;

/**
 * List contribution types response schema.
 *
 * @public
 */
export const listContributionTypesResponseSchema = z.object({
  types: z.array(contributionTypeSummarySchema),
  total: z.number().int(),
  hasMore: z.boolean(),
  cursor: z.string().optional(),
});

/**
 * List contribution types response type.
 *
 * @public
 */
export type ListContributionTypesResponse = z.infer<typeof listContributionTypesResponseSchema>;

// =============================================================================
// Get Contribution Type
// =============================================================================

/**
 * Get contribution type params schema.
 *
 * @public
 */
export const getContributionTypeParamsSchema = z.object({
  id: z.string().describe('Contribution type identifier'),
});

/**
 * Get contribution type params type.
 *
 * @public
 */
export type GetContributionTypeParams = z.infer<typeof getContributionTypeParamsSchema>;

// =============================================================================
// Contribution Type Proposal Schemas
// =============================================================================

/**
 * Proposal type schema.
 *
 * @public
 */
export const contributionProposalTypeSchema = z
  .enum(['create', 'update', 'deprecate'])
  .describe('Type of proposal');

/**
 * Proposal status schema.
 *
 * @public
 */
export const contributionProposalStatusSchema = z
  .enum(['pending', 'approved', 'rejected', 'expired'])
  .describe('Proposal status');

/**
 * Vote tally schema.
 *
 * @public
 */
export const proposalVoteTallySchema = z.object({
  approve: z.number().int().describe('Approval votes'),
  reject: z.number().int().describe('Rejection votes'),
  total: z.number().int().describe('Total votes'),
  expertVotes: z.number().int().describe('Expert votes'),
  quorumMet: z.boolean().describe('Whether quorum reached'),
  thresholdsMet: z.boolean().describe('Whether approval thresholds met'),
});

/**
 * Vote tally type.
 *
 * @public
 */
export type ProposalVoteTally = z.infer<typeof proposalVoteTallySchema>;

/**
 * Contribution type proposal schema.
 *
 * @public
 */
export const contributionTypeProposalSchema = z.object({
  uri: atUriSchema.describe('Proposal AT URI'),
  proposer: didSchema.describe('Proposer DID'),
  proposalType: contributionProposalTypeSchema,
  typeId: z.string().optional().describe('Existing type ID (for update/deprecate)'),
  proposedId: z.string().describe('Proposed type identifier'),
  proposedLabel: z.string().describe('Proposed label'),
  proposedDescription: z.string().optional().describe('Proposed description'),
  externalMappings: z.array(contributionExternalMappingSchema).optional(),
  rationale: z.string().describe('Justification for proposal'),
  supersedes: atUriSchema.optional().describe('Type being deprecated'),
  status: contributionProposalStatusSchema,
  voteTally: proposalVoteTallySchema.optional(),
  createdAt: z.string().datetime(),
  votingDeadline: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  resultUri: atUriSchema.optional().describe('Resulting type URI if approved'),
});

/**
 * Contribution type proposal type.
 *
 * @public
 */
export type ContributionTypeProposalResponse = z.infer<typeof contributionTypeProposalSchema>;

/**
 * Proposal summary schema (for lists).
 *
 * @public
 */
export const contributionProposalSummarySchema = z.object({
  uri: atUriSchema,
  proposer: didSchema,
  proposalType: contributionProposalTypeSchema,
  proposedId: z.string(),
  proposedLabel: z.string(),
  status: contributionProposalStatusSchema,
  voteTally: proposalVoteTallySchema.optional(),
  createdAt: z.string().datetime(),
  votingDeadline: z.string().datetime().optional(),
});

/**
 * Proposal summary type.
 *
 * @public
 */
export type ContributionProposalSummary = z.infer<typeof contributionProposalSummarySchema>;

// =============================================================================
// List Proposals
// =============================================================================

/**
 * List proposals params schema.
 *
 * @public
 */
export const listContributionProposalsParamsSchema = paginationQuerySchema.extend({
  status: contributionProposalStatusSchema.optional().describe('Filter by status'),
  proposer: didSchema.optional().describe('Filter by proposer'),
  proposalType: contributionProposalTypeSchema.optional().describe('Filter by proposal type'),
});

/**
 * List proposals params type.
 *
 * @public
 */
export type ListContributionProposalsParams = z.infer<typeof listContributionProposalsParamsSchema>;

/**
 * List proposals response schema.
 *
 * @public
 */
export const listContributionProposalsResponseSchema = z.object({
  proposals: z.array(contributionProposalSummarySchema),
  total: z.number().int(),
  hasMore: z.boolean(),
  cursor: z.string().optional(),
});

/**
 * List proposals response type.
 *
 * @public
 */
export type ListContributionProposalsResponse = z.infer<
  typeof listContributionProposalsResponseSchema
>;

// =============================================================================
// Get Proposal
// =============================================================================

/**
 * Get proposal params schema.
 *
 * @public
 */
export const getContributionProposalParamsSchema = z.object({
  uri: atUriSchema.describe('Proposal AT URI'),
});

/**
 * Get proposal params type.
 *
 * @public
 */
export type GetContributionProposalParams = z.infer<typeof getContributionProposalParamsSchema>;

// =============================================================================
// Search Types
// =============================================================================

/**
 * Search contribution types params schema.
 *
 * @public
 */
export const searchContributionTypesParamsSchema = z.object({
  q: z.string().min(1).max(100).describe('Search query'),
  limit: z.coerce.number().int().min(1).max(50).default(10).describe('Maximum results'),
});

/**
 * Search contribution types params type.
 *
 * @public
 */
export type SearchContributionTypesParams = z.infer<typeof searchContributionTypesParamsSchema>;

/**
 * Search contribution types response schema.
 *
 * @public
 */
export const searchContributionTypesResponseSchema = z.object({
  types: z.array(contributionTypeSummarySchema),
  total: z.number().int(),
});

/**
 * Search contribution types response type.
 *
 * @public
 */
export type SearchContributionTypesResponse = z.infer<typeof searchContributionTypesResponseSchema>;
