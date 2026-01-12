/**
 * Endorsement API schemas.
 *
 * @remarks
 * Zod schemas for endorsement-related API requests and responses.
 * Endorsements are formal signals of support categorized by contribution type.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import { atUriSchema, didSchema, authorRefSchema, paginationQuerySchema } from './common.js';

/**
 * Contribution type schema.
 *
 * @remarks
 * 15 fine-grained categories derived from CRediT taxonomy:
 * - Core research: methodological, analytical, theoretical, empirical, conceptual
 * - Technical: technical, data
 * - Validation: replication, reproducibility
 * - Synthesis: synthesis, interdisciplinary
 * - Communication: pedagogical, visualization
 * - Impact: societal-impact, clinical
 *
 * @public
 */
export const contributionTypeSchema = z.enum([
  'methodological',
  'analytical',
  'theoretical',
  'empirical',
  'conceptual',
  'technical',
  'data',
  'replication',
  'reproducibility',
  'synthesis',
  'interdisciplinary',
  'pedagogical',
  'visualization',
  'societal-impact',
  'clinical',
]);

/**
 * Contribution type.
 *
 * @public
 */
export type ContributionType = z.infer<typeof contributionTypeSchema>;

/**
 * Endorsement schema.
 *
 * @public
 */
export const endorsementSchema = z.object({
  uri: atUriSchema.describe('Endorsement AT-URI'),
  eprintUri: atUriSchema.describe('Endorsed eprint AT-URI'),
  endorser: authorRefSchema.describe('Endorser'),
  contributions: z.array(contributionTypeSchema).min(1).describe('Contribution types'),
  comment: z.string().max(1000).optional().describe('Optional comment'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
});

/**
 * Endorsement type.
 *
 * @public
 */
export type Endorsement = z.infer<typeof endorsementSchema>;

/**
 * Endorsement summary schema.
 *
 * @public
 */
export const endorsementSummarySchema = z.object({
  total: z.number().int().describe('Total endorsement count'),
  endorserCount: z.number().int().describe('Unique endorser count'),
  byType: z.record(z.string(), z.number().int()).describe('Count by contribution type'),
});

/**
 * Endorsement summary type.
 *
 * @public
 */
export type EndorsementSummary = z.infer<typeof endorsementSummarySchema>;

/**
 * List endorsements for eprint params schema.
 *
 * @public
 */
export const listEndorsementsForEprintParamsSchema = paginationQuerySchema.extend({
  eprintUri: atUriSchema.describe('Eprint AT-URI'),
  contributionType: contributionTypeSchema.optional().describe('Filter by contribution type'),
});

/**
 * List endorsements for eprint params type.
 *
 * @public
 */
export type ListEndorsementsForEprintParams = z.infer<
  typeof listEndorsementsForEprintParamsSchema
>;

/**
 * Get endorsement summary params schema.
 *
 * @public
 */
export const getEndorsementSummaryParamsSchema = z.object({
  eprintUri: atUriSchema.describe('Eprint AT-URI'),
});

/**
 * Get endorsement summary params type.
 *
 * @public
 */
export type GetEndorsementSummaryParams = z.infer<typeof getEndorsementSummaryParamsSchema>;

/**
 * Get user endorsement params schema.
 *
 * @public
 */
export const getUserEndorsementParamsSchema = z.object({
  eprintUri: atUriSchema.describe('Eprint AT-URI'),
  userDid: didSchema.describe('User DID'),
});

/**
 * Get user endorsement params type.
 *
 * @public
 */
export type GetUserEndorsementParams = z.infer<typeof getUserEndorsementParamsSchema>;

/**
 * Create endorsement input schema.
 *
 * @public
 */
export const createEndorsementInputSchema = z.object({
  eprintUri: atUriSchema.describe('Eprint AT-URI'),
  contributions: z.array(contributionTypeSchema).min(1).describe('Contribution types'),
  comment: z.string().max(1000).optional().describe('Optional comment'),
});

/**
 * Create endorsement input type.
 *
 * @public
 */
export type CreateEndorsementInput = z.infer<typeof createEndorsementInputSchema>;

/**
 * Update endorsement input schema.
 *
 * @public
 */
export const updateEndorsementInputSchema = z.object({
  uri: atUriSchema.describe('Endorsement AT-URI'),
  contributions: z.array(contributionTypeSchema).min(1).describe('Updated contribution types'),
  comment: z.string().max(1000).optional().describe('Updated comment'),
});

/**
 * Update endorsement input type.
 *
 * @public
 */
export type UpdateEndorsementInput = z.infer<typeof updateEndorsementInputSchema>;

/**
 * Delete endorsement input schema.
 *
 * @public
 */
export const deleteEndorsementInputSchema = z.object({
  uri: atUriSchema.describe('Endorsement AT-URI to delete'),
});

/**
 * Delete endorsement input type.
 *
 * @public
 */
export type DeleteEndorsementInput = z.infer<typeof deleteEndorsementInputSchema>;

/**
 * Endorsements response schema.
 *
 * @public
 */
export const endorsementsResponseSchema = z.object({
  endorsements: z.array(endorsementSchema).describe('List of endorsements'),
  summary: endorsementSummarySchema.optional().describe('Aggregated summary'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Endorsements response type.
 *
 * @public
 */
export type EndorsementsResponse = z.infer<typeof endorsementsResponseSchema>;
