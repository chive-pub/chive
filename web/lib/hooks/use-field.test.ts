import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import {
  createMockFieldDetail,
  createMockFieldList,
  createMockFieldSummary,
} from '@/tests/mock-data';

import { fieldKeys, useField, useFields, useFieldWithRelations } from './use-field';

// Mock functions using vi.hoisted for proper hoisting
const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockApiGet,
  },
}));

describe('fieldKeys', () => {
  it('generates all key', () => {
    expect(fieldKeys.all).toEqual(['fields']);
  });

  it('generates lists key', () => {
    expect(fieldKeys.lists()).toEqual(['fields', 'list']);
  });

  it('generates list key with params', () => {
    const params = { status: 'established' as const, limit: 10 };
    expect(fieldKeys.list(params)).toEqual(['fields', 'list', params]);
  });

  it('generates details key', () => {
    expect(fieldKeys.details()).toEqual(['fields', 'detail']);
  });

  it('generates detail key for specific ID', () => {
    expect(fieldKeys.detail('machine-learning')).toEqual(['fields', 'detail', 'machine-learning']);
  });

  it('generates children key', () => {
    expect(fieldKeys.children('computer-science')).toEqual([
      'fields',
      'detail',
      'computer-science',
      'children',
    ]);
  });

  it('generates ancestors key', () => {
    expect(fieldKeys.ancestors('machine-learning')).toEqual([
      'fields',
      'detail',
      'machine-learning',
      'ancestors',
    ]);
  });

  it('generates eprints key', () => {
    expect(fieldKeys.eprints('physics')).toEqual(['fields', 'detail', 'physics', 'eprints']);
  });
});

describe('useField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches field by ID', async () => {
    const mockField = createMockFieldDetail();
    mockApiGet.mockResolvedValueOnce({
      data: mockField,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useField('machine-learning'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe(mockField.id);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.getNode', {
      params: {
        query: expect.objectContaining({
          id: 'machine-learning',
          includeEdges: false,
        }),
      },
    });
  });

  it('fetches field with edges', async () => {
    const mockField = createMockFieldDetail();
    mockApiGet.mockResolvedValueOnce({
      data: mockField,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useField('machine-learning', {
          includeEdges: true,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.getNode', {
      params: {
        query: expect.objectContaining({
          id: 'machine-learning',
          includeEdges: true,
        }),
      },
    });
  });

  it('is disabled when ID is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useField(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Field not found' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useField('invalid-field'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Field not found');
  });
});

describe('useFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches field list', async () => {
    const mockFields = createMockFieldList(3);
    const mockResponse = {
      nodes: mockFields.map((f) => ({
        ...f,
        uri: `at://did:plc:gov/pub.chive.graph.node/${f.id}`,
      })),
      cursor: undefined,
      hasMore: false,
      total: 3,
    };
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFields(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.fields).toHaveLength(3);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.listNodes', {
      params: {
        query: expect.objectContaining({
          subkind: 'field',
        }),
      },
    });
  });

  it('fetches fields with status filter', async () => {
    const mockFields = createMockFieldList(2);
    const mockResponse = {
      nodes: mockFields.map((f) => ({
        ...f,
        uri: `at://did:plc:gov/pub.chive.graph.node/${f.id}`,
        status: 'established',
      })),
      cursor: undefined,
      hasMore: false,
      total: 2,
    };
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useFields({
          status: 'established',
          limit: 20,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.listNodes', {
      params: {
        query: expect.objectContaining({
          subkind: 'field',
          status: 'established',
          limit: 20,
        }),
      },
    });
  });
});

describe('useFieldWithRelations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches field with resolved relations', async () => {
    const mockField = createMockFieldDetail();
    mockApiGet.mockResolvedValueOnce({
      data: {
        ...mockField,
        edges: [
          {
            id: 'edge1',
            uri: 'at://test/edge/1',
            sourceUri: mockField.uri,
            targetUri: 'at://did:plc:gov/pub.chive.graph.node/cs',
            relationSlug: 'broader',
            status: 'established',
          },
        ],
      },
      error: undefined,
    });

    // Mock the related node lookup
    mockApiGet.mockResolvedValueOnce({
      data: {
        nodes: [
          {
            id: 'cs',
            uri: 'at://did:plc:gov/pub.chive.graph.node/cs',
            label: 'Computer Science',
            status: 'established',
          },
        ],
        cursor: undefined,
        hasMore: false,
        total: 1,
      },
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFieldWithRelations('machine-learning'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe(mockField.id);
  });

  it('is disabled when ID is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFieldWithRelations('', { enabled: true }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
