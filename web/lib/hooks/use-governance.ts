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
import { api, authApi } from '@/lib/api/client';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { createVoteRecord, createNodeProposalRecord } from '@/lib/atproto/record-creator';
import type {
  Vote as RecordCreatorVote,
  NodeProposal as RecordCreatorNodeProposal,
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
  GovernanceRole,
  EditorStatus,
  TrustedEditorRecord,
  ElevationRequest,
  ElevationResult,
  DelegationRecord,
  DelegationResult,
  ListTrustedEditorsResponse,
  ElevationRequestsResponse,
  DelegationsResponse,
  ApproveElevationInput,
  RejectElevationInput,
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
  GovernanceRole,
  EditorStatus,
  TrustedEditorRecord,
  ElevationRequest,
  ElevationResult,
  DelegationRecord,
  DelegationResult,
  ElevationRequestsResponse,
  DelegationsResponse,
  ApproveElevationInput,
  RejectElevationInput,
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

  /** Key for trusted editor queries */
  trustedEditors: () => [...governanceKeys.all, 'trusted-editors'] as const,

  /** Key for trusted editors list */
  trustedEditorsList: (params?: TrustedEditorListParams) =>
    [...governanceKeys.trustedEditors(), 'list', params] as const,

  /** Key for editor status */
  editorStatus: (did: string) => [...governanceKeys.trustedEditors(), 'status', did] as const,

  /** Key for current user's editor status */
  myEditorStatus: () => [...governanceKeys.trustedEditors(), 'my-status'] as const,

  /** Key for elevation requests queries */
  elevationRequests: (params?: TrustedEditorListParams) =>
    [...governanceKeys.all, 'elevation-requests', params] as const,

  /** Key for delegations queries */
  delegations: (params?: TrustedEditorListParams) =>
    [...governanceKeys.all, 'delegations', params] as const,
};

// =============================================================================
// PARAMETER TYPES
// =============================================================================

/**
 * Parameters for listing proposals.
 */
export interface ProposalListParams {
  /** Filter by status */
  status?: ProposalStatus;
  /** Filter by proposal type */
  type?: ProposalType;
  /** Filter by node kind (type/object) */
  kind?: 'type' | 'object';
  /** Filter by subkind (field, institution, etc.) */
  subkind?: string;
  /** Filter by node URI */
  nodeUri?: string;
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
  /** Proposal entity type (node or edge) */
  category: ProposalCategory;
  /** Proposal type (create, update, merge, deprecate) */
  type: ProposalType;
  /** Target node URI (for update/merge/deprecate) */
  targetUri?: string;
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

/**
 * Parameters for listing trusted editors.
 */
export interface TrustedEditorListParams {
  /** Filter by role */
  role?: GovernanceRole;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Input for granting delegation.
 */
export interface GrantDelegationInput {
  /** DID of delegate */
  delegateDid: string;
  /** Collections to grant access to */
  collections: string[];
  /** Days until expiration */
  daysValid?: number;
  /** Maximum records per day */
  maxRecordsPerDay?: number;
}

/**
 * Input for revoking delegation.
 */
export interface RevokeDelegationInput {
  /** Delegation ID to revoke */
  delegationId: string;
}

/**
 * Input for revoking role.
 */
export interface RevokeRoleInput {
  /** DID of user to revoke role from */
  did: string;
  /** Reason for revocation */
  reason: string;
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
      try {
        const response = await api.pub.chive.governance.listProposals({
          ...params,
          limit: params.limit ?? 20,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch proposals',
          undefined,
          'pub.chive.governance.listProposals'
        );
      }
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
      try {
        const response = await api.pub.chive.governance.getProposal({ proposalId });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch proposal',
          undefined,
          'pub.chive.governance.getProposal'
        );
      }
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
      try {
        const response = await api.pub.chive.governance.listVotes({
          proposalId,
          limit: 50,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch votes',
          undefined,
          'pub.chive.governance.listVotes'
        );
      }
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
        const response = await api.pub.chive.governance.getUserVote({ proposalId, userDid });
        // The API returns a VoteView with a different $type discriminator than listVotes.
        // Cast to Vote since they share the same structural shape.
        return (response.data?.vote as Vote) ?? null;
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
      try {
        const response = await api.pub.chive.governance.getPendingCount({});
        return response.data.count;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch pending count',
          undefined,
          'pub.chive.governance.getPendingCount'
        );
      }
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

