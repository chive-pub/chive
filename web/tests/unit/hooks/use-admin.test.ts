/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for admin dashboard hooks.
 *
 * @remarks
 * Tests the query key factory, fetch helpers (via queryFn/mutationFn),
 * and hook configurations for the admin dashboard.
 *
 * Hook tests use renderHook with a QueryClient wrapper since TanStack Query
 * hooks require a React context.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks: dependencies that the hooks module imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({
  getApiBaseUrl: () => 'https://api.chive.test',
}));

vi.mock('@/lib/auth/service-auth', () => ({
  getServiceAuthToken: vi.fn().mockResolvedValue('test-service-token'),
}));

vi.mock('@/lib/auth/oauth-client', () => ({
  getCurrentAgent: vi.fn().mockReturnValue({ did: 'did:plc:testadmin' }),
}));

// ---------------------------------------------------------------------------
// Import after mocks are established
// ---------------------------------------------------------------------------

import {
  adminKeys,
  useAdminOverview,
  useSystemHealth,
  usePrometheusMetrics,
  useAdminAlphaApplications,
  useAdminAlphaApplication,
  useAdminAlphaStats,
  useUpdateAlphaApplication,
  useAdminUserSearch,
  useAdminUserDetail,
  useAssignRole,
  useRevokeRole,
  useAdminEprints,
  useAdminReviews,
  useAdminEndorsements,
  useDeleteContent,
  useFirehoseStatus,
  useAdminDLQEntries,
  useRetryDLQEntry,
  useRetryAllDLQ,
  useDismissDLQEntry,
  usePurgeOldDLQ,
  useBackfillStatus,
  useTriggerBackfill,
  useTriggerGovernanceSync,
  useCancelBackfill,
  useAdminPDSes,
  useRescanPDS,
  useAdminGraphStats,
  useAdminMetricsOverview,
  useSearchAnalytics,
  useEndpointMetrics,
  useNodeMetrics,
  useAdminAuditLog,
  useAdminWarnings,
  useAdminViolations,
} from '@/lib/hooks/use-admin';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function mockFetchResponse(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: vi.fn().mockResolvedValue(body),
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminKeys', () => {
  it('produces hierarchical cache keys', () => {
    expect(adminKeys.all).toEqual(['admin']);
    expect(adminKeys.overview()).toEqual(['admin', 'overview']);
    expect(adminKeys.health()).toEqual(['admin', 'health']);
    expect(adminKeys.prometheus()).toEqual(['admin', 'prometheus']);
  });

  it('produces alpha sub-keys', () => {
    expect(adminKeys.alpha()).toEqual(['admin', 'alpha']);
    expect(adminKeys.alphaList('pending')).toEqual(['admin', 'alpha', 'list', 'pending']);
    expect(adminKeys.alphaList()).toEqual(['admin', 'alpha', 'list', undefined]);
    expect(adminKeys.alphaDetail('did:plc:abc')).toEqual([
      'admin',
      'alpha',
      'detail',
      'did:plc:abc',
    ]);
    expect(adminKeys.alphaStats()).toEqual(['admin', 'alpha', 'stats']);
  });

  it('produces user sub-keys', () => {
    expect(adminKeys.users()).toEqual(['admin', 'users']);
    expect(adminKeys.userSearch('alice')).toEqual(['admin', 'users', 'search', 'alice']);
    expect(adminKeys.userDetail('did:plc:xyz')).toEqual([
      'admin',
      'users',
      'detail',
      'did:plc:xyz',
    ]);
  });

  it('produces content sub-keys with filters', () => {
    expect(adminKeys.content()).toEqual(['admin', 'content']);
    const filters = { status: 'flagged' };
    expect(adminKeys.eprints(filters)).toEqual(['admin', 'content', 'eprints', filters]);
    expect(adminKeys.reviews(filters)).toEqual(['admin', 'content', 'reviews', filters]);
    expect(adminKeys.endorsements(filters)).toEqual(['admin', 'content', 'endorsements', filters]);
  });

  it('produces firehose sub-keys', () => {
    expect(adminKeys.firehose()).toEqual(['admin', 'firehose']);
    const dlqFilters = { collection: 'pub.chive.eprint.submission' };
    expect(adminKeys.dlq(dlqFilters)).toEqual(['admin', 'firehose', 'dlq', dlqFilters]);
  });

  it('produces backfill key', () => {
    expect(adminKeys.backfill()).toEqual(['admin', 'backfill']);
  });

  it('produces PDS sub-keys', () => {
    expect(adminKeys.pds()).toEqual(['admin', 'pds']);
    expect(adminKeys.pdsList({ status: 'active' })).toEqual([
      'admin',
      'pds',
      'list',
      { status: 'active' },
    ]);
    expect(adminKeys.imports({ source: 'arxiv' })).toEqual([
      'admin',
      'pds',
      'imports',
      { source: 'arxiv' },
    ]);
  });

  it('produces graph key', () => {
    expect(adminKeys.graph()).toEqual(['admin', 'graph']);
  });

  it('produces metrics sub-keys', () => {
    expect(adminKeys.metrics()).toEqual(['admin', 'metrics']);
    expect(adminKeys.metricsOverview('7d')).toEqual(['admin', 'metrics', 'overview', '7d']);
    expect(adminKeys.searchAnalytics('24h')).toEqual(['admin', 'metrics', 'search', '24h']);
    expect(adminKeys.activityCorrelation('1h')).toEqual(['admin', 'metrics', 'activity', '1h']);
    expect(adminKeys.trendingVelocity('7d')).toEqual(['admin', 'metrics', 'trending', '7d']);
    expect(adminKeys.viewDownloads('at://did:plc:test/sub/rkey', 'hour')).toEqual([
      'admin',
      'metrics',
      'viewDownloads',
      'at://did:plc:test/sub/rkey',
      'hour',
    ]);
    expect(adminKeys.endpoints()).toEqual(['admin', 'metrics', 'endpoints']);
    expect(adminKeys.nodeMetrics()).toEqual(['admin', 'metrics', 'node']);
  });

  it('produces governance sub-keys', () => {
    expect(adminKeys.governance()).toEqual(['admin', 'governance']);
    expect(adminKeys.auditLog({ action: 'approve' })).toEqual([
      'admin',
      'governance',
      'audit',
      { action: 'approve' },
    ]);
    expect(adminKeys.warnings()).toEqual(['admin', 'governance', 'warnings']);
    expect(adminKeys.violations()).toEqual(['admin', 'governance', 'violations']);
  });
});

