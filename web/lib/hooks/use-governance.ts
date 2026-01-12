/**
 * React hooks for governance data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for community governance features:
 * proposals, voting, and consensus visualization.
 *
 * Governance uses Wikipedia-style weighted voting:
 * - Community member: 1x weight
 * - Reviewer: 2x weight
 * - Domain expert: 3x weight
 * - Administrator: 5x weight
 *
 * Consensus threshold: 67% weighted approval with minimum 3 votes.
 *
 * @example
 * ```tsx
 * import { useProposals, useProposal } from '@/lib/hooks/use-governance';
 *
 * function ProposalList() {
 *   const { data, isLoading } = useProposals({ status: 'pending' });
 *
 *   if (isLoading) return <ProposalListSkeleton />;
 *   return <ProposalCards proposals={data?.proposals ?? []} />;
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { api } from '@/lib/api/client';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { createFieldProposalRecord, createVoteRecord } from '@/lib/atproto/record-creator';
import type {
  FieldProposal as RecordCreatorFieldProposal,
  Vote as RecordCreatorVote,
} from '@/lib/schemas/governance';
import type {
  VoterRole,
  ProposalStatus,
  ProposalType,
  ProposalCategory,
  VoteAction,
  VoteValue,
  Proposal,
  ProposalChanges,
  ConsensusProgress,
  Vote,
  ProposalsResponse,
  VotesResponse,
} from '@/lib/api/schema';

// Re-export types for convenience
export type {
  VoterRole,
  ProposalStatus,
  ProposalType,
  ProposalCategory,
  VoteAction,
  VoteValue,
  Proposal,
  ProposalChanges,
  ConsensusProgress,
  Vote,
  ProposalsResponse,
  VotesResponse,
};

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for governance queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 */
export const governanceKeys = {
  /** Base key for all governance queries */
  all: ['governance'] as const,

  /** Key for proposals queries */
  proposals: () => [...governanceKeys.all, 'proposals'] as const,

  /** Key for proposals with filters */
  proposalsList: (params?: ProposalListParams) =>
    [...governanceKeys.proposals(), 'list', params] as const,

  /** Key for a single proposal */
  proposal: (id: string) => [...governanceKeys.proposals(), 'detail', id] as const,

  /** Key for votes on a proposal */
  votes: (proposalId: string) => [...governanceKeys.all, 'votes', proposalId] as const,

  /** Key for user's vote on a proposal */
  userVote: (proposalId: string, userDid: string) =>
    [...governanceKeys.votes(proposalId), 'user', userDid] as const,

  /** Key for pending proposals count (for badges) */
  pendingCount: () => [...governanceKeys.proposals(), 'pending-count'] as const,
};

// =============================================================================
// PARAMETER TYPES
// =============================================================================

/**
 * Parameters for listing proposals.
 */
