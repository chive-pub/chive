/**
 * React hooks for endorsement data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching, creating, and managing endorsements.
 * Endorsements are formal signals of support for preprints, categorized by
 * contribution type. Endorsers select one or more contribution types from
 * 15 fine-grained categories derived from the CRediT taxonomy:
 *
 * **Core research**: methodological, analytical, theoretical, empirical, conceptual
 * **Technical**: technical, data
 * **Validation**: replication, reproducibility
 * **Synthesis**: synthesis, interdisciplinary
 * **Communication**: pedagogical, visualization
 * **Impact**: societal-impact, clinical
 *
 * @example
 * ```tsx
 * import { useEndorsements, endorsementKeys } from '@/lib/hooks/use-endorsement';
 *
 * function PreprintEndorsements({ preprintUri }: { preprintUri: string }) {
 *   const { data, isLoading } = useEndorsements(preprintUri);
 *
 *   if (isLoading) return <EndorsementPanelSkeleton />;
 *   return (
 *     <EndorsementPanel
 *       endorsements={data?.endorsements ?? []}
 *       summary={data?.summary}
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { api } from '@/lib/api/client';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createEndorsementRecord,
  updateEndorsementRecord,
  deleteRecord,
  type CreateEndorsementInput as RecordCreatorEndorsementInput,
  type UpdateEndorsementInput as RecordCreatorUpdateEndorsementInput,
} from '@/lib/atproto/record-creator';
import type {
  Endorsement,
  EndorsementsResponse,
  EndorsementSummary,
  ContributionType,
} from '@/lib/api/schema';

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for endorsement queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 *
 * @example
 * ```typescript
 * // Invalidate all endorsement queries
 * queryClient.invalidateQueries({ queryKey: endorsementKeys.all });
 *
 * // Invalidate endorsements for a specific preprint
 * queryClient.invalidateQueries({ queryKey: endorsementKeys.forPreprint(preprintUri) });
 *
 * // Check if user has endorsed
 * queryClient.getQueryData(endorsementKeys.userEndorsement(preprintUri, userDid));
 * ```
 */
