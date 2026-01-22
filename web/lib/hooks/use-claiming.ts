import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { authApi, getApiBaseUrl } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { logger } from '@/lib/observability';

const claimingLogger = logger.child({ component: 'claiming' });
/**
 * Claim status type derived from the lexicon.
 */
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Co-author claim status type derived from the lexicon.
 */
export type CoauthorClaimStatus = 'pending' | 'approved' | 'rejected';

// Import generated types
import type { OutputSchema as GetClaimResponse } from '@/lib/api/generated/types/pub/chive/claiming/getClaim.js';
import type { OutputSchema as GetUserClaimsResponse } from '@/lib/api/generated/types/pub/chive/claiming/getUserClaims.js';
import type { OutputSchema as FindClaimableResponse } from '@/lib/api/generated/types/pub/chive/claiming/findClaimable.js';
import type { OutputSchema as GetPendingClaimsResponse } from '@/lib/api/generated/types/pub/chive/claiming/getPendingClaims.js';
import type { OutputSchema as GetSubmissionDataResponse } from '@/lib/api/generated/types/pub/chive/claiming/getSubmissionData.js';
import type { OutputSchema as GetSuggestionsResponse } from '@/lib/api/generated/types/pub/chive/claiming/getSuggestions.js';
import type { OutputSchema as GetMyCoauthorRequestsResponse } from '@/lib/api/generated/types/pub/chive/claiming/getMyCoauthorRequests.js';
import type {
  OutputSchema as GetCoauthorRequestsResponse,
  CoauthorRequest,
} from '@/lib/api/generated/types/pub/chive/claiming/getCoauthorRequests.js';
import type { OutputSchema as StartClaimResponse } from '@/lib/api/generated/types/pub/chive/claiming/startClaim.js';

/**
 * Submission data for claiming a paper (prefilled form data).
 */
export type SubmissionData = GetSubmissionDataResponse;

// Re-export types for consumer convenience
export type { CoauthorRequest as CoauthorClaimRequest };
export type ClaimRequest = GetClaimResponse['claim'];
export type ClaimRequestWithPaper = GetUserClaimsResponse['claims'][number];
export type ClaimPaperDetails = ClaimRequestWithPaper['paper'];
export type SuggestedPaper = GetSuggestionsResponse['papers'][number];
export type SuggestedPaperAuthor = SuggestedPaper['authors'][number];
export type SuggestionsProfileMetadata = GetSuggestionsResponse['profileUsed'];
export type ClaimableEprint = FindClaimableResponse['eprints'][number];

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
  /** Key for claimable eprints search */
  claimable: (params?: { q?: string; source?: string }) =>
    [...claimingKeys.all, 'claimable', params] as const,
  /** Key for pending claims (admin) */
  pending: (params?: { minScore?: number; maxScore?: number }) =>
    [...claimingKeys.all, 'pending', params] as const,
  /** Key for paper suggestions */
  suggestions: (params?: { limit?: number }) =>
    [...claimingKeys.all, 'suggestions', params] as const,
  /** Key for submission data (claim prefill) */
  submissionData: (source: string, externalId: string) =>
    [...claimingKeys.all, 'submissionData', source, externalId] as const,
  /** Key for co-author requests made by user */
  myCoauthorRequests: (params?: { status?: CoauthorClaimStatus }) =>
    [...claimingKeys.all, 'myCoauthorRequests', params] as const,
  /** Key for co-author requests on user's eprints (as owner) */
  coauthorRequests: () => [...claimingKeys.all, 'coauthorRequests'] as const,
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
 * @returns Infinite query result with paginated claims including paper details
 */
