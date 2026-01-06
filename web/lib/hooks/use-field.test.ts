import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import {
  createMockFieldDetail,
  createMockFieldListResponse,
  createMockFieldSummary,
  createMockPreprintSummary,
} from '@/tests/mock-data';

import { fieldKeys, useField, useFields, useFieldChildren, useFieldPreprints } from './use-field';

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
    const params = { parentId: 'parent', limit: 10 };
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

  it('generates preprints key', () => {
    expect(fieldKeys.preprints('physics')).toEqual(['fields', 'detail', 'physics', 'preprints']);
  });
});

describe('useField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches field by ID', async () => {
    const mockField = createMockFieldDetail();
    mockApiGet.mockResolvedValueOnce({
      data: { field: mockField },
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useField('machine-learning'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockField);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.getField', {
      params: {
        query: expect.objectContaining({
          id: 'machine-learning',
          includeRelationships: false,
          includeChildren: false,
          includeAncestors: false,
        }),
      },
    });
  });

  it('fetches field with relationships', async () => {
    const mockField = createMockFieldDetail();
    mockApiGet.mockResolvedValueOnce({
      data: { field: mockField },
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useField('machine-learning', {
          includeRelationships: true,
          includeChildren: true,
          includeAncestors: true,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.getField', {
      params: {
        query: expect.objectContaining({
          id: 'machine-learning',
          includeRelationships: true,
          includeChildren: true,
          includeAncestors: true,
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
    const mockResponse = createMockFieldListResponse();
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFields(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.listFields', {
      params: { query: expect.objectContaining({}) },
    });
  });

  it('fetches fields with filters', async () => {
    const mockResponse = createMockFieldListResponse();
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useFields({
          parentId: 'computer-science',
          status: 'approved',
          limit: 20,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.listFields', {
      params: {
        query: expect.objectContaining({
          parentId: 'computer-science',
          status: 'approved',
          limit: 20,
        }),
      },
    });
  });
});

describe('useFieldChildren', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches child fields', async () => {
    const mockChildren = [
      createMockFieldSummary({ id: 'ai', name: 'Artificial Intelligence' }),
      createMockFieldSummary({ id: 'databases', name: 'Databases' }),
    ];
    mockApiGet.mockResolvedValueOnce({
      data: { fields: mockChildren },
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFieldChildren('computer-science'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockChildren);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.listFields', {
      params: { query: expect.objectContaining({ parentId: 'computer-science' }) },
    });
  });

  it('is disabled when parentId is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFieldChildren(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useFieldPreprints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches field preprints with pagination', async () => {
    const mockResponse = {
      preprints: [
        createMockPreprintSummary({ uri: 'at://did:plc:test1/pub.chive.preprint.submission/1' }),
        createMockPreprintSummary({ uri: 'at://did:plc:test2/pub.chive.preprint.submission/2' }),
      ],
      cursor: 'next-cursor',
      hasMore: true,
      total: 100,
    };
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFieldPreprints('machine-learning'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0]).toEqual(mockResponse);
    expect(result.current.hasNextPage).toBe(true);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.getFieldPreprints', {
      params: {
        query: expect.objectContaining({
          fieldId: 'machine-learning',
          limit: 10,
        }),
      },
    });
  });

  it('handles custom limit', async () => {
    const mockResponse = {
      preprints: [],
      hasMore: false,
      total: 0,
    };
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFieldPreprints('physics', { limit: 25 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.graph.getFieldPreprints', {
      params: {
        query: expect.objectContaining({
          fieldId: 'physics',
          limit: 25,
        }),
      },
    });
  });

  it('is disabled when fieldId is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFieldPreprints(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
