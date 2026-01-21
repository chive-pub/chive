/**
 * React hooks for endorsement data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching, creating, and managing endorsements.
 * Endorsements are formal signals of support for eprints, categorized by
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
 * function EprintEndorsements({ eprintUri }: { eprintUri: string }) {
 *   const { data, isLoading } = useEndorsements(eprintUri);
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
import { api, authApi } from '@/lib/api/client';
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
  ContributionType,
  ListEndorsementsResponse,
  EndorsementSummaryResponse,
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
 * // Invalidate endorsements for a specific eprint
 * queryClient.invalidateQueries({ queryKey: endorsementKeys.forEprint(eprintUri) });
 *
 * // Check if user has endorsed
 * queryClient.getQueryData(endorsementKeys.userEndorsement(eprintUri, userDid));
 * ```
 */
export const endorsementKeys = {
  /** Base key for all endorsement queries */
  all: ['endorsements'] as const,

  /** Key for endorsements by eprint */
  forEprint: (eprintUri: string) => [...endorsementKeys.all, 'eprint', eprintUri] as const,

  /** Key for endorsements list with filters */
  list: (eprintUri: string, params?: EndorsementListParams) =>
    [...endorsementKeys.forEprint(eprintUri), 'list', params] as const,

  /** Key for endorsement summary (counts by type) */
  summary: (eprintUri: string) => [...endorsementKeys.forEprint(eprintUri), 'summary'] as const,

  /** Key for user's endorsement on an eprint */
  userEndorsement: (eprintUri: string, userDid: string) =>
    [...endorsementKeys.forEprint(eprintUri), 'user', userDid] as const,

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
  /** AT-URI of the eprint to endorse */
  eprintUri: string;
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
  /** AT-URI of the eprint (for cache invalidation) */
  eprintUri: string;
  /** New set of contribution types */
  contributions: ContributionType[];
  /** Optional updated comment */
  comment?: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches endorsements for an eprint.
 *
 * @remarks
 * Returns endorsements with aggregated counts by contribution type.
 * Uses a 2-minute stale time as endorsements change less frequently than reviews.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useEndorsements(eprintUri);
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
 * @param eprintUri - AT-URI of the eprint
 * @param params - Query parameters (limit, cursor, contributionType)
 * @param options - Hook options
 * @returns Query result with endorsements data
 *
 * @throws {Error} When the endorsements API request fails
 */
export function useEndorsements(
  eprintUri: string,
  params: EndorsementListParams = {},
  options: UseEndorsementsOptions = {}
) {
  return useQuery({
    queryKey: endorsementKeys.list(eprintUri, params),
    queryFn: async (): Promise<ListEndorsementsResponse> => {
      try {
        const response = await api.pub.chive.endorsement.listForEprint({
          eprintUri,
          limit: params.limit ?? 20,
          cursor: params.cursor,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch endorsements',
          undefined,
          'pub.chive.endorsement.listForEprint'
        );
      }
    },
    enabled: !!eprintUri && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches only the endorsement summary (counts by contribution type).
 *
 * @remarks
 * Lightweight query that returns just the counts without full endorsement data.
 * Useful for displaying badges/counts in eprint cards.
 *
 * @example
 * ```tsx
 * const { data: summary } = useEndorsementSummary(eprintUri);
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
 * @param eprintUri - AT-URI of the eprint
 * @param options - Hook options
 * @returns Query result with endorsement summary
 */
export function useEndorsementSummary(eprintUri: string, options: UseEndorsementsOptions = {}) {
  return useQuery({
    queryKey: endorsementKeys.summary(eprintUri),
    queryFn: async (): Promise<EndorsementSummaryResponse> => {
      try {
        const response = await api.pub.chive.endorsement.getSummary({ eprintUri });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch endorsement summary',
          undefined,
          'pub.chive.endorsement.getSummary'
        );
      }
    },
    enabled: !!eprintUri && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Checks if a user has endorsed an eprint.
 *
 * @remarks
 * Returns the user's endorsement if it exists, or null if not.
 * Useful for showing/hiding the endorsement form and displaying user's existing endorsement.
 *
 * @example
 * ```tsx
 * const { data: userEndorsement, isLoading } = useUserEndorsement(
 *   eprintUri,
 *   currentUser.did
 * );
 *
 * if (userEndorsement) {
 *   return <YourEndorsement endorsement={userEndorsement} />;
 * }
 *
 * return <EndorsementForm eprintUri={eprintUri} />;
 * ```
 *
 * @param eprintUri - AT-URI of the eprint
 * @param userDid - DID of the user to check
 * @param options - Hook options
 * @returns Query result with user's endorsement or null
 */
export function useUserEndorsement(
  eprintUri: string,
  userDid: string,
  options: UseEndorsementsOptions = {}
) {
  return useQuery({
    queryKey: endorsementKeys.userEndorsement(eprintUri, userDid),
    queryFn: async (): Promise<Endorsement | null> => {
      try {
        const response = await authApi.pub.chive.endorsement.getUserEndorsement({
          eprintUri,
          userDid,
        });
        // Cast needed because getUserEndorsement and listForEprint use different $type discriminators
        // for the same underlying EndorsementView structure (ATProto pattern)
        return (response.data ?? null) as Endorsement | null;
      } catch (error) {
        // Return null for 404 (user has not endorsed) - this is expected behavior
        if (error instanceof APIError && error.statusCode === 404) {
          return null;
        }
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch user endorsement',
          undefined,
          'pub.chive.endorsement.getUserEndorsement'
        );
      }
    },
    enabled: !!eprintUri && !!userDid && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Mutation hook for creating a new endorsement.
 *
 * @remarks
 * Creates an endorsement in the user's PDS. Users can only have one
 * endorsement per eprint but can select multiple contribution types.
 *
 * Automatically invalidates relevant queries on success.
 *
 * @example
 * ```tsx
 * const createEndorsement = useCreateEndorsement();
 *
 * const handleEndorse = async (contributions: ContributionType[]) => {
 *   await createEndorsement.mutateAsync({
 *     eprintUri,
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
        cid: result.cid,
        eprintUri: input.eprintUri,
        endorser: {
          did: '',
        },
        contributions: input.contributions as ContributionType[],
        comment: input.comment,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      // Invalidate endorsements for the eprint
      queryClient.invalidateQueries({
        queryKey: endorsementKeys.forEprint(data.eprintUri),
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
 *     eprintUri: endorsement.eprintUri,
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
        cid: result.cid,
        eprintUri: input.eprintUri,
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
        queryKey: endorsementKeys.forEprint(variables.eprintUri),
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
 *     eprintUri: endorsement.eprintUri,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for deleting endorsements
 */
export function useDeleteEndorsement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri }: { uri: string; eprintUri: string }): Promise<void> => {
      // Delete directly from PDS using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteEndorsement');
      }

      await deleteRecord(agent, uri);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: endorsementKeys.forEprint(variables.eprintUri),
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
 *   <EprintCard
 *     onMouseEnter={() => prefetchEndorsements(eprint.uri)}
 *   />
 * );
 * ```
 *
 * @returns Function to prefetch endorsements for an eprint
 */
export function usePrefetchEndorsements() {
  const queryClient = useQueryClient();

  return (eprintUri: string) => {
    queryClient.prefetchQuery({
      queryKey: endorsementKeys.summary(eprintUri),
      queryFn: async (): Promise<EndorsementSummaryResponse | undefined> => {
        try {
          const response = await api.pub.chive.endorsement.getSummary({ eprintUri });
          return response.data;
        } catch {
          return undefined;
        }
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
 *
 * @remarks
 * Uses `Record<string, string>` to allow safe indexing with open union types
 * from the lexicon (`ContributionType | (string & {})`).
 */
export const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
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
 *
 * @remarks
 * Uses `Record<string, string>` to allow safe indexing with open union types
 * from the lexicon (`ContributionType | (string & {})`).
 */
export const CONTRIBUTION_TYPE_DESCRIPTIONS: Record<string, string> = {
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