      // Route by category to appropriate record creator
      let result: { uri: string; cid: string };

      switch (input.category) {
        case 'node':
          result = await createNodeProposalRecord(agent, {
            proposalType: input.type,
            kind: input.changes.kind ?? 'type',
            subkind: input.changes.subkind,
            proposedNode: {
              label: input.changes.label ?? '',
              description: input.changes.description,
              alternateLabels: input.changes.alternateLabels,
              externalIds: input.changes.externalIds,
              metadata: input.changes.metadata,
            },
            targetUri: input.targetUri,
            mergeIntoUri: input.changes.mergeIntoUri,
            rationale: input.rationale,
          } as RecordCreatorNodeProposal);
          break;

        case 'edge':
          result = await createNodeProposalRecord(agent, {
            proposalType: input.type,
            kind: 'type',
            subkind: 'relation',
            proposedNode: {
              label: input.changes.label ?? '',
              description: input.changes.description,
            },
            targetUri: input.targetUri,
            mergeIntoUri: input.changes.mergeIntoUri,
            rationale: input.rationale,
          } as RecordCreatorNodeProposal);
          break;

        default: {
          const exhaustiveCheck: never = input.category;
          throw new APIError(`Unsupported category: ${exhaustiveCheck}`, 400, 'createProposal');
        }
      }

      // Return a Proposal-like object for cache management
      return {
        id: result.uri.split('/').pop() ?? '',
        uri: result.uri,
        cid: result.cid,
        type: input.type,
        nodeUri: input.targetUri,
        changes: input.changes,
        rationale: input.rationale,
        status: 'open' as ProposalStatus,
        proposedBy: '',
        votes: { approve: 0, reject: 0, abstain: 0 },
        consensus: {
          approvalPercentage: 0,
          threshold: CONSENSUS_THRESHOLD,
          voterCount: 0,
          minimumVotes: MINIMUM_VOTES,
          consensusReached: false,
          recommendedStatus: 'pending',
        },
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
        cid: result.cid,
        proposalUri: input.proposalId,
        voterDid: agent.did ?? '',
        voterRole: 'community-member' as VoterRole,
        vote: input.vote,
        weight: 1,
        rationale: input.rationale,
        createdAt: new Date().toISOString(),
      };
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: governanceKeys.proposal(input.proposalId),
      });

      // Snapshot previous proposal data for rollback
      const previousProposal = queryClient.getQueryData<Proposal>(
        governanceKeys.proposal(input.proposalId)
      );

      // Optimistically update the proposal's vote counts
      if (previousProposal) {
        // Build updated vote counts based on vote type
        const { approve, reject, abstain } = previousProposal.votes;
        const updatedVotes = {
          approve: input.vote === 'approve' ? approve + 1 : approve,
          reject: input.vote === 'reject' ? reject + 1 : reject,
          abstain: input.vote === 'abstain' ? abstain + 1 : abstain,
        };

        queryClient.setQueryData<Proposal>(governanceKeys.proposal(input.proposalId), {
          ...previousProposal,
          votes: updatedVotes,
          consensus: {
            ...previousProposal.consensus,
            voterCount: previousProposal.consensus.voterCount + 1,
          },
        });
      }

