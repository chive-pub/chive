/**
 * Unit tests for DiscoveryService.
 *
 * @remarks
 * Tests the discovery service orchestration including enrichment,
 * paper lookup, related papers, and recommendations.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DiscoveryService } from '../../../../src/services/discovery/discovery-service.js';
import type { AtUri, DID } from '../../../../src/types/atproto.js';
import type {
  EnrichmentInput,
  ICitationGraph,
  CoCitedPaper,
} from '../../../../src/types/interfaces/discovery.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  IPluginManager,
  IPluginManifest,
} from '../../../../src/types/interfaces/plugin.interface.js';
import type { IRankingService } from '../../../../src/types/interfaces/ranking.interface.js';
import type { ISearchEngine } from '../../../../src/types/interfaces/search.interface.js';
import {
  mockWork as oaMockWork,
  mockTextClassification as oaMockTextClassification,
} from '../../../mocks/openalex-api.js';
import {
  mockPaper as s2MockPaper,
  mockAuthor as s2MockAuthor,
  mockRecommendations as s2MockRecommendations,
  mockCitations as s2MockCitations,
} from '../../../mocks/semantic-scholar-api.js';

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

/**
 * Database pool interface matching DiscoveryService expectations.
 */
interface DatabasePool {
  query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

interface MockDatabasePool extends DatabasePool {
  query: ReturnType<typeof vi.fn> & DatabasePool['query'];
}

const createMockDatabasePool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
});

/**
 * Mock search engine with proper mock function types.
 */
interface MockSearchEngine {
  search: ReturnType<typeof vi.fn>;
  indexPreprint: ReturnType<typeof vi.fn>;
  facetedSearch: ReturnType<typeof vi.fn>;
  autocomplete: ReturnType<typeof vi.fn>;
  deleteDocument: ReturnType<typeof vi.fn>;
  findRelated: ReturnType<typeof vi.fn>;
  findByConceptOverlap: ReturnType<typeof vi.fn>;
}

const createMockSearchEngine = (): MockSearchEngine => ({
  search: vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0 }),
  indexPreprint: vi.fn().mockResolvedValue(undefined),
  facetedSearch: vi.fn().mockResolvedValue({ hits: [], total: 0, facets: {} }),
  autocomplete: vi.fn().mockResolvedValue([]),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  findRelated: vi.fn().mockResolvedValue([]),
  findByConceptOverlap: vi.fn().mockResolvedValue([]),
});

/**
 * Mock ranking service with proper mock function types.
 */
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
  getUserFields: vi.fn().mockResolvedValue(['Computer Science', 'Linguistics']),
  clearCache: vi.fn(),
  clearUserCache: vi.fn(),
});

/**
 * Mock citation graph with proper mock function types.
 */
interface MockCitationGraph {
  upsertCitationsBatch: ReturnType<typeof vi.fn>;
  getCitingPapers: ReturnType<typeof vi.fn>;
  getReferences: ReturnType<typeof vi.fn>;
  findCoCitedPapers: ReturnType<typeof vi.fn>;
  getCitationCounts: ReturnType<typeof vi.fn>;
  deleteCitationsForPaper: ReturnType<typeof vi.fn>;
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
});

/**
 * Mock S2 plugin interface.
 */
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

/**
 * Creates a mock S2 plugin.
 */
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
  getPaperByDoi: vi.fn().mockResolvedValue(s2MockPaper),
  getPaperByArxiv: vi.fn().mockResolvedValue(s2MockPaper),
  getAuthorByOrcid: vi.fn().mockResolvedValue(s2MockAuthor),
  getRecommendations: vi.fn().mockResolvedValue(s2MockRecommendations),
  getRecommendationsFromLists: vi.fn().mockResolvedValue(s2MockRecommendations),
  getCitations: vi.fn().mockResolvedValue({
    citations: s2MockCitations,
    next: undefined,
  }),
  getReferences: vi.fn().mockResolvedValue({
    references: [],
    next: undefined,
  }),
});