export const endorsementKeys = {
  /** Base key for all endorsement queries */
  all: ['endorsements'] as const,

  /** Key for endorsements by preprint */
  forPreprint: (preprintUri: string) => [...endorsementKeys.all, 'preprint', preprintUri] as const,

  /** Key for endorsements list with filters */
  list: (preprintUri: string, params?: EndorsementListParams) =>
    [...endorsementKeys.forPreprint(preprintUri), 'list', params] as const,

  /** Key for endorsement summary (counts by type) */
  summary: (preprintUri: string) =>
    [...endorsementKeys.forPreprint(preprintUri), 'summary'] as const,

  /** Key for user's endorsement on a preprint */
  userEndorsement: (preprintUri: string, userDid: string) =>
    [...endorsementKeys.forPreprint(preprintUri), 'user', userDid] as const,

  /** Key for endorsements by a specific user */
  byUser: (did: string) => [...endorsementKeys.all, 'user', did] as const,
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parameters for listing endorsements.
 */
export interface EndorsementListParams {
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by contribution type */
  contributionType?: ContributionType;
}

/**
 * Options for the useEndorsements hook.
 */
export interface UseEndorsementsOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Input for creating a new endorsement.
 */
export interface CreateEndorsementInput {
  /** AT-URI of the preprint to endorse */
  preprintUri: string;
  /** Set of contribution types being endorsed (minimum 1, no duplicates) */
  contributions: ContributionType[];
  /** Optional comment explaining the endorsement */
  comment?: string;
}

/**
 * Input for updating an existing endorsement.
 */
export interface UpdateEndorsementInput {
  /** AT-URI of the endorsement to update */
  uri: string;
  /** AT-URI of the preprint (for cache invalidation) */
  preprintUri: string;
  /** New set of contribution types */
  contributions: ContributionType[];
  /** Optional updated comment */
  comment?: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches endorsements for a preprint.
 *
 * @remarks
 * Returns endorsements with aggregated counts by contribution type.
 * Uses a 2-minute stale time as endorsements change less frequently than reviews.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useEndorsements(preprintUri);
 *
 * if (isLoading) return <EndorsementPanelSkeleton />;
 *
 * return (
 *   <EndorsementPanel
 *     endorsements={data.endorsements}
 *     summary={data.summary}
 *   />
 * );
 * ```
 *
 * @param preprintUri - AT-URI of the preprint
 * @param params - Query parameters (limit, cursor, contributionType)
 * @param options - Hook options
 * @returns Query result with endorsements data
 *
 * @throws {Error} When the endorsements API request fails
 */
export function useEndorsements(
  preprintUri: string,
  params: EndorsementListParams = {},
  options: UseEndorsementsOptions = {}
) {
  return useQuery({
    queryKey: endorsementKeys.list(preprintUri, params),
    queryFn: async (): Promise<EndorsementsResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.endorsement.listForPreprint', {
        params: {
          query: {
            preprintUri,
            limit: params.limit ?? 20,
            cursor: params.cursor,
            contributionType: params.contributionType,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch endorsements',
          undefined,
          '/xrpc/pub.chive.endorsement.listForPreprint'
        );
      }
      return data!;
    },
    enabled: !!preprintUri && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches only the endorsement summary (counts by contribution type).
 *
 * @remarks
 * Lightweight query that returns just the counts without full endorsement data.
 * Useful for displaying badges/counts in preprint cards.
 *
 * @example
 * ```tsx
 * const { data: summary } = useEndorsementSummary(preprintUri);
 *
 * return (
 *   <EndorsementBadges
 *     byType={summary?.byType}
 *     total={summary?.total ?? 0}
 *     endorserCount={summary?.endorserCount ?? 0}
 *   />
 * );
 * ```
 *
 * @param preprintUri - AT-URI of the preprint
 * @param options - Hook options
 * @returns Query result with endorsement summary
 */
export function useEndorsementSummary(preprintUri: string, options: UseEndorsementsOptions = {}) {
  return useQuery({
    queryKey: endorsementKeys.summary(preprintUri),
    queryFn: async (): Promise<EndorsementSummary> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.endorsement.getSummary', {
        params: { query: { preprintUri } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch endorsement summary',
          undefined,
          '/xrpc/pub.chive.endorsement.getSummary'
        );
      }
      return data!;
    },
    enabled: !!preprintUri && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Checks if a user has endorsed a preprint.
 *
 * @remarks
 * Returns the user's endorsement if it exists, or null if not.
 * Useful for showing/hiding the endorsement form and displaying user's existing endorsement.
 *
 * @example
 * ```tsx
 * const { data: userEndorsement, isLoading } = useUserEndorsement(
 *   preprintUri,
 *   currentUser.did
 * );
 *
 * if (userEndorsement) {
 *   return <YourEndorsement endorsement={userEndorsement} />;
 * }
 *
 * return <EndorsementForm preprintUri={preprintUri} />;
 * ```
 *
 * @param preprintUri - AT-URI of the preprint
 * @param userDid - DID of the user to check
 * @param options - Hook options
 * @returns Query result with user's endorsement or null
 */
export function useUserEndorsement(
  preprintUri: string,
  userDid: string,
  options: UseEndorsementsOptions = {}
) {
  return useQuery({
    queryKey: endorsementKeys.userEndorsement(preprintUri, userDid),
    queryFn: async (): Promise<Endorsement | null> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.endorsement.getUserEndorsement', {
        params: { query: { preprintUri, userDid } },
      });
      if (error) {
        const errorObj = error as { message?: string; status?: number };
        // Return null for 404 (user has not endorsed)
        if (errorObj.status === 404) {
          return null;
        }
        throw new APIError(
          errorObj.message ?? 'Failed to fetch user endorsement',
          errorObj.status,
          '/xrpc/pub.chive.endorsement.getUserEndorsement'
        );
      }
      return data!;
    },
    enabled: !!preprintUri && !!userDid && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Mutation hook for creating a new endorsement.
 *
 * @remarks
 * Creates an endorsement in the user's PDS. Users can only have one
 * endorsement per preprint but can select multiple contribution types.
 *
 * Automatically invalidates relevant queries on success.
 *
 * @example
 * ```tsx
 * const createEndorsement = useCreateEndorsement();
 *
 * const handleEndorse = async (contributions: ContributionType[]) => {
 *   await createEndorsement.mutateAsync({
 *     preprintUri,
 *     contributions: ['methodological', 'empirical'],
 *     comment: 'Excellent methodology and strong empirical evidence!',
 *   });
 * };
 * ```
 *
 * @returns Mutation object for creating endorsements
 */
export function useCreateEndorsement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEndorsementInput): Promise<Endorsement> => {
      // Write directly to PDS from browser using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createEndorsement');
      }

      const result = await createEndorsementRecord(agent, input as RecordCreatorEndorsementInput);

      // Return an Endorsement-like object for cache management
      return {
        uri: result.uri,
        preprintUri: input.preprintUri,
        endorser: {
          did: '',
        },
        contributions: input.contributions as ContributionType[],
        comment: input.comment,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      // Invalidate endorsements for the preprint
      queryClient.invalidateQueries({
        queryKey: endorsementKeys.forPreprint(data.preprintUri),
      });
    },
  });
}

/**
 * Mutation hook for updating an existing endorsement.
 *
 * @remarks
 * Updates the contribution types and/or comment of an existing endorsement.
 * Only the endorser can update their own endorsements.
 *
 * @example
 * ```tsx
 * const updateEndorsement = useUpdateEndorsement();
 *
 * const handleUpdate = async () => {
 *   await updateEndorsement.mutateAsync({
 *     uri: endorsement.uri,
 *     preprintUri: endorsement.preprintUri,
 *     contributions: ['methodological', 'analytical', 'data'],
 *     comment: 'Updated comment',
 *   });
 * };
 * ```
 *
 * @returns Mutation object for updating endorsements
 */
export function useUpdateEndorsement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateEndorsementInput): Promise<Endorsement> => {
      // Write directly to PDS from browser using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'updateEndorsement');
      }

      const result = await updateEndorsementRecord(agent, {
        uri: input.uri,
        contributions: input.contributions,
        comment: input.comment,
      } as RecordCreatorUpdateEndorsementInput);

      // Return an Endorsement-like object for cache management
      return {
        uri: result.uri,
        preprintUri: input.preprintUri,
        endorser: {
          did: '',
        },
        contributions: input.contributions as ContributionType[],
        comment: input.comment,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: endorsementKeys.forPreprint(variables.preprintUri),
      });
    },
  });
}

/**
 * Mutation hook for deleting an endorsement.
 *
 * @remarks
 * Deletes an endorsement from the user's PDS. Only the endorser
 * can delete their own endorsements.
 *
 * @example
 * ```tsx
 * const deleteEndorsement = useDeleteEndorsement();
 *
 * const handleDelete = async () => {
 *   await deleteEndorsement.mutateAsync({
 *     uri: endorsement.uri,
 *     preprintUri: endorsement.preprintUri,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for deleting endorsements
 */
export function useDeleteEndorsement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri }: { uri: string; preprintUri: string }): Promise<void> => {
      // Delete directly from PDS using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteEndorsement');
      }

      await deleteRecord(agent, uri);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: endorsementKeys.forPreprint(variables.preprintUri),
      });
    },
  });
}