      return { previousProposal };
    },
    onError: (_err, input, context) => {
      // Rollback to previous state on error
      if (context?.previousProposal) {
        queryClient.setQueryData(
          governanceKeys.proposal(input.proposalId),
          context.previousProposal
        );
      }
    },
    onSuccess: (data, input) => {
      const proposalId = input.proposalId;

      // Optimistically set the user's vote so it appears immediately
      if (data.voterDid) {
        queryClient.setQueryData<Vote | null>(
          governanceKeys.userVote(proposalId, data.voterDid),
          data
        );
      }

      // Invalidate queries to refetch latest data from server
      // Use a slight delay to allow firehose indexing
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: governanceKeys.proposal(proposalId),
        });
        queryClient.invalidateQueries({
          queryKey: governanceKeys.votes(proposalId),
        });
        queryClient.invalidateQueries({
          queryKey: governanceKeys.proposalsList(),
        });
      }, 1000);
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
        try {
          const response = await api.pub.chive.governance.getProposal({ proposalId });
          return response.data;
        } catch {
          return undefined;
        }
      },
      staleTime: 30 * 1000,
    });
  };
}

// =============================================================================
// TRUSTED EDITOR HOOKS
// =============================================================================

/**
 * Fetches the current user's editor status.
 *
 * @param options - Hook options
 * @returns Query result with editor status
 *
 * @example
 * ```tsx
 * const { data: status } = useMyEditorStatus();
 * if (status?.role === 'trusted-editor') {
 *   // Show delegation controls
 * }
 * ```
 */
export function useMyEditorStatus(options: UseGovernanceOptions = {}) {
  return useQuery({
    queryKey: governanceKeys.myEditorStatus(),
    queryFn: async (): Promise<EditorStatus> => {
      try {
        const response = await authApi.pub.chive.governance.getEditorStatus({});
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch editor status',
          undefined,
          'pub.chive.governance.getEditorStatus'
        );
      }
    },
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetches editor status for a specific user.
 *
 * @param did - User DID
 * @param options - Hook options
 * @returns Query result with editor status
 *
 * @example
 * ```tsx
 * const { data: status } = useEditorStatus(userDid);
 * ```
 */
export function useEditorStatus(did: string, options: UseGovernanceOptions = {}) {
  return useQuery({
    queryKey: governanceKeys.editorStatus(did),
    queryFn: async (): Promise<EditorStatus> => {
      try {
        const response = await api.pub.chive.governance.getEditorStatus({ did });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch editor status',
          undefined,
          'pub.chive.governance.getEditorStatus'
        );
      }
    },
    enabled: !!did && (options.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Fetches list of trusted editors (admin only).
 *
 * @param params - Query parameters
 * @param options - Hook options
 * @returns Query result with trusted editors
 *
 * @example
 * ```tsx
 * const { data } = useTrustedEditors({ role: 'trusted-editor', limit: 20 });
 * ```
 */
export function useTrustedEditors(
  params: TrustedEditorListParams = {},
  options: UseGovernanceOptions = {}
) {
  return useQuery({
    queryKey: governanceKeys.trustedEditorsList(params),
    queryFn: async (): Promise<ListTrustedEditorsResponse> => {
      try {
        const response = await authApi.pub.chive.governance.listTrustedEditors({
          limit: params.limit ?? 20,
          cursor: params.cursor,
          role: params.role,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch trusted editors',
          undefined,
          'pub.chive.governance.listTrustedEditors'
        );
      }
    },
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Mutation hook for requesting elevation to trusted editor.
 *
 * @returns Mutation object for requesting elevation
 *
 * @example
 * ```tsx
 * const requestElevation = useRequestElevation();
 *
 * await requestElevation.mutateAsync();
 * ```
 */
export function useRequestElevation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ElevationResult> => {
      try {
        const response = await api.pub.chive.governance.requestElevation({
          targetRole: 'trusted-editor',
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to request elevation',
          undefined,
          'pub.chive.governance.requestElevation'
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: governanceKeys.myEditorStatus() });
    },
  });
}

/**
 * Mutation hook for granting delegation (admin only).
 *
 * @returns Mutation object for granting delegation
 *
 * @example
 * ```tsx
 * const grantDelegation = useGrantDelegation();
 *
 * await grantDelegation.mutateAsync({
 *   delegateDid: 'did:plc:example',
 *   collections: ['pub.chive.graph.authority'],
 *   daysValid: 365,
 * });
 * ```
 */
export function useGrantDelegation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GrantDelegationInput): Promise<DelegationResult> => {
      try {
        const response = await api.pub.chive.governance.grantDelegation({
          delegateDid: input.delegateDid,
          collections: input.collections,
          daysValid: input.daysValid ?? 365,
          maxRecordsPerDay: input.maxRecordsPerDay ?? 100,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to grant delegation',
          undefined,
          'pub.chive.governance.grantDelegation'
        );
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: governanceKeys.editorStatus(variables.delegateDid),
      });
      queryClient.invalidateQueries({ queryKey: governanceKeys.trustedEditors() });
    },
  });
}

/**
 * Mutation hook for revoking delegation (admin only).
 *
 * @returns Mutation object for revoking delegation
 *
 * @example
 * ```tsx
 * const revokeDelegation = useRevokeDelegation();
 *
 * await revokeDelegation.mutateAsync({ delegationId: 'delegation-123' });
 * ```
 */
export function useRevokeDelegation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RevokeDelegationInput): Promise<DelegationResult> => {
      try {
        const response = await api.pub.chive.governance.revokeDelegation({
          delegationId: input.delegationId,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to revoke delegation',
          undefined,
          'pub.chive.governance.revokeDelegation'
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: governanceKeys.trustedEditors() });
    },
  });
}

