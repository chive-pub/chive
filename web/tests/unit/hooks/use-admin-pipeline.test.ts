/**
 * Tests for the admin surface's request pipeline.
 *
 * @remarks
 * The admin endpoints cannot use the generated client — they need a service-auth
 * token scoped to the specific NSID being called — so they build their own
 * requests. These tests pin the part that matters: those requests go through
 * the same instrumented pipeline as every other API call, rather than raw
 * `fetch`, which left admin traffic invisible in tracing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { createWrapper } from '@/tests/test-utils';
import { APIError } from '@/lib/errors';

const { mockInstrumentedFetch, mockCreateInstrumentedFetch, mockGetServiceAuthToken, mockAgent } =
  vi.hoisted(() => {
    const mockInstrumentedFetch = vi.fn();
    return {
      mockInstrumentedFetch,
      mockCreateInstrumentedFetch: vi.fn(
        (_options: { authenticated: boolean }) => mockInstrumentedFetch
      ),
      mockGetServiceAuthToken: vi.fn(),
      mockAgent: { did: 'did:plc:admin' },
    };
  });

vi.mock('@/lib/api/client', () => ({
  createInstrumentedFetch: mockCreateInstrumentedFetch,
  getApiBaseUrl: () => 'https://api.test',
}));

vi.mock('@/lib/auth/service-auth', () => ({
  getServiceAuthToken: mockGetServiceAuthToken,
}));

vi.mock('@/lib/auth/oauth-client', () => ({
  getCurrentAgent: () => mockAgent,
}));

const { useAdminOverview, useAssignRole } = await import('@/lib/hooks/use-admin');

// Captured at module load, before beforeEach clears the mock record.
const pipelineOptions = mockCreateInstrumentedFetch.mock.calls[0]?.[0];

function okResponse(body: unknown) {
  return { json: () => Promise.resolve(body) } as unknown as Response;
}

describe('admin request pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServiceAuthToken.mockResolvedValue('service-token');
    mockInstrumentedFetch.mockResolvedValue(okResponse({ totalEprints: 3 }));
  });

  it('builds its requests on the instrumented pipeline, not raw fetch', () => {
    // This is the whole point: correlation IDs, traceparent, structured logging,
    // Faro reporting and APIError all live in that pipeline.
    expect(pipelineOptions).toEqual({ authenticated: false });
  });

  it('carries a service-auth token scoped to the endpoint being called', async () => {
    const { result } = renderHook(() => useAdminOverview(), { wrapper: createWrapper().Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetServiceAuthToken).toHaveBeenCalledWith(mockAgent, 'pub.chive.admin.getOverview');
    const [, init] = mockInstrumentedFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer service-token');
  });

  it('calls the endpoint named by the NSID', async () => {
    const { result } = renderHook(() => useAdminOverview(), { wrapper: createWrapper().Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = mockInstrumentedFetch.mock.calls[0] as [string];
    expect(url).toBe('https://api.test/xrpc/pub.chive.admin.getOverview');
  });

  it('surfaces the pipeline APIError rather than flattening it to Error', async () => {
    // Callers can branch on status now; before, every failure was a bare Error
    // carrying only a message.
    mockInstrumentedFetch.mockRejectedValue(
      new APIError('Forbidden', 403, '/xrpc/pub.chive.admin.getOverview')
    );

    const { result } = renderHook(() => useAdminOverview(), { wrapper: createWrapper().Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(APIError);
    expect((result.current.error as APIError).statusCode).toBe(403);
  });

  it('sends mutations as JSON through the same pipeline', async () => {
    mockInstrumentedFetch.mockResolvedValue(okResponse({ success: true }));

    const { result } = renderHook(() => useAssignRole(), { wrapper: createWrapper().Wrapper });
    result.current.mutate({ did: 'did:plc:someone', role: 'moderator' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockInstrumentedFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/xrpc/pub.chive.admin.assignRole');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      did: 'did:plc:someone',
      role: 'moderator',
    });
  });
});
