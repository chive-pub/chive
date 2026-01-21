/**
 * Type-safe API client mocks for testing.
 *
 * @remarks
 * Provides mock implementations for the XRPC-based API client.
 * The XRPC client uses namespace-based calls like `api.pub.chive.author.getProfile()`.
 *
 * @packageDocumentation
 */

import { vi } from 'vitest';
import type {
  AuthorProfileResponse,
  ListReviewsResponse,
  ListEndorsementsResponse,
  EndorsementSummaryResponse,
  SearchResultsResponse,
  BrowseFacetedResponse,
  GetNodeResponse,
  ListNodesResponse,
  SearchNodesResponse,
  EprintTagsResponse,
  TrendingTagsResponse,
  GetForYouResponse,
  GetSimilarResponse,
  GetCitationsResponse,
  GetEnrichmentResponse,
  GetTrendingResponse,
  ListByAuthorResponse,
} from '@/lib/api/schema';

// =============================================================================
// TYPE UTILITIES
// =============================================================================

/**
 * XRPC response structure.
 */
interface XRPCResponse<T> {
  success: boolean;
  headers: Record<string, string>;
  data: T;
}

/**
 * Error response structure matching XRPC error format.
 */
interface XRPCErrorResponse {
  success: false;
  error: string;
  message: string;
}

// =============================================================================
// MOCK RESPONSE FACTORIES
// =============================================================================

/**
 * Creates a successful XRPC mock response.
 *
 * @param data - Response data
 * @returns Mock response object
 */
export function mockXRPCSuccess<T>(data: T): XRPCResponse<T> {
  return {
    success: true,
    headers: { 'content-type': 'application/json' },
    data,
  };
}

/**
 * Creates an XRPC error response.
 *
 * @param error - Error code
 * @param message - Error message
 * @returns Mock error response
 */
export function mockXRPCError(error: string, message: string): XRPCErrorResponse {
  return {
    success: false,
    error,
    message,
  };
}

// =============================================================================
// OPERATION-SPECIFIC FACTORIES
// =============================================================================

/**
 * Type-safe factory for author profile responses.
 */
export function mockAuthorProfileResponse(
  data: AuthorProfileResponse
): XRPCResponse<AuthorProfileResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for eprint list responses.
 */
export function mockEprintListResponse(
  data: ListByAuthorResponse
): XRPCResponse<ListByAuthorResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for review list responses.
 */
export function mockReviewListResponse(
  data: ListReviewsResponse
): XRPCResponse<ListReviewsResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for endorsement list responses.
 */
export function mockEndorsementListResponse(
  data: ListEndorsementsResponse
): XRPCResponse<ListEndorsementsResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for endorsement summary responses.
 */
export function mockEndorsementSummaryResponse(
  data: EndorsementSummaryResponse
): XRPCResponse<EndorsementSummaryResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for search responses.
 */
export function mockSearchResponse(
  data: SearchResultsResponse
): XRPCResponse<SearchResultsResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for faceted search responses.
 */
export function mockFacetedSearchResponse(
  data: BrowseFacetedResponse
): XRPCResponse<BrowseFacetedResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for node responses.
 */
export function mockNodeResponse(data: GetNodeResponse): XRPCResponse<GetNodeResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for node list responses.
 */
export function mockNodeListResponse(data: ListNodesResponse): XRPCResponse<ListNodesResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for node search responses.
 */
export function mockNodeSearchResponse(
  data: SearchNodesResponse
): XRPCResponse<SearchNodesResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for tag list responses.
 */
export function mockTagListResponse(data: EprintTagsResponse): XRPCResponse<EprintTagsResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for trending tags responses.
 */
export function mockTrendingTagsResponse(
  data: TrendingTagsResponse
): XRPCResponse<TrendingTagsResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for discovery recommendations responses.
 */
export function mockDiscoveryForYouResponse(
  data: GetForYouResponse
): XRPCResponse<GetForYouResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for similar papers responses.
 */
export function mockSimilarPapersResponse(
  data: GetSimilarResponse
): XRPCResponse<GetSimilarResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for citations responses.
 */
export function mockCitationsResponse(
  data: GetCitationsResponse
): XRPCResponse<GetCitationsResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for enrichment responses.
 */
export function mockEnrichmentResponse(
  data: GetEnrichmentResponse
): XRPCResponse<GetEnrichmentResponse> {
  return mockXRPCSuccess(data);
}

/**
 * Type-safe factory for trending eprints responses.
 */
export function mockTrendingResponse(data: GetTrendingResponse): XRPCResponse<GetTrendingResponse> {
  return mockXRPCSuccess(data);
}

// =============================================================================
// MOCK API CLIENT
// =============================================================================