/**
 * Mutation hook for revoking a user's role (admin only).
 *
 * @returns Mutation object for revoking role
 *
 * @example
 * ```tsx
 * const revokeRole = useRevokeRole();
 *
 * await revokeRole.mutateAsync({
 *   did: 'did:plc:example',
 *   reason: 'Violation of community guidelines',
 * });
 * ```
 */
export function useRevokeRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RevokeRoleInput): Promise<ElevationResult> => {
      try {
        const response = await api.pub.chive.governance.revokeRole({
          did: input.did,
          reason: input.reason,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to revoke role',
          undefined,
          'pub.chive.governance.revokeRole'
        );
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: governanceKeys.editorStatus(variables.did) });
      queryClient.invalidateQueries({ queryKey: governanceKeys.trustedEditors() });
    },
  });
}

// =============================================================================
// ELEVATION REQUEST HOOKS (Admin Only)
// =============================================================================

/**
 * Query hook for fetching pending elevation requests.
 *
 * @param options - Query options
 * @returns Query result with elevation requests
 *
 * @example
 * ```tsx
 * const { data } = useElevationRequests({ limit: 20 });
 * ```
 */
export function useElevationRequests(
  params: TrustedEditorListParams = {},
  options: UseGovernanceOptions = {}
) {
  return useQuery({
    queryKey: governanceKeys.elevationRequests(params),
    queryFn: async (): Promise<ElevationRequestsResponse> => {
      try {
        const response = await authApi.pub.chive.governance.listElevationRequests({
          limit: params.limit ?? 20,
          cursor: params.cursor,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch elevation requests',
          undefined,
          'pub.chive.governance.listElevationRequests'
        );
      }
    },
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation hook for approving an elevation request (admin only).
 *
 * @returns Mutation object for approving elevation
 *
 * @example
 * ```tsx
 * const approveElevation = useApproveElevation();
 *
 * await approveElevation.mutateAsync({
 *   requestId: 'request-123',
 *   verificationNotes: 'Verified via ORCID',
 * });
 * ```
 */
export function useApproveElevation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApproveElevationInput): Promise<ElevationResult> => {
      try {
        const response = await authApi.pub.chive.governance.approveElevation({
          requestId: input.requestId,
          verificationNotes: input.verificationNotes,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to approve elevation',
          undefined,
          'pub.chive.governance.approveElevation'
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: governanceKeys.elevationRequests() });
      queryClient.invalidateQueries({ queryKey: governanceKeys.trustedEditors() });
    },
  });
}

/**
 * Mutation hook for rejecting an elevation request (admin only).
 *
 * @returns Mutation object for rejecting elevation
 *
 * @example
 * ```tsx
 * const rejectElevation = useRejectElevation();
 *
 * await rejectElevation.mutateAsync({
 *   requestId: 'request-123',
 *   reason: 'Does not meet criteria',
 * });
 * ```
 */
export function useRejectElevation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RejectElevationInput): Promise<ElevationResult> => {
      try {
        const response = await authApi.pub.chive.governance.rejectElevation({
          requestId: input.requestId,
          reason: input.reason,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to reject elevation',
          undefined,
          'pub.chive.governance.rejectElevation'
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: governanceKeys.elevationRequests() });
    },
  });
}

