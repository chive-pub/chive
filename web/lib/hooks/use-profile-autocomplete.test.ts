import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';

import {
  profileAutocompleteKeys,
  useOrcidAutocomplete,
  useAffiliationAutocomplete,
  useKeywordAutocomplete,
  useAuthorIdDiscovery,
} from './use-profile-autocomplete';

// Mock fetch globally
const mockFetch = vi.fn();

// Mock auth functions for useAuthorIdDiscovery
vi.mock('../auth/oauth-client', () => ({
  getCurrentAgent: vi.fn(),
}));

vi.mock('../auth/service-auth', () => ({
  getServiceAuthToken: vi.fn(),
}));

// Import mocked modules to get references to mock functions
import { getCurrentAgent } from '../auth/oauth-client';
import { getServiceAuthToken } from '../auth/service-auth';

describe('profileAutocompleteKeys', () => {
  it('generates all key', () => {
    expect(profileAutocompleteKeys.all).toEqual(['profile-autocomplete']);
  });

  it('generates orcid key', () => {
    expect(profileAutocompleteKeys.orcid('john smith')).toEqual([
      'profile-autocomplete',
      'orcid',
      'john smith',
    ]);
  });

  it('generates affiliation key', () => {
    expect(profileAutocompleteKeys.affiliation('stanford')).toEqual([
      'profile-autocomplete',
      'affiliation',
      'stanford',
    ]);
  });

  it('generates keyword key', () => {
    expect(profileAutocompleteKeys.keyword('machine learning')).toEqual([
      'profile-autocomplete',
      'keyword',
      'machine learning',
      undefined,
    ]);
  });

  it('generates keyword key with sources', () => {
    expect(profileAutocompleteKeys.keyword('neural', ['fast', 'wikidata'])).toEqual([
      'profile-autocomplete',
      'keyword',
      'neural',
      ['fast', 'wikidata'],
    ]);
  });

  it('generates author-ids key', () => {
    expect(profileAutocompleteKeys.authorIds('Jane Doe')).toEqual([
      'profile-autocomplete',
      'author-ids',
      'Jane Doe',
    ]);
  });
});

describe('useOrcidAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches ORCID suggestions after debounce', async () => {
    const mockResponse = {
      suggestions: [
        {
          orcid: '0000-0002-1825-0097',
          givenNames: 'John',
          familyName: 'Smith',
          affiliation: 'Stanford University',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useOrcidAutocomplete('John Smith', { debounceMs: 10 }), {
      wrapper: Wrapper,
    });

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 2000 }
    );

    expect(result.current.data?.suggestions).toHaveLength(1);
    expect(result.current.data?.suggestions[0].orcid).toBe('0000-0002-1825-0097');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('pub.chive.actor.autocompleteOrcid')
    );
  });

  it('does not fetch for short queries', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useOrcidAutocomplete('J', { debounceMs: 10 }), {
      wrapper: Wrapper,
    });

    // Wait a bit to ensure no fetch was made
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('can be disabled via options', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useOrcidAutocomplete('John Smith', { enabled: false, debounceMs: 10 }),
      { wrapper: Wrapper }
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('useAffiliationAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches affiliation suggestions from ROR', async () => {
    const mockResponse = {
      suggestions: [
        {
          rorId: 'https://ror.org/02mhbdp94',
          name: 'Stanford University',
          country: 'United States',
          types: ['Education'],
          acronym: 'Stanford',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAffiliationAutocomplete('Stanford', { debounceMs: 10 }),
      { wrapper: Wrapper }
    );

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 2000 }
    );

    expect(result.current.data?.suggestions).toHaveLength(1);
    expect(result.current.data?.suggestions[0].name).toBe('Stanford University');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('pub.chive.actor.autocompleteAffiliation')
    );
  });

  it('respects custom minLength', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAffiliationAutocomplete('MI', { minLength: 3, debounceMs: 10 }),
      { wrapper: Wrapper }
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAffiliationAutocomplete('Test', { debounceMs: 10 }), {
      wrapper: Wrapper,
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 2000 }
    );
  });
});

describe('useKeywordAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches keyword suggestions from FAST and Wikidata', async () => {
    const mockResponse = {
      suggestions: [
        {
          id: '12345',
          label: 'Machine learning',
          source: 'fast',
          description: 'Branch of artificial intelligence',
          usageCount: 5000,
        },
        {
          id: 'Q2539',
          label: 'Machine learning',
          source: 'wikidata',
          description: 'Study of algorithms',
          usageCount: null,
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useKeywordAutocomplete('machine', { debounceMs: 10 }), {
      wrapper: Wrapper,
    });

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 2000 }
    );

    expect(result.current.data?.suggestions).toHaveLength(2);
    expect(result.current.data?.suggestions.map((s) => s.source)).toEqual(['fast', 'wikidata']);
  });

  it('includes sources filter in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: [] }),
    });

    const { Wrapper } = createWrapper();
    renderHook(() => useKeywordAutocomplete('neural', { sources: ['fast'], debounceMs: 10 }), {
      wrapper: Wrapper,
    });

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('sources=fast'));
      },
      { timeout: 2000 }
    );
  });
});

describe('useAuthorIdDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    // Set up auth mocks - hook requires authentication
    vi.mocked(getCurrentAgent).mockReturnValue({} as never);
    vi.mocked(getServiceAuthToken).mockResolvedValue('mock-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('discovers author IDs from OpenAlex and Semantic Scholar', async () => {
    const mockResponse = {
      searchedName: 'Jane Doe',
      matches: [
        {
          displayName: 'Jane Doe',
          institution: 'MIT',
          worksCount: 150,
          citedByCount: 5000,
          ids: {
            openalex: 'A123456',
            semanticScholar: 'S789',
            orcid: '0000-0001-2345-6789',
            dblp: 'pid/123/JaneDoe',
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorIdDiscovery('Jane Doe', { debounceMs: 10 }), {
      wrapper: Wrapper,
    });

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 2000 }
    );

    expect(result.current.data?.searchedName).toBe('Jane Doe');
    expect(result.current.data?.matches).toHaveLength(1);
    expect(result.current.data?.matches[0].ids.openalex).toBe('A123456');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('pub.chive.actor.discoverAuthorIds'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    );
  });

  it('fetches after debounce period', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ searchedName: 'Test', matches: [] }),
    });

    const { Wrapper } = createWrapper();
    renderHook(() => useAuthorIdDiscovery('Test User', { debounceMs: 10 }), { wrapper: Wrapper });

    // Wait for debounce and fetch
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('handles empty results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ searchedName: 'Unknown Person', matches: [] }),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAuthorIdDiscovery('Unknown Person', { debounceMs: 10 }),
      { wrapper: Wrapper }
    );

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 2000 }
    );

    expect(result.current.data?.matches).toHaveLength(0);
  });
});