// ---------------------------------------------------------------------------
// Query hooks: fetch URL construction, auth, and error handling
// ---------------------------------------------------------------------------

describe('adminFetch (via query hooks)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it('constructs the correct URL with NSID', async () => {
    const mockData = {
      eprints: 5,
      authors: 2,
      reviews: 1,
      endorsements: 0,
      collections: 0,
      tags: 3,
    };
    mockFetchResponse(mockData);

    const { result } = renderHook(() => useAdminOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.chive.test/xrpc/pub.chive.admin.getOverview');
    expect(options.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer test-service-token' })
    );
  });

  it('appends query parameters when status filter is provided', async () => {
    mockFetchResponse({ items: [], total: 0 });

    const { result } = renderHook(() => useAdminAlphaApplications('pending'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('status')).toBe('pending');
  });

  it('omits undefined query parameter values', async () => {
    mockFetchResponse({ items: [], total: 0 });

    const { result } = renderHook(() => useAdminAlphaApplications(undefined), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.has('status')).toBe(false);
  });

  it('throws on non-ok response with server error message', async () => {
    mockFetchResponse({ message: 'Forbidden' }, false, 403);

    const { result } = renderHook(() => useAdminOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Forbidden');
  });

  it('throws generic message when server returns unparseable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('not json')),
      })
    );

    const { result } = renderHook(() => useAdminOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Request failed');
  });

  it('continues without auth when getServiceAuthToken throws', async () => {
    const { getServiceAuthToken } = await import('@/lib/auth/service-auth');
    vi.mocked(getServiceAuthToken).mockRejectedValueOnce(new Error('auth failed'));
    mockFetchResponse({ status: 'healthy', databases: [], uptime: 1000, timestamp: '' });

    const { result } = renderHook(() => useSystemHealth(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('continues without auth when no agent is available', async () => {
    const { getCurrentAgent } = await import('@/lib/auth/oauth-client');
    vi.mocked(getCurrentAgent).mockReturnValueOnce(null);
    mockFetchResponse({ status: 'healthy', databases: [], uptime: 1000, timestamp: '' });

    const { result } = renderHook(() => useSystemHealth(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// adminPost (via mutation hooks)
// ---------------------------------------------------------------------------

describe('adminPost (via mutation hooks)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it('sends POST with JSON body and auth header', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useUpdateAlphaApplication(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ did: 'did:plc:test', action: 'approve' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.chive.test/xrpc/pub.chive.admin.updateAlphaApplication');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({
      did: 'did:plc:test',
      action: 'approve',
    });
    expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((options.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-service-token'
    );
  });

  it('throws on non-ok POST response', async () => {
    mockFetchResponse({ message: 'Not authorized' }, false, 403);

    const { result } = renderHook(() => useRetryDLQEntry(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync({ index: 0 })).rejects.toThrow('Not authorized');
  });
});

// ---------------------------------------------------------------------------
// Query hook configurations (via renderHook)
// ---------------------------------------------------------------------------

describe('useAdminOverview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches from the correct endpoint', async () => {
    mockFetchResponse({
      eprints: 5,
      authors: 2,
      reviews: 1,
      endorsements: 0,
      collections: 0,
      tags: 3,
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://api.chive.test/xrpc/pub.chive.admin.getOverview');
    expect(result.current.data).toEqual({
      eprints: 5,
      authors: 2,
      reviews: 1,
      endorsements: 0,
      collections: 0,
      tags: 3,
    });
  });
});

describe('useAdminAlphaApplications', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes status filter to fetch params', async () => {
    mockFetchResponse({ items: [], total: 0 });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminAlphaApplications('approved'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(new URL(url).searchParams.get('status')).toBe('approved');
  });
});

describe('useAdminEprints', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes string filters to { q: string }', async () => {
    mockFetchResponse({ eprints: [], total: 0 });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminEprints('quantum'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(new URL(url).searchParams.get('q')).toBe('quantum');
  });

  it('stringifies filter values in fetch params', async () => {
    mockFetchResponse({ eprints: [], total: 0 });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminEprints({ status: 'flagged', limit: 10 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('status')).toBe('flagged');
    expect(parsed.searchParams.get('limit')).toBe('10');
  });

  it('omits null and undefined filter values', async () => {
    mockFetchResponse({ eprints: [], total: 0 });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminEprints({ status: null, q: undefined }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.has('status')).toBe(false);
    expect(parsed.searchParams.has('q')).toBe(false);
  });
});

describe('useFirehoseStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches from firehose status endpoint', async () => {
    mockFetchResponse({ cursor: '12345', dlqCount: 3, timestamp: '2024-01-01T00:00:00Z' });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useFirehoseStatus(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://api.chive.test/xrpc/pub.chive.admin.getFirehoseStatus');
  });
});

describe('useAdminMetricsOverview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps period string to days parameter', async () => {
    mockFetchResponse({ trending: [], period: { days: 7, window: '7d' } });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminMetricsOverview('7d'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(new URL(url).searchParams.get('days')).toBe('7');
  });

  it('defaults to 7 days for unknown period', async () => {
    mockFetchResponse({ trending: [], period: { days: 7, window: 'unknown' } });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminMetricsOverview('unknown'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(new URL(url).searchParams.get('days')).toBe('7');
  });
});

describe('useAdminUserSearch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is disabled when query is shorter than 2 characters', async () => {
    mockFetchResponse({ users: [], total: 0 });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminUserSearch('a'), {
      wrapper: createWrapper(queryClient),
    });

    // Should not fire any fetch since it is disabled
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('is enabled when query is at least 2 characters', async () => {
    mockFetchResponse({ users: [], total: 0 });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAdminUserSearch('al'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalled();
  });
});

describe('useAdminDLQEntries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes filters as query params', async () => {
    mockFetchResponse({ entries: [], total: 0 });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () => useAdminDLQEntries({ collection: 'pub.chive.eprint.submission' }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(new URL(url).searchParams.get('collection')).toBe('pub.chive.eprint.submission');
  });
});

// ---------------------------------------------------------------------------
// Mutation hooks: cache invalidation
// ---------------------------------------------------------------------------

describe('mutation cache invalidation', () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it('useUpdateAlphaApplication invalidates alpha and detail keys', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useUpdateAlphaApplication(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ did: 'did:plc:target', action: 'approve' });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.alpha() });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: adminKeys.alphaDetail('did:plc:target'),
    });
  });

  it('useAssignRole invalidates user detail and users list', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useAssignRole(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ did: 'did:plc:user1', role: 'editor' });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: adminKeys.userDetail('did:plc:user1'),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.users() });
  });

  it('useRevokeRole invalidates user detail and users list', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useRevokeRole(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ did: 'did:plc:user2', role: 'admin' });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: adminKeys.userDetail('did:plc:user2'),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.users() });
  });

  it('useDeleteContent invalidates content and overview keys', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useDeleteContent(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      uri: 'at://did:plc:test/pub.chive.eprint.submission/abc',
      collection: 'pub.chive.eprint.submission',
      reason: 'test',
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.content() });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.overview() });
  });

  it('useRetryDLQEntry invalidates firehose key', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useRetryDLQEntry(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ index: 5 });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.firehose() });
  });

  it('useRetryAllDLQ invalidates firehose key', async () => {
    mockFetchResponse({ success: true, retriedCount: 3 });

    const { result } = renderHook(() => useRetryAllDLQ(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ errorType: 'network' });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.firehose() });
  });

  it('useTriggerGovernanceSync invalidates backfill, governance, and graph keys', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useTriggerGovernanceSync(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync();

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.backfill() });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: adminKeys.governance(),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.graph() });
  });

  it('useRescanPDS invalidates PDS key', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useRescanPDS(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ pdsUrl: 'https://pds.example.com' });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.pds() });
  });
});