/**
 * Query hook for fetching active delegations (admin only).
 *
 * @param options - Query options
 * @returns Query result with delegations
 *
 * @example
 * ```tsx
 * const { data } = useDelegations({ limit: 20 });
 * ```
 */
export function useDelegations(
  params: TrustedEditorListParams = {},
  options: UseGovernanceOptions = {}
) {
  return useQuery({
    queryKey: governanceKeys.delegations(params),
    queryFn: async (): Promise<DelegationsResponse> => {
      try {
        const response = await authApi.pub.chive.governance.listDelegations({
          limit: params.limit ?? 20,
          cursor: params.cursor,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch delegations',
          undefined,
          'pub.chive.governance.listDelegations'
        );
      }
    },
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Vote weight by role.
 * Uses string index for compatibility with lexicon's open union types.
 */
export const VOTE_WEIGHTS: Record<string, number> = {
  'community-member': 1,
  reviewer: 2,
  'domain-expert': 3,
  administrator: 5,
};

/**
 * Human-readable role labels.
 * Uses string index for compatibility with lexicon's open union types.
 */
export const ROLE_LABELS: Record<string, string> = {
  'community-member': 'Community Member',
  reviewer: 'Reviewer',
  'domain-expert': 'Domain Expert',
  administrator: 'Administrator',
};

/**
 * Human-readable status labels.
 */
export const STATUS_LABELS: Record<string, string> = {
  open: 'Pending Review',
  pending: 'Pending Review', // Legacy: maps to 'open'
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  expired: 'Expired', // Legacy: maps to 'withdrawn'
};

/**
 * Human-readable proposal type labels.
 * Uses string index for compatibility with lexicon's open union types.
 */
export const TYPE_LABELS: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  merge: 'Merge',
  deprecate: 'Deprecate',
};

/**
 * Human-readable category labels.
 */
export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
  node: 'Node',
  edge: 'Edge',
};

/**
 * Human-readable vote labels.
 * Uses string index for compatibility with lexicon's open union types.
 */
export const VOTE_LABELS: Record<string, string> = {
  approve: 'Approve',
  reject: 'Reject',
  abstain: 'Abstain',
  'request-changes': 'Request Changes',
};

/**
 * Human-readable governance role labels.
 * Uses string index for compatibility with lexicon's open union types.
 */
export const GOVERNANCE_ROLE_LABELS: Record<string, string> = {
  'community-member': 'Community Member',
  'trusted-editor': 'Trusted Editor',
  'graph-editor': 'Graph Editor',
  'domain-expert': 'Domain Expert',
  administrator: 'Administrator',
};

/**
 * Default consensus threshold (67%).
 */
export const CONSENSUS_THRESHOLD = 67;

/**
 * Minimum votes required.
 */
export const MINIMUM_VOTES = 3;
