import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';

import { dataLinkKeys, useDataLinks } from './use-data-links';

const { mockListDataLinks } = vi.hoisted(() => ({
  mockListDataLinks: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        eprint: {
          listDataLinks: mockListDataLinks,
        },
      },
    },
  },
}));

const EPRINT_URI = 'at://did:plc:author/pub.chive.eprint.submission/abc123';

describe('dataLinkKeys', () => {
  it('scopes the key by eprint so two papers do not share a cache entry', () => {
    expect(dataLinkKeys.forEprint(EPRINT_URI)).not.toEqual(dataLinkKeys.forEprint('at://other'));
  });

  it('nests under the shared prefix so the whole namespace can be invalidated', () => {
    expect(dataLinkKeys.forEprint(EPRINT_URI).slice(0, 1)).toEqual(dataLinkKeys.all);
  });
});

describe('useDataLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the links Layers reported', async () => {
    mockListDataLinks.mockResolvedValue({
      data: {
        dataLinks: [
          {
            uri: 'at://did:plc:author/pub.layers.eprint.dataLink/1',
            dataKind: 'corpus',
            paperSection: 'Table 3',
          },
        ],
        source: 'layers',
      },
    });

    const { result } = renderHook(() => useDataLinks(EPRINT_URI), {
      wrapper: createWrapper().Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.dataLinks).toHaveLength(1);
    expect(result.current.source).toBe('layers');
  });

  it('reports an empty list without a source until the query resolves', () => {
    mockListDataLinks.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDataLinks(EPRINT_URI), {
      wrapper: createWrapper().Wrapper,
    });

    expect(result.current.dataLinks).toEqual([]);
    expect(result.current.source).toBeUndefined();
  });

  it('distinguishes an unreachable Layers from a paper with no datasets', async () => {
    mockListDataLinks.mockResolvedValue({ data: { dataLinks: [], source: 'unavailable' } });

    const { result } = renderHook(() => useDataLinks(EPRINT_URI), {
      wrapper: createWrapper().Wrapper,
    });

    await waitFor(() => expect(result.current.source).toBe('unavailable'));
    expect(result.current.dataLinks).toEqual([]);
  });

  it('does not ask Layers before the eprint URI is known', () => {
    renderHook(() => useDataLinks(undefined), { wrapper: createWrapper().Wrapper });

    expect(mockListDataLinks).not.toHaveBeenCalled();
  });

  it('does not retry a federated read the server already gave up on', async () => {
    mockListDataLinks.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDataLinks(EPRINT_URI), {
      wrapper: createWrapper().Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListDataLinks).toHaveBeenCalledTimes(1);
    expect(result.current.dataLinks).toEqual([]);
  });
});