export interface ProposalListParams {
  /** Filter by category (field, contribution-type) */
  category?: ProposalCategory;
  /** Filter by status */
  status?: ProposalStatus;
  /** Filter by proposal type */
  type?: ProposalType;
  /** Filter by field ID */
  fieldId?: string;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Options for hooks.
 */
export interface UseGovernanceOptions {
  /** Whether query is enabled */
  enabled?: boolean;
}

/**
 * Input for creating a proposal.
 */
export interface CreateProposalInput {
  /** Proposal category (field, contribution-type) */
  category: ProposalCategory;
  /** Proposal type */
  type: ProposalType;
  /** Target field ID (for update/merge/delete) */
  fieldId?: string;
  /** Proposed changes */
  changes: ProposalChanges;
  /** Rationale */
  rationale: string;
}

/**
 * Input for creating a vote.
 */
export interface CreateVoteInput {
  /** Proposal ID */
  proposalId: string;
  /** Vote value */
  vote: VoteValue;
  /** Optional rationale */
  rationale?: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches a list of proposals with optional filtering.
 *
 * @param params - Query parameters
 * @param options - Hook options
 * @returns Query result with proposals
 *
 * @example
 * ```tsx
 * const { data } = useProposals({ status: 'pending' });
 * ```
 */
export function useProposals(params: ProposalListParams = {}, options: UseGovernanceOptions = {}) {
  return useQuery({
    queryKey: governanceKeys.proposalsList(params),
    queryFn: async (): Promise<ProposalsResponse> => {
      const { data } = await api.GET('/xrpc/pub.chive.governance.listProposals', {
        params: {
          query: { ...params, limit: params.limit ?? 20 },
        },
      });
      return data!;
    },
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches a single proposal by ID.
 *
 * @param proposalId - Proposal ID
 * @param options - Hook options
 * @returns Query result with proposal
 *
 * @example
 * ```tsx
 * const { data: proposal } = useProposal(proposalId);
 * ```
 */
export function useProposal(proposalId: string, options: UseGovernanceOptions = {}) {
  return useQuery({
    queryKey: governanceKeys.proposal(proposalId),
    queryFn: async (): Promise<Proposal> => {
      const { data } = await api.GET('/xrpc/pub.chive.governance.getProposal', {
        params: {
          query: { proposalId },
        },
      });
      return data!;
    },
    enabled: !!proposalId && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches votes for a proposal.
 *
 * @param proposalId - Proposal ID
 * @param options - Hook options
 * @returns Query result with votes
 *
 * @example
 * ```tsx
 * const { data } = useProposalVotes(proposalId);
 * ```
 */
export function useProposalVotes(proposalId: string, options: UseGovernanceOptions = {}) {
  return useQuery({
    queryKey: governanceKeys.votes(proposalId),
    queryFn: async (): Promise<VotesResponse> => {
      const { data } = await api.GET('/xrpc/pub.chive.governance.listVotes', {
        params: {
          query: { proposalId, limit: 50 },
        },
      });
      return data!;
    },
    enabled: !!proposalId && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches the current user's vote on a proposal.
 *
 * @param proposalId - Proposal ID
 * @param userDid - User DID
 * @param options - Hook options
 * @returns Query result with user's vote or null
 *
 * @example
 * ```tsx
 * const { data: myVote } = useMyVote(proposalId, currentUser.did);
 * ```
 */
export function useMyVote(proposalId: string, userDid: string, options: UseGovernanceOptions = {}) {
  return useQuery({
    queryKey: governanceKeys.userVote(proposalId, userDid),
    queryFn: async (): Promise<Vote | null> => {
      try {
        const { data } = await api.GET('/xrpc/pub.chive.governance.getUserVote', {
          params: {
            query: { proposalId, userDid },
          },
        });
        return data?.vote ?? null;
      } catch (error) {
        if (error instanceof APIError && error.statusCode === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!proposalId && !!userDid && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches count of pending proposals (for nav badges).
 *
 * @param options - Hook options
 * @returns Query result with pending count
 */
export function usePendingProposalsCount(options: UseGovernanceOptions = {}) {
  return useQuery({
    queryKey: governanceKeys.pendingCount(),
    queryFn: async (): Promise<number> => {
      const { data } = await api.GET('/xrpc/pub.chive.governance.getPendingCount', {});
      return data!.count;
    },
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Mutation hook for creating a proposal.
 *
 * @returns Mutation object for creating proposals
 *
 * @example
 * ```tsx
 * const createProposal = useCreateProposal();
 *
 * await createProposal.mutateAsync({
 *   type: 'create',
 *   changes: {
 *     label: 'Quantum Machine Learning',
 *     description: 'Intersection of quantum computing and ML',
 *     fieldType: 'topic',
 *     parentId: 'quantum-computing',
 *   },
 *   rationale: 'Emerging research area with growing publications',
 * });
 * ```
 */
export function useCreateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProposalInput): Promise<Proposal> => {
      // Write directly to PDS from browser using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createProposal');
      }

      // Map from CreateProposalInput to record creator input
      const result = await createFieldProposalRecord(agent, {
        fieldName: input.changes.label ?? '',
        description: input.changes.description ?? '',
        proposalType: input.type,
        fieldType: input.changes.fieldType,
        parentFieldUri: input.changes.parentId,
        existingFieldUri: input.fieldId,
        mergeTargetUri: input.changes.mergeTargetId,
        rationale: input.rationale,
      } as RecordCreatorFieldProposal);

      // Return a Proposal-like object for cache management
      return {
        id: result.uri.split('/').pop() ?? '',
        uri: result.uri,
        type: input.type,
        fieldId: input.fieldId,
        changes: input.changes,
        rationale: input.rationale,
        status: 'pending' as ProposalStatus,
        proposedBy: '',
        votes: { approve: 0, reject: 0, abstain: 0 },
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: governanceKeys.proposals() });
    },
  });
}

/**
 * Mutation hook for casting a vote.
 *
 * @returns Mutation object for voting
 *
 * @example
 * ```tsx
 * const createVote = useCreateVote();
 *
 * await createVote.mutateAsync({
 *   proposalId: 'abc123',
 *   vote: 'approve',
 *   rationale: 'Well-scoped proposal with clear benefit',
 * });
 * ```
 */
export function useCreateVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVoteInput): Promise<Vote> => {
      // Write directly to PDS from browser using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createVote');
      }

      const result = await createVoteRecord(agent, {
        proposalUri: input.proposalId,
        vote: input.vote,
        rationale: input.rationale,
      } as RecordCreatorVote);

      // Return a Vote-like object for cache management
      return {
        id: result.uri.split('/').pop() ?? '',
        uri: result.uri,
        proposalUri: input.proposalId,
        voterDid: '',
        voterRole: 'community-member' as VoterRole,
        vote: input.vote,
        weight: 1,
        rationale: input.rationale,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: governanceKeys.proposal(data.proposalUri.split('/').pop()!),
      });
      queryClient.invalidateQueries({
        queryKey: governanceKeys.votes(data.proposalUri.split('/').pop()!),
      });
    },
  });
}

/**
 * Hook for prefetching a proposal on hover.
 *
 * @returns Prefetch function
 */
export function usePrefetchProposal() {
  const queryClient = useQueryClient();

  return (proposalId: string) => {
    queryClient.prefetchQuery({
      queryKey: governanceKeys.proposal(proposalId),
      queryFn: async (): Promise<Proposal | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.governance.getProposal', {
          params: { query: { proposalId } },
        });
        return data;
      },
      staleTime: 30 * 1000,
    });
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Vote weight by role.
 */
export const VOTE_WEIGHTS: Record<VoterRole, number> = {
  'community-member': 1,
  reviewer: 2,
  'domain-expert': 3,
  administrator: 5,
};

/**
 * Human-readable role labels.
 */
export const ROLE_LABELS: Record<VoterRole, string> = {
  'community-member': 'Community Member',
  reviewer: 'Reviewer',
  'domain-expert': 'Domain Expert',
  administrator: 'Administrator',
};

/**
 * Human-readable status labels.
 */
export const STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

/**
 * Human-readable proposal type labels.
 */
export const TYPE_LABELS: Record<ProposalType, string> = {
  create: 'Create',
  update: 'Update',
  merge: 'Merge',
  delete: 'Delete',
};

/**
 * Human-readable category labels.
 */
export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
  field: 'Knowledge Graph Field',
  'contribution-type': 'Contribution Type',
  facet: 'Facet Value',
  organization: 'Organization',
  reconciliation: 'Reconciliation',
};

/**
 * Human-readable vote labels.
 */
export const VOTE_LABELS: Record<VoteAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  abstain: 'Abstain',
  'request-changes': 'Request Changes',
};

/**
 * Default consensus threshold (67%).
 */
export const CONSENSUS_THRESHOLD = 67;

/**
 * Minimum votes required.
 */
export const MINIMUM_VOTES = 3;