export function useUserClaims(options: UseUserClaimsOptions = {}) {
  const { status, limit = 20, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: claimingKeys.userClaims({ status }),
    queryFn: async ({ pageParam }): Promise<GetUserClaimsResponse> => {
      try {
        const response = await authApi.pub.chive.claiming.getUserClaims({
          status,
          limit,
          cursor: pageParam,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch user claims',
          undefined,
          'pub.chive.claiming.getUserClaims'
        );
      }
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
      try {
        const response = await authApi.pub.chive.claiming.getClaim({ claimId: id });
        return response.data.claim;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch claim',
          undefined,
          'pub.chive.claiming.getClaim'
        );
      }
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

interface UseClaimableEprintsOptions {
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
 * Searches for claimable eprints (imported but not yet claimed).
 *
 * @param options - Search options
 * @returns Infinite query result with claimable eprints
 */
export function useClaimableEprints(options: UseClaimableEprintsOptions = {}) {
  const { q, source, limit = 20, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: claimingKeys.claimable({ q, source }),
    queryFn: async ({ pageParam }): Promise<FindClaimableResponse> => {
      try {
        const response = await authApi.pub.chive.claiming.findClaimable({
          q,
          source,
          limit,
          cursor: pageParam as string | undefined,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to search claimable eprints',
          undefined,
          'pub.chive.claiming.findClaimable'
        );
      }
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
    queryFn: async ({ pageParam }): Promise<GetPendingClaimsResponse> => {
      try {
        const response = await authApi.pub.chive.claiming.getPendingClaims({
          minScore,
          maxScore,
          limit,
          cursor: pageParam as string | undefined,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch pending claims',
          undefined,
          'pub.chive.claiming.getPendingClaims'
        );
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches prefilled submission data for claiming a paper from an external source.
 *
 * @param source - External source (e.g., 'arxiv', 'semanticscholar')
 * @param externalId - Source-specific identifier
 * @returns Query result with prefilled submission data
 */
export function useSubmissionData(source: string, externalId: string) {
  return useQuery({
    queryKey: claimingKeys.submissionData(source, externalId),
    queryFn: async (): Promise<GetSubmissionDataResponse> => {
      try {
        const response = await authApi.pub.chive.claiming.getSubmissionData({
          source,
          externalId,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch submission data',
          undefined,
          'pub.chive.claiming.getSubmissionData'
        );
      }
    },
    enabled: !!source && !!externalId,
    staleTime: 5 * 60 * 1000, // 5 minutes - external data doesn't change often
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Mutation hook to start a claim on an imported eprint.
 *
 * @returns Mutation for starting a claim
 */
export function useStartClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      importId,
    }: {
      importId: number;
    }): Promise<StartClaimResponse['claim']> => {
      try {
        const response = await authApi.pub.chive.claiming.startClaim({ importId });
        return response.data.claim;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to start claim',
          undefined,
          'pub.chive.claiming.startClaim'
        );
      }
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
      try {
        const response = await authApi.pub.chive.claiming.completeClaim(undefined, {
          qp: { claimId, canonicalUri },
        });
        return { success: response.data.success, claimId };
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to complete claim',
          undefined,
          'pub.chive.claiming.completeClaim'
        );
      }
    },
    onSuccess: (result) => {
      // Invalidate the specific claim to refetch updated data
      queryClient.invalidateQueries({ queryKey: claimingKeys.claim(result.claimId) });
      // Invalidate user claims
      queryClient.invalidateQueries({ queryKey: claimingKeys.userClaims() });
      // Invalidate claimable eprints (this one is no longer claimable)
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
      try {
        await authApi.pub.chive.claiming.approveClaim(undefined, { qp: { claimId } });
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to approve claim',
          undefined,
          'pub.chive.claiming.approveClaim'
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
      try {
        await authApi.pub.chive.claiming.rejectClaim({ claimId, reason });
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to reject claim',
          undefined,
          'pub.chive.claiming.rejectClaim'
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
    queryFn: async (): Promise<GetSuggestionsResponse> => {
      try {
        const response = await authApi.pub.chive.claiming.getSuggestions({ limit });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch suggestions',
          undefined,
          'pub.chive.claiming.getSuggestions'
        );
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// =============================================================================
// CO-AUTHOR CLAIM HOOKS
// =============================================================================

interface UseMyCoauthorRequestsOptions {
  /** Filter by status */
  status?: CoauthorClaimStatus;
  /** Number of results per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches co-author requests made by the authenticated user (as claimant).
 *
 * @remarks
 * Shows pending requests to be added as co-author to papers in other users' PDSes.
 *
 * @param options - Query options
 * @returns Query result with co-author requests
 */
export function useMyCoauthorRequests(options: UseMyCoauthorRequestsOptions = {}) {
  const { status, limit = 50, enabled = true } = options;

  return useQuery({
    queryKey: claimingKeys.myCoauthorRequests({ status }),
    queryFn: async (): Promise<GetMyCoauthorRequestsResponse> => {
      try {
        const response = await authApi.pub.chive.claiming.getMyCoauthorRequests({ status, limit });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch co-author requests',
          undefined,
          'pub.chive.claiming.getMyCoauthorRequests'
        );
      }
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

interface UseCoauthorRequestsOptions {
  /** Number of results per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches co-author requests on the authenticated user's eprints (as owner).
 *
 * @remarks
 * Shows pending requests from other users who want to be added as co-authors
 * to eprints in your PDS.
 *
 * @param options - Query options
 * @returns Query result with co-author requests
 */
export function useCoauthorRequests(options: UseCoauthorRequestsOptions = {}) {
  const { limit = 50, enabled = true } = options;

  return useQuery({
    queryKey: claimingKeys.coauthorRequests(),
    queryFn: async (): Promise<GetCoauthorRequestsResponse> => {
      try {
        const response = await authApi.pub.chive.claiming.getCoauthorRequests({ limit });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch co-author requests',
          undefined,
          'pub.chive.claiming.getCoauthorRequests'
        );
      }
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Mutation hook to request co-authorship on another user's paper.
 *
 * @returns Mutation for requesting co-authorship
 */
export function useRequestCoauthorship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eprintUri,
      eprintOwnerDid,
      claimantName,
      authorIndex,
      authorName,
      message,
    }: {
      eprintUri: string;
      eprintOwnerDid: string;
      claimantName: string;
      authorIndex: number;
      authorName: string;
      message?: string;
    }): Promise<CoauthorRequest> => {
      try {
        const response = await authApi.pub.chive.claiming.requestCoauthorship({
          eprintUri,
          eprintOwnerDid,
          claimantName,
          authorIndex,
          authorName,
          message,
        });
        return response.data.request as CoauthorRequest;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to request co-authorship',
          undefined,
          'pub.chive.claiming.requestCoauthorship'
        );
      }
    },
    onSuccess: () => {
      // Invalidate my co-author requests cache
      queryClient.invalidateQueries({ queryKey: claimingKeys.myCoauthorRequests() });
    },
  });
}

/**
 * Mutation hook to approve a co-author request (for eprint owners).
 *
 * @returns Mutation for approving co-authorship
 */
export function useApproveCoauthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: number }): Promise<void> => {
      try {
        await authApi.pub.chive.claiming.approveCoauthor(undefined, { qp: { requestId } });
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to approve co-author',
          undefined,
          'pub.chive.claiming.approveCoauthor'
        );
      }
    },
    onSuccess: () => {
      // Invalidate co-author requests cache
      queryClient.invalidateQueries({ queryKey: claimingKeys.coauthorRequests() });
    },
  });
}

/**
 * Mutation hook to reject a co-author request (for eprint owners).
 *
 * @returns Mutation for rejecting co-authorship
 */
export function useRejectCoauthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: number;
      reason?: string;
    }): Promise<void> => {
      try {
        await authApi.pub.chive.claiming.rejectCoauthor({ requestId, reason });
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to reject co-author',
          undefined,
          'pub.chive.claiming.rejectCoauthor'
        );
      }
    },
    onSuccess: () => {
      // Invalidate co-author requests cache
      queryClient.invalidateQueries({ queryKey: claimingKeys.coauthorRequests() });
    },
  });
}

// =============================================================================
// EXTERNAL PDF FETCH
// =============================================================================

/**
 * Fetches external PDF through proxy endpoint.
 *
 * @remarks
 * Uses the backend proxy to fetch PDFs from external sources to avoid CORS issues.
 * Returns the PDF as a File object that can be used in the submission form.
 *
 * @param source - External source (e.g., 'arxiv', 'semanticscholar')
 * @param externalId - Source-specific identifier
 * @returns File object containing the PDF
 */
export async function fetchExternalPdf(source: string, externalId: string): Promise<File> {
  const agent = getCurrentAgent();
  const headers: HeadersInit = {};

  // Add service auth if authenticated
  if (agent) {
    try {
      const token = await getServiceAuthToken(agent, 'pub.chive.claiming.fetchExternalPdf');
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      claimingLogger.error('Failed to get service auth token for PDF fetch', error, {
        source,
        externalId,
      });
      // Continue without auth - backend will return 401
    }
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/xrpc/pub.chive.claiming.fetchExternalPdf?source=${encodeURIComponent(source)}&externalId=${encodeURIComponent(externalId)}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new APIError(
      errorText || 'Failed to fetch PDF',
      response.status,
      '/xrpc/pub.chive.claiming.fetchExternalPdf'
    );
  }

  const blob = await response.blob();
  const filename = `${source}-${externalId}.pdf`;

  return new File([blob], filename, { type: 'application/pdf' });
}

/**
 * Hook to fetch external PDF for claiming.
 *
 * @param source - External source (e.g., 'arxiv', 'semanticscholar')
 * @param externalId - Source-specific identifier
 * @param options - Query options
 * @returns Query result with PDF File
 */
export function useExternalPdf(
  source: string | undefined,
  externalId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: [...claimingKeys.all, 'pdf', source, externalId],
    queryFn: () => fetchExternalPdf(source!, externalId!),
    enabled: enabled && !!source && !!externalId,
    staleTime: 30 * 60 * 1000, // 30 minutes - PDF won't change
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2, // Limited retries for large file fetches
  });
}
