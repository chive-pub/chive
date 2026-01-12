/**
 * Mock service factories for integration tests.
 *
 * @remarks
 * Provides mock implementations of services required for ServerConfig.
 * These mocks allow testing API endpoints without real database connections.
 *
 * @packageDocumentation
 */

import { vi } from 'vitest';

import type { ServerConfig } from '@/api/server.js';
import type { BlobProxyService } from '@/services/blob-proxy/proxy-service.js';
import type { KnowledgeGraphService } from '@/services/knowledge-graph/graph-service.js';
import type { MetricsService } from '@/services/metrics/metrics-service.js';
import { NoOpRelevanceLogger } from '@/services/search/relevance-logger.js';
import type { SearchService } from '@/services/search/search-service.js';
import type {
  IAuthorizationService,
  Role,
  Permission,
} from '@/types/interfaces/authorization.interface.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IRepository } from '@/types/interfaces/repository.interface.js';
import type {
  ISearchEngine,
  SearchQuery,
  SearchResults,
  FacetedSearchQuery,
  FacetedSearchResults,
} from '@/types/interfaces/search.interface.js';
import type { IStorageBackend } from '@/types/interfaces/storage.interface.js';

/**
 * Creates a mock authorization service for tests.
 *
 * @remarks
 * By default, returns no roles and denies all permission checks.
 * Override behavior using vi.mocked().
 */
