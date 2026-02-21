/**
 * Unit tests for MLT fallback in DiscoveryService.findRelatedEprints.
 *
 * @remarks
 * Tests that the discovery service correctly falls back to Elasticsearch
 * More Like This when SPECTER2 (via Semantic Scholar) is unavailable,
 * and that MLT scores are weighted at 0.6x relative to SPECTER2.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DiscoveryService } from '../../../../src/services/discovery/discovery-service.js';
import type { AtUri } from '../../../../src/types/atproto.js';
import type { ICitationGraph } from '../../../../src/types/interfaces/discovery.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  IPluginManager,
  IPluginManifest,
} from '../../../../src/types/interfaces/plugin.interface.js';
import type { IRankingService } from '../../../../src/types/interfaces/ranking.interface.js';
import type {
  ISearchEngine,
  MLTResult,
} from '../../../../src/types/interfaces/search.interface.js';
import { mockRecommendations as s2MockRecommendations } from '../../../mocks/semantic-scholar-api.js';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

interface DatabasePool {
  query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

interface MockDatabasePool extends DatabasePool {
  query: ReturnType<typeof vi.fn> & DatabasePool['query'];
}

const createMockDatabasePool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
});

interface MockSearchEngine {
  search: ReturnType<typeof vi.fn>;
  indexEprint: ReturnType<typeof vi.fn>;
  facetedSearch: ReturnType<typeof vi.fn>;
  autocomplete: ReturnType<typeof vi.fn>;
  deleteDocument: ReturnType<typeof vi.fn>;
  findSimilarByText: ReturnType<typeof vi.fn>;
}

const createMockSearchEngine = (): MockSearchEngine => ({
  search: vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0 }),
  indexEprint: vi.fn().mockResolvedValue(undefined),
  facetedSearch: vi.fn().mockResolvedValue({ hits: [], total: 0, facets: {} }),
  autocomplete: vi.fn().mockResolvedValue([]),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  findSimilarByText: vi.fn().mockResolvedValue([]),
});

interface MockRankingService {
  rank: ReturnType<typeof vi.fn>;
  getUserFields: ReturnType<typeof vi.fn>;
  clearCache: ReturnType<typeof vi.fn>;
  clearUserCache: ReturnType<typeof vi.fn>;
}

const createMockRankingService = (): MockRankingService => ({
  rank: vi.fn().mockImplementation((items: readonly unknown[]) =>
    items.map((item, index) => ({
      item,
      score: 1 - index * 0.1,
      fieldMatchScore: 0.5,
      textRelevanceScore: 0.5,
    }))
  ),
  getUserFields: vi.fn().mockResolvedValue([]),
  clearCache: vi.fn(),
  clearUserCache: vi.fn(),
});

interface MockCitationGraph {
  upsertCitationsBatch: ReturnType<typeof vi.fn>;
  getCitingPapers: ReturnType<typeof vi.fn>;
  getReferences: ReturnType<typeof vi.fn>;
  findCoCitedPapers: ReturnType<typeof vi.fn>;
  getCitationCounts: ReturnType<typeof vi.fn>;
  deleteCitationsForPaper: ReturnType<typeof vi.fn>;
  upsertRelatedWorksBatch: ReturnType<typeof vi.fn>;
  deleteRelatedWorksForPaper: ReturnType<typeof vi.fn>;
}

const createMockCitationGraph = (): MockCitationGraph => ({
  upsertCitationsBatch: vi.fn().mockResolvedValue(undefined),
  getCitingPapers: vi.fn().mockResolvedValue({
    citations: [],
    total: 0,
    hasMore: false,
  }),
  getReferences: vi.fn().mockResolvedValue({
    citations: [],
    total: 0,
    hasMore: false,
  }),
  findCoCitedPapers: vi.fn().mockResolvedValue([]),
  getCitationCounts: vi.fn().mockResolvedValue({
    citedByCount: 0,
    referencesCount: 0,
    influentialCitedByCount: 0,
  }),
  deleteCitationsForPaper: vi.fn().mockResolvedValue(undefined),
  upsertRelatedWorksBatch: vi.fn().mockResolvedValue(0),
  deleteRelatedWorksForPaper: vi.fn().mockResolvedValue(undefined),
});

interface MockS2Plugin {
  id: string;
  manifest: IPluginManifest;
  initialize: ReturnType<typeof vi.fn>;
  shutdown: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  getPaperByDoi: ReturnType<typeof vi.fn>;
  getPaperByArxiv: ReturnType<typeof vi.fn>;
  getAuthorByOrcid: ReturnType<typeof vi.fn>;
  getRecommendations: ReturnType<typeof vi.fn>;
  getRecommendationsFromLists: ReturnType<typeof vi.fn>;
  getCitations: ReturnType<typeof vi.fn>;
  getReferences: ReturnType<typeof vi.fn>;
}

const createMockS2Plugin = (): MockS2Plugin => ({
  id: 'pub.chive.plugin.semantic-scholar',
  manifest: {
    id: 'pub.chive.plugin.semantic-scholar',
    name: 'Semantic Scholar',
    version: '1.0.0',
    description: 'Semantic Scholar integration',
    author: 'Chive',
    license: 'MIT',
    permissions: { hooks: [], network: { allowedDomains: ['api.semanticscholar.org'] } },
    entrypoint: 'index.js',
  },
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockReturnValue('running'),
  getPaperByDoi: vi.fn().mockResolvedValue(null),
  getPaperByArxiv: vi.fn().mockResolvedValue(null),
  getAuthorByOrcid: vi.fn().mockResolvedValue(null),
  getRecommendations: vi.fn().mockResolvedValue(s2MockRecommendations),
  getRecommendationsFromLists: vi.fn().mockResolvedValue(s2MockRecommendations),
  getCitations: vi.fn().mockResolvedValue({ citations: [], next: undefined }),
  getReferences: vi.fn().mockResolvedValue({ references: [], next: undefined }),
});

const createMockPluginManager = (s2Plugin?: MockS2Plugin): IPluginManager =>
  ({
    getPlugin: vi.fn((id: string) => {
      if (id === 'pub.chive.plugin.semantic-scholar') return s2Plugin;
      return undefined;
    }),
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    getAllPlugins: vi.fn().mockReturnValue(s2Plugin ? [s2Plugin] : []),
  }) as unknown as IPluginManager;

// ============================================================================
// Sample Data
// ============================================================================

const EPRINT_URI = 'at://did:plc:test/pub.chive.eprint.submission/1' as AtUri;

/**
 * Eprint row without a semantic_scholar_id (will trigger MLT fallback).
 */
