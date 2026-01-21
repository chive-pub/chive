/**
 * React hooks for CRediT contribution types and governance.
 *
 * @remarks
 * Provides TanStack Query hooks for:
 * - Fetching available contribution types (CRediT taxonomy)
 * - Listing and viewing contribution type proposals
 * - Voting on contribution type proposals
 *
 * Contribution types follow the CRediT taxonomy with community governance
 * for adding new types. Proposals require 60% weighted approval.
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { api } from '@/lib/api/client';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import type {
  PubChiveGraphListNodes,
  PubChiveGovernanceListProposals,
  PubChiveGovernanceGetProposal,
  PubChiveGovernanceListVotes,
  PubChiveGovernanceGetUserVote,
} from '@/lib/api/client';

// =============================================================================
// TYPES
// =============================================================================

/**
 * CRediT contribution type.
 */
export interface CreditContributionType {
  /** AT-URI of the contribution type record */
  uri: string;
  /** Unique identifier (e.g., 'conceptualization') */
  id: string;
  /** Human-readable label */
  label: string;
  /** Description of the contribution type */
  description: string;
  /** External mappings to CRediT, CRO, etc. */
  externalMappings: Array<{
    system: string;
    identifier: string;
    uri: string;
    matchType?: 'exact-match' | 'close-match' | 'related-match';
  }>;
  /** Status in the system */
  status: 'established' | 'provisional' | 'deprecated';
  /** URI of the proposal that created this type (null for seeded types) */
  proposalUri?: string;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Contribution type proposal.
 */
export interface ContributionTypeProposal {
  /** AT-URI of the proposal record */
  uri: string;
  /** Proposal type */
  proposalType: 'create' | 'update' | 'deprecate';
  /** Proposed type ID */
  proposedId: string;
  /** Proposed label */
  proposedLabel: string;
  /** Proposed description */
  proposedDescription?: string;
  /** External mappings */
  externalMappings?: Array<{
    system: string;
    identifier: string;
    uri: string;
  }>;
  /** Rationale for the proposal */
  rationale: string;
  /** DID of the proposer */
  proposerDid: string;
  /** Proposer display name */
  proposerName?: string;
  /** Proposal status */
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  /** Vote tally */
  votes: {
    approve: number;
    reject: number;
    abstain: number;
    weightedApprove: number;
    weightedReject: number;
    total: number;
  };
  /** Creation timestamp */
  createdAt: string;
  /** Existing type ID (for update/deprecate) */
  existingTypeId?: string;
}

/**
 * Vote on a contribution type proposal.
 */
export interface ContributionTypeVote {
  /** AT-URI of the vote record */
  uri: string;
  /** URI of the proposal being voted on */
  proposalUri: string;
  /** DID of the voter */
  voterDid: string;
  /** Voter display name */
  voterName?: string;
  /** Vote value */
  value: 'approve' | 'reject' | 'abstain';
  /** Vote weight based on role */
  weight: number;
  /** Optional rationale */
  rationale?: string;
  /** Creation timestamp */
  createdAt: string;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for contribution type queries.
 */
export const contributionTypeKeys = {
  /** Base key for all contribution type queries */
  all: ['contribution-types'] as const,

  /** Key for contribution types list */
  types: () => [...contributionTypeKeys.all, 'types'] as const,

  /** Key for types list with filters */
  typesList: (params?: ContributionTypesParams) =>
    [...contributionTypeKeys.types(), 'list', params] as const,

  /** Key for a single contribution type */
  type: (id: string) => [...contributionTypeKeys.types(), 'detail', id] as const,

  /** Key for proposals */
  proposals: () => [...contributionTypeKeys.all, 'proposals'] as const,

  /** Key for proposals list with filters */
  proposalsList: (params?: ProposalListParams) =>
    [...contributionTypeKeys.proposals(), 'list', params] as const,

  /** Key for a single proposal */
  proposal: (uri: string) => [...contributionTypeKeys.proposals(), 'detail', uri] as const,

  /** Key for proposal votes */
  proposalVotes: (proposalUri: string) =>
    [...contributionTypeKeys.proposals(), 'votes', proposalUri] as const,

  /** Key for user's vote on a proposal */
  userVote: (proposalUri: string, userDid: string) =>
    [...contributionTypeKeys.proposalVotes(proposalUri), 'user', userDid] as const,

  /** Key for pending proposals count */
  pendingCount: () => [...contributionTypeKeys.proposals(), 'pending-count'] as const,
};

// =============================================================================
// PARAMETER TYPES
// =============================================================================

/**
 * Parameters for listing contribution types.
 */
export interface ContributionTypesParams {
  /** Filter by status */
  status?: 'proposed' | 'established' | 'deprecated';
  /** Search query */
  query?: string;
  /** Maximum results */
  limit?: number;
}

/**
 * Parameters for listing proposals.
 */
export interface ProposalListParams {
  /** Filter by status */
  status?: 'pending' | 'approved' | 'rejected' | 'expired';
  /** Filter by proposal type */
  proposalType?: 'create' | 'update' | 'deprecate';
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Options for hooks.
 */
export interface UseContributionTypeOptions {
  /** Whether query is enabled */
  enabled?: boolean;
}

// =============================================================================
// HOOKS - CONTRIBUTION TYPES
// =============================================================================

/**
 * Default CRediT contribution types (fallback when API not available).
 * Uses unified node AT-URI format: at://governance-did/pub.chive.graph.node/rkey
 */
const DEFAULT_CREDIT_TYPES: CreditContributionType[] = [
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-conceptualization',
    id: 'conceptualization',
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'conceptualization',
        uri: 'https://credit.niso.org/contributor-roles/conceptualization/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-data-curation',
    id: 'data-curation',
    label: 'Data Curation',
    description:
      'Management activities to annotate, scrub data and maintain research data for initial use and later reuse',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'data-curation',
        uri: 'https://credit.niso.org/contributor-roles/data-curation/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-formal-analysis',
    id: 'formal-analysis',
    label: 'Formal Analysis',
    description:
      'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'formal-analysis',
        uri: 'https://credit.niso.org/contributor-roles/formal-analysis/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-funding-acquisition',
    id: 'funding-acquisition',
    label: 'Funding Acquisition',
    description: 'Acquisition of the financial support for the project leading to this publication',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'funding-acquisition',
        uri: 'https://credit.niso.org/contributor-roles/funding-acquisition/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-investigation',
    id: 'investigation',
    label: 'Investigation',
    description:
      'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'investigation',
        uri: 'https://credit.niso.org/contributor-roles/investigation/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-methodology',
    id: 'methodology',
    label: 'Methodology',
    description: 'Development or design of methodology; creation of models',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'methodology',
        uri: 'https://credit.niso.org/contributor-roles/methodology/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-project-administration',
    id: 'project-administration',
    label: 'Project Administration',
    description:
      'Management and coordination responsibility for the research activity planning and execution',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'project-administration',
        uri: 'https://credit.niso.org/contributor-roles/project-administration/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-resources',
    id: 'resources',
    label: 'Resources',
    description:
      'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'resources',
        uri: 'https://credit.niso.org/contributor-roles/resources/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-software',
    id: 'software',
    label: 'Software',
    description:
      'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'software',
        uri: 'https://credit.niso.org/contributor-roles/software/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-supervision',
    id: 'supervision',
    label: 'Supervision',
    description:
      'Oversight and leadership responsibility for the research activity planning and execution, including mentorship',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'supervision',
        uri: 'https://credit.niso.org/contributor-roles/supervision/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-validation',
    id: 'validation',
    label: 'Validation',
    description:
      'Verification of the overall replication/reproducibility of results/experiments and other research outputs',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'validation',
        uri: 'https://credit.niso.org/contributor-roles/validation/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-visualization',
    id: 'visualization',
    label: 'Visualization',
    description:
      'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'visualization',
        uri: 'https://credit.niso.org/contributor-roles/visualization/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-writing-original-draft',
    id: 'writing-original-draft',
    label: 'Writing - Original Draft',
    description:
      'Preparation, creation and/or presentation of the published work, specifically writing the initial draft',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'writing-original-draft',
        uri: 'https://credit.niso.org/contributor-roles/writing-original-draft/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
  {
    uri: 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-writing-review-editing',
    id: 'writing-review-editing',
    label: 'Writing - Review & Editing',
    description:
      'Preparation, creation and/or presentation of the published work, specifically critical review, commentary or revision',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'writing-review-editing',
        uri: 'https://credit.niso.org/contributor-roles/writing-review-editing/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: new Date().toISOString(),
  },
];

/**
 * Fetches available contribution types.
 *
 * @param params - Query parameters
 * @param options - Hook options
 * @returns Query result with contribution types
 */
export function useContributionTypes(
  params: ContributionTypesParams = {},
  options: UseContributionTypeOptions = {}
) {
  return useQuery({
    queryKey: contributionTypeKeys.typesList(params),
    queryFn: async (): Promise<{ types: CreditContributionType[]; cursor?: string }> => {
      const response = await api.pub.chive.graph.listNodes({
        subkind: 'contribution-type',
        status: params.status as 'established' | 'provisional' | 'deprecated' | undefined,
        limit: params.limit ?? 50,
      });

      const data = response.data;

      // Map API response to our CreditContributionType interface
      const types: CreditContributionType[] = (data.nodes ?? []).map(
        (n: PubChiveGraphListNodes.GraphNode) => ({
          uri: n.uri,
          id: n.id,
          label: n.label,
          description: n.description ?? '',
          externalMappings: (n.externalIds ?? []).map(
            (ext: { system: string; identifier: string; uri?: string; matchType?: string }) => ({
              system: ext.system,
              identifier: ext.identifier,
              uri: ext.uri ?? '',
              matchType:
                ext.matchType === 'exact'
                  ? 'exact-match'
                  : ext.matchType === 'close'
                    ? 'close-match'
                    : 'related-match',
            })
          ),
          status: n.status as 'established' | 'provisional' | 'deprecated',
          createdAt: n.createdAt,
        })
      );

      return { types, cursor: data.cursor };
    },
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: { types: DEFAULT_CREDIT_TYPES },
  });
}

/**
 * Fetches a single contribution type.
 *
 * @param typeId - Type identifier
 * @param options - Hook options
 * @returns Query result with contribution type
 */
export function useContributionType(typeId: string, options: UseContributionTypeOptions = {}) {
  return useQuery({
    queryKey: contributionTypeKeys.type(typeId),
    queryFn: async (): Promise<CreditContributionType> => {
      const response = await api.pub.chive.graph.getNode({ id: typeId, includeEdges: false });

      const data = response.data;

      return {
        uri: data.uri,
        id: data.id,
        label: data.label,
        description: data.description ?? '',
        externalMappings: (data.externalIds ?? []).map(
          (m: { system: string; identifier: string; uri?: string; matchType?: string }) => ({
            system: m.system,
            identifier: m.identifier,
            uri: m.uri ?? '',
            matchType:
              m.matchType === 'exact'
                ? 'exact-match'
                : m.matchType === 'close'
                  ? 'close-match'
                  : 'related-match',
          })
        ),
        status: data.status as 'established' | 'provisional' | 'deprecated',
        createdAt: data.createdAt,
      };
    },
    enabled: !!typeId && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// HOOKS - PROPOSALS
// =============================================================================

/**
 * Fetches contribution type proposals via governance API.
 *
 * @param params - Query parameters
 * @param options - Hook options
 * @returns Query result with proposals
 */
export function useContributionTypeProposals(
  params: ProposalListParams = {},
  options: UseContributionTypeOptions = {}
) {
  return useQuery({
    queryKey: contributionTypeKeys.proposalsList(params),
    queryFn: async (): Promise<{
      proposals: ContributionTypeProposal[];
      cursor?: string;
    }> => {
      // Note: 'contribution-type' is not a valid API category, use 'concept' instead
      // Contribution types are specialized concept nodes
      const response = await api.pub.chive.governance.listProposals({
        subkind: 'contribution-type',
        status: params.status,
        limit: params.limit ?? 20,
        cursor: params.cursor,
      });

      const data = response.data;

      const proposals: ContributionTypeProposal[] = data.proposals.map(
        (p: PubChiveGovernanceListProposals.ProposalView) => ({
          uri: p.uri,
          proposalType: (p.type as 'create' | 'update' | 'deprecate') ?? 'create',
          proposedId: p.id ?? '',
          proposedLabel: p.label ?? '',
          proposedDescription: p.changes?.description,
          rationale: p.rationale ?? '',
          proposerDid: p.proposedBy,
          proposerName: p.proposerName,
          status: p.status as 'pending' | 'approved' | 'rejected' | 'expired',
          votes: {
            approve: p.votes?.approve ?? 0,
            reject: p.votes?.reject ?? 0,
            abstain: p.votes?.abstain ?? 0,
            weightedApprove: 0,
            weightedReject: 0,
            total: (p.votes?.approve ?? 0) + (p.votes?.reject ?? 0) + (p.votes?.abstain ?? 0),
          },
          createdAt: p.createdAt,
        })
      );

      return { proposals, cursor: data.cursor };
    },
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches a single contribution type proposal via governance API.
 *
 * @param proposalUri - Proposal AT-URI
 * @param options - Hook options
 * @returns Query result with proposal
 */
export function useContributionTypeProposal(
  proposalUri: string,
  options: UseContributionTypeOptions = {}
) {
  return useQuery({
    queryKey: contributionTypeKeys.proposal(proposalUri),
    queryFn: async (): Promise<ContributionTypeProposal> => {
      const response = await api.pub.chive.governance.getProposal({ proposalId: proposalUri });

      const p: PubChiveGovernanceGetProposal.ProposalView = response.data;

      return {
        uri: p.uri,
        proposalType: (p.type as 'create' | 'update' | 'deprecate') ?? 'create',
        proposedId: p.id ?? '',
        proposedLabel: p.label ?? '',
        proposedDescription: p.changes?.description,
        rationale: p.rationale ?? '',
        proposerDid: p.proposedBy,
        proposerName: p.proposerName,
        status: p.status as 'pending' | 'approved' | 'rejected' | 'expired',
        votes: {
          approve: p.votes?.approve ?? 0,
          reject: p.votes?.reject ?? 0,
          abstain: p.votes?.abstain ?? 0,
          weightedApprove: 0,
          weightedReject: 0,
          total: (p.votes?.approve ?? 0) + (p.votes?.reject ?? 0) + (p.votes?.abstain ?? 0),
        },
        createdAt: p.createdAt,
        existingTypeId: p.nodeUri,
      };
    },
    enabled: !!proposalUri && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches votes for a contribution type proposal via governance API.
 *
 * @param proposalUri - Proposal AT-URI
 * @param options - Hook options
 * @returns Query result with votes
 */
export function useContributionTypeProposalVotes(
  proposalUri: string,
  options: UseContributionTypeOptions = {}
) {
  return useQuery({
    queryKey: contributionTypeKeys.proposalVotes(proposalUri),
    queryFn: async (): Promise<{ votes: ContributionTypeVote[] }> => {
      const response = await api.pub.chive.governance.listVotes({
        proposalId: proposalUri,
        limit: 50,
      });

      const data = response.data;

      const votes: ContributionTypeVote[] = data.votes.map(
        (v: PubChiveGovernanceListVotes.VoteView) => ({
          uri: v.uri,
          proposalUri: v.proposalUri,
          voterDid: v.voterDid,
          voterName: v.voterName,
          value: v.vote as 'approve' | 'reject' | 'abstain',
          weight: v.weight,
          rationale: v.rationale,
          createdAt: v.createdAt,
        })
      );

      return { votes };
    },
    enabled: !!proposalUri && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches the current user's vote on a proposal via governance API.
 *
 * @param proposalUri - Proposal AT-URI
 * @param userDid - User DID
 * @param options - Hook options
 * @returns Query result with user's vote or null
 */
export function useMyContributionTypeVote(
  proposalUri: string,
  userDid: string,
  options: UseContributionTypeOptions = {}
) {
  return useQuery({
    queryKey: contributionTypeKeys.userVote(proposalUri, userDid),
    queryFn: async (): Promise<ContributionTypeVote | null> => {
      const response = await api.pub.chive.governance.getUserVote({
        proposalId: proposalUri,
        userDid,
      });

      const data = response.data;

      const v = data.vote as PubChiveGovernanceGetUserVote.VoteView | undefined;
      if (!v) return null;

      return {
        uri: v.uri,
        proposalUri: v.proposalUri,
        voterDid: v.voterDid,
        voterName: undefined,
        value: v.vote as 'approve' | 'reject' | 'abstain',
        weight: v.weight,
        rationale: v.rationale,
        createdAt: v.createdAt,
      };
    },
    enabled: !!proposalUri && !!userDid && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches count of pending contribution type proposals via governance API.
 *
 * @param options - Hook options
 * @returns Query result with pending count
 */
export function usePendingContributionTypeProposalsCount(options: UseContributionTypeOptions = {}) {
  return useQuery({
    queryKey: contributionTypeKeys.pendingCount(),
    queryFn: async (): Promise<number> => {
      const response = await api.pub.chive.governance.getPendingCount({});

      return response.data.count;
    },
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000, // 1 minute
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Input for creating a contribution type proposal.
 */
export interface CreateContributionTypeProposalInput {
  /** Proposal type */
  proposalType: 'create' | 'update' | 'deprecate';
  /** Proposed type ID */
  proposedId: string;
  /** Proposed label */
  proposedLabel: string;
  /** Proposed description */
  proposedDescription?: string;
  /** External mappings */
  externalMappings?: Array<{
    system: string;
    identifier: string;
    uri: string;
  }>;
  /** Rationale for the proposal */
  rationale: string;
  /** Existing type ID (for update/deprecate) */
  existingTypeId?: string;
}

/**
 * Mutation hook for creating a contribution type proposal.
 *
 * @returns Mutation object for creating proposals
 */
export function useCreateContributionTypeProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CreateContributionTypeProposalInput
    ): Promise<ContributionTypeProposal> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createProposal');
      }

      // Create the proposal record in the user's PDS using unified node proposal
      const result = await agent.com.atproto.repo.createRecord({
        repo: agent.did ?? '',
        collection: 'pub.chive.graph.nodeProposal',
        record: {
          $type: 'pub.chive.graph.nodeProposal',
          proposalType: input.proposalType,
          kind: 'type',
          subkind: 'contribution-type',
          targetUri: input.existingTypeId,
          proposedNode: {
            id: input.proposedId,
            kind: 'type',
            subkind: 'contribution-type',
            label: input.proposedLabel,
            description: input.proposedDescription,
            externalIds: input.externalMappings?.map((m) => ({
              system: m.system,
              identifier: m.identifier,
              uri: m.uri,
              matchType: 'exact',
            })),
          },
          rationale: input.rationale,
          createdAt: new Date().toISOString(),
        },
      });

      // Return a proposal-like object for cache management
      return {
        uri: result.data.uri,
        proposalType: input.proposalType,
        proposedId: input.proposedId,
        proposedLabel: input.proposedLabel,
        proposedDescription: input.proposedDescription,
        externalMappings: input.externalMappings,
        rationale: input.rationale,
        proposerDid: agent.did ?? '',
        status: 'pending',
        votes: {
          approve: 0,
          reject: 0,
          abstain: 0,
          weightedApprove: 0,
          weightedReject: 0,
          total: 0,
        },
        createdAt: new Date().toISOString(),
        existingTypeId: input.existingTypeId,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contributionTypeKeys.proposals() });
    },
  });
}

/**
 * Input for voting on a contribution type proposal.
 */
export interface VoteOnContributionTypeProposalInput {
  /** Proposal AT-URI */
  proposalUri: string;
  /** Vote value */
  value: 'approve' | 'reject' | 'abstain';
  /** Optional rationale */
  rationale?: string;
}

/**
 * Mutation hook for voting on a contribution type proposal.
 *
 * @returns Mutation object for voting
 */
export function useVoteOnContributionTypeProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: VoteOnContributionTypeProposalInput
    ): Promise<ContributionTypeVote> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createVote');
      }

      // Create the vote record in the user's PDS
      const result = await agent.com.atproto.repo.createRecord({
        repo: agent.did ?? '',
        collection: 'pub.chive.graph.vote',
        record: {
          $type: 'pub.chive.graph.vote',
          subject: input.proposalUri,
          value: input.value,
          rationale: input.rationale,
          createdAt: new Date().toISOString(),
        },
      });

      // Return a vote-like object for cache management
      return {
        uri: result.data.uri,
        proposalUri: input.proposalUri,
        voterDid: agent.did ?? '',
        value: input.value,
        weight: 1,
        rationale: input.rationale,
        createdAt: new Date().toISOString(),
      };
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: contributionTypeKeys.proposal(input.proposalUri),
      });

      // Snapshot previous proposal data for rollback
      const previousProposal = queryClient.getQueryData<ContributionTypeProposal>(
        contributionTypeKeys.proposal(input.proposalUri)
      );

      // Optimistically update the proposal's vote counts
      if (previousProposal) {
        queryClient.setQueryData<ContributionTypeProposal>(
          contributionTypeKeys.proposal(input.proposalUri),
          {
            ...previousProposal,
            votes: {
              ...previousProposal.votes,
              [input.value]: previousProposal.votes[input.value] + 1,
              total: previousProposal.votes.total + 1,
            },
          }
        );
      }

      return { previousProposal };
    },
    onError: (_err, input, context) => {
      // Rollback to previous state on error
      if (context?.previousProposal) {
        queryClient.setQueryData(
          contributionTypeKeys.proposal(input.proposalUri),
          context.previousProposal
        );
      }
    },
    onSuccess: (data, input) => {
      const proposalUri = input.proposalUri;

      // Optimistically set the user's vote so it appears immediately
      if (data.voterDid) {
        queryClient.setQueryData<ContributionTypeVote | null>(
          contributionTypeKeys.userVote(proposalUri, data.voterDid),
          data
        );
      }

      // Invalidate queries to refetch latest data from server
      // Use a slight delay to allow firehose indexing
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: contributionTypeKeys.proposal(proposalUri),
        });
        queryClient.invalidateQueries({
          queryKey: contributionTypeKeys.proposalVotes(proposalUri),
        });
        queryClient.invalidateQueries({
          queryKey: contributionTypeKeys.proposalsList(),
        });
      }, 1000);
    },
  });
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Consensus threshold for contribution type proposals (60%).
 */
export const CONTRIBUTION_TYPE_CONSENSUS_THRESHOLD = 60;

/**
 * Minimum votes required for contribution type proposals.
 */
export const CONTRIBUTION_TYPE_MINIMUM_VOTES = 3;

/**
 * Human-readable status labels.
 */
export const PROPOSAL_STATUS_LABELS: Record<ContributionTypeProposal['status'], string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

/**
 * Human-readable proposal type labels.
 */
export const PROPOSAL_TYPE_LABELS: Record<ContributionTypeProposal['proposalType'], string> = {
  create: 'Create New Type',
  update: 'Update Type',
  deprecate: 'Deprecate Type',
};
