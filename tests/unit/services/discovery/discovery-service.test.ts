/**
 * Unit tests for DiscoveryService.
 *
 * @remarks
 * Tests the discovery service orchestration including enrichment,
 * paper lookup, related papers, and recommendations. Covers the
 * multi-signal paper relatedness system: concept overlap, citation
 * graph (co-citation + bibliographic coupling), author network,
 * weighted scoring, and user recommendation enhancements.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DiscoveryService } from '../../../../src/services/discovery/discovery-service.js';
import type {
  RecommendationService,
  SimilarPaper,
} from '../../../../src/storage/neo4j/recommendations.js';
import type { AtUri, DID } from '../../../../src/types/atproto.js';
import type {
  EnrichmentInput,
  ICitationGraph,
  CoCitedPaper,
  OpenAlexTopicMatch,
  OpenAlexConceptMatch,
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
  indexEprint: ReturnType<typeof vi.fn>;
  facetedSearch: ReturnType<typeof vi.fn>;
  autocomplete: ReturnType<typeof vi.fn>;
  deleteDocument: ReturnType<typeof vi.fn>;
  findRelated: ReturnType<typeof vi.fn>;
  findByConceptOverlap: ReturnType<typeof vi.fn>;
  findSimilarByText: ReturnType<typeof vi.fn>;
}

const createMockSearchEngine = (): MockSearchEngine => ({
  search: vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0 }),
  indexEprint: vi.fn().mockResolvedValue(undefined),
  facetedSearch: vi.fn().mockResolvedValue({ hits: [], total: 0, facets: {} }),
  autocomplete: vi.fn().mockResolvedValue([]),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  findRelated: vi.fn().mockResolvedValue([]),
  findByConceptOverlap: vi.fn().mockResolvedValue([]),
  findSimilarByText: vi.fn().mockResolvedValue([]),
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

/**
 * Mock recommendation engine (Neo4j RecommendationService).
 */
interface MockRecommendationEngine {
  getPersonalized: ReturnType<typeof vi.fn>;
  getTrending: ReturnType<typeof vi.fn>;
  getSimilar: ReturnType<typeof vi.fn>;
  getRecommendedFields: ReturnType<typeof vi.fn>;
}