export function createMockAuthzService(): IAuthorizationService {
  return {
    authorize: vi.fn().mockResolvedValue({ allowed: true }),
    assignRole: vi.fn().mockResolvedValue(undefined),
    revokeRole: vi.fn().mockResolvedValue(undefined),
    getRoles: vi.fn().mockResolvedValue([] as Role[]),
    getRoleAssignments: vi.fn().mockResolvedValue([]),
    hasPermission: vi.fn().mockResolvedValue(false),
    getPermissionsForRole: vi.fn().mockResolvedValue([] as Permission[]),
    hasAnyRole: vi.fn().mockResolvedValue(false),
    reloadPolicies: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock alpha application service for tests.
 *
 * @remarks
 * Returns null/none status by default. Override with vi.mocked().
 */
export function createMockAlphaService(): ServerConfig['alphaService'] {
  return {
    apply: vi.fn().mockResolvedValue({
      id: 'test-app-id',
      did: 'did:plc:test123',
      email: 'test@example.com',
      sector: 'academia',
      careerStage: 'postdoc',
      researchField: 'Test Field',
      status: 'pending',
      zulipInvited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getByDid: vi.fn().mockResolvedValue(null),
    getStatus: vi.fn().mockResolvedValue({ status: 'none' }),
  } as unknown as ServerConfig['alphaService'];
}

/**
 * Creates a mock logger for tests.
 */
export function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => createMockLogger(),
  };
}

/**
 * Creates a mock identity resolver.
 */
export function createMockIdentity(
  did = 'did:plc:testuser123',
  pdsUrl = 'https://pds.test.example.com'
): IIdentityResolver {
  return {
    resolveDID: vi.fn().mockResolvedValue({
      id: did,
      alsoKnownAs: ['at://testuser.bsky.social'],
      verificationMethod: [],
    }),
    resolveHandle: vi.fn().mockResolvedValue(did),
    getPDSEndpoint: vi.fn().mockResolvedValue(pdsUrl),
  };
}

/**
 * Creates a mock repository.
 */
export function createMockRepository(): IRepository {
  return {
    getRecord: vi.fn().mockResolvedValue(null),
    listRecords: vi.fn(),
    getBlob: vi.fn().mockResolvedValue(null),
  };
}

/**
 * Creates a mock search engine.
 */
export function createMockSearchEngine(): ISearchEngine {
  return {
    indexEprint: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue({
      hits: [],
      total: 0,
      took: 0,
    } satisfies SearchResults),
    facetedSearch: vi.fn().mockResolvedValue({
      hits: [],
      facets: {},
      total: 0,
      took: 0,
    } satisfies FacetedSearchResults),
    autocomplete: vi.fn().mockResolvedValue([]),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock search service wrapping a search engine.
 */
export function createMockSearchService(searchEngine?: ISearchEngine): SearchService {
  const engine = searchEngine ?? createMockSearchEngine();
  return {
    search: (query: SearchQuery) => engine.search(query),
    facetedSearch: (query: FacetedSearchQuery) => engine.facetedSearch(query),
    autocomplete: vi.fn().mockResolvedValue([]),
  } as unknown as SearchService;
}

/**
 * Creates a mock metrics service.
 */
export function createMockMetricsService(): MetricsService {
  return {
    recordView: vi.fn().mockResolvedValue(undefined),
    recordDownload: vi.fn().mockResolvedValue(undefined),
    recordEndorsement: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({ views: 100, downloads: 20, endorsements: 5 }),
    getTrending: vi.fn().mockResolvedValue({
      eprints: [],
      window: '24h',
      generatedAt: new Date(),
    }),
  } as unknown as MetricsService;
}

/**
 * Creates a mock graph service.
 */
export function createMockGraphService(): KnowledgeGraphService {
  return {
    getField: vi.fn().mockResolvedValue(null),
    getRelatedFields: vi.fn().mockResolvedValue([]),
    getChildFields: vi.fn().mockResolvedValue([]),
    getAncestorPath: vi.fn().mockResolvedValue([]),
    searchAuthorities: vi.fn().mockResolvedValue({
      authorities: [],
      hasMore: false,
      total: 0,
    }),
    browseFaceted: vi.fn().mockResolvedValue({
      eprints: [],
      availableFacets: {},
      hasMore: false,
      total: 0,
    }),
  } as unknown as KnowledgeGraphService;
}

/**
 * Creates a mock blob proxy service.
 */
export function createMockBlobProxyService(): BlobProxyService {
  return {
    getProxiedBlobUrl: vi.fn().mockResolvedValue('https://cdn.chive.example.com/blob/xyz'),
    streamBlob: vi.fn().mockResolvedValue(null),
  } as unknown as BlobProxyService;
}

/**
 * Creates a mock review service.
 */
export function createMockReviewService(): ServerConfig['reviewService'] {
  return {
    getReviews: vi.fn().mockResolvedValue([]),
    getReviewByUri: vi.fn().mockResolvedValue(null),
    getReviewThread: vi.fn().mockResolvedValue([]),
    getEndorsements: vi.fn().mockResolvedValue([]),
    getEndorsementSummary: vi.fn().mockResolvedValue({ total: 0, endorserCount: 0, byType: {} }),
    getEndorsementByUser: vi.fn().mockResolvedValue(null),
    listEndorsementsForEprint: vi.fn().mockResolvedValue({ items: [], hasMore: false, total: 0 }),
  } as unknown as ServerConfig['reviewService'];
}

/**
 * Creates a mock tag manager.
 */
export function createMockTagManager(): ServerConfig['tagManager'] {
  return {
    getTag: vi.fn().mockResolvedValue(null),
    getTagsForRecord: vi.fn().mockResolvedValue([]),
    searchTags: vi.fn().mockResolvedValue([]),
    getTrendingTags: vi.fn().mockResolvedValue([]),
    getTagSuggestions: vi.fn().mockResolvedValue([]),
  } as unknown as ServerConfig['tagManager'];
}

/**
 * Creates a mock backlink service.
 */
export function createMockBacklinkService(): ServerConfig['backlinkService'] {
  return {
    createBacklink: vi.fn().mockResolvedValue({ id: 1 }),
    deleteBacklink: vi.fn().mockResolvedValue(undefined),
    getBacklinks: vi.fn().mockResolvedValue({ backlinks: [], cursor: undefined }),
    getCounts: vi.fn().mockResolvedValue({
      sembleCollections: 0,
      leafletLists: 0,
      whitewindBlogs: 0,
      blueskyShares: 0,
      total: 0,
      updatedAt: new Date(),
    }),
    updateCounts: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerConfig['backlinkService'];
}

/**
 * Creates a mock claiming service.
 */
export function createMockClaimingService(): ServerConfig['claimingService'] {
  return {
    startClaim: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0,
      status: 'pending',
      canonicalUri: null,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
    collectEvidence: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0.5,
      status: 'pending',
      canonicalUri: null,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
    completeClaim: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0.8,
      status: 'approved',
      canonicalUri: 'at://did:plc:test/pub.chive.eprint.submission/123',
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: null,
    }),
    approveClaim: vi.fn().mockResolvedValue(undefined),
    rejectClaim: vi.fn().mockResolvedValue(undefined),
    getClaim: vi.fn().mockResolvedValue(null),
    getUserClaims: vi.fn().mockResolvedValue([]),
    findClaimable: vi.fn().mockResolvedValue({ eprints: [], cursor: undefined }),
    getPendingClaims: vi.fn().mockResolvedValue({ claims: [], cursor: undefined }),
  } as unknown as ServerConfig['claimingService'];
}

/**
 * Creates a mock import service.
 */
export function createMockImportService(): ServerConfig['importService'] {
  return {
    exists: vi.fn().mockResolvedValue(false),
    get: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    search: vi.fn().mockResolvedValue({ eprints: [], cursor: undefined }),
    markClaimed: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerConfig['importService'];
}

/**
 * Creates a mock PDS sync service.
 */
export function createMockPDSSyncService(): ServerConfig['pdsSyncService'] {
  return {
    detectStaleRecords: vi.fn().mockResolvedValue([]),
    refreshRecord: vi.fn().mockResolvedValue({
      ok: true,
      value: { refreshed: true, changed: false, previousCID: '', currentCID: '' },
    }),
    checkStaleness: vi.fn().mockResolvedValue({ uri: '', isStale: false, indexedCID: '' }),
    trackPDSUpdate: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  } as unknown as ServerConfig['pdsSyncService'];
}

/**
 * Creates a mock activity service.
 */
export function createMockActivityService(): ServerConfig['activityService'] {
  return {
    logActivity: vi.fn().mockResolvedValue({ ok: true, value: 'mock-activity-id' }),
    correlateWithFirehose: vi.fn().mockResolvedValue({ ok: true, value: null }),
    markFailed: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    timeoutStaleActivities: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
    getActivityFeed: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { activities: [], cursor: null } }),
    getCorrelationMetrics: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getActivity: vi.fn().mockResolvedValue({ ok: true, value: null }),
    batchCorrelate: vi.fn().mockResolvedValue({ ok: true, value: new Map() }),
    getPendingCount: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
  } as unknown as ServerConfig['activityService'];
}

/**
 * Creates a mock eprint service.
 */
export function createMockEprintService(): ServerConfig['eprintService'] {
  return {
    getEprint: vi.fn().mockResolvedValue(null),
    getEprintByUri: vi.fn().mockResolvedValue(null),
    listEprints: vi.fn().mockResolvedValue({ eprints: [], cursor: undefined }),
    getEprintsByAuthor: vi.fn().mockResolvedValue({ eprints: [], total: 0 }),
    indexEprint: vi.fn().mockResolvedValue(undefined),
    deleteEprint: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerConfig['eprintService'];
}

/**
 * Creates a no-op relevance logger.
 */
export function createNoOpRelevanceLogger(): NoOpRelevanceLogger {
  return new NoOpRelevanceLogger();
}

/**
 * Creates a mock service auth verifier that accepts test tokens.
 *
 * @remarks
 * Implements IServiceAuthVerifier for proper type safety.
 */
export function createMockServiceAuthVerifier(
  defaultDid = 'did:plc:testuser123'
): import('@/auth/service-auth/index.js').IServiceAuthVerifier {
  return {
    verify: vi.fn().mockImplementation((token: string) => {
      if (token === 'valid-test-token' || token === `token-for-${defaultDid}`) {
        return Promise.resolve({ did: defaultDid, exp: Date.now() + 3600000 });
      }
      if (token.startsWith('token-for-')) {
        const extractedDid = token.replace('token-for-', '');
        return Promise.resolve({ did: extractedDid, exp: Date.now() + 3600000 });
      }
      return Promise.resolve(null);
    }),
  };
}

/**
 * Creates a mock contribution type manager.
 */
export function createMockContributionTypeManager(): ServerConfig['contributionTypeManager'] {
  return {
    listContributionTypes: vi.fn().mockResolvedValue([]),
    getContributionType: vi.fn().mockResolvedValue(null),
    searchContributionTypes: vi.fn().mockResolvedValue([]),
    initializeContributionTypes: vi.fn().mockResolvedValue(undefined),
    createContributionType: vi.fn().mockResolvedValue(undefined),
    updateContributionType: vi.fn().mockResolvedValue(undefined),
    deprecateContributionType: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerConfig['contributionTypeManager'];
}

/**
 * Creates a mock storage backend.
 */
export function createMockStorageBackend(): IStorageBackend {
  return {
    storeEprint: vi.fn().mockResolvedValue(undefined),
    getEprint: vi.fn().mockResolvedValue(null),
    updateEprint: vi.fn().mockResolvedValue(undefined),
    deleteEprint: vi.fn().mockResolvedValue(undefined),
    getEprintsByAuthor: vi.fn().mockResolvedValue({ eprints: [], total: 0 }),
  } as unknown as IStorageBackend;
}
