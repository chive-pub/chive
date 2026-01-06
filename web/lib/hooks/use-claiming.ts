import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { authApi } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type {
  ClaimRequest,
  ClaimablePreprint,
  ClaimStatus,
  ClaimEvidenceType,
  SuggestedPaper,
  SuggestedPaperAuthor,
  SuggestionsProfileMetadata,
} from '@/lib/api/schema';

// Re-export suggestion types for consumer convenience
export type { SuggestedPaper, SuggestedPaperAuthor, SuggestionsProfileMetadata };

/**
 * Query key factory for claiming-related queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for claiming data.
 */
export const claimingKeys = {
  /** Base key for all claiming queries */
  all: ['claiming'] as const,
  /** Key for user claims queries */
  userClaims: (params?: { status?: ClaimStatus }) => [...claimingKeys.all, 'user', params] as const,
  /** Key for specific claim query */
  claim: (id: number) => [...claimingKeys.all, 'claim', id] as const,
  /** Key for claimable preprints search */
  claimable: (params?: { q?: string; source?: string }) =>
    [...claimingKeys.all, 'claimable', params] as const,
  /** Key for pending claims (admin) */
  pending: (params?: { minScore?: number; maxScore?: number }) =>
    [...claimingKeys.all, 'pending', params] as const,
  /** Key for paper suggestions */
  suggestions: (params?: { limit?: number }) =>
    [...claimingKeys.all, 'suggestions', params] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

interface UseUserClaimsOptions {
  /** Filter by claim status */
  status?: ClaimStatus;
  /** Number of claims per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches the authenticated user's claims with pagination.
 *
 * @param options - Query options
 * @returns Infinite query result with paginated claims
 */
export function useUserClaims(options: UseUserClaimsOptions = {}) {
  const { status, limit = 20, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: claimingKeys.userClaims({ status }),
    queryFn: async ({
      pageParam,
    }): Promise<{
      claims: ClaimRequest[];
      cursor?: string;
      hasMore: boolean;
    }> => {
      const { data, error } = await authApi.GET('/xrpc/pub.chive.claiming.getUserClaims', {
        params: {
          query: {
            status,
            limit,
            cursor: pageParam as string | undefined,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch claims',
          undefined,
          '/xrpc/pub.chive.claiming.getUserClaims'
        );
      }
      return data!;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetches a specific claim by ID.
 *
 * @param id - The claim ID
 * @returns Query result with claim details
 */
export function useClaim(id: number) {
  return useQuery({
    queryKey: claimingKeys.claim(id),
    queryFn: async (): Promise<ClaimRequest | null> => {
      const { data, error } = await authApi.GET('/xrpc/pub.chive.claiming.getClaim', {
        params: { query: { claimId: id } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch claim',
          undefined,
          '/xrpc/pub.chive.claiming.getClaim'
        );
      }
      return data!.claim;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

interface UseClaimablePreprintsOptions {
  /** Search query */
  q?: string;
  /** Filter by source (e.g., 'arxiv', 'biorxiv') */
  source?: string;
  /** Number of results per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Searches for claimable preprints (imported but not yet claimed).
 *
 * @param options - Search options
 * @returns Infinite query result with claimable preprints
 */
export function useClaimablePreprints(options: UseClaimablePreprintsOptions = {}) {
  const { q, source, limit = 20, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: claimingKeys.claimable({ q, source }),
    queryFn: async ({
      pageParam,
    }): Promise<{
      preprints: ClaimablePreprint[];
      cursor?: string;
    }> => {
      const { data, error } = await authApi.GET('/xrpc/pub.chive.claiming.findClaimable', {
        params: {
          query: {
            q,
            source,
            limit,
            cursor: pageParam as string | undefined,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to search claimable preprints',
          undefined,
          '/xrpc/pub.chive.claiming.findClaimable'
        );
      }
      return data!;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: enabled && !!q,
    staleTime: 60 * 1000, // 1 minute
  });
}

interface UsePendingClaimsOptions {
  /** Minimum verification score */
  minScore?: number;
  /** Maximum verification score */
  maxScore?: number;
  /** Number of claims per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches pending claims for admin review.
 *
 * @remarks
 * Requires admin authentication.
 *
 * @param options - Query options
 * @returns Infinite query result with pending claims
 */
export function usePendingClaims(options: UsePendingClaimsOptions = {}) {
  const { minScore, maxScore, limit = 50, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: claimingKeys.pending({ minScore, maxScore }),
    queryFn: async ({
      pageParam,
    }): Promise<{
      claims: ClaimRequest[];
      cursor?: string;
      hasMore: boolean;
    }> => {
      const { data, error } = await authApi.GET('/xrpc/pub.chive.claiming.getPendingClaims', {
        params: {
          query: {
            minScore,
            maxScore,
            limit,
            cursor: pageParam as string | undefined,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch pending claims',
          undefined,
          '/xrpc/pub.chive.claiming.getPendingClaims'
        );
      }
      return data!;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Mutation hook to start a claim on an imported preprint.
 *
 * @returns Mutation for starting a claim
 */
export function useStartClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ importId }: { importId: number }): Promise<ClaimRequest> => {
      const { data, error } = await authApi.POST('/xrpc/pub.chive.claiming.startClaim', {
        body: { importId },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to start claim',
          undefined,
          '/xrpc/pub.chive.claiming.startClaim'
        );
      }
      return data!.claim;
    },
    onSuccess: (claim) => {
      // Update claims cache
      queryClient.invalidateQueries({ queryKey: claimingKeys.userClaims() });
      // Set the new claim in cache
      queryClient.setQueryData(claimingKeys.claim(claim.id), claim);
    },
  });
}

/**
 * Mutation hook to collect evidence from external authorities.
 *
 * @returns Mutation for collecting evidence
 */
export function useCollectEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      claimId,
      authorities,
    }: {
      claimId: number;
      authorities: ClaimEvidenceType[];
    }): Promise<ClaimRequest> => {
      const { data, error } = await authApi.POST('/xrpc/pub.chive.claiming.collectEvidence', {
        body: { claimId, authorities },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to collect evidence',
          undefined,
          '/xrpc/pub.chive.claiming.collectEvidence'
        );
      }
      return data!.claim;
    },
    onSuccess: (claim) => {
      // Update the specific claim in cache
      queryClient.setQueryData(claimingKeys.claim(claim.id), claim);
      // Invalidate user claims to reflect updated evidence
      queryClient.invalidateQueries({ queryKey: claimingKeys.userClaims() });
    },
  });
}

/**
 * Mutation hook to complete a claim after creating the canonical record.
 *
 * @returns Mutation for completing a claim
 */
export function useCompleteClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      claimId,
      canonicalUri,
    }: {
      claimId: number;
      canonicalUri: string;
    }): Promise<{ success: boolean; claimId: number }> => {
      const { data, error } = await authApi.POST('/xrpc/pub.chive.claiming.completeClaim', {
        body: { claimId, canonicalUri },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to complete claim',
          undefined,
          '/xrpc/pub.chive.claiming.completeClaim'
        );
      }
      return { success: data!.success, claimId };
    },
    onSuccess: (result) => {
      // Invalidate the specific claim to refetch updated data
      queryClient.invalidateQueries({ queryKey: claimingKeys.claim(result.claimId) });
      // Invalidate user claims
      queryClient.invalidateQueries({ queryKey: claimingKeys.userClaims() });
      // Invalidate claimable preprints (this one is no longer claimable)
      queryClient.invalidateQueries({ queryKey: claimingKeys.claimable() });
    },
  });
}

/**
 * Mutation hook for admins to approve a claim.
 *
 * @returns Mutation for approving a claim
 */
export function useApproveClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ claimId }: { claimId: number }): Promise<void> => {
      const { error } = await authApi.POST('/xrpc/pub.chive.claiming.approveClaim', {
        body: { claimId },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to approve claim',
          undefined,
          '/xrpc/pub.chive.claiming.approveClaim'
        );
      }
    },
    onSuccess: (_, { claimId }) => {
      // Invalidate the specific claim
      queryClient.invalidateQueries({ queryKey: claimingKeys.claim(claimId) });
      // Invalidate pending claims (removed from queue)
      queryClient.invalidateQueries({ queryKey: claimingKeys.pending() });
    },
  });
}

/**
 * Mutation hook for admins to reject a claim.
 *
 * @returns Mutation for rejecting a claim
 */
export function useRejectClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: number; reason: string }): Promise<void> => {
      const { error } = await authApi.POST('/xrpc/pub.chive.claiming.rejectClaim', {
        body: { claimId, reason },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to reject claim',
          undefined,
          '/xrpc/pub.chive.claiming.rejectClaim'
        );
      }
    },
    onSuccess: (_, { claimId }) => {
      // Invalidate the specific claim
      queryClient.invalidateQueries({ queryKey: claimingKeys.claim(claimId) });
      // Invalidate pending claims (removed from queue)
      queryClient.invalidateQueries({ queryKey: claimingKeys.pending() });
    },
  });
}

// =============================================================================
// PAPER SUGGESTIONS
// =============================================================================

interface UsePaperSuggestionsOptions {
  /** Maximum number of suggestions */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches paper suggestions based on the user's Chive profile.
 *
 * @remarks
 * Returns papers that likely match the user's authorship based on:
 * - ORCID matches
 * - Name similarity to profile's name variants
 * - Affiliation overlap
 * - Research keyword matches
 *
 * @param options - Query options
 * @returns Query result with suggested papers
 */
export function usePaperSuggestions(options: UsePaperSuggestionsOptions = {}) {
  const { limit = 20, enabled = true } = options;

  return useQuery({
    queryKey: claimingKeys.suggestions({ limit }),
    queryFn: async () => {
      // authApi throws APIError on non-2xx via error middleware
      const { data } = await authApi.GET('/xrpc/pub.chive.claiming.getSuggestions', {
        params: { query: { limit } },
      });
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