/**
 * Creates a namespace method mock.
 * Each namespace method is a vi.fn() that can be configured per-test.
 */
function createNamespaceMocks() {
  return vi.fn().mockResolvedValue({ success: true, headers: {}, data: {} });
}

/**
 * Creates a mock XRPC API client.
 *
 * @remarks
 * The mock client mirrors the namespace structure of the real XRPC client.
 * Use vi.fn() mocking to configure responses per test.
 *
 * @example
 * ```typescript
 * const mockApi = createMockApiClient();
 *
 * // Configure a specific method
 * mockApi.pub.chive.author.getProfile.mockResolvedValueOnce(
 *   mockAuthorProfileResponse({
 *     profile: createMockAuthorProfile(),
 *     metrics: createMockAuthorMetrics(),
 *   })
 * );
 *
 * vi.mock('@/lib/api/client', () => ({
 *   api: mockApi,
 * }));
 * ```
 */
export function createMockApiClient() {
  return {
    pub: {
      chive: {
        author: {
          getProfile: createNamespaceMocks(),
          searchAuthors: createNamespaceMocks(),
          getMetrics: createNamespaceMocks(),
        },
        eprint: {
          getSubmission: createNamespaceMocks(),
          listByAuthor: createNamespaceMocks(),
          searchSubmissions: createNamespaceMocks(),
        },
        review: {
          listForEprint: createNamespaceMocks(),
          listForAuthor: createNamespaceMocks(),
          getThread: createNamespaceMocks(),
        },
        endorsement: {
          listForEprint: createNamespaceMocks(),
          getSummary: createNamespaceMocks(),
          getUserEndorsement: createNamespaceMocks(),
        },
        graph: {
          getNode: createNamespaceMocks(),
          listNodes: createNamespaceMocks(),
          searchNodes: createNamespaceMocks(),
          browseFaceted: createNamespaceMocks(),
          listEdges: createNamespaceMocks(),
          getRelations: createNamespaceMocks(),
        },
        tag: {
          listForEprint: createNamespaceMocks(),
          getTrending: createNamespaceMocks(),
          getDetail: createNamespaceMocks(),
          search: createNamespaceMocks(),
        },
        discovery: {
          getForYou: createNamespaceMocks(),
          getSimilar: createNamespaceMocks(),
          getCitations: createNamespaceMocks(),
          getEnrichment: createNamespaceMocks(),
          getRecommendations: createNamespaceMocks(),
        },
        metrics: {
          getTrending: createNamespaceMocks(),
          getMetrics: createNamespaceMocks(),
          getViewCount: createNamespaceMocks(),
        },
        backlink: {
          list: createNamespaceMocks(),
          getCounts: createNamespaceMocks(),
        },
        governance: {
          getProposal: createNamespaceMocks(),
          listProposals: createNamespaceMocks(),
          listVotes: createNamespaceMocks(),
          getEditorStatus: createNamespaceMocks(),
          listTrustedEditors: createNamespaceMocks(),
        },
        claiming: {
          getClaim: createNamespaceMocks(),
          getSuggestions: createNamespaceMocks(),
          findClaimable: createNamespaceMocks(),
          getCoauthorRequests: createNamespaceMocks(),
        },
        alpha: {
          checkStatus: createNamespaceMocks(),
          apply: createNamespaceMocks(),
        },
        activity: {
          log: createNamespaceMocks(),
          markFailed: createNamespaceMocks(),
          getFeed: createNamespaceMocks(),
        },
        notification: {
          listReviewsOnMyPapers: createNamespaceMocks(),
          listEndorsementsOnMyPapers: createNamespaceMocks(),
        },
        actor: {
          getMyProfile: createNamespaceMocks(),
          getDiscoverySettings: createNamespaceMocks(),
        },
        search: {
          track: createNamespaceMocks(),
        },
        contributionType: {
          list: createNamespaceMocks(),
        },
      },
    },
    com: {
      atproto: {
        repo: {
          listRecords: createNamespaceMocks(),
          getRecord: createNamespaceMocks(),
          createRecord: createNamespaceMocks(),
          putRecord: createNamespaceMocks(),
          deleteRecord: createNamespaceMocks(),
        },
      },
    },
  };
}

/**
 * Creates a mock authenticated API client.
 */
export function createMockAuthApiClient() {
  return createMockApiClient();
}

/**
 * Creates the mock module for @/lib/api/client.
 *
 * @example
 * ```typescript
 * vi.mock('@/lib/api/client', () => createApiClientMock());
 * ```
 */
export function createApiClientMock() {
  return {
    api: createMockApiClient(),
    authApi: createMockAuthApiClient(),
    getApiBaseUrl: () => 'http://localhost:3001',
  };
}