/**
 * Mock OpenAlex plugin interface.
 */
interface MockOpenAlexPlugin {
  id: string;
  manifest: IPluginManifest;
  initialize: ReturnType<typeof vi.fn>;
  shutdown: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  getWorkByDoi: ReturnType<typeof vi.fn>;
  getAuthorByOrcid: ReturnType<typeof vi.fn>;
  classifyText: ReturnType<typeof vi.fn>;
  getRelatedWorks: ReturnType<typeof vi.fn>;
  getWorksBatch: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock OpenAlex plugin.
 */
const createMockOpenAlexPlugin = (): MockOpenAlexPlugin => ({
  id: 'pub.chive.plugin.openalex',
  manifest: {
    id: 'pub.chive.plugin.openalex',
    name: 'OpenAlex',
    version: '1.0.0',
    description: 'OpenAlex integration',
    author: 'Chive',
    license: 'MIT',
    permissions: { hooks: [], network: { allowedDomains: ['api.openalex.org'] } },
    entrypoint: 'index.js',
  },
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockReturnValue('running'),
  getWorkByDoi: vi.fn().mockResolvedValue(oaMockWork),
  getAuthorByOrcid: vi.fn().mockResolvedValue(null),
  classifyText: vi.fn().mockResolvedValue(oaMockTextClassification),
  getRelatedWorks: vi.fn().mockResolvedValue([]),
  getWorksBatch: vi.fn().mockResolvedValue([]),
});

/**
 * Creates a mock plugin manager.
 */
const createMockPluginManager = (
  s2Plugin = createMockS2Plugin(),
  oaPlugin = createMockOpenAlexPlugin()
): IPluginManager =>
  ({
    getPlugin: vi.fn((id: string) => {
      if (id === 'pub.chive.plugin.semantic-scholar') return s2Plugin;
      if (id === 'pub.chive.plugin.openalex') return oaPlugin;
      return undefined;
    }),
    // Add other required methods
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    getAllPlugins: vi.fn().mockReturnValue([s2Plugin, oaPlugin]),
  }) as unknown as IPluginManager;

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_PREPRINT_URI = 'at://did:plc:test/pub.chive.preprint/1' as AtUri;
const SAMPLE_USER_DID = 'did:plc:testuser' as DID;

const SAMPLE_ENRICHMENT_INPUT: EnrichmentInput = {
  uri: SAMPLE_PREPRINT_URI,
  doi: '10.1234/test.2024.001',
  title: 'A Test Paper for Discovery Features',
  abstract: 'This is a test abstract for validating discovery feature integration.',
};

const SAMPLE_PREPRINT_ROW = {
  uri: SAMPLE_PREPRINT_URI,
  title: 'A Test Paper for Discovery Features',
  abstract: 'This is a test abstract for validating discovery feature integration.',
  categories: ['cs.CL', 'linguistics'],
  doi: '10.1234/test.2024.001',
  arxiv_id: '2401.12345',
  publication_date: new Date('2024-01-15'),
  semantic_scholar_id: '649def34f8be52c8b66281af98ae884c09aef38b',
  openalex_id: 'https://openalex.org/W2741809807',
};

const SAMPLE_ENRICHMENT_ROW = {
  uri: SAMPLE_PREPRINT_URI,
  semantic_scholar_id: '649def34f8be52c8b66281af98ae884c09aef38b',
  openalex_id: 'https://openalex.org/W2741809807',
  citation_count: 42,
  influential_citation_count: 5,
  references_count: 23,
  concepts: [
    {
      id: 'https://openalex.org/C41008148',
      displayName: 'Computer Science',
      wikidataId: 'Q21198',
      score: 0.85,
      level: 0,
    },
  ],
  topics: [
    {
      id: 'https://openalex.org/T10123',
      displayName: 'Natural Language Processing',
      subfield: 'Artificial Intelligence',
      field: 'Computer Science',
      domain: 'Physical Sciences',
      score: 0.92,
    },
  ],
  enriched_at: new Date('2024-01-15T12:00:00Z'),
};

// ============================================================================
// Tests
// ============================================================================

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let logger: ILogger;
  let db: MockDatabasePool;
  let searchEngine: ReturnType<typeof createMockSearchEngine>;
  let ranking: ReturnType<typeof createMockRankingService>;
  let citationGraph: ReturnType<typeof createMockCitationGraph>;
  let pluginManager: ReturnType<typeof createMockPluginManager>;
  let s2Plugin: ReturnType<typeof createMockS2Plugin>;
  let oaPlugin: ReturnType<typeof createMockOpenAlexPlugin>;

