/**
 * Tests for standard.site document hooks.
 *
 * @packageDocumentation
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  useCreateStandardDocument,
  useUpdateStandardDocument,
  useDualWriteEprint,
  standardDocumentKeys,
} from './use-standard-document';

// =============================================================================
// MOCKS
// =============================================================================

const mockAgent = {
  did: 'did:plc:test123',
  com: {
    atproto: {
      repo: {
        createRecord: vi.fn().mockResolvedValue({
          data: {
            uri: 'at://did:plc:test123/site.standard.document/abc123',
            cid: 'bafydoc123',
          },
        }),
        putRecord: vi.fn().mockResolvedValue({
          data: {
            uri: 'at://did:plc:test123/site.standard.document/abc123',
            cid: 'bafyupdated123',
          },
        }),
        getRecord: vi.fn().mockResolvedValue({
          data: {
            uri: 'at://did:plc:test123/site.standard.document/abc123',
            cid: 'bafyexisting123',
            value: {
              $type: 'site.standard.document',
              title: 'Original Title',
              content: { uri: 'at://did:plc:test123/pub.chive.eprint.submission/eprint123' },
              visibility: 'public',
              createdAt: '2024-01-15T00:00:00.000Z',
            },
          },
        }),
      },
    },
  },
  uploadBlob: vi.fn().mockResolvedValue({
    data: {
      blob: { ref: { $link: 'bafyblob123' }, mimeType: 'application/pdf', size: 1024 },
    },
  }),
};

vi.mock('@/lib/auth/auth-context', () => ({
  useAgent: () => mockAgent,
}));

vi.mock('@/lib/observability', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// =============================================================================
// TEST SETUP
// =============================================================================

function createWrapper(): ({ children }: { children: ReactNode }) => ReactNode {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('standardDocumentKeys', () => {
  it('generates correct query keys', () => {
    expect(standardDocumentKeys.all).toEqual(['standardDocuments']);
    expect(standardDocumentKeys.lists()).toEqual(['standardDocuments', 'list']);
    expect(standardDocumentKeys.detail('at://did:plc:abc/site.standard.document/123')).toEqual([
      'standardDocuments',
      'detail',
      'at://did:plc:abc/site.standard.document/123',
    ]);
  });
});

describe('useCreateStandardDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a standard document record', async () => {
    const { result } = renderHook(() => useCreateStandardDocument(), {
      wrapper: createWrapper(),
    });

    const createResult = await result.current.mutateAsync({
      title: 'Test Paper',
      description: 'Test abstract',
      eprintUri: 'at://did:plc:test123/pub.chive.eprint.submission/eprint123',
      eprintCid: 'bafyeprint123',
    });

    expect(createResult.uri).toContain('site.standard.document');
    expect(createResult.cid).toBeDefined();
    expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'site.standard.document',
      })
    );
  });

  it('returns mutation state', () => {
    const { result } = renderHook(() => useCreateStandardDocument(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(typeof result.current.mutateAsync).toBe('function');
  });
});

describe('useUpdateStandardDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a standard document record', async () => {
    const { result } = renderHook(() => useUpdateStandardDocument(), {
      wrapper: createWrapper(),
    });

    const updateResult = await result.current.mutateAsync({
      uri: 'at://did:plc:test123/site.standard.document/abc123',
      title: 'Updated Title',
    });

    expect(updateResult.uri).toContain('site.standard.document');
    expect(updateResult.cid).toBeDefined();
    expect(mockAgent.com.atproto.repo.getRecord).toHaveBeenCalled();
    expect(mockAgent.com.atproto.repo.putRecord).toHaveBeenCalled();
  });
});

describe('useDualWriteEprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a mutation hook with expected interface', () => {
    const { result } = renderHook(() => useDualWriteEprint(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(typeof result.current.mutateAsync).toBe('function');
  });

  it('has correct mutation options', () => {
    const { result } = renderHook(() => useDualWriteEprint(), {
      wrapper: createWrapper(),
    });

    // Verify the hook returns the expected TanStack Query mutation structure
    expect(result.current).toHaveProperty('mutate');
    expect(result.current).toHaveProperty('mutateAsync');
    expect(result.current).toHaveProperty('reset');
    expect(result.current).toHaveProperty('isPending');
    expect(result.current).toHaveProperty('isSuccess');
    expect(result.current).toHaveProperty('isError');
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('error');
  });
});
