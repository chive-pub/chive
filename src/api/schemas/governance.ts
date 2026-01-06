/**
 * Governance API schemas.
 *
 * @remarks
 * Zod schemas for governance-related API requests and responses.
 * Governance uses Wikipedia-style weighted voting for knowledge graph changes.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import { paginationQuerySchema } from './common.js';

// =============================================================================
// ENUMS
// =============================================================================

export const voterRoleSchema = z.enum([
  'community-member',
  'reviewer',
  'domain-expert',
  'administrator',
]);

export const proposalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);

export const proposalTypeSchema = z.enum(['create', 'update', 'merge', 'delete']);

export const voteValueSchema = z.enum(['approve', 'reject', 'abstain', 'request-changes']);

export type VoterRole = z.infer<typeof voterRoleSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;
export type ProposalType = z.infer<typeof proposalTypeSchema>;
export type VoteValue = z.infer<typeof voteValueSchema>;

// =============================================================================
// PROPOSAL SCHEMAS
// =============================================================================

export const proposalChangesSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
  fieldType: z.enum(['field', 'root', 'subfield', 'topic']).optional(),
  parentId: z.string().optional(),
  mergeTargetId: z.string().optional(),
  wikidataId: z.string().optional(),
});

export type ProposalChanges = z.infer<typeof proposalChangesSchema>;

export const consensusProgressSchema = z.object({
  approvalPercentage: z.number(),
  threshold: z.number(),
  voterCount: z.number(),
  minimumVotes: z.number(),
  consensusReached: z.boolean(),
  recommendedStatus: z.enum(['approved', 'rejected', 'pending']),
});

export type ConsensusProgress = z.infer<typeof consensusProgressSchema>;

export const proposalSchema = z.object({
  id: z.string(),
  uri: z.string(),
  fieldId: z.string().optional(),
  label: z.string().optional(),
  type: proposalTypeSchema,
  changes: proposalChangesSchema,
  rationale: z.string(),
  status: proposalStatusSchema,
  proposedBy: z.string(),
  proposerName: z.string().optional(),
  votes: z.object({
    approve: z.number(),
    reject: z.number(),
    abstain: z.number(),
  }),
  consensus: consensusProgressSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type Proposal = z.infer<typeof proposalSchema>;

// =============================================================================
// VOTE SCHEMAS
// =============================================================================

export const voteSchema = z.object({
  id: z.string(),
  uri: z.string(),
  proposalUri: z.string(),
  voterDid: z.string(),
  voterName: z.string().optional(),
  voterRole: voterRoleSchema,
  vote: voteValueSchema,
  weight: z.number(),
  rationale: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type Vote = z.infer<typeof voteSchema>;

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

export const listProposalsParamsSchema = paginationQuerySchema.extend({
  status: proposalStatusSchema.optional(),
  type: proposalTypeSchema.optional(),
  fieldId: z.string().optional(),
  proposedBy: z.string().optional(),
});

export type ListProposalsParams = z.infer<typeof listProposalsParamsSchema>;

export const getProposalParamsSchema = z.object({
  proposalId: z.string(),
});

export type GetProposalParams = z.infer<typeof getProposalParamsSchema>;

export const listVotesParamsSchema = paginationQuerySchema.extend({
  proposalId: z.string(),
});

export type ListVotesParams = z.infer<typeof listVotesParamsSchema>;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

export const proposalsResponseSchema = z.object({
  proposals: z.array(proposalSchema),
  cursor: z.string().optional(),
  total: z.number(),
});

export type ProposalsResponse = z.infer<typeof proposalsResponseSchema>;

export const votesResponseSchema = z.object({
  votes: z.array(voteSchema),
  cursor: z.string().optional(),
  total: z.number(),
});

export type VotesResponse = z.infer<typeof votesResponseSchema>;

// =============================================================================
// INPUT SCHEMAS FOR MUTATIONS
// =============================================================================

export const createProposalInputSchema = z.object({
  type: proposalTypeSchema,
  fieldId: z.string().optional().describe('Existing field ID (for update, merge, delete)'),
  changes: proposalChangesSchema,
  rationale: z.string().min(10).max(5000).describe('Rationale for the proposal'),
});

export type CreateProposalInput = z.infer<typeof createProposalInputSchema>;

export const createVoteInputSchema = z.object({
  proposalId: z.string().describe('Proposal ID to vote on'),
  vote: voteValueSchema,
  rationale: z.string().max(2000).optional().describe('Optional rationale for vote'),
});

export type CreateVoteInput = z.infer<typeof createVoteInputSchema>;

export const getUserVoteParamsSchema = z.object({
  proposalId: z.string().describe('Proposal ID'),
  userDid: z.string().describe('User DID'),
});

export type GetUserVoteParams = z.infer<typeof getUserVoteParamsSchema>;

export const getPendingCountParamsSchema = z.object({}).optional();

export type GetPendingCountParams = z.infer<typeof getPendingCountParamsSchema>;

export const pendingCountResponseSchema = z.object({
  count: z.number().int().describe('Number of pending proposals'),
});

export type PendingCountResponse = z.infer<typeof pendingCountResponseSchema>;