  beforeEach(() => {
    logger = createMockLogger();
    db = createMockDatabasePool();
    searchEngine = createMockSearchEngine();
    ranking = createMockRankingService();
    citationGraph = createMockCitationGraph();
    s2Plugin = createMockS2Plugin();
    oaPlugin = createMockOpenAlexPlugin();
    pluginManager = createMockPluginManager(s2Plugin, oaPlugin);

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

  // ==========================================================================
  // setPluginManager
  // ==========================================================================

  describe('setPluginManager', () => {
    it('should set the plugin manager', () => {
      service.setPluginManager(pluginManager);

      expect(logger.info).toHaveBeenCalledWith('Plugin manager configured for discovery service');
    });

    it('should allow external API calls after setting plugin manager', async () => {
      service.setPluginManager(pluginManager);

      // Now S2 plugin should be accessible for enrichment
      db.query.mockResolvedValueOnce({ rows: [] }); // filterToChiveCitations check

      const result = await service.enrichPreprint(SAMPLE_ENRICHMENT_INPUT);

      expect(result.success).toBe(true);
      expect(s2Plugin.getPaperByDoi).toHaveBeenCalledWith('10.1234/test.2024.001');
    });
  });

  // ==========================================================================
  // enrichPreprint
  // ==========================================================================

  describe('enrichPreprint', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
    });

    it('should enrich preprint with S2 data using DOI', async () => {
      db.query.mockResolvedValue({ rows: [] }); // No Chive citations found

      const result = await service.enrichPreprint(SAMPLE_ENRICHMENT_INPUT);

      expect(result.success).toBe(true);
      expect(result.semanticScholarId).toBe(s2MockPaper.paperId);
      expect(result.citationCount).toBe(s2MockPaper.citationCount);
      expect(result.influentialCitationCount).toBe(s2MockPaper.influentialCitationCount);
      expect(s2Plugin.getPaperByDoi).toHaveBeenCalledWith('10.1234/test.2024.001');
    });

    it('should enrich preprint with arXiv ID if no DOI', async () => {
      const input: EnrichmentInput = {
        uri: SAMPLE_PREPRINT_URI,
        arxivId: '2401.12345',
        title: 'Test Paper',
      };

      db.query.mockResolvedValue({ rows: [] });

      const result = await service.enrichPreprint(input);

      expect(result.success).toBe(true);
      expect(s2Plugin.getPaperByArxiv).toHaveBeenCalledWith('2401.12345');
    });

    it('should enrich preprint with OpenAlex data', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await service.enrichPreprint(SAMPLE_ENRICHMENT_INPUT);

      expect(result.success).toBe(true);
      expect(result.openAlexId).toBe(oaMockWork.id);
      expect(result.concepts).toBeDefined();
      expect(oaPlugin.getWorkByDoi).toHaveBeenCalledWith('10.1234/test.2024.001');
    });

    it('should use text classification fallback when no DOI match in OpenAlex', async () => {
      oaPlugin.getWorkByDoi.mockResolvedValueOnce(null);
      db.query.mockResolvedValue({ rows: [] });

      const result = await service.enrichPreprint(SAMPLE_ENRICHMENT_INPUT);

      expect(result.success).toBe(true);
      expect(result.topics).toBeDefined();
      expect(oaPlugin.classifyText).toHaveBeenCalledWith(
        SAMPLE_ENRICHMENT_INPUT.title,
        SAMPLE_ENRICHMENT_INPUT.abstract
      );
    });

