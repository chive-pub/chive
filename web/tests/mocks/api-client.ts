/**
 * Type-safe API client mocks for testing.
 *
 * @remarks
 * Provides properly typed mock implementations of the openapi-fetch client.
 * Uses `openapi-typescript-helpers` to extract exact response types from
 * the generated OpenAPI schema, ensuring test mocks match the API contract.
 *
 * @packageDocumentation
 */

import { vi } from 'vitest';
import type { paths, operations } from '@/lib/api/schema.generated';
import type { SuccessResponseJSON } from 'openapi-typescript-helpers';

// =============================================================================
// TYPE UTILITIES
// =============================================================================

/**
 * Extract the HTTP method key from a path's operations.
 */
type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

/**
 * Extract operation from path and method.
 */
type PathOperation<P extends keyof paths, M extends HttpMethod> = paths[P] extends {
  [K in M]: infer Op;
}
  ? Op
  : never;

/**
 * Extract success response type for an operation.
 */
type OperationResponse<Op> = Op extends {
  responses: { 200: { content: { 'application/json': infer R } } };
}
  ? R
  : never;

/**
 * Get the success response type for a path and method.
 */
export type ApiSuccessResponse<
  P extends keyof paths,
  M extends HttpMethod = 'get',
> = OperationResponse<PathOperation<P, M>>;

// =============================================================================
// MOCK RESPONSE FACTORIES
// =============================================================================

/**
 * Error response structure matching API error format.
 */
interface MockErrorResponse {
  error: string;
  message: string;
}

/**
 * Full mock response structure matching openapi-fetch return type.
 */
interface MockFetchResponse<T> {
  data: T;
  error: undefined;
  response: Response;
}

/**
 * Full mock error response structure.
 */
interface MockFetchErrorResponse {
  data: undefined;
  error: MockErrorResponse;
  response: Response;
}

/**
 * Creates a type-safe successful mock response for a specific API path.
 *
 * @typeParam P - The API path (e.g., '/xrpc/pub.chive.author.getProfile')
 * @typeParam M - The HTTP method (defaults to 'get')
 * @param data - Response data matching the API schema
 * @returns Mock response object compatible with openapi-fetch
 *
 * @example
 * ```typescript
 * // Type-safe: data must match GetProfileResponse
 * mockGet.mockResolvedValueOnce(
 *   mockApiSuccess<'/xrpc/pub.chive.author.getProfile'>({
 *     profile: createMockAuthorProfile(),
 *     metrics: createMockAuthorMetrics(),
 *   })
 * );
 * ```
 */
