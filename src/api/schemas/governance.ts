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

import { z } from './base.js';
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

export const proposalTypeSchema = z.enum(['create', 'update', 'merge', 'deprecate']);

export const nodeKindSchema = z.enum(['type', 'object']);

export const voteValueSchema = z.enum(['approve', 'reject', 'abstain', 'request-changes']);

export type VoterRole = z.infer<typeof voterRoleSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;
export type ProposalType = z.infer<typeof proposalTypeSchema>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export type VoteValue = z.infer<typeof voteValueSchema>;

// =============================================================================
// PROPOSAL SCHEMAS
// =============================================================================

export const externalIdSchema = z.object({
  system: z.string(),
  identifier: z.string(),
  uri: z.string().optional(),
  matchType: z.enum(['exact', 'close', 'broader', 'narrower', 'related']).optional(),
});

export const proposalChangesSchema = z.object({
  // Matches pub.chive.graph.nodeProposal.proposedNode
  label: z.string().optional(),
  alternateLabels: z.array(z.string()).optional(),
  description: z.string().optional(),
  externalIds: z.array(externalIdSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),

  // Node classification (lexicon-aligned)
  kind: nodeKindSchema.optional(),
  subkind: z.string().optional(),

  // For update/merge/deprecate proposals
  targetUri: z.string().optional(),
  mergeIntoUri: z.string().optional(),
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
  nodeUri: z.string().optional(),
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
  kind: nodeKindSchema.optional().describe('Filter by node kind (type/object)'),
  subkind: z.string().optional().describe('Filter by subkind (field, institution, etc.)'),
  nodeUri: z.string().optional(),
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

export const getPendingCountParamsSchema = z
  .object({
    kind: nodeKindSchema.optional().describe('Filter by node kind (type/object)'),
    subkind: z.string().optional().describe('Filter by subkind (field, institution, etc.)'),
  })
  .optional();

export type GetPendingCountParams = z.infer<typeof getPendingCountParamsSchema>;

export const pendingCountResponseSchema = z.object({
  count: z.number().int().describe('Number of pending proposals'),
});

export type PendingCountResponse = z.infer<typeof pendingCountResponseSchema>;

// =============================================================================
// TRUSTED EDITOR SCHEMAS
// =============================================================================

export const governanceRoleSchema = z.enum([
  'community-member',
  'trusted-editor',
  'graph-editor',
  'domain-expert',
  'administrator',
]);

export type GovernanceRole = z.infer<typeof governanceRoleSchema>;

export const reputationMetricsSchema = z.object({
  did: z.string(),
  accountCreatedAt: z.number(),
  accountAgeDays: z.number(),
  eprintCount: z.number(),
  wellEndorsedEprintCount: z.number(),
  totalEndorsements: z.number(),
  proposalCount: z.number(),
  voteCount: z.number(),
  successfulProposals: z.number(),
  warningCount: z.number(),
  violationCount: z.number(),
  reputationScore: z.number(),
  role: governanceRoleSchema,
  eligibleForTrustedEditor: z.boolean(),
  missingCriteria: z.array(z.string()),
});

export type ReputationMetrics = z.infer<typeof reputationMetricsSchema>;

export const editorStatusSchema = z.object({
  did: z.string(),
  displayName: z.string().optional(),
  role: governanceRoleSchema,
  roleGrantedAt: z.number().optional(),
  roleGrantedBy: z.string().optional(),
  hasDelegation: z.boolean(),
  delegationExpiresAt: z.number().optional(),
  delegationCollections: z.array(z.string()).optional(),
  recordsCreatedToday: z.number(),
  dailyRateLimit: z.number(),
  metrics: reputationMetricsSchema,
});

export type EditorStatus = z.infer<typeof editorStatusSchema>;

export const trustedEditorRecordSchema = z.object({
  did: z.string(),
  handle: z.string().optional(),
  displayName: z.string().optional(),
  role: governanceRoleSchema,
  roleGrantedAt: z.number(),
  roleGrantedBy: z.string().optional(),
  hasDelegation: z.boolean(),
  delegationExpiresAt: z.number().optional(),
  recordsCreatedToday: z.number(),
  dailyRateLimit: z.number(),
  metrics: reputationMetricsSchema,
});

export type TrustedEditorRecord = z.infer<typeof trustedEditorRecordSchema>;

export const elevationRequestSchema = z.object({
  id: z.string(),
  did: z.string(),
  handle: z.string().optional(),
  displayName: z.string().optional(),
  requestedRole: governanceRoleSchema,
  currentRole: governanceRoleSchema,
  requestedAt: z.number(),
  metrics: reputationMetricsSchema,
  verificationNotes: z.string().optional(),
});

export type ElevationRequest = z.infer<typeof elevationRequestSchema>;

export const delegationRecordSchema = z.object({
  id: z.string(),
  delegateDid: z.string(),
  handle: z.string().optional(),
  displayName: z.string().optional(),
  collections: z.array(z.string()),
  expiresAt: z.number(),
  maxRecordsPerDay: z.number(),
  recordsCreatedToday: z.number(),
  grantedAt: z.number(),
  grantedBy: z.string(),
  active: z.boolean(),
});

export type DelegationRecord = z.infer<typeof delegationRecordSchema>;

// Request schemas
export const getEditorStatusParamsSchema = z.object({
  did: z.string().optional().describe('User DID (defaults to authenticated user)'),
});

export type GetEditorStatusParams = z.infer<typeof getEditorStatusParamsSchema>;

export const listTrustedEditorsParamsSchema = paginationQuerySchema.extend({
  role: governanceRoleSchema.optional().describe('Filter by role'),
});

export type ListTrustedEditorsParams = z.infer<typeof listTrustedEditorsParamsSchema>;

export const requestElevationInputSchema = z.object({
  targetRole: z.enum(['trusted-editor']).describe('Role to request elevation to'),
});

export type RequestElevationInput = z.infer<typeof requestElevationInputSchema>;

export const approveElevationInputSchema = z.object({
  requestId: z.string(),
  verificationNotes: z.string().optional(),
});

export type ApproveElevationInput = z.infer<typeof approveElevationInputSchema>;

export const rejectElevationInputSchema = z.object({
  requestId: z.string(),
  reason: z.string().min(10).max(1000),
});

export type RejectElevationInput = z.infer<typeof rejectElevationInputSchema>;

export const grantDelegationInputSchema = z.object({
  delegateDid: z.string(),
  collections: z.array(z.string()).min(1),
  daysValid: z.number().min(1).max(365).default(365),
  maxRecordsPerDay: z.number().min(1).max(1000).default(100),
});

export type GrantDelegationInput = z.infer<typeof grantDelegationInputSchema>;

export const revokeDelegationInputSchema = z.object({
  delegationId: z.string(),
});

export type RevokeDelegationInput = z.infer<typeof revokeDelegationInputSchema>;

export const revokeRoleInputSchema = z.object({
  did: z.string(),
  reason: z.string().min(10).max(1000),
});

export type RevokeRoleInput = z.infer<typeof revokeRoleInputSchema>;

// Response schemas
export const trustedEditorsResponseSchema = z.object({
  editors: z.array(trustedEditorRecordSchema),
  cursor: z.string().optional(),
  total: z.number(),
});

export type TrustedEditorsResponse = z.infer<typeof trustedEditorsResponseSchema>;

export const elevationRequestsResponseSchema = z.object({
  requests: z.array(elevationRequestSchema),
  cursor: z.string().optional(),
  total: z.number(),
});

export type ElevationRequestsResponse = z.infer<typeof elevationRequestsResponseSchema>;

export const delegationsResponseSchema = z.object({
  delegations: z.array(delegationRecordSchema),
  cursor: z.string().optional(),
  total: z.number(),
});

export type DelegationsResponse = z.infer<typeof delegationsResponseSchema>;

export const elevationResultSchema = z.object({
  success: z.boolean(),
  requestId: z.string().optional(),
  message: z.string(),
});

export type ElevationResult = z.infer<typeof elevationResultSchema>;

export const delegationResultSchema = z.object({
  success: z.boolean(),
  delegationId: z.string().optional(),
  message: z.string(),
});

export type DelegationResult = z.infer<typeof delegationResultSchema>;