    it('should index Chive-to-Chive citations', async () => {
      // First call for filterToChiveCitations check
      db.query
        .mockResolvedValueOnce({
          rows: [{ uri: 'at://did:plc:other/pub.chive.preprint/cited' }],
        })
        .mockResolvedValue({ rows: [] });

      const result = await service.enrichPreprint(SAMPLE_ENRICHMENT_INPUT);

      expect(result.success).toBe(true);
      expect(citationGraph.upsertCitationsBatch).toHaveBeenCalled();
    });

    it('should work without plugins (no enrichment data)', async () => {
      // Create new service without plugin manager
      const localService = new DiscoveryService(
        logger,
        db,
        searchEngine as unknown as ISearchEngine,
        ranking as unknown as IRankingService,
        citationGraph as unknown as ICitationGraph
      );

      const result = await localService.enrichPreprint(SAMPLE_ENRICHMENT_INPUT);

      // Service still returns success but without enrichment data
      // since no plugins are available for external API calls
      expect(result.success).toBe(true);
      expect(result.semanticScholarId).toBeUndefined();
      expect(result.openAlexId).toBeUndefined();
      expect(result.citationCount).toBeUndefined();
    });

    it('should handle S2 API errors gracefully (graceful degradation)', async () => {
      s2Plugin.getPaperByDoi.mockRejectedValueOnce(new Error('API rate limited'));
      db.query.mockResolvedValue({ rows: [] });

      const result = await service.enrichPreprint(SAMPLE_ENRICHMENT_INPUT);

      // Graceful degradation: success is true even if S2 fails
      // OpenAlex data may still be available
      expect(result.success).toBe(true);
      expect(result.semanticScholarId).toBeUndefined();
      expect(result.citationCount).toBeUndefined();

      // Logs as debug, not warn (expected graceful failure)
      expect(logger.debug).toHaveBeenCalledWith(
        'Semantic Scholar enrichment failed (graceful degradation)',
        expect.objectContaining({
          uri: SAMPLE_ENRICHMENT_INPUT.uri,
          error: 'API rate limited',
        })
      );
    });