/**
 * Hook for prefetching endorsements on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading endorsement data before
 * the user interacts with the endorsement panel.
 *
 * @example
 * ```tsx
 * const prefetchEndorsements = usePrefetchEndorsements();
 *
 * return (
 *   <PreprintCard
 *     onMouseEnter={() => prefetchEndorsements(preprint.uri)}
 *   />
 * );
 * ```
 *
 * @returns Function to prefetch endorsements for a preprint
 */
export function usePrefetchEndorsements() {
  const queryClient = useQueryClient();

  return (preprintUri: string) => {
    queryClient.prefetchQuery({
      queryKey: endorsementKeys.summary(preprintUri),
      queryFn: async (): Promise<EndorsementSummary | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.endorsement.getSummary', {
          params: { query: { preprintUri } },
        });
        return data;
      },
      staleTime: 2 * 60 * 1000,
    });
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All valid contribution types.
 */
export const CONTRIBUTION_TYPES: ContributionType[] = [
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
];

/**
 * Contribution types grouped by category.
 */
export const CONTRIBUTION_TYPE_CATEGORIES = {
  'Core Research': ['methodological', 'analytical', 'theoretical', 'empirical', 'conceptual'],
  Technical: ['technical', 'data'],
  Validation: ['replication', 'reproducibility'],
  Synthesis: ['synthesis', 'interdisciplinary'],
  Communication: ['pedagogical', 'visualization'],
  Impact: ['societal-impact', 'clinical'],
} as const satisfies Record<string, readonly ContributionType[]>;

/**
 * Human-readable labels for contribution types.
 */
export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  methodological: 'Methodological',
  analytical: 'Analytical',
  theoretical: 'Theoretical',
  empirical: 'Empirical',
  conceptual: 'Conceptual',
  technical: 'Technical',
  data: 'Data',
  replication: 'Replication',
  reproducibility: 'Reproducibility',
  synthesis: 'Synthesis',
  interdisciplinary: 'Interdisciplinary',
  pedagogical: 'Pedagogical',
  visualization: 'Visualization',
  'societal-impact': 'Societal Impact',
  clinical: 'Clinical',
};

/**
 * Descriptions for each contribution type.
 */
export const CONTRIBUTION_TYPE_DESCRIPTIONS: Record<ContributionType, string> = {
  methodological: 'Novel methods, techniques, approaches, protocols',
  analytical: 'Statistical, computational, or mathematical analysis',
  theoretical: 'Theoretical framework, conceptual model, theory development',
  empirical: 'Data collection, experiments, observations, fieldwork',
  conceptual: 'Novel ideas, hypotheses, problem framing',
  technical: 'Software, tools, infrastructure, instrumentation',
  data: 'Dataset creation, curation, availability',
  replication: 'Successful replication of prior work',
  reproducibility: 'Code/materials availability, reproducible workflow',
  synthesis: 'Literature review, meta-analysis, systematic review',
  interdisciplinary: 'Cross-disciplinary integration, bridging fields',
  pedagogical: 'Educational value, clarity of exposition',
  visualization: 'Figures, graphics, data presentation',
  'societal-impact': 'Real-world applications, policy implications',
  clinical: 'Clinical relevance (for medical/health research)',
};