export function mockApiSuccess<P extends keyof paths, M extends HttpMethod = 'get'>(
  data: ApiSuccessResponse<P, M>
): MockFetchResponse<ApiSuccessResponse<P, M>> {
  return {
    data,
    error: undefined,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

/**
 * Creates a mock error response.
 *
 * @param status - HTTP status code
 * @param error - Error type code
 * @param message - Error message
 * @returns Mock error response object
 *
 * @example
 * ```typescript
 * mockGet.mockResolvedValueOnce(
 *   mockApiError(404, 'NotFound', 'Author not found')
 * );
 * ```
 */
export function mockApiError(
  status: number,
  error: string,
  message: string
): MockFetchErrorResponse {
  return {
    data: undefined,
    error: { error, message },
    response: new Response(JSON.stringify({ error, message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

// =============================================================================
// OPERATION-SPECIFIC TYPE-SAFE FACTORIES
// =============================================================================

/**
 * Type-safe factory for author profile responses.
 */
export function mockAuthorProfileResponse(
  data: SuccessResponseJSON<operations['pub_chive_author_getProfile']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_author_getProfile']>> {
  return mockApiSuccess<'/xrpc/pub.chive.author.getProfile'>(data);
}

/**
 * Type-safe factory for eprint list responses.
 */
export function mockEprintListResponse(
  data: SuccessResponseJSON<operations['pub_chive_eprint_listByAuthor']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_eprint_listByAuthor']>> {
  return mockApiSuccess<'/xrpc/pub.chive.eprint.listByAuthor'>(data);
}

/**
 * Type-safe factory for review list responses.
 */
export function mockReviewListResponse(
  data: SuccessResponseJSON<operations['pub_chive_review_listForEprint']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_review_listForEprint']>> {
  return mockApiSuccess<'/xrpc/pub.chive.review.listForEprint'>(data);
}

/**
 * Type-safe factory for endorsement list responses.
 */
export function mockEndorsementListResponse(
  data: SuccessResponseJSON<operations['pub_chive_endorsement_listForEprint']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_endorsement_listForEprint']>> {
  return mockApiSuccess<'/xrpc/pub.chive.endorsement.listForEprint'>(data);
}

/**
 * Type-safe factory for endorsement summary responses.
 */
export function mockEndorsementSummaryResponse(
  data: SuccessResponseJSON<operations['pub_chive_endorsement_getSummary']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_endorsement_getSummary']>> {
  return mockApiSuccess<'/xrpc/pub.chive.endorsement.getSummary'>(data);
}

/**
 * Type-safe factory for search responses.
 */
export function mockSearchResponse(
  data: SuccessResponseJSON<operations['pub_chive_eprint_searchSubmissions']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_eprint_searchSubmissions']>> {
  return mockApiSuccess<'/xrpc/pub.chive.eprint.searchSubmissions'>(data);
}

/**
 * Type-safe factory for faceted search responses.
 */
export function mockFacetedSearchResponse(
  data: SuccessResponseJSON<operations['pub_chive_graph_browseFaceted']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_graph_browseFaceted']>> {
  return mockApiSuccess<'/xrpc/pub.chive.graph.browseFaceted'>(data);
}

/**
 * Type-safe factory for field responses.
 */
export function mockFieldResponse(
  data: SuccessResponseJSON<operations['pub_chive_graph_getField']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_graph_getField']>> {
  return mockApiSuccess<'/xrpc/pub.chive.graph.getField'>(data);
}

/**
 * Type-safe factory for field list responses.
 */
export function mockFieldListResponse(
  data: SuccessResponseJSON<operations['pub_chive_graph_listFields']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_graph_listFields']>> {
  return mockApiSuccess<'/xrpc/pub.chive.graph.listFields'>(data);
}

/**
 * Type-safe factory for tag list responses.
 */
export function mockTagListResponse(
  data: SuccessResponseJSON<operations['pub_chive_tag_listForEprint']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_tag_listForEprint']>> {
  return mockApiSuccess<'/xrpc/pub.chive.tag.listForEprint'>(data);
}

/**
 * Type-safe factory for trending tags responses.
 */
export function mockTrendingTagsResponse(
  data: SuccessResponseJSON<operations['pub_chive_tag_getTrending']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_tag_getTrending']>> {
  return mockApiSuccess<'/xrpc/pub.chive.tag.getTrending'>(data);
}

/**
 * Type-safe factory for discovery recommendations responses.
 */
export function mockDiscoveryForYouResponse(
  data: SuccessResponseJSON<operations['pub_chive_discovery_getForYou']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_discovery_getForYou']>> {
  return mockApiSuccess<'/xrpc/pub.chive.discovery.getForYou'>(data);
}

/**
 * Type-safe factory for similar papers responses.
 */
export function mockSimilarPapersResponse(
  data: SuccessResponseJSON<operations['pub_chive_discovery_getSimilar']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_discovery_getSimilar']>> {
  return mockApiSuccess<'/xrpc/pub.chive.discovery.getSimilar'>(data);
}

/**
 * Type-safe factory for citations responses.
 */
export function mockCitationsResponse(
  data: SuccessResponseJSON<operations['pub_chive_discovery_getCitations']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_discovery_getCitations']>> {
  return mockApiSuccess<'/xrpc/pub.chive.discovery.getCitations'>(data);
}

/**
 * Type-safe factory for enrichment responses.
 */
export function mockEnrichmentResponse(
  data: SuccessResponseJSON<operations['pub_chive_discovery_getEnrichment']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_discovery_getEnrichment']>> {
  return mockApiSuccess<'/xrpc/pub.chive.discovery.getEnrichment'>(data);
}

/**
 * Type-safe factory for backlink list responses.
 */
export function mockBacklinkListResponse(
  data: SuccessResponseJSON<operations['pub_chive_backlink_list']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_backlink_list']>> {
  return mockApiSuccess<'/xrpc/pub.chive.backlink.list'>(data);
}

/**
 * Type-safe factory for backlink counts responses.
 */
export function mockBacklinkCountsResponse(
  data: SuccessResponseJSON<operations['pub_chive_backlink_getCounts']>
): MockFetchResponse<SuccessResponseJSON<operations['pub_chive_backlink_getCounts']>> {
  return mockApiSuccess<'/xrpc/pub.chive.backlink.getCounts'>(data);
}

// =============================================================================
// MOCK API CLIENT
// =============================================================================

/**
 * Creates a mock API client with properly typed methods.
 *
 * @remarks
 * The mock client uses vi.fn() which allows flexible response mocking
 * in tests. Use the type-safe factory functions to create responses.
 *
 * @example
 * ```typescript
 * const mockApi = createMockApiClient();
 *
 * // Use type-safe response factory
 * mockApi.GET.mockResolvedValueOnce(
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
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
    PATCH: vi.fn(),
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
    getBaseUrl: () => 'http://localhost:3001',
  };
}