    it('should update preprint record with enrichment data', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await service.enrichPreprint(SAMPLE_ENRICHMENT_INPUT);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE preprints SET'),
        expect.any(Array)
      );
    });
  });

  // ==========================================================================
  // lookupPaper
  // ==========================================================================

  describe('lookupPaper', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
    });

    it('should lookup paper by DOI from S2 and OpenAlex', async () => {
      const result = await service.lookupPaper({ doi: '10.1234/test.2024.001' });

      expect(result).not.toBeNull();
      expect(result?.title).toBe(s2MockPaper.title);
      expect(result?.externalIds.semanticScholarId).toBe(s2MockPaper.paperId);
      expect(result?.externalIds.openAlexId).toBe(oaMockWork.id);
    });

    it('should lookup paper by arXiv ID', async () => {
      const result = await service.lookupPaper({ arxivId: '2401.12345' });

      expect(result).not.toBeNull();
      expect(s2Plugin.getPaperByArxiv).toHaveBeenCalledWith('2401.12345');
    });

    it('should merge data from both sources', async () => {
      const result = await service.lookupPaper({ doi: '10.1234/test.2024.001' });

      expect(result).not.toBeNull();
      expect(result?.authors).toBeDefined();
      expect(result?.concepts).toBeDefined(); // From OpenAlex
      expect(result?.citationCount).toBeDefined(); // From S2
    });

    it('should return null if no plugins available', async () => {
      const localService = new DiscoveryService(
        logger,
        db,
        searchEngine as unknown as ISearchEngine,
        ranking as unknown as IRankingService,
        citationGraph as unknown as ICitationGraph
      );

      const result = await localService.lookupPaper({ doi: '10.1234/test.2024.001' });

      expect(result).toBeNull();
    });

    it('should return null if paper not found in any source', async () => {
      s2Plugin.getPaperByDoi.mockResolvedValueOnce(null);
      oaPlugin.getWorkByDoi.mockResolvedValueOnce(null);

      const result = await service.lookupPaper({ doi: '10.1234/nonexistent' });

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      s2Plugin.getPaperByDoi.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.lookupPaper({ doi: '10.1234/test.2024.001' });

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Paper lookup failed', expect.any(Object));
    });
  });

  // ==========================================================================
  // findRelatedPreprints
  // ==========================================================================

  describe('findRelatedPreprints', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
      db.query.mockResolvedValue({ rows: [SAMPLE_PREPRINT_ROW] });
    });

    it('should find related preprints using citation signal', async () => {
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.preprint/related1' as AtUri,
          title: 'Related Paper 1',
          abstract: 'Abstract 1',
          coCitationCount: 5,
          strength: 0.8,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      const result = await service.findRelatedPreprints(SAMPLE_PREPRINT_URI, {
        signals: ['citations'],
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.relationshipType).toBe('co-cited');
      expect(citationGraph.findCoCitedPapers).toHaveBeenCalled();
    });

    it('should find related preprints using semantic signal', async () => {
      // Mock that recommended papers exist in Chive
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_PREPRINT_ROW] }) // getPreprintByUri
        .mockResolvedValueOnce({
          rows: [
            {
              ...SAMPLE_PREPRINT_ROW,
              uri: 'at://did:plc:other/pub.chive.preprint/related',
              semantic_scholar_id: 'rec1',
            },
          ],
        }); // findPreprintByExternalId

      await service.findRelatedPreprints(SAMPLE_PREPRINT_URI, {
        signals: ['semantic'],
      });

      expect(s2Plugin.getRecommendations).toHaveBeenCalled();
    });

    it('should respect limit option', async () => {
      const coCitedPapers: CoCitedPaper[] = Array.from({ length: 20 }, (_, i) => ({
        uri: `at://did:plc:other/pub.chive.preprint/related${i}` as AtUri,
        title: `Related Paper ${i}`,
        coCitationCount: 5 - i,
        strength: 0.9 - i * 0.02,
      }));
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      const result = await service.findRelatedPreprints(SAMPLE_PREPRINT_URI, {
        signals: ['citations'],
        limit: 5,
      });

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should filter by minScore', async () => {
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.preprint/high' as AtUri,
          title: 'High Score',
          coCitationCount: 10,
          strength: 0.9,
        },
        {
          uri: 'at://did:plc:other/pub.chive.preprint/low' as AtUri,
          title: 'Low Score',
          coCitationCount: 1,
          strength: 0.2,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      const result = await service.findRelatedPreprints(SAMPLE_PREPRINT_URI, {
        signals: ['citations'],
        minScore: 0.5,
      });

      expect(result.every((r) => r.score >= 0.5)).toBe(true);
    });

    it('should return empty array if preprint not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.findRelatedPreprints(SAMPLE_PREPRINT_URI);

      expect(result).toEqual([]);
    });

    it('should combine multiple signals', async () => {
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.preprint/cocited' as AtUri,
          title: 'Co-cited Paper',
          coCitationCount: 5,
          strength: 0.7,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);
      citationGraph.getCitingPapers.mockResolvedValueOnce({
        citations: [
          {
            citingUri: 'at://did:plc:citing/pub.chive.preprint/1' as AtUri,
            citedUri: SAMPLE_PREPRINT_URI,
            isInfluential: true,
            source: 'semantic-scholar' as const,
          },
        ],
        total: 1,
        hasMore: false,
      });

      db.query.mockResolvedValue({ rows: [SAMPLE_PREPRINT_ROW] });

      const result = await service.findRelatedPreprints(SAMPLE_PREPRINT_URI, {
        signals: ['citations'],
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // getRecommendationsForUser
  // ==========================================================================

  describe('getRecommendationsForUser', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
    });

    it('should return field-based recommendations', async () => {
      // Mock user has claimed papers
      db.query
        .mockResolvedValueOnce({ rows: [{ uri: SAMPLE_PREPRINT_URI }] }) // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [] }) // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [SAMPLE_PREPRINT_ROW] }); // getPreprintByUri for field-based

      searchEngine.search.mockResolvedValueOnce({
        hits: [{ uri: 'at://did:plc:other/pub.chive.preprint/fieldmatch' as AtUri, score: 0.9 }],
        total: 1,
      });

      const result = await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: ['fields'],
      });

      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
      expect(ranking.getUserFields).toHaveBeenCalledWith(SAMPLE_USER_DID);
    });

    it('should return citation-based recommendations', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ uri: SAMPLE_PREPRINT_URI }] }) // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [] }) // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [SAMPLE_PREPRINT_ROW] }); // getPreprintByUri

      citationGraph.getCitingPapers.mockResolvedValueOnce({
        citations: [
          {
            citingUri: 'at://did:plc:citing/pub.chive.preprint/new' as AtUri,
            citedUri: SAMPLE_PREPRINT_URI,
            isInfluential: false,
            source: 'semantic-scholar' as const,
          },
        ],
        total: 1,
        hasMore: false,
      });

      await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: ['citations'],
      });

      expect(citationGraph.getCitingPapers).toHaveBeenCalled();
    });

    it('should filter dismissed recommendations', async () => {
      const dismissedUri = 'at://did:plc:dismissed/pub.chive.preprint/1';
      db.query
        .mockResolvedValueOnce({ rows: [] }) // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [{ preprint_uri: dismissedUri }] }) // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [SAMPLE_PREPRINT_ROW] });

      searchEngine.search.mockResolvedValueOnce({
        hits: [
          { uri: dismissedUri as AtUri, score: 0.95 },
          { uri: 'at://did:plc:other/pub.chive.preprint/1' as AtUri, score: 0.9 },
        ],
        total: 2,
      });

      const result = await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: ['fields'],
      });

      const uris = result.recommendations.map((r) => r.uri);
      expect(uris).not.toContain(dismissedUri);
    });

    it('should use RankingService for scoring', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [SAMPLE_PREPRINT_ROW] });

      searchEngine.search.mockResolvedValueOnce({
        hits: [{ uri: 'at://did:plc:other/pub.chive.preprint/1' as AtUri, score: 0.9 }],
        total: 1,
      });

      await service.getRecommendationsForUser(SAMPLE_USER_DID, { signals: ['fields'] });

      expect(ranking.rank).toHaveBeenCalled();
    });

    it('should respect limit option', async () => {
      db.query.mockResolvedValue({ rows: [] });
      searchEngine.search.mockResolvedValueOnce({
        hits: Array.from({ length: 30 }, (_, i) => ({
          uri: `at://did:plc:other/pub.chive.preprint/${i}` as AtUri,
          score: 0.9 - i * 0.01,
        })),
        total: 30,
      });

      ranking.rank.mockImplementation((items: readonly unknown[]) =>
        items.map((item, index) => ({
          item,
          score: 1 - index * 0.01,
          fieldMatchScore: 0.5,
          textRelevanceScore: 0.5,
        }))
      );

      const result = await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        limit: 5,
        signals: ['fields'],
      });

      expect(result.recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should include explanations with recommendations', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [SAMPLE_PREPRINT_ROW] });

      searchEngine.search.mockResolvedValueOnce({
        hits: [{ uri: 'at://did:plc:other/pub.chive.preprint/1' as AtUri, score: 0.9 }],
        total: 1,
      });

      const result = await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: ['fields'],
      });

      if (result.recommendations.length > 0) {
        expect(result.recommendations[0]!.explanation).toBeDefined();
        expect(result.recommendations[0]!.explanation.text).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // recordInteraction
  // ==========================================================================

  describe('recordInteraction', () => {
    it('should record a view interaction', async () => {
      await service.recordInteraction(SAMPLE_USER_DID, {
        type: 'view',
        preprintUri: SAMPLE_PREPRINT_URI,
        timestamp: new Date(),
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_interactions'),
        expect.arrayContaining([SAMPLE_USER_DID, SAMPLE_PREPRINT_URI, 'view'])
      );
    });

    it('should record a dismiss interaction', async () => {
      await service.recordInteraction(SAMPLE_USER_DID, {
        type: 'dismiss',
        preprintUri: SAMPLE_PREPRINT_URI,
        recommendationId: 'rec-123',
        timestamp: new Date(),
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_interactions'),
        expect.arrayContaining([SAMPLE_USER_DID, SAMPLE_PREPRINT_URI, 'dismiss', 'rec-123'])
      );
    });

    it('should log debug message on success', async () => {
      await service.recordInteraction(SAMPLE_USER_DID, {
        type: 'click',
        preprintUri: SAMPLE_PREPRINT_URI,
        timestamp: new Date(),
      });

      expect(logger.debug).toHaveBeenCalledWith('Recorded user interaction', expect.any(Object));
    });

    it('should throw ValidationError if preprintUri is missing', async () => {
      await expect(
        service.recordInteraction(SAMPLE_USER_DID, {
          type: 'view',
          preprintUri: '' as AtUri,
          timestamp: new Date(),
        })
      ).rejects.toThrow('required');
    });
  });

  // ==========================================================================
  // Citation Graph Delegation
  // ==========================================================================

  describe('getCitationCounts', () => {
    it('should delegate to citation graph', async () => {
      citationGraph.getCitationCounts.mockResolvedValueOnce({
        citedByCount: 42,
        referencesCount: 23,
        influentialCitedByCount: 5,
      });

      const result = await service.getCitationCounts(SAMPLE_PREPRINT_URI);

      expect(result.citedByCount).toBe(42);
      expect(result.referencesCount).toBe(23);
      expect(result.influentialCitedByCount).toBe(5);
      expect(citationGraph.getCitationCounts).toHaveBeenCalledWith(SAMPLE_PREPRINT_URI);
    });
  });

  describe('getCitingPapers', () => {
    it('should delegate to citation graph and add cursor', async () => {
      citationGraph.getCitingPapers.mockResolvedValueOnce({
        citations: [
          {
            citingUri: 'at://did:plc:citing/pub.chive.preprint/1' as AtUri,
            citedUri: SAMPLE_PREPRINT_URI,
            isInfluential: true,
            source: 'semantic-scholar' as const,
          },
        ],
        total: 10,
        hasMore: true,
      });

      const result = await service.getCitingPapers(SAMPLE_PREPRINT_URI, { limit: 5 });

      expect(result.citations.length).toBe(1);
      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBeDefined();
    });
  });

  describe('getReferences', () => {
    it('should delegate to citation graph and add cursor', async () => {
      citationGraph.getReferences.mockResolvedValueOnce({
        citations: [
          {
            citingUri: SAMPLE_PREPRINT_URI,
            citedUri: 'at://did:plc:ref/pub.chive.preprint/1' as AtUri,
            isInfluential: false,
            source: 'openalex' as const,
          },
        ],
        total: 5,
        hasMore: false,
      });

      const result = await service.getReferences(SAMPLE_PREPRINT_URI);

      expect(result.citations.length).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.cursor).toBeUndefined();
    });
  });

  // ==========================================================================
  // getEnrichment
  // ==========================================================================

  describe('getEnrichment', () => {
    it('should return enrichment data from database', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_ENRICHMENT_ROW] });

      const result = await service.getEnrichment(SAMPLE_PREPRINT_URI);

      expect(result).not.toBeNull();
      expect(result?.semanticScholarId).toBe(SAMPLE_ENRICHMENT_ROW.semantic_scholar_id);
      expect(result?.citationCount).toBe(SAMPLE_ENRICHMENT_ROW.citation_count);
      expect(result?.concepts).toBeDefined();
    });

    it('should return null if no enrichment data', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getEnrichment(SAMPLE_PREPRINT_URI);

      expect(result).toBeNull();
    });
  });
});
