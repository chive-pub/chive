/**
 * Test mocks for Chive frontend.
 *
 * @remarks
 * Provides centralized mock implementations for testing components
 * that interact with ATProto, the API client, and authentication.
 *
 * @packageDocumentation
 */

// ATProto mocks
export {
  createMockAgent,
  createUnauthenticatedMockAgent,
  createMockBlobRef,
  createMockUploadBlobResult,
  createMockCreateRecordResult,
  createMockAgentSession,
  simulateUploadFailure,
  simulateCreateRecordFailure,
  expectUploadBlobCalled,
  expectCreateRecordCalled,
  type MockAgent,
  type MockBlobRef,
  type MockUploadBlobResult,
  type MockCreateRecordResult,
  type MockAgentSession,
} from './atproto';

// API client mocks
export {
  createMockApiClient,
  createMockAuthApiClient,
  createApiClientMock,
  mockApiSuccess,
  mockApiError,
  mockAuthorProfileResponse,
  mockEprintListResponse,
  mockReviewListResponse,
  mockEndorsementListResponse,
  mockEndorsementSummaryResponse,
  mockSearchResponse,
  mockFacetedSearchResponse,
  mockFieldResponse,
  mockFieldListResponse,
  mockTagListResponse,
  mockTrendingTagsResponse,
  mockDiscoveryForYouResponse,
  mockSimilarPapersResponse,
  mockCitationsResponse,
  mockEnrichmentResponse,
  mockBacklinkListResponse,
  mockBacklinkCountsResponse,
  type ApiSuccessResponse,
} from './api-client';

// Auth mocks
export {
  createMockUser,
  createMockSession,
  createMockAuthState,
  createMockAuthContext,
  createUnauthenticatedMockAuthContext,
  createLoadingMockAuthContext,
  createErrorMockAuthContext,
  createMockAuthProvider,
  createAuthMock,
  mockUseAuth,
  mockUseAgent,
  simulateLogin,
  simulateLogout,
  simulateLoginFailure,
  expectLoginCalledWith,
  expectLogoutCalled,
  type MockAuthOptions,
  type MockAuthContextValue,
} from './auth';
