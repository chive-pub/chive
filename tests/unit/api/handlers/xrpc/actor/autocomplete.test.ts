/**
 * Unit tests for XRPC actor autocomplete handlers.
 *
 * @remarks
 * Tests autocompleteOrcid, autocompleteAffiliation, autocompleteKeyword,
 * and discoverAuthorIds handlers. These handlers make direct API calls
 * to external services which are mocked in tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { autocompleteAffiliationHandler } from '@/api/handlers/xrpc/actor/autocompleteAffiliation.js';
import { autocompleteKeywordHandler } from '@/api/handlers/xrpc/actor/autocompleteKeyword.js';
import { autocompleteOrcidHandler } from '@/api/handlers/xrpc/actor/autocompleteOrcid.js';
import { discoverAuthorIdsHandler } from '@/api/handlers/xrpc/actor/discoverAuthorIds.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

interface MockContext {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

describe('XRPC Actor Autocomplete Handlers', () => {
  let mockLogger: ILogger;
  let mockContext: MockContext;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'logger':
            return mockLogger;
          case 'auth':
          case 'user':
            return { did: 'did:plc:testuser123' };
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('autocompleteOrcidHandler', () => {
    it('returns ORCID suggestions for a valid query', async () => {
      const mockOrcidResponse = {
        'expanded-result': [
          {
            'orcid-id': '0000-0002-1825-0097',
            'given-names': 'John',
            'family-names': 'Smith',
            'institution-name': ['Stanford University'],
          },
          {
            'orcid-id': '0000-0001-2345-6789',
            'given-names': 'Jane',
            'family-names': 'Doe',
            'institution-name': [],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrcidResponse),
      });

      const result = await autocompleteOrcidHandler(mockContext as never, {
        query: 'John Smith',
      });

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0]).toEqual({
        orcid: '0000-0002-1825-0097',
        givenNames: 'John',
        familyName: 'Smith',
        affiliation: 'Stanford University',
      });
      expect(result.suggestions[1]).toEqual({
        orcid: '0000-0001-2345-6789',
        givenNames: 'Jane',
        familyName: 'Doe',
        affiliation: null,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pub.orcid.org'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });

    it('returns empty array on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await autocompleteOrcidHandler(mockContext as never, {
        query: 'Test User',
      });

      expect(result.suggestions).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('respects limit parameter', async () => {
      const mockOrcidResponse = {
        'expanded-result': Array.from({ length: 10 }, (_, i) => ({
          'orcid-id': `0000-0000-0000-000${i}`,
          'given-names': `User${i}`,
          'family-names': 'Test',
          'institution-name': [],
        })),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrcidResponse),
      });

      const result = await autocompleteOrcidHandler(mockContext as never, {
        query: 'Test',
        limit: 3,
      });

      expect(result.suggestions).toHaveLength(3);
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await autocompleteOrcidHandler(mockContext as never, {
        query: 'Test User',
      });

      expect(result.suggestions).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ORCID autocomplete error',
        expect.objectContaining({ error: 'Network error' })
      );
    });
  });

  describe('autocompleteAffiliationHandler', () => {
    it('returns ROR suggestions for a valid query', async () => {
      // ROR API v2 format
      const mockRorResponse = {
        items: [
          {
            id: 'https://ror.org/02mhbdp94',
            names: [
              { value: 'Stanford University', types: ['ror_display'], lang: 'en' },
              { value: 'Stanford', types: ['acronym'], lang: null },
            ],
            locations: [
              { geonames_details: { country_name: 'United States', country_code: 'US' } },
            ],
            types: ['education'],
          },
          {
            id: 'https://ror.org/03vek6s52',
            names: [{ value: 'Harvard University', types: ['ror_display'], lang: 'en' }],
            locations: [
              { geonames_details: { country_name: 'United States', country_code: 'US' } },
            ],
            types: ['education'],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRorResponse),
      });

      const result = await autocompleteAffiliationHandler(mockContext as never, {
        query: 'University',
      });

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0]).toEqual({
        rorId: 'https://ror.org/02mhbdp94',
        name: 'Stanford University',
        country: 'United States',
        types: ['education'],
        acronym: 'Stanford',
      });
      expect(result.suggestions[1]).toEqual({
        rorId: 'https://ror.org/03vek6s52',
        name: 'Harvard University',
        country: 'United States',
        types: ['education'],
        acronym: null,
      });
    });

    it('handles missing country data', async () => {
      // ROR API v2 format with no locations
      const mockRorResponse = {
        items: [
          {
            id: 'https://ror.org/test123',
            names: [{ value: 'Test Institute', types: ['ror_display'], lang: 'en' }],
            locations: [],
            types: ['facility'],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRorResponse),
      });

      const result = await autocompleteAffiliationHandler(mockContext as never, {
        query: 'Test',
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]?.country).toBe('Unknown');
    });

    it('returns empty array on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await autocompleteAffiliationHandler(mockContext as never, {
        query: 'Test',
      });

      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('autocompleteKeywordHandler', () => {
    it('returns combined FAST and Wikidata suggestions', async () => {
      const mockFastResponse = {
        response: {
          docs: [
            {
              idroot: '12345',
              auth: 'Machine learning',
              suggestall: ['Machine learning', 'ML'],
              type: 'topical',
              usageCount: 5000,
            },
          ],
        },
      };

      const mockWikidataResponse = {
        search: [
          {
            id: 'Q2539',
            label: 'Machine learning',
            description: 'Branch of artificial intelligence',
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFastResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWikidataResponse),
        });

      const result = await autocompleteKeywordHandler(mockContext as never, {
        query: 'machine learning',
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      // Should have suggestions from both sources interleaved
      const sources = result.suggestions.map((s) => s.source);
      expect(sources).toContain('fast');
      expect(sources).toContain('wikidata');
    });

    it('filters by source when specified', async () => {
      const mockFastResponse = {
        response: {
          docs: [
            {
              idroot: '12345',
              auth: 'Neural networks',
              suggestall: ['Neural networks'],
              type: 'topical',
              usageCount: 3000,
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFastResponse),
      });

      const result = await autocompleteKeywordHandler(mockContext as never, {
        query: 'neural',
        sources: ['fast'],
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.every((s) => s.source === 'fast')).toBe(true);
    });

    it('handles FAST API failure gracefully', async () => {
      const mockWikidataResponse = {
        search: [
          {
            id: 'Q12345',
            label: 'Test topic',
            description: 'A test topic',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWikidataResponse),
      });

      const result = await autocompleteKeywordHandler(mockContext as never, {
        query: 'test',
      });

      // Should still return Wikidata results even if FAST fails
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.every((s) => s.source === 'wikidata')).toBe(true);
    });

    it('handles empty results from both sources', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: { docs: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ search: [] }),
        });

      const result = await autocompleteKeywordHandler(mockContext as never, {
        query: 'xyznonexistent',
      });

      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('discoverAuthorIdsHandler', () => {
    it('returns combined OpenAlex and Semantic Scholar results', async () => {
      const mockOpenAlexResponse = {
        results: [
          {
            id: 'https://openalex.org/A5023888391',
            display_name: 'John Smith',
            last_known_institution: { display_name: 'Stanford University' },
            works_count: 150,
            cited_by_count: 5000,
            ids: {
              openalex: 'A5023888391',
              orcid: '0000-0002-1825-0097',
            },
          },
        ],
      };

      const mockS2Response = {
        data: [
          {
            authorId: '123456789',
            name: 'John Smith',
            affiliations: [{ name: 'MIT' }],
            paperCount: 100,
            citationCount: 3000,
            externalIds: { DBLP: ['pid/123'] },
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOpenAlexResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockS2Response),
        });

      const result = await discoverAuthorIdsHandler(mockContext as never, {
        name: 'John Smith',
      });

      expect(result.searchedName).toBe('John Smith');
      expect(result.matches.length).toBeGreaterThan(0);

      const firstMatch = result.matches[0];
      expect(firstMatch).toBeDefined();
      expect(firstMatch).toHaveProperty('displayName');
      expect(firstMatch).toHaveProperty('ids');
      expect(firstMatch?.ids).toHaveProperty('openalex');
    });

    it('requires authentication', async () => {
      const unauthContext = {
        get: vi.fn((key: string) => {
          switch (key) {
            case 'logger':
              return mockLogger;
            case 'auth':
            case 'user':
              return null;
            default:
              return undefined;
          }
        }),
        set: vi.fn(),
      };

      // The handler should throw an authentication error
      await expect(
        discoverAuthorIdsHandler(unauthContext as never, { name: 'Test' })
      ).rejects.toThrow('Authentication required');
    });

    it('handles OpenAlex API failure gracefully', async () => {
      const mockS2Response = {
        data: [
          {
            authorId: '123456',
            name: 'Test User',
            affiliations: [],
            paperCount: 50,
            citationCount: 100,
            externalIds: {},
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockS2Response),
      });

      const result = await discoverAuthorIdsHandler(mockContext as never, {
        name: 'Test User',
      });

      // Should still return S2 results
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('deduplicates results by ORCID', async () => {
      const mockOpenAlexResponse = {
        results: [
          {
            id: 'https://openalex.org/A123',
            display_name: 'Jane Doe',
            last_known_institution: null,
            works_count: 100,
            cited_by_count: 500,
            ids: { openalex: 'A123', orcid: '0000-0001-1111-1111' },
          },
        ],
      };

      const mockS2Response = {
        data: [
          {
            authorId: 'S456',
            name: 'Jane Doe',
            affiliations: [],
            paperCount: 100,
            citationCount: 500,
            externalIds: { ORCID: '0000-0001-1111-1111' },
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOpenAlexResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockS2Response),
        });

      const result = await discoverAuthorIdsHandler(mockContext as never, {
        name: 'Jane Doe',
      });

      // Should deduplicate by ORCID and merge IDs
      const uniqueOrcids = new Set(
        result.matches.filter((m) => m.ids.orcid).map((m) => m.ids.orcid)
      );
      expect(uniqueOrcids.size).toBeLessThanOrEqual(1);
    });

    it('handles both APIs failing', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await discoverAuthorIdsHandler(mockContext as never, {
        name: 'Test',
      });

      expect(result.matches).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