// ---------------------------------------------------------------------------
// Mutation hooks: endpoint and body verification
// ---------------------------------------------------------------------------

describe('mutation endpoints', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it('useRetryDLQEntry posts to retryDLQEntry', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useRetryDLQEntry(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ index: 5 });

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://api.chive.test/xrpc/pub.chive.admin.retryDLQEntry');
  });

  it('useRetryAllDLQ posts to retryAllDLQ with optional errorType', async () => {
    mockFetchResponse({ success: true, retriedCount: 3 });

    const { result } = renderHook(() => useRetryAllDLQ(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ errorType: 'network' });

    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.chive.test/xrpc/pub.chive.admin.retryAllDLQ');
    expect(JSON.parse(options.body as string)).toEqual({ errorType: 'network' });
  });

  it('useCancelBackfill normalizes input.id to operationId', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useCancelBackfill(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ id: 'op-123' });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({ operationId: 'op-123' });
  });

  it('useCancelBackfill uses operationId directly when provided', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useCancelBackfill(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ operationId: 'op-456' });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({ operationId: 'op-456' });
  });

  it('useRescanPDS posts pdsUrl to rescanPDS', async () => {
    mockFetchResponse({ success: true });

    const { result } = renderHook(() => useRescanPDS(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ pdsUrl: 'https://pds.example.com' });

    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.chive.test/xrpc/pub.chive.admin.rescanPDS');
    expect(JSON.parse(options.body as string)).toEqual({ pdsUrl: 'https://pds.example.com' });
  });
});