const createMockRecommendationEngine = (): MockRecommendationEngine => ({
  getPersonalized: vi.fn().mockResolvedValue([]),
  getTrending: vi.fn().mockResolvedValue([]),
  getSimilar: vi.fn().mockResolvedValue([]),
  getRecommendedFields: vi.fn().mockResolvedValue([]),
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

const SAMPLE_EPRINT_URI = 'at://did:plc:test/pub.chive.eprint/1' as AtUri;
const SAMPLE_USER_DID = 'did:plc:testuser' as DID;

const SAMPLE_ENRICHMENT_INPUT: EnrichmentInput = {
  uri: SAMPLE_EPRINT_URI,
  doi: '10.1234/test.2024.001',
  title: 'A Test Paper for Discovery Features',
  abstract: 'This is a test abstract for validating discovery feature integration.',
};

const SAMPLE_EPRINT_ROW = {
  uri: SAMPLE_EPRINT_URI,
  title: 'A Test Paper for Discovery Features',
  abstract: 'This is a test abstract for validating discovery feature integration.',
  categories: ['cs.CL', 'linguistics'],
  doi: '10.1234/test.2024.001',
  arxiv_id: '2401.12345',
  publication_date: new Date('2024-01-15'),
  semantic_scholar_id: '649def34f8be52c8b66281af98ae884c09aef38b',
  openalex_id: 'https://openalex.org/W2741809807',
  authors: [
    { did: 'did:plc:author1', name: 'Alice Researcher' },
    { did: 'did:plc:author2', name: 'Bob Scientist' },
  ],
};

const SAMPLE_ENRICHMENT_ROW = {
  uri: SAMPLE_EPRINT_URI,
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
// Realistic OpenAlex Concept/Topic Data for Multi-Signal Tests
// ============================================================================

const MOCK_CONCEPTS_A: readonly OpenAlexConceptMatch[] = [
  { id: 'C1', displayName: 'Computational Linguistics', score: 0.85, level: 2 },
  { id: 'C2', displayName: 'Natural Language Processing', score: 0.78, level: 2 },
  { id: 'C3', displayName: 'Machine Learning', score: 0.65, level: 1 },
];

const MOCK_CONCEPTS_B: readonly OpenAlexConceptMatch[] = [
  { id: 'C1', displayName: 'Computational Linguistics', score: 0.82, level: 2 },
  { id: 'C4', displayName: 'Speech Recognition', score: 0.72, level: 2 },
];

const MOCK_TOPICS_A: readonly OpenAlexTopicMatch[] = [
  {
    id: 'T1',
    displayName: 'Formal Semantics',
    subfield: 'Semantics',
    field: 'Linguistics',
    domain: 'Social Sciences',
    score: 0.91,
  },
  {
    id: 'T2',
    displayName: 'Discourse Analysis',
    subfield: 'Pragmatics',
    field: 'Linguistics',
    domain: 'Social Sciences',
    score: 0.8,
  },
];

const MOCK_TOPICS_B_SAME_TOPIC: readonly OpenAlexTopicMatch[] = [
  {
    id: 'T1', // Same topic ID as MOCK_TOPICS_A
    displayName: 'Formal Semantics',
    subfield: 'Semantics',
    field: 'Linguistics',
    domain: 'Social Sciences',
    score: 0.88,
  },
];

const MOCK_TOPICS_C_SAME_SUBFIELD: readonly OpenAlexTopicMatch[] = [
  {
    id: 'T5',
    displayName: 'Lexical Semantics',
    subfield: 'Semantics', // Same subfield as MOCK_TOPICS_A
    field: 'Linguistics',
    domain: 'Social Sciences',
    score: 0.85,
  },
];

const MOCK_TOPICS_D_SAME_FIELD: readonly OpenAlexTopicMatch[] = [
  {
    id: 'T6',
    displayName: 'Phonetics',
    subfield: 'Phonology', // Different subfield
    field: 'Linguistics', // Same field as MOCK_TOPICS_A
    domain: 'Social Sciences',
    score: 0.75,
  },
];

const MOCK_TOPICS_E_SAME_DOMAIN: readonly OpenAlexTopicMatch[] = [
  {
    id: 'T7',
    displayName: 'Political Economy',
    subfield: 'Political Science',
    field: 'Economics',
    domain: 'Social Sciences', // Same domain as MOCK_TOPICS_A
    score: 0.7,
  },
];

const MOCK_TOPICS_F_NO_OVERLAP: readonly OpenAlexTopicMatch[] = [
  {
    id: 'T8',
    displayName: 'Quantum Mechanics',
    subfield: 'Quantum Physics',
    field: 'Physics',
    domain: 'Natural Sciences',
    score: 0.9,
  },
];

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

      const result = await service.enrichEprint(SAMPLE_ENRICHMENT_INPUT);

      expect(result.success).toBe(true);
      expect(s2Plugin.getPaperByDoi).toHaveBeenCalledWith('10.1234/test.2024.001');
    });
  });

  // ==========================================================================
  // enrichEprint
  // ==========================================================================

  describe('enrichEprint', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
    });

    it('should enrich eprint with S2 data using DOI', async () => {
      db.query.mockResolvedValue({ rows: [] }); // No Chive citations found

      const result = await service.enrichEprint(SAMPLE_ENRICHMENT_INPUT);

      expect(result.success).toBe(true);
      expect(result.semanticScholarId).toBe(s2MockPaper.paperId);
      expect(result.citationCount).toBe(s2MockPaper.citationCount);
      expect(result.influentialCitationCount).toBe(s2MockPaper.influentialCitationCount);
      expect(s2Plugin.getPaperByDoi).toHaveBeenCalledWith('10.1234/test.2024.001');
    });

    it('should enrich eprint with arXiv ID if no DOI', async () => {
      const input: EnrichmentInput = {
        uri: SAMPLE_EPRINT_URI,
        arxivId: '2401.12345',
        title: 'Test Paper',
      };

      db.query.mockResolvedValue({ rows: [] });

      const result = await service.enrichEprint(input);

      expect(result.success).toBe(true);
      expect(s2Plugin.getPaperByArxiv).toHaveBeenCalledWith('2401.12345');
    });

    it('should enrich eprint with OpenAlex data', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await service.enrichEprint(SAMPLE_ENRICHMENT_INPUT);

      expect(result.success).toBe(true);
      expect(result.openAlexId).toBe(oaMockWork.id);
      expect(result.concepts).toBeDefined();
      expect(oaPlugin.getWorkByDoi).toHaveBeenCalledWith('10.1234/test.2024.001');
    });

    it('should use text classification fallback when no DOI match in OpenAlex', async () => {
      oaPlugin.getWorkByDoi.mockResolvedValueOnce(null);
      db.query.mockResolvedValue({ rows: [] });

      const result = await service.enrichEprint(SAMPLE_ENRICHMENT_INPUT);

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
          rows: [{ uri: 'at://did:plc:other/pub.chive.eprint/cited' }],
        })
        .mockResolvedValue({ rows: [] });

      const result = await service.enrichEprint(SAMPLE_ENRICHMENT_INPUT);

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

      const result = await localService.enrichEprint(SAMPLE_ENRICHMENT_INPUT);

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

      const result = await service.enrichEprint(SAMPLE_ENRICHMENT_INPUT);

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

    it('should update eprint record with enrichment data', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await service.enrichEprint(SAMPLE_ENRICHMENT_INPUT);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE eprints SET'),
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
  // findRelatedEprints (existing tests)
  // ==========================================================================

  describe('findRelatedEprints', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });
    });

    it('should find related eprints using citation signal', async () => {
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/related1' as AtUri,
          title: 'Related Paper 1',
          abstract: 'Abstract 1',
          coCitationCount: 5,
          strength: 0.8,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
      });
      const firstResult = result[0];

      expect(result.length).toBeGreaterThan(0);
      expect(firstResult?.relationshipType).toBe('co-cited');
      expect(citationGraph.findCoCitedPapers).toHaveBeenCalled();
    });

    it('should find related eprints using semantic signal', async () => {
      // Mock that recommended papers exist in Chive
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }) // getEprintByUri
        .mockResolvedValueOnce({
          rows: [
            {
              ...SAMPLE_EPRINT_ROW,
              uri: 'at://did:plc:other/pub.chive.eprint/related',
              semantic_scholar_id: 'rec1',
            },
          ],
        }); // findEprintByExternalId

      await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['semantic'],
      });

      expect(s2Plugin.getRecommendations).toHaveBeenCalled();
    });

    it('should respect limit option', async () => {
      const coCitedPapers: CoCitedPaper[] = Array.from({ length: 20 }, (_, i) => ({
        uri: `at://did:plc:other/pub.chive.eprint/related${i}` as AtUri,
        title: `Related Paper ${i}`,
        coCitationCount: 5 - i,
        strength: 0.9 - i * 0.02,
      }));
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        limit: 5,
      });

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should filter by minScore', async () => {
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/high' as AtUri,
          title: 'High Score',
          coCitationCount: 10,
          strength: 0.9,
        },
        {
          uri: 'at://did:plc:other/pub.chive.eprint/low' as AtUri,
          title: 'Low Score',
          coCitationCount: 1,
          strength: 0.2,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        minScore: 0.5,
      });

      expect(result.every((r) => r.score >= 0.5)).toBe(true);
    });

    it('should return empty array if eprint not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI);

      expect(result).toEqual([]);
    });

    it('should combine multiple signals', async () => {
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/cocited' as AtUri,
          title: 'Co-cited Paper',
          coCitationCount: 5,
          strength: 0.7,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);
      citationGraph.getCitingPapers.mockResolvedValueOnce({
        citations: [
          {
            citingUri: 'at://did:plc:citing/pub.chive.eprint/1' as AtUri,
            citedUri: SAMPLE_EPRINT_URI,
            isInfluential: true,
            source: 'semantic-scholar' as const,
          },
        ],
        total: 1,
        hasMore: false,
      });

      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // collectConceptSignals (via findRelatedEprints)
  // ==========================================================================

  describe('collectConceptSignals', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
    });

    it('scores papers with matching topic IDs at ~0.9', async () => {
      // getEprintByUri for the source paper
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        // getEnrichment for source paper
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: MOCK_CONCEPTS_A }],
        })
        // Query eprint_enrichment for candidates
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/sametopic',
              topics: MOCK_TOPICS_B_SAME_TOPIC,
              concepts: [],
            },
          ],
        })
        // getEprintByUri for the candidate
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/sametopic',
              title: 'Same Topic Paper',
              categories: ['linguistics'],
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['concepts'],
        minScore: 0.0,
      });

      const conceptResult = result.find(
        (r) => r.uri === 'at://did:plc:other/pub.chive.eprint/sametopic'
      );
      expect(conceptResult).toBeDefined();
      // Topic score 0.9 * conceptOverlap weight 0.2 = 0.18 combined score
      // The signalScores.concepts should be ~0.9
      if (conceptResult) {
        expect(conceptResult.signalScores?.concepts).toBeCloseTo(0.9, 1);
      }
    });

    it('scores papers with matching subfield at ~0.7', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: [] }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/samesubfield',
              topics: MOCK_TOPICS_C_SAME_SUBFIELD,
              concepts: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/samesubfield',
              title: 'Same Subfield Paper',
              categories: ['linguistics'],
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['concepts'],
        minScore: 0.0,
      });

      const conceptResult = result.find(
        (r) => r.uri === 'at://did:plc:other/pub.chive.eprint/samesubfield'
      );
      expect(conceptResult).toBeDefined();
      if (conceptResult) {
        expect(conceptResult.signalScores?.concepts).toBeCloseTo(0.7, 1);
      }
    });

    it('scores papers with matching field at ~0.5', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: [] }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/samefield',
              topics: MOCK_TOPICS_D_SAME_FIELD,
              concepts: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/samefield',
              title: 'Same Field Paper',
              categories: ['linguistics'],
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['concepts'],
        minScore: 0.0,
      });

      const conceptResult = result.find(
        (r) => r.uri === 'at://did:plc:other/pub.chive.eprint/samefield'
      );
      expect(conceptResult).toBeDefined();
      if (conceptResult) {
        expect(conceptResult.signalScores?.concepts).toBeCloseTo(0.5, 1);
      }
    });

    it('scores papers with matching domain at ~0.3', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: [] }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/samedomain',
              topics: MOCK_TOPICS_E_SAME_DOMAIN,
              concepts: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/samedomain',
              title: 'Same Domain Paper',
              categories: ['economics'],
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['concepts'],
        minScore: 0.0,
      });

      const conceptResult = result.find(
        (r) => r.uri === 'at://did:plc:other/pub.chive.eprint/samedomain'
      );
      expect(conceptResult).toBeDefined();
      if (conceptResult) {
        expect(conceptResult.signalScores?.concepts).toBeCloseTo(0.3, 1);
      }
    });

    it('returns empty results when no enrichment data exists', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        // getEnrichment returns no data
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['concepts'],
        minScore: 0.0,
      });

      expect(result).toEqual([]);
    });

    it('returns empty results when no overlapping concepts exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: MOCK_CONCEPTS_A }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/nooverlap',
              topics: MOCK_TOPICS_F_NO_OVERLAP,
              concepts: [],
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['concepts'],
        minScore: 0.0,
      });

      // No overlapping topics/concepts, so no results should match
      expect(result).toEqual([]);
    });

    it('generates the correct explanation text for each overlap level', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: [] }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/sametopic',
              topics: MOCK_TOPICS_B_SAME_TOPIC,
              concepts: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/sametopic',
              title: 'Same Topic Paper',
              categories: [],
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['concepts'],
        minScore: 0.0,
      });

      const match = result[0];
      expect(match).toBeDefined();
      if (match) {
        expect(match.explanation).toBe('Shares the same research topic');
        expect(match.relationshipType).toBe('similar-topics');
      }
    });
  });

  // ==========================================================================
  // collectCitationSignals (via findRelatedEprints)
  // ==========================================================================

  describe('collectCitationSignals', () => {
    it('uses getSimilar when recommendationEngine is provided', async () => {
      const mockRecommendationEngine = createMockRecommendationEngine();
      const similarPapers: SimilarPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/similar1' as AtUri,
          title: 'Similar Paper 1',
          authors: ['Author A'],
          similarity: 8.0,
          reason: 'co-citation',
          sharedReferences: 3,
          sharedCiters: 2,
        },
      ];
      mockRecommendationEngine.getSimilar.mockResolvedValueOnce(similarPapers);

      const serviceWithRecEngine = new DiscoveryService(
        logger,
        db,
        searchEngine as unknown as ISearchEngine,
        ranking as unknown as IRankingService,
        citationGraph as unknown as ICitationGraph,
        mockRecommendationEngine as unknown as RecommendationService
      );

      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      const result = await serviceWithRecEngine.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        minScore: 0.0,
      });

      expect(mockRecommendationEngine.getSimilar).toHaveBeenCalledWith(SAMPLE_EPRINT_URI, 20);
      // findCoCitedPapers should NOT be called when recommendationEngine is available
      expect(citationGraph.findCoCitedPapers).not.toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      const firstResult = result[0];
      expect(firstResult?.relationshipType).toBe('co-cited');
    });

    it('falls back to findCoCitedPapers without recommendationEngine', async () => {
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/cocited1' as AtUri,
          title: 'Co-cited Paper',
          coCitationCount: 3,
          strength: 0.6,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        minScore: 0.0,
      });

      expect(citationGraph.findCoCitedPapers).toHaveBeenCalledWith(SAMPLE_EPRINT_URI, 2);
      expect(result.length).toBeGreaterThan(0);
    });

    it('normalizes similarity=5 to approximately 0.5', () => {
      // Access the private method via type assertion
      const normalizedScore = (
        service as unknown as { normalizeSimilarityScore: (s: number) => number }
      ).normalizeSimilarityScore(5);
      // k=5: 5/(5+5) = 0.5
      expect(normalizedScore).toBeCloseTo(0.5, 2);
    });

    it('normalizes similarity=20 to approximately 0.8', () => {
      const normalizedScore = (
        service as unknown as { normalizeSimilarityScore: (s: number) => number }
      ).normalizeSimilarityScore(20);
      // k=5: 20/(20+5) = 0.8
      expect(normalizedScore).toBeCloseTo(0.8, 2);
    });

    it('normalizes similarity=0 to 0', () => {
      const normalizedScore = (
        service as unknown as { normalizeSimilarityScore: (s: number) => number }
      ).normalizeSimilarityScore(0);
      expect(normalizedScore).toBe(0);
    });

    it('normalizes similarity=100 to approximately 0.95', () => {
      const normalizedScore = (
        service as unknown as { normalizeSimilarityScore: (s: number) => number }
      ).normalizeSimilarityScore(100);
      // k=5: 100/(100+5) ≈ 0.952
      expect(normalizedScore).toBeCloseTo(0.952, 2);
    });

    it('maps co-citation reason to co-cited relationship type', async () => {
      const mockRecommendationEngine = createMockRecommendationEngine();
      const similarPapers: SimilarPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/cocited' as AtUri,
          title: 'Co-cited Paper',
          authors: [],
          similarity: 6.0,
          reason: 'co-citation',
          sharedReferences: 0,
          sharedCiters: 3,
        },
      ];
      mockRecommendationEngine.getSimilar.mockResolvedValueOnce(similarPapers);

      const serviceWithRecEngine = new DiscoveryService(
        logger,
        db,
        searchEngine as unknown as ISearchEngine,
        ranking as unknown as IRankingService,
        citationGraph as unknown as ICitationGraph,
        mockRecommendationEngine as unknown as RecommendationService
      );

      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      const result = await serviceWithRecEngine.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        minScore: 0.0,
      });

      expect(result[0]?.relationshipType).toBe('co-cited');
    });

    it('maps bibliographic-coupling reason to bibliographic-coupling type', async () => {
      const mockRecommendationEngine = createMockRecommendationEngine();
      const similarPapers: SimilarPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/bibcoupled' as AtUri,
          title: 'Bib Coupled Paper',
          authors: [],
          similarity: 4.5,
          reason: 'bibliographic-coupling',
          sharedReferences: 3,
          sharedCiters: 0,
        },
      ];
      mockRecommendationEngine.getSimilar.mockResolvedValueOnce(similarPapers);

      const serviceWithRecEngine = new DiscoveryService(
        logger,
        db,
        searchEngine as unknown as ISearchEngine,
        ranking as unknown as IRankingService,
        citationGraph as unknown as ICitationGraph,
        mockRecommendationEngine as unknown as RecommendationService
      );

      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      const result = await serviceWithRecEngine.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        minScore: 0.0,
      });

      expect(result[0]?.relationshipType).toBe('bibliographic-coupling');
    });

    it('builds citation explanation from shared citers and references', async () => {
      const mockRecommendationEngine = createMockRecommendationEngine();
      const similarPapers: SimilarPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/explained' as AtUri,
          title: 'Explained Paper',
          authors: [],
          similarity: 7.0,
          reason: 'co-citation',
          sharedReferences: 4,
          sharedCiters: 3,
        },
      ];
      mockRecommendationEngine.getSimilar.mockResolvedValueOnce(similarPapers);

      const serviceWithRecEngine = new DiscoveryService(
        logger,
        db,
        searchEngine as unknown as ISearchEngine,
        ranking as unknown as IRankingService,
        citationGraph as unknown as ICitationGraph,
        mockRecommendationEngine as unknown as RecommendationService
      );

      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      const result = await serviceWithRecEngine.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        minScore: 0.0,
      });

      expect(result[0]?.explanation).toContain('3 shared citing papers');
      expect(result[0]?.explanation).toContain('4 shared references');
    });
  });

  // ==========================================================================
  // collectAuthorSignals (via findRelatedEprints)
  // ==========================================================================

  describe('collectAuthorSignals', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
    });

    it('scores papers sharing 1 of 2 authors at ~0.7', async () => {
      // getEprintByUri for source paper (has 2 authors with DIDs)
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        // Author query: find papers sharing at least one author DID
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/sameauthor1',
              title: 'One Shared Author Paper',
              abstract: 'Some abstract',
              categories: ['cs.CL'],
              publication_date: new Date('2024-03-01'),
              overlap_count: 1, // 1 of 2 authors
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['authors'],
        minScore: 0.0,
      });

      const authorResult = result.find(
        (r) => r.uri === 'at://did:plc:other/pub.chive.eprint/sameauthor1'
      );
      expect(authorResult).toBeDefined();
      if (authorResult) {
        // overlapRatio = 1/2 = 0.5, score = 0.4 + 0.5 * 0.6 = 0.7
        // Combined: 0.7 * authorNetwork weight (0.15) = 0.105
        expect(authorResult.signalScores?.authors).toBeCloseTo(0.7, 1);
      }
    });

    it('scores papers sharing all authors at 1.0', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }).mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:other/pub.chive.eprint/allauthors',
            title: 'All Authors Paper',
            abstract: null,
            categories: null,
            publication_date: null,
            overlap_count: 2, // Both authors
          },
        ],
      });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['authors'],
        minScore: 0.0,
      });

      const authorResult = result.find(
        (r) => r.uri === 'at://did:plc:other/pub.chive.eprint/allauthors'
      );
      expect(authorResult).toBeDefined();
      if (authorResult) {
        // overlapRatio = 2/2 = 1.0, score = min(1.0, 0.4 + 1.0 * 0.6) = 1.0
        expect(authorResult.signalScores?.authors).toBeCloseTo(1.0, 1);
      }
    });

    it('returns empty when source paper has no author DIDs', async () => {
      const eprintNoAuthorDids = {
        ...SAMPLE_EPRINT_ROW,
        authors: [{ name: 'Alice' }, { name: 'Bob' }], // No DIDs
      };
      db.query.mockResolvedValueOnce({ rows: [eprintNoAuthorDids] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['authors'],
        minScore: 0.0,
      });

      expect(result).toEqual([]);
    });

    it('returns empty when source paper has no authors at all', async () => {
      const eprintNoAuthors = {
        ...SAMPLE_EPRINT_ROW,
        authors: null,
      };
      db.query.mockResolvedValueOnce({ rows: [eprintNoAuthors] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['authors'],
        minScore: 0.0,
      });

      expect(result).toEqual([]);
    });

    it('excludes the source paper from results', async () => {
      // The SQL query includes "e.uri != $1" to exclude source,
      // but also the weighted combination filters out the source URI.
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        // Author query returns no additional papers (only source matched)
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['authors'],
        minScore: 0.0,
      });

      const selfResult = result.find((r) => r.uri === SAMPLE_EPRINT_URI);
      expect(selfResult).toBeUndefined();
    });

    it('includes correct explanation for single shared author', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }).mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:other/pub.chive.eprint/shared1',
            title: 'Shared Author Paper',
            abstract: null,
            categories: null,
            publication_date: null,
            overlap_count: 1,
          },
        ],
      });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['authors'],
        minScore: 0.0,
      });

      expect(result[0]?.explanation).toBe('Shares an author with this paper');
      expect(result[0]?.relationshipType).toBe('same-author');
    });

    it('includes correct explanation for multiple shared authors', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }).mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:other/pub.chive.eprint/shared2',
            title: 'Multi Author Paper',
            abstract: null,
            categories: null,
            publication_date: null,
            overlap_count: 2,
          },
        ],
      });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['authors'],
        minScore: 0.0,
      });

      expect(result[0]?.explanation).toBe('Shares 2 authors with this paper');
    });
  });

  // ==========================================================================
  // Weighted Scoring (via findRelatedEprints)
  // ==========================================================================

  describe('weighted scoring', () => {
    it('uses correct default weights: SPECTER2 0.25, co-citation 0.20, concepts 0.15, authors 0.30', async () => {
      // Create a service with the recommendation engine for full signal coverage
      const mockRecommendationEngine = createMockRecommendationEngine();

      const serviceWithRec = new DiscoveryService(
        logger,
        db,
        searchEngine as unknown as ISearchEngine,
        ranking as unknown as IRankingService,
        citationGraph as unknown as ICitationGraph,
        mockRecommendationEngine as unknown as RecommendationService
      );

      const candidateUri = 'at://did:plc:other/pub.chive.eprint/weighted' as AtUri;
      const candidateRow = {
        uri: candidateUri,
        title: 'Weighted Test Paper',
        categories: ['cs.CL'],
        authors: [{ did: 'did:plc:author1', name: 'Alice Researcher' }],
      };

      // Set up: citation signal via recommendation engine
      mockRecommendationEngine.getSimilar.mockResolvedValueOnce([
        {
          uri: candidateUri,
          title: 'Weighted Test Paper',
          authors: [],
          similarity: 5, // normalize to 0.5
          reason: 'co-citation' as const,
          sharedReferences: 0,
          sharedCiters: 2,
        },
      ]);

      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }) // getEprintByUri (source)
        // Concept signal: getEnrichment for source
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: MOCK_CONCEPTS_A }],
        })
        // Concept signal: query eprint_enrichment candidates
        .mockResolvedValueOnce({
          rows: [
            {
              uri: candidateUri,
              topics: MOCK_TOPICS_B_SAME_TOPIC, // 0.9 topic score
              concepts: MOCK_CONCEPTS_B, // 1/3 concept overlap
            },
          ],
        })
        // getEprintByUri for concept candidate
        .mockResolvedValueOnce({ rows: [candidateRow] })
        // Author signal query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: candidateUri,
              title: 'Weighted Test Paper',
              abstract: null,
              categories: ['cs.CL'],
              publication_date: null,
              overlap_count: 1,
            },
          ],
        });

      const result = await serviceWithRec.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations', 'concepts', 'authors'],
        minScore: 0.0,
      });

      const paper = result.find((r) => r.uri === candidateUri);
      expect(paper).toBeDefined();
      if (paper) {
        const scores = paper.signalScores ?? {};

        // Check that individual signal scores are present
        expect(scores.citations).toBeDefined();
        expect(scores.concepts).toBeDefined();
        expect(scores.authors).toBeDefined();

        // Only citations, concepts, authors active (raw weights: 0.20, 0.15, 0.30).
        // Normalized: 0.20/0.65, 0.15/0.65, 0.30/0.65
        const citationsScore = scores.citations ?? 0;
        const conceptsScore = scores.concepts ?? 0;
        const authorsScore = scores.authors ?? 0;
        const weightSum = 0.2 + 0.15 + 0.3;
        const expectedScore =
          citationsScore * (0.2 / weightSum) +
          conceptsScore * (0.15 / weightSum) +
          authorsScore * (0.3 / weightSum);

        expect(paper.score).toBeCloseTo(expectedScore, 2);
      }
    });

    it('takes max score per signal via mergeSignal when paper appears in multiple signal sources', async () => {
      // Test mergeSignal by having the same URI appear from both citation and
      // concept signals. mergeSignal takes the max of each signal dimension.
      const candidateUri = 'at://did:plc:other/pub.chive.eprint/multi' as AtUri;
      const candidateRow = {
        uri: candidateUri,
        title: 'Multi Signal Paper',
        categories: ['cs.CL'],
      };

      // Citation signal provides citations score of 0.3
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: candidateUri,
          title: 'Multi Signal Paper',
          coCitationCount: 2,
          strength: 0.3,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }) // getEprintByUri (source)
        // Concept signal: getEnrichment for source
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: [] }],
        })
        // Concept signal: query eprint_enrichment candidates
        .mockResolvedValueOnce({
          rows: [
            {
              uri: candidateUri,
              topics: MOCK_TOPICS_B_SAME_TOPIC, // 0.9 topic score
              concepts: [],
            },
          ],
        })
        // getEprintByUri for concept candidate
        .mockResolvedValueOnce({ rows: [candidateRow] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations', 'concepts'],
        minScore: 0.0,
      });

      const paper = result.find((r) => r.uri === candidateUri);
      expect(paper).toBeDefined();
      if (paper) {
        // mergeSignal preserves both dimensions independently
        expect(paper.signalScores?.citations).toBeCloseTo(0.3, 1);
        expect(paper.signalScores?.concepts).toBeCloseTo(0.9, 1);
      }
    });

    it('sorts results by combined score descending', async () => {
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/low' as AtUri,
          title: 'Low Score Paper',
          coCitationCount: 2,
          strength: 0.3,
        },
        {
          uri: 'at://did:plc:other/pub.chive.eprint/high' as AtUri,
          title: 'High Score Paper',
          coCitationCount: 10,
          strength: 0.9,
        },
        {
          uri: 'at://did:plc:other/pub.chive.eprint/mid' as AtUri,
          title: 'Mid Score Paper',
          coCitationCount: 5,
          strength: 0.6,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        minScore: 0.0,
      });

      // Verify descending order
      for (let i = 0; i < result.length - 1; i++) {
        const current = result[i];
        const next = result[i + 1];
        if (current && next) {
          expect(current.score).toBeGreaterThanOrEqual(next.score);
        }
      }
    });

    it('excludes papers with zero total score', async () => {
      // A paper with 0 citation strength will get 0 combined score
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: 'at://did:plc:other/pub.chive.eprint/zero' as AtUri,
          title: 'Zero Score Paper',
          coCitationCount: 0,
          strength: 0.0,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
        minScore: 0.2, // Default minScore
      });

      // Paper with 0 combined score should be filtered out
      const zeroResult = result.find((r) => r.uri === 'at://did:plc:other/pub.chive.eprint/zero');
      expect(zeroResult).toBeUndefined();
    });
  });

  // ==========================================================================
  // findRelatedEprints integration tests
  // ==========================================================================

  describe('findRelatedEprints integration', () => {
    it('combines citation + concept + author signals when all enabled', async () => {
      // Test a simpler combination without semantic signal (which requires
      // S2 plugin setup and external ID lookups). Verifying that three signal
      // types produce accumulator entries for the same paper.
      const candidateUri = 'at://did:plc:other/pub.chive.eprint/allsignals' as AtUri;
      const candidateRow = {
        uri: candidateUri,
        title: 'All Signals Paper',
        abstract: 'About semantics',
        categories: ['cs.CL'],
      };

      // Citation signal via co-citation
      const coCitedPapers: CoCitedPaper[] = [
        {
          uri: candidateUri,
          title: 'All Signals Paper',
          coCitationCount: 4,
          strength: 0.6,
        },
      ];
      citationGraph.findCoCitedPapers.mockResolvedValueOnce(coCitedPapers);

      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }) // getEprintByUri (source)
        // Concept signal: getEnrichment for source
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: [] }],
        })
        // Concept signal: query eprint_enrichment candidates
        .mockResolvedValueOnce({
          rows: [
            {
              uri: candidateUri,
              topics: MOCK_TOPICS_C_SAME_SUBFIELD, // 0.7 topic overlap
              concepts: [],
            },
          ],
        })
        // getEprintByUri for concept candidate
        .mockResolvedValueOnce({ rows: [candidateRow] })
        // Author signal query
        .mockResolvedValueOnce({
          rows: [
            {
              uri: candidateUri,
              title: 'All Signals Paper',
              abstract: null,
              categories: ['cs.CL'],
              publication_date: null,
              overlap_count: 1,
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations', 'concepts', 'authors'],
        minScore: 0.0,
      });

      const paper = result.find((r) => r.uri === candidateUri);
      expect(paper).toBeDefined();
      if (paper) {
        // Paper should have scores from all three signal types
        expect(paper.signalScores?.citations).toBeDefined();
        expect(paper.signalScores?.concepts).toBeDefined();
        expect(paper.signalScores?.authors).toBeDefined();
        // Combined score should use weights
        expect(paper.score).toBeGreaterThan(0);
      }
    });

    it('uses only concept overlap when signals is ["concepts"]', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] })
        .mockResolvedValueOnce({
          rows: [{ uri: SAMPLE_EPRINT_URI, topics: MOCK_TOPICS_A, concepts: [] }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/conceptonly',
              topics: MOCK_TOPICS_B_SAME_TOPIC,
              concepts: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: 'at://did:plc:other/pub.chive.eprint/conceptonly',
              title: 'Concept Only Paper',
              categories: [],
            },
          ],
        });

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['concepts'],
        minScore: 0.0,
      });

      // Citation graph should not be called
      expect(citationGraph.findCoCitedPapers).not.toHaveBeenCalled();
      expect(citationGraph.getCitingPapers).not.toHaveBeenCalled();
      // Only concept-based results
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.signalScores?.citations).toBeUndefined();
      expect(result[0]?.signalScores?.concepts).toBeDefined();
    });

    it('uses default signals when none specified', async () => {
      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      await service.findRelatedEprints(SAMPLE_EPRINT_URI);

      // Default signals: ['citations', 'concepts', 'semantic']
      // Citation graph should be called
      expect(citationGraph.findCoCitedPapers).toHaveBeenCalled();
    });

    it('handles empty results gracefully', async () => {
      db.query.mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });
      citationGraph.findCoCitedPapers.mockResolvedValueOnce([]);

      const result = await service.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations'],
      });

      expect(result).toEqual([]);
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
        .mockResolvedValueOnce({ rows: [{ uri: SAMPLE_EPRINT_URI }] }) // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [] }) // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }); // getEprintByUri for field-based

      searchEngine.search.mockResolvedValueOnce({
        hits: [{ uri: 'at://did:plc:other/pub.chive.eprint/fieldmatch' as AtUri, score: 0.9 }],
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
        .mockResolvedValueOnce({ rows: [{ uri: SAMPLE_EPRINT_URI }] }) // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [] }) // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }); // getEprintByUri

      citationGraph.getCitingPapers.mockResolvedValueOnce({
        citations: [
          {
            citingUri: 'at://did:plc:citing/pub.chive.eprint/new' as AtUri,
            citedUri: SAMPLE_EPRINT_URI,
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
      const dismissedUri = 'at://did:plc:dismissed/pub.chive.eprint/1';
      db.query
        .mockResolvedValueOnce({ rows: [] }) // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [{ eprint_uri: dismissedUri }] }) // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] });

      searchEngine.search.mockResolvedValueOnce({
        hits: [
          { uri: dismissedUri as AtUri, score: 0.95 },
          { uri: 'at://did:plc:other/pub.chive.eprint/1' as AtUri, score: 0.9 },
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
        .mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      searchEngine.search.mockResolvedValueOnce({
        hits: [{ uri: 'at://did:plc:other/pub.chive.eprint/1' as AtUri, score: 0.9 }],
        total: 1,
      });

      await service.getRecommendationsForUser(SAMPLE_USER_DID, { signals: ['fields'] });

      expect(ranking.rank).toHaveBeenCalled();
    });

    it('should respect limit option', async () => {
      db.query.mockResolvedValue({ rows: [] });
      searchEngine.search.mockResolvedValueOnce({
        hits: Array.from({ length: 30 }, (_, i) => ({
          uri: `at://did:plc:other/pub.chive.eprint/${i}` as AtUri,
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
        .mockResolvedValue({ rows: [SAMPLE_EPRINT_ROW] });

      searchEngine.search.mockResolvedValueOnce({
        hits: [{ uri: 'at://did:plc:other/pub.chive.eprint/1' as AtUri, score: 0.9 }],
        total: 1,
      });

      const result = await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: ['fields'],
      });

      const firstRecommendation = result.recommendations[0];
      if (firstRecommendation) {
        expect(firstRecommendation.explanation).toBeDefined();
        expect(firstRecommendation.explanation.text).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // collectTopicRecommendations (via getRecommendationsForUser)
  // ==========================================================================

  describe('collectTopicRecommendations', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
    });

    it('finds papers with overlapping topics from claimed paper enrichments', async () => {
      const claimedUri = 'at://did:plc:test/pub.chive.eprint/claimed1' as AtUri;
      const candidateUri = 'at://did:plc:other/pub.chive.eprint/topicmatch' as AtUri;

      db.query
        // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [{ uri: claimedUri }] })
        // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [] })
        // getEnrichment for claimed paper (called by collectTopicRecommendations)
        .mockResolvedValueOnce({
          rows: [
            {
              uri: claimedUri,
              semantic_scholar_id: null,
              openalex_id: null,
              citation_count: null,
              influential_citation_count: null,
              references_count: null,
              concepts: MOCK_CONCEPTS_A,
              topics: MOCK_TOPICS_A,
              enriched_at: new Date(),
            },
          ],
        })
        // Query eprint_enrichment for candidate papers
        .mockResolvedValueOnce({
          rows: [
            {
              uri: candidateUri,
              topics: MOCK_TOPICS_B_SAME_TOPIC, // Same topic ID as claimed
            },
          ],
        })
        // getEprintByUri for the candidate
        .mockResolvedValueOnce({
          rows: [
            {
              uri: candidateUri,
              title: 'Topic Match Paper',
              abstract: 'Abstract about semantics',
              categories: ['linguistics'],
              publication_date: new Date('2024-02-01'),
            },
          ],
        });

      await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        // Only trigger topic-based signal (no fields/citations/semantic)
        signals: [],
      });

      // Topic recommendations are always collected when claimedPapers.size > 0
      expect(ranking.rank).toHaveBeenCalled();
      const rankedItems = ranking.rank.mock.calls[0]?.[0] as
        | { uri: string; signalType: string }[]
        | undefined;
      const topicCandidate = rankedItems?.find(
        (item) => item.uri === candidateUri && item.signalType === 'concepts'
      );
      expect(topicCandidate).toBeDefined();
    });

    it('skips topic recommendations when no enrichment topics exist', async () => {
      const claimedUri = 'at://did:plc:test/pub.chive.eprint/claimed1' as AtUri;

      db.query
        .mockResolvedValueOnce({ rows: [{ uri: claimedUri }] }) // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [] }) // getDismissedRecommendations
        // getEnrichment returns no topics
        .mockResolvedValueOnce({
          rows: [
            {
              uri: claimedUri,
              semantic_scholar_id: null,
              openalex_id: null,
              citation_count: null,
              influential_citation_count: null,
              references_count: null,
              concepts: [],
              topics: [],
              enriched_at: new Date(),
            },
          ],
        });

      const result = await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: [],
      });

      expect(result.recommendations).toEqual([]);
    });
  });

  // ==========================================================================
  // collectCoauthorRecommendations (via getRecommendationsForUser)
  // ==========================================================================

  describe('collectCoauthorRecommendations', () => {
    beforeEach(() => {
      service.setPluginManager(pluginManager);
    });

    it('finds papers by co-authors that user has not claimed', async () => {
      const claimedUri = 'at://did:plc:test/pub.chive.eprint/claimed1' as AtUri;
      const coauthorPaperUri = 'at://did:plc:coauthor/pub.chive.eprint/paper1' as AtUri;

      db.query
        // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [{ uri: claimedUri }] })
        // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [] })
        // getEnrichment for claimed paper (topic recommendations)
        .mockResolvedValueOnce({ rows: [] })
        // Co-author query: find co-author DIDs from claimed papers
        .mockResolvedValueOnce({
          rows: [{ did: 'did:plc:coauthor1', name: 'Dr. Collaborator' }],
        })
        // Papers by co-authors
        .mockResolvedValueOnce({
          rows: [
            {
              uri: coauthorPaperUri,
              title: 'Coauthor Recent Paper',
              abstract: 'A paper by the co-author',
              categories: ['cs.AI'],
              publication_date: new Date('2024-05-01'),
              coauthor_name: 'Dr. Collaborator',
            },
          ],
        });

      await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: ['collaborators'],
      });

      expect(ranking.rank).toHaveBeenCalled();
      const rankedItems = ranking.rank.mock.calls[0]?.[0] as
        | { uri: string; signalType: string; explanation: string }[]
        | undefined;
      const coauthorCandidate = rankedItems?.find(
        (item) => item.uri === coauthorPaperUri && item.signalType === 'collaborators'
      );
      expect(coauthorCandidate).toBeDefined();
      expect(coauthorCandidate?.explanation).toBe('By your co-author Dr. Collaborator');
    });

    it('skips when no co-authors found', async () => {
      const claimedUri = 'at://did:plc:test/pub.chive.eprint/claimed1' as AtUri;

      db.query
        .mockResolvedValueOnce({ rows: [{ uri: claimedUri }] }) // getUserClaimedPapers
        .mockResolvedValueOnce({ rows: [] }) // getDismissedRecommendations
        .mockResolvedValueOnce({ rows: [] }) // getEnrichment (topic recommendations)
        // Co-author query returns empty
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: ['collaborators'],
      });

      // No candidates should be added from collaborator signal
      expect(result.recommendations).toEqual([]);
    });

    it('uses generic explanation when co-author name is null', async () => {
      const claimedUri = 'at://did:plc:test/pub.chive.eprint/claimed1' as AtUri;
      const coauthorPaperUri = 'at://did:plc:coauthor/pub.chive.eprint/anon' as AtUri;

      db.query
        .mockResolvedValueOnce({ rows: [{ uri: claimedUri }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // enrichment
        .mockResolvedValueOnce({
          rows: [{ did: 'did:plc:coauthor1', name: null }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              uri: coauthorPaperUri,
              title: 'Anon Coauthor Paper',
              abstract: null,
              categories: null,
              publication_date: null,
              coauthor_name: null,
            },
          ],
        });

      await service.getRecommendationsForUser(SAMPLE_USER_DID, {
        signals: ['collaborators'],
      });

      const rankedItems = ranking.rank.mock.calls[0]?.[0] as
        | { uri: string; explanation: string }[]
        | undefined;
      const candidate = rankedItems?.find((item) => item.uri === coauthorPaperUri);
      expect(candidate?.explanation).toBe('By one of your co-authors');
    });
  });

  // ==========================================================================
  // mergeSignal (tested indirectly)
  // ==========================================================================

  describe('mergeSignal', () => {
    it('preserves first-seen metadata when merging signals', async () => {
      // When a paper appears in both citation and author signals,
      // the first-seen title/abstract/categories should be kept.
      const mockRecommendationEngine = createMockRecommendationEngine();
      const candidateUri = 'at://did:plc:other/pub.chive.eprint/merge' as AtUri;

      // Citation signal provides title "Citation Title"
      mockRecommendationEngine.getSimilar.mockResolvedValueOnce([
        {
          uri: candidateUri,
          title: 'Citation Title',
          authors: [],
          similarity: 5.0,
          reason: 'co-citation' as const,
          sharedReferences: 1,
          sharedCiters: 2,
        },
      ]);

      const serviceWithRec = new DiscoveryService(
        logger,
        db,
        searchEngine as unknown as ISearchEngine,
        ranking as unknown as IRankingService,
        citationGraph as unknown as ICitationGraph,
        mockRecommendationEngine as unknown as RecommendationService
      );

      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_EPRINT_ROW] }) // source
        // Author signal also returns the same paper (but with potentially different metadata)
        .mockResolvedValueOnce({
          rows: [
            {
              uri: candidateUri,
              title: 'Author Signal Title',
              abstract: 'Author abstract',
              categories: ['cs.AI'],
              publication_date: null,
              overlap_count: 1,
            },
          ],
        });

      const result = await serviceWithRec.findRelatedEprints(SAMPLE_EPRINT_URI, {
        signals: ['citations', 'authors'],
        minScore: 0.0,
      });

      const paper = result.find((r) => r.uri === candidateUri);
      expect(paper).toBeDefined();
      if (paper) {
        // First-seen title (from citations) should be preserved
        expect(paper.title).toBe('Citation Title');
        // Both signal scores should be present
        expect(paper.signalScores?.citations).toBeDefined();
        expect(paper.signalScores?.authors).toBeDefined();
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
        eprintUri: SAMPLE_EPRINT_URI,
        timestamp: new Date(),
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_interactions'),
        expect.arrayContaining([SAMPLE_USER_DID, SAMPLE_EPRINT_URI, 'view'])
      );
    });

    it('should record a dismiss interaction', async () => {
      await service.recordInteraction(SAMPLE_USER_DID, {
        type: 'dismiss',
        eprintUri: SAMPLE_EPRINT_URI,
        recommendationId: 'rec-123',
        timestamp: new Date(),
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_interactions'),
        expect.arrayContaining([SAMPLE_USER_DID, SAMPLE_EPRINT_URI, 'dismiss', 'rec-123'])
      );
    });

    it('should log debug message on success', async () => {
      await service.recordInteraction(SAMPLE_USER_DID, {
        type: 'click',
        eprintUri: SAMPLE_EPRINT_URI,
        timestamp: new Date(),
      });

      expect(logger.debug).toHaveBeenCalledWith('Recorded user interaction', expect.any(Object));
    });

    it('should throw ValidationError if eprintUri is missing', async () => {
      await expect(
        service.recordInteraction(SAMPLE_USER_DID, {
          type: 'view',
          eprintUri: '' as AtUri,
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

      const result = await service.getCitationCounts(SAMPLE_EPRINT_URI);

      expect(result.citedByCount).toBe(42);
      expect(result.referencesCount).toBe(23);
      expect(result.influentialCitedByCount).toBe(5);
      expect(citationGraph.getCitationCounts).toHaveBeenCalledWith(SAMPLE_EPRINT_URI);
    });
  });

  describe('getCitingPapers', () => {
    it('should delegate to citation graph and add cursor', async () => {
      citationGraph.getCitingPapers.mockResolvedValueOnce({
        citations: [
          {
            citingUri: 'at://did:plc:citing/pub.chive.eprint/1' as AtUri,
            citedUri: SAMPLE_EPRINT_URI,
            isInfluential: true,
            source: 'semantic-scholar' as const,
          },
        ],
        total: 10,
        hasMore: true,
      });

      const result = await service.getCitingPapers(SAMPLE_EPRINT_URI, { limit: 5 });

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
            citingUri: SAMPLE_EPRINT_URI,
            citedUri: 'at://did:plc:ref/pub.chive.eprint/1' as AtUri,
            isInfluential: false,
            source: 'openalex' as const,
          },
        ],
        total: 5,
        hasMore: false,
      });

      const result = await service.getReferences(SAMPLE_EPRINT_URI);

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

      const result = await service.getEnrichment(SAMPLE_EPRINT_URI);

      expect(result).not.toBeNull();
      expect(result?.semanticScholarId).toBe(SAMPLE_ENRICHMENT_ROW.semantic_scholar_id);
      expect(result?.citationCount).toBe(SAMPLE_ENRICHMENT_ROW.citation_count);
      expect(result?.concepts).toBeDefined();
    });

    it('should return null if no enrichment data', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getEnrichment(SAMPLE_EPRINT_URI);

      expect(result).toBeNull();
    });
  });
});