const EPRINT_ROW_NO_S2 = {
  uri: EPRINT_URI,
  title: 'A Paper Without S2 ID',
  abstract: 'This paper has no Semantic Scholar identifier.',
  categories: ['cs.CL'],
  doi: null,
  arxiv_id: null,
  publication_date: new Date('2024-06-01'),
  semantic_scholar_id: null,
  openalex_id: null,
};

/**
 * Eprint row with a semantic_scholar_id (will use SPECTER2).
 */
const EPRINT_ROW_WITH_S2 = {
  ...EPRINT_ROW_NO_S2,
  semantic_scholar_id: '649def34f8be52c8b66281af98ae884c09aef38b',
};

/**
 * Sample MLT results returned by the search engine.
 */
const SAMPLE_MLT_RESULTS: MLTResult[] = [
  {
    uri: 'at://did:plc:other/pub.chive.eprint.submission/mlt1' as AtUri,
    score: 15.2,
    title: 'MLT Similar Paper One',
  },
  {
    uri: 'at://did:plc:other/pub.chive.eprint.submission/mlt2' as AtUri,
    score: 9.8,
    title: 'MLT Similar Paper Two',
  },
  {
    uri: 'at://did:plc:other/pub.chive.eprint.submission/mlt3' as AtUri,
    score: 4.5,
    title: 'MLT Similar Paper Three',
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('DiscoveryService MLT fallback', () => {
  let service: DiscoveryService;
  let logger: ILogger;
  let db: MockDatabasePool;
  let searchEngine: MockSearchEngine;
  let ranking: MockRankingService;
  let citationGraph: MockCitationGraph;

  beforeEach(() => {
    logger = createMockLogger();
    db = createMockDatabasePool();
    searchEngine = createMockSearchEngine();
    ranking = createMockRankingService();
    citationGraph = createMockCitationGraph();

    service = new DiscoveryService(
      logger,
      db,
      searchEngine as unknown as ISearchEngine,
      ranking as unknown as IRankingService,
      citationGraph as unknown as ICitationGraph
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findRelatedEprints', () => {
    it('uses SPECTER2 when semantic_scholar_id is present', async () => {
      const s2Plugin = createMockS2Plugin();
      const pluginManager = createMockPluginManager(s2Plugin);
      service.setPluginManager(pluginManager);

      // Return eprint with S2 ID
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_WITH_S2] });

      await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      expect(s2Plugin.getRecommendations).toHaveBeenCalledWith(
        EPRINT_ROW_WITH_S2.semantic_scholar_id,
        { limit: 10 }
      );
      // MLT should NOT be called when SPECTER2 succeeds
      expect(searchEngine.findSimilarByText).not.toHaveBeenCalled();
    });

    it('falls back to ES MLT when no semantic_scholar_id', async () => {
      const s2Plugin = createMockS2Plugin();
      const pluginManager = createMockPluginManager(s2Plugin);
      service.setPluginManager(pluginManager);

      // Return eprint without S2 ID
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });
      searchEngine.findSimilarByText.mockResolvedValueOnce(SAMPLE_MLT_RESULTS);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      // SPECTER2 should NOT be called (no S2 ID)
      expect(s2Plugin.getRecommendations).not.toHaveBeenCalled();

      // ES MLT should be called
      expect(searchEngine.findSimilarByText).toHaveBeenCalledWith(EPRINT_URI, {
        limit: 10,
        minTermFreq: 1,
        minDocFreq: 1,
        maxQueryTerms: 25,
        minimumShouldMatch: '30%',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.relationshipType === 'semantically-similar')).toBe(true);
    });

    it('falls back to ES MLT when SPECTER2 plugin is unavailable', async () => {
      // No plugin manager set at all
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_WITH_S2] });
      searchEngine.findSimilarByText.mockResolvedValueOnce(SAMPLE_MLT_RESULTS);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      // Without plugin manager, no S2 plugin is available, so usedSpecter2 stays false
      expect(searchEngine.findSimilarByText).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });

    it('falls back to ES MLT when SPECTER2 API throws an error', async () => {
      const s2Plugin = createMockS2Plugin();
      s2Plugin.getRecommendations.mockRejectedValueOnce(new Error('S2 API rate limit exceeded'));
      const pluginManager = createMockPluginManager(s2Plugin);
      service.setPluginManager(pluginManager);

      db.query.mockResolvedValue({ rows: [EPRINT_ROW_WITH_S2] });
      searchEngine.findSimilarByText.mockResolvedValueOnce(SAMPLE_MLT_RESULTS);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      // S2 was attempted but failed
      expect(s2Plugin.getRecommendations).toHaveBeenCalled();

      // Fallback to ES MLT
      expect(searchEngine.findSimilarByText).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);

      // Should log the S2 failure
      expect(logger.debug).toHaveBeenCalledWith(
        'S2 recommendations unavailable, falling back to ES MLT',
        expect.objectContaining({
          uri: EPRINT_URI,
          error: 'S2 API rate limit exceeded',
        })
      );
    });

    it('weights MLT scores at 0.6x relative to SPECTER2', async () => {
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });

      // ES saturation normalization produces scores in the 0-1 range
      const mltResults: MLTResult[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint.submission/weighted' as AtUri,
          score: 0.85,
          title: 'Weighted Score Paper',
        },
      ];
      searchEngine.findSimilarByText.mockResolvedValueOnce(mltResults);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      expect(results).toHaveLength(1);

      const result = results[0];
      // MLT score = raw_score * 0.6 (scores already 0-1 via ES saturation)
      // 0.85 * 0.6 = 0.51
      const expectedScore = 0.85 * 0.6;
      expect(result?.score).toBeCloseTo(expectedScore, 5);
      expect(result?.signalScores?.semantic).toBeCloseTo(expectedScore, 5);
    });

    it('applies 0.6 discount to high MLT scores', async () => {
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });

      // Saturation-normalized score near maximum
      const mltResults: MLTResult[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint.submission/capped' as AtUri,
          score: 0.98,
          title: 'Very High Score Paper',
        },
      ];
      searchEngine.findSimilarByText.mockResolvedValueOnce(mltResults);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      expect(results).toHaveLength(1);
      // 0.98 * 0.6 = 0.588
      expect(results[0]?.score).toBeCloseTo(0.98 * 0.6, 5);
    });

    it('handles MLT returning no results gracefully', async () => {
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });
      searchEngine.findSimilarByText.mockResolvedValueOnce([]);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      expect(searchEngine.findSimilarByText).toHaveBeenCalled();
      expect(results).toEqual([]);

      // Debug log should note empty results
      expect(logger.debug).toHaveBeenCalledWith(
        'ES MLT fallback produced results',
        expect.objectContaining({
          uri: EPRINT_URI,
          resultCount: 0,
        })
      );
    });

    it('handles MLT errors gracefully', async () => {
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });
      searchEngine.findSimilarByText.mockRejectedValueOnce(new Error('Elasticsearch unavailable'));

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      // Should not throw; returns empty array since MLT was the only signal
      expect(results).toEqual([]);

      // Should log the MLT failure
      expect(logger.debug).toHaveBeenCalledWith(
        'ES MLT fallback unavailable',
        expect.objectContaining({
          uri: EPRINT_URI,
          error: 'Elasticsearch unavailable',
        })
      );
    });

    it('combines SPECTER2 and MLT results when both sources produce results', async () => {
      // This scenario: S2 fails, so we fall back to MLT. Meanwhile, citations
      // signal is also requested. We verify that citation-based results and MLT
      // results are combined.
      const s2Plugin = createMockS2Plugin();
      // S2 fails, triggering MLT fallback
      s2Plugin.getRecommendations.mockRejectedValueOnce(new Error('S2 unavailable'));
      const pluginManager = createMockPluginManager(s2Plugin);
      service.setPluginManager(pluginManager);

      const citingUri = 'at://did:plc:citing/pub.chive.eprint.submission/1' as AtUri;
      const mltUri = 'at://did:plc:mlt/pub.chive.eprint.submission/1' as AtUri;

      // Return eprint with S2 ID
      db.query.mockResolvedValue({
        rows: [EPRINT_ROW_WITH_S2],
      });

      // Citation signal: one citing paper
      citationGraph.findCoCitedPapers.mockResolvedValueOnce([]);
      citationGraph.getCitingPapers.mockResolvedValueOnce({
        citations: [
          {
            citingUri,
            citedUri: EPRINT_URI,
            isInfluential: true,
            source: 'semantic-scholar' as const,
          },
        ],
        total: 1,
        hasMore: false,
      });
      citationGraph.getReferences.mockResolvedValueOnce({
        citations: [],
        total: 0,
        hasMore: false,
      });

      // MLT fallback: one similar paper
      const mltResults: MLTResult[] = [
        {
          uri: mltUri,
          score: 8.0,
          title: 'MLT Found Paper',
        },
      ];
      searchEngine.findSimilarByText.mockResolvedValueOnce(mltResults);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['citations', 'semantic'],
      });

      // Should have results from both citations and MLT
      const uris = results.map((r) => r.uri);
      expect(uris).toContain(citingUri);
      expect(uris).toContain(mltUri);

      // Verify relationship types
      const citingResult = results.find((r) => r.uri === citingUri);
      const mltResult = results.find((r) => r.uri === mltUri);
      expect(citingResult?.relationshipType).toBe('cited-by');
      expect(mltResult?.relationshipType).toBe('semantically-similar');
    });

    it('does not call MLT when semantic signal is not requested', async () => {
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });

      await service.findRelatedEprints(EPRINT_URI, {
        signals: ['citations'],
      });

      expect(searchEngine.findSimilarByText).not.toHaveBeenCalled();
    });

    it('includes correct explanation for MLT results', async () => {
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });
      searchEngine.findSimilarByText.mockResolvedValueOnce([
        {
          uri: 'at://did:plc:other/pub.chive.eprint.submission/explained' as AtUri,
          score: 7.5,
          title: 'Explained Paper',
        },
      ]);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.explanation).toBe(
        'Similar content based on title, abstract, and keywords'
      );
    });

    it('uses empty string for title when MLT result has no title', async () => {
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });
      searchEngine.findSimilarByText.mockResolvedValueOnce([
        {
          uri: 'at://did:plc:other/pub.chive.eprint.submission/notitle' as AtUri,
          score: 6.0,
          title: undefined,
        },
      ]);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['semantic'],
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('');
    });

    it('does not duplicate URIs between SPECTER2 fallback MLT and other signals', async () => {
      db.query.mockResolvedValue({ rows: [EPRINT_ROW_NO_S2] });

      const sharedUri = 'at://did:plc:other/pub.chive.eprint.submission/shared' as AtUri;

      // Citation signal produces a result with the same URI as MLT
      citationGraph.findCoCitedPapers.mockResolvedValueOnce([
        {
          uri: sharedUri,
          title: 'Shared Paper (from citations)',
          coCitationCount: 3,
          strength: 0.7,
        },
      ]);

      // MLT also returns the same URI
      searchEngine.findSimilarByText.mockResolvedValueOnce([
        {
          uri: sharedUri,
          score: 8.0,
          title: 'Shared Paper (from MLT)',
        },
      ]);

      const results = await service.findRelatedEprints(EPRINT_URI, {
        signals: ['citations', 'semantic'],
      });

      // The shared URI should appear only once (citation signal wins since it was added first)
      const sharedResults = results.filter((r) => r.uri === sharedUri);
      expect(sharedResults).toHaveLength(1);
      expect(sharedResults[0]?.relationshipType).toBe('co-cited');
    });
  });
});
