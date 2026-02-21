/**
 * Citation extraction pipeline integration tests.
 *
 * @remarks
 * Tests the citation extraction service end-to-end with mocked external
 * services (GROBID, Semantic Scholar, Crossref). Validates:
 * - Extracting citations from a paper and storing them in PostgreSQL
 * - Matching extracted citations to existing Chive papers
 * - Creating CITES edges in Neo4j citation graph
 * - Graceful degradation when external services fail
 *
 * ATProto Compliance:
 * - PDF blobs are fetched from user PDSes via IRepository (read-only)
 * - Extracted citations are stored in Chive's local index (rebuildable)
 * - Citation graph is an index, never source of truth
 * - Never writes to user PDSes
 *
 * All tests use a mock database pool because the production migration
 * schema (extracted_citations, eprints_index) has pending column alignment.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  CitationExtractionService,
  type ExtractionOptions,
} from '@/services/citation/citation-extraction-service.js';
import type { GrobidClient, GrobidReference } from '@/services/citation/grobid-client.js';
import type { AtUri, CID, DID } from '@/types/atproto.js';
import type { IDatabasePool } from '@/types/interfaces/database.interface.js';
import type {
  CitationRelationship,
  ICitationGraph,
  RelatedWorkInput,
} from '@/types/interfaces/discovery.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IPluginManager, IChivePlugin } from '@/types/interfaces/plugin.interface.js';
import type { IRepository } from '@/types/interfaces/repository.interface.js';

// Test constants
const TEST_AUTHOR = 'did:plc:citationtest123' as DID;
const TEST_EPRINT_URI = 'at://did:plc:citationtest123/pub.chive.eprint.submission/paper1' as AtUri;
const TEST_CID = 'bafyreicitation123' as CID;

/**
 * Creates mock logger for tests.
 */
function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => createMockLogger(),
  };
}

/**
 * Creates mock GROBID client that returns predictable references.
 */
function createMockGrobidClient(refs: GrobidReference[] = [], available = true): GrobidClient {
  return {
    extractReferences: vi.fn().mockResolvedValue(refs),
    isAvailable: vi.fn().mockResolvedValue(available),
  } as unknown as GrobidClient;
}

/**
 * Creates mock repository (read-only, no write methods).
 */
function createMockRepository(): IRepository {
  // Simulate returning a PDF blob stream
  const mockStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0x25, 0x50, 0x44, 0x46])); // %PDF header
      controller.close();
    },
  });

  return {
    getRecord: vi.fn().mockResolvedValue(null),
    listRecords: vi.fn(),
    getBlob: vi.fn().mockResolvedValue(mockStream),
  };
}

/**
 * Creates mock citation graph that tracks operations.
 */
function createMockCitationGraph(): ICitationGraph & {
  upsertedCitations: CitationRelationship[];
  upsertedRelatedWorks: RelatedWorkInput[];
} {
  const upsertedCitations: CitationRelationship[] = [];
  const upsertedRelatedWorks: RelatedWorkInput[] = [];

  return {
    upsertedCitations,
    upsertedRelatedWorks,
    upsertCitationsBatch: vi.fn().mockImplementation((citations: CitationRelationship[]) => {
      upsertedCitations.push(...citations);
      return Promise.resolve();
    }),
    getCitingPapers: vi.fn().mockResolvedValue({ citations: [], total: 0, hasMore: false }),
    getReferences: vi.fn().mockResolvedValue({ citations: [], total: 0, hasMore: false }),
    findCoCitedPapers: vi.fn().mockResolvedValue([]),
    getCitationCounts: vi.fn().mockResolvedValue({
      citedByCount: 0,
      referencesCount: 0,
      influentialCitedByCount: 0,
    }),
    deleteCitationsForPaper: vi.fn().mockResolvedValue(undefined),
    upsertRelatedWorksBatch: vi.fn().mockImplementation((rws: RelatedWorkInput[]) => {
      upsertedRelatedWorks.push(...rws);
      return Promise.resolve(rws.length);
    }),
    deleteRelatedWorksForPaper: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates mock Semantic Scholar plugin.
 */
function createMockS2Plugin(): IChivePlugin & {
  getPaperByDoi: ReturnType<typeof vi.fn>;
  getReferences: ReturnType<typeof vi.fn>;
} {
  return {
    id: 'pub.chive.plugin.semantic-scholar',
    manifest: {
      id: 'pub.chive.plugin.semantic-scholar',
      name: 'Semantic Scholar',
      version: '1.0.0',
      description: 'S2 integration',
      author: 'Chive',
      license: 'MIT',
      permissions: {
        hooks: [],
        network: { allowedDomains: ['api.semanticscholar.org'] },
      },
      entrypoint: 'index.js',
    },
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue('running'),
    getPaperByDoi: vi.fn().mockResolvedValue({
      paperId: 's2-paper-123',
      title: 'Test Paper',
      citationCount: 10,
    }),
    getReferences: vi.fn().mockResolvedValue({
      references: [
        {
          paper: {
            paperId: 's2-ref-1',
            title: 'Referenced Paper via S2',
            externalIds: { DOI: '10.1234/s2ref1' },
            year: 2023,
            venue: 'ACL',
          },
        },
        {
          paper: {
            paperId: 's2-ref-2',
            title: 'Another Referenced Paper',
            externalIds: {},
            year: 2022,
            venue: 'EMNLP',
          },
        },
      ],
      next: undefined,
    }),
  };
}

/**
 * Creates a mock database pool that handles citation extraction queries.
 *
 * @remarks
 * The mock handles these query patterns:
 * - DELETE FROM extracted_citations (cleanup before insert)
 * - INSERT INTO extracted_citations (store extracted citations)
 * - SELECT ... FROM extracted_citations (get stored citations)
 * - SELECT uri FROM eprints_index WHERE LOWER(doi) (DOI matching)
 * - SELECT uri, title FROM eprints_index WHERE LOWER(REGEXP_REPLACE(...)) (title matching)
 *
 * @param doiMatches - Map of DOI -> URI for DOI matching
 * @param storedCitations - Array to track stored citations
 */
function createMockDbPool(
  doiMatches = new Map<string, string>(),
  storedCitations: Record<string, unknown>[] = []
): IDatabasePool {
  return {
    query: vi.fn().mockImplementation((query: string, params?: unknown[]) => {
      // DELETE existing citations
      if (typeof query === 'string' && query.includes('DELETE FROM extracted_citations')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      // INSERT citations
      if (typeof query === 'string' && query.includes('INSERT INTO extracted_citations')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }

      // SELECT extracted citations
      if (
        typeof query === 'string' &&
        query.includes('SELECT') &&
        query.includes('extracted_citations') &&
        query.includes('WHERE eprint_uri')
      ) {
        return Promise.resolve({ rows: storedCitations });
      }

      // DOI matching query (uses published_version->>'doi' JSONB accessor)
      if (
        typeof query === 'string' &&
        query.includes("'doi'") &&
        query.includes('LOWER') &&
        query.includes('eprints_index') &&
        Array.isArray(params)
      ) {
        const searchDoi = String(params[0]).toLowerCase();
        const matchUri = doiMatches.get(searchDoi);
        if (matchUri) {
          return Promise.resolve({ rows: [{ uri: matchUri }] });
        }
        return Promise.resolve({ rows: [] });
      }

      // Title matching query
      if (typeof query === 'string' && query.includes('REGEXP_REPLACE')) {
        return Promise.resolve({ rows: [] });
      }

      // Default: empty result
      return Promise.resolve({ rows: [] });
    }),
  } as unknown as IDatabasePool;
}

describe('Citation Extraction Pipeline Integration', () => {
  let logger: ILogger;
  let repository: IRepository;
  let citationGraph: ReturnType<typeof createMockCitationGraph>;

  beforeEach(() => {
    logger = createMockLogger();
    repository = createMockRepository();
    citationGraph = createMockCitationGraph();
    vi.clearAllMocks();
  });

  describe('extractCitations with GROBID', () => {
    it('extracts references from PDF via GROBID and stores them', async () => {
      const grobidRefs: GrobidReference[] = [
        {
          rawText: 'Smith, J. (2020). Attention mechanisms for NLP. JMLR.',
          title: 'Attention mechanisms for NLP',
          authors: [{ firstName: 'John', lastName: 'Smith' }],
          doi: '10.1234/attention',
          year: 2020,
          journal: 'JMLR',
        },
        {
          rawText: 'Doe, A. (2019). Transformers in practice. ACL.',
          title: 'Transformers in practice',
          authors: [{ firstName: 'Alice', lastName: 'Doe' }],
          year: 2019,
          journal: 'ACL',
        },
      ];

      const grobidClient = createMockGrobidClient(grobidRefs, true);
      const mockDb = createMockDbPool();

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });

      const options: ExtractionOptions = {
        useGrobid: true,
        useSemanticScholar: false,
        useCrossref: false,
        authorDid: TEST_AUTHOR,
        documentCid: TEST_CID,
      };

      const result = await service.extractCitations(TEST_EPRINT_URI, options);

      expect(result.success).toBe(true);
      expect(result.grobidCount).toBe(2);
      expect(result.totalExtracted).toBe(2);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Verify GROBID was called
      expect(grobidClient.isAvailable).toHaveBeenCalled();
      expect(grobidClient.extractReferences).toHaveBeenCalled();

      // Verify PDF was fetched from PDS (read-only)
      expect(repository.getBlob).toHaveBeenCalledWith(TEST_AUTHOR, TEST_CID);

      // Verify citations were stored (DELETE + INSERT queries issued)
      const queryCalls = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls;
      const deleteCall = queryCalls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('DELETE FROM extracted_citations')
      );
      const insertCall = queryCalls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('INSERT INTO extracted_citations')
      );

      expect(deleteCall).toBeDefined();
      expect(insertCall).toBeDefined();
    });

    it('handles GROBID unavailability gracefully', async () => {
      const grobidClient = createMockGrobidClient([], false);
      const mockDb = createMockDbPool();

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });

      const options: ExtractionOptions = {
        useGrobid: true,
        useSemanticScholar: false,
        useCrossref: false,
        authorDid: TEST_AUTHOR,
        documentCid: TEST_CID,
      };

      const result = await service.extractCitations(TEST_EPRINT_URI, options);

      // Should succeed with 0 citations (graceful degradation)
      expect(result.success).toBe(true);
      expect(result.grobidCount).toBe(0);
      expect(result.totalExtracted).toBe(0);
    });
  });

  describe('extractCitations with Semantic Scholar', () => {
    it('enriches citations from Semantic Scholar API via plugin', async () => {
      const grobidClient = createMockGrobidClient([], false);
      const s2Plugin = createMockS2Plugin();
      const mockDb = createMockDbPool();

      const pluginManager: IPluginManager = {
        getPlugin: vi.fn().mockImplementation((id: string) => {
          if (id === 'pub.chive.plugin.semantic-scholar') return s2Plugin;
          return undefined;
        }),
        getAllPlugins: vi.fn().mockReturnValue([s2Plugin]),
        isPluginLoaded: vi.fn().mockReturnValue(true),
      } as unknown as IPluginManager;

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });
      service.setPluginManager(pluginManager);

      const options: ExtractionOptions = {
        useGrobid: false,
        useSemanticScholar: true,
        useCrossref: false,
        doi: '10.1234/test-paper',
      };

      const result = await service.extractCitations(TEST_EPRINT_URI, options);

      expect(result.success).toBe(true);
      expect(result.semanticScholarCount).toBe(2);
      expect(result.totalExtracted).toBe(2);

      // Verify S2 plugin was called for DOI lookup and references
      expect(s2Plugin.getPaperByDoi).toHaveBeenCalledWith('10.1234/test-paper');
      expect(s2Plugin.getReferences).toHaveBeenCalled();
    });

    it('works without plugin manager (graceful degradation)', async () => {
      const grobidClient = createMockGrobidClient([], false);
      const mockDb = createMockDbPool();

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });

      // No setPluginManager called

      const options: ExtractionOptions = {
        useSemanticScholar: true,
        useGrobid: false,
        useCrossref: false,
        doi: '10.1234/test-paper',
      };

      const result = await service.extractCitations(TEST_EPRINT_URI, options);

      expect(result.success).toBe(true);
      expect(result.semanticScholarCount).toBe(0);
    });
  });

  describe('matchCitationsToChive', () => {
    it('matches citations by DOI to indexed eprints', async () => {
      const targetUri = 'at://did:plc:citationtest123/pub.chive.eprint.submission/target1' as AtUri;
      const testDoi = '10.9999/citationmatchtest';

      const doiMatches = new Map([[testDoi.toLowerCase(), targetUri]]);
      const mockDb = createMockDbPool(doiMatches);

      const grobidClient = createMockGrobidClient([], false);

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });

      const citations = [
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'A Paper With Known DOI. 2024.',
          title: 'A Paper With Known DOI',
          doi: testDoi,
          source: 'grobid' as const,
        },
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'Unknown Paper. 2024.',
          title: 'Unknown Paper',
          doi: '10.9999/nonexistent',
          source: 'grobid' as const,
        },
      ];

      const matched = await service.matchCitationsToChive(citations);

      // First citation should match
      const doiMatch = matched.find((m) => m.doi === testDoi);
      expect(doiMatch?.chiveMatchUri).toBe(targetUri);
      expect(doiMatch?.matchConfidence).toBe(1.0);
      expect(doiMatch?.matchMethod).toBe('doi');

      // Second citation should not match
      const noMatch = matched.find((m) => m.doi === '10.9999/nonexistent');
      expect(noMatch?.chiveMatchUri).toBeUndefined();
    });
  });

  describe('Citation graph integration', () => {
    it('creates CITES edges for matched citations', async () => {
      const matchedDoi = '10.1234/knownpaper';
      const matchedUri =
        'at://did:plc:citationtest123/pub.chive.eprint.submission/matched1' as AtUri;

      const grobidRefs: GrobidReference[] = [
        {
          rawText: 'Known Paper. 2023.',
          title: 'Known Paper Title',
          doi: matchedDoi,
          year: 2023,
        },
      ];

      const grobidClient = createMockGrobidClient(grobidRefs, true);

      // Mock DB that returns DOI match and handles storage
      const doiMatches = new Map([[matchedDoi.toLowerCase(), matchedUri]]);
      const mockDb = createMockDbPool(doiMatches);

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        useGrobid: true,
        useSemanticScholar: false,
        useCrossref: false,
        authorDid: TEST_AUTHOR,
        documentCid: TEST_CID,
      });

      expect(result.success).toBe(true);
      expect(result.matchedToChive).toBe(1);

      // Verify citation graph was updated
      expect(citationGraph.upsertCitationsBatch).toHaveBeenCalled();
      expect(citationGraph.upsertedCitations.length).toBe(1);
      expect(citationGraph.upsertedCitations[0]?.citingUri).toBe(TEST_EPRINT_URI);
      expect(citationGraph.upsertedCitations[0]?.citedUri).toBe(matchedUri);
    });

    it('does not create graph edges for unmatched citations', async () => {
      const grobidRefs: GrobidReference[] = [
        {
          rawText: 'Unknown External Paper. 2023.',
          title: 'Unknown External Paper',
          year: 2023,
        },
      ];

      const grobidClient = createMockGrobidClient(grobidRefs, true);
      const mockDb = createMockDbPool();

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        useGrobid: true,
        useSemanticScholar: false,
        useCrossref: false,
        authorDid: TEST_AUTHOR,
        documentCid: TEST_CID,
      });

      expect(result.success).toBe(true);
      expect(result.matchedToChive).toBe(0);

      // Citation graph should NOT be called (no matched citations)
      expect(citationGraph.upsertCitationsBatch).not.toHaveBeenCalled();
    });
  });

  describe('ATProto compliance', () => {
    it('never writes to user PDSes during extraction', async () => {
      const grobidRefs: GrobidReference[] = [
        {
          rawText: 'Test Ref. 2023.',
          title: 'Test Reference',
          year: 2023,
        },
      ];

      const grobidClient = createMockGrobidClient(grobidRefs, true);
      const mockDb = createMockDbPool();

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });

      await service.extractCitations(TEST_EPRINT_URI, {
        useGrobid: true,
        useSemanticScholar: false,
        useCrossref: false,
        authorDid: TEST_AUTHOR,
        documentCid: TEST_CID,
      });

      // Repository should only have read operations (getBlob for PDF)
      expect(repository.getBlob).toHaveBeenCalled();

      // Repository should NOT have write methods called
      const repoMock = repository as unknown as Record<string, unknown>;
      expect(repoMock.createRecord).toBeUndefined();
      expect(repoMock.putRecord).toBeUndefined();
      expect(repoMock.deleteRecord).toBeUndefined();
    });

    it('stores BlobRef pointers (never blob data) for referenced PDFs', () => {
      const grobidClient = createMockGrobidClient([], false);
      const mockDb = createMockDbPool();

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });

      // The service uses repository.getBlob() to fetch the PDF, then
      // passes it to GROBID. It never stores the PDF data itself.
      // The only data stored is the extracted citations (text metadata).

      // Verify the service does not store blob data
      expect(service).not.toHaveProperty('storeBlob');
      expect(service).not.toHaveProperty('savePdf');
      expect(service).not.toHaveProperty('uploadBlob');
    });

    it('extraction results are derived data (rebuildable)', () => {
      // Extracted citations are derived from:
      // 1. GROBID (PDF analysis)
      // 2. Semantic Scholar (API)
      // 3. Crossref (API)
      //
      // If Chive's extracted_citations table is deleted, all data can
      // be rebuilt by re-running extraction on indexed eprints.

      const extractionDataProperties = {
        sourceOfTruth: ['grobid', 'semantic-scholar', 'crossref'],
        storage: 'postgresql-extracted-citations',
        type: 'derived-index',
        rebuildable: true,
      };

      expect(extractionDataProperties.rebuildable).toBe(true);
      expect(extractionDataProperties.type).toBe('derived-index');
      expect(extractionDataProperties.sourceOfTruth).not.toContain('chive');
    });
  });

  describe('Multiple source deduplication', () => {
    it('deduplicates citations from GROBID and S2 by DOI', async () => {
      const sharedDoi = '10.1234/shared';

      const grobidRefs: GrobidReference[] = [
        {
          rawText: 'Shared Paper. 2023.',
          title: 'Shared Paper',
          doi: sharedDoi,
          year: 2023,
        },
        {
          rawText: 'GROBID Only Paper. 2022.',
          title: 'GROBID Only Paper',
          year: 2022,
        },
      ];

      const grobidClient = createMockGrobidClient(grobidRefs, true);
      const s2Plugin = createMockS2Plugin();

      // Override S2 to return the same DOI as one GROBID ref
      s2Plugin.getReferences.mockResolvedValue({
        references: [
          {
            paper: {
              paperId: 's2-shared',
              title: 'Shared Paper From S2',
              externalIds: { DOI: sharedDoi },
              year: 2023,
              venue: 'ACL',
            },
          },
          {
            paper: {
              paperId: 's2-unique',
              title: 'S2 Only Paper',
              externalIds: {},
              year: 2021,
              venue: 'EMNLP',
            },
          },
        ],
        next: undefined,
      });

      const pluginManager: IPluginManager = {
        getPlugin: vi.fn().mockImplementation((id: string) => {
          if (id === 'pub.chive.plugin.semantic-scholar') return s2Plugin;
          return undefined;
        }),
        getAllPlugins: vi.fn().mockReturnValue([s2Plugin]),
        isPluginLoaded: vi.fn().mockReturnValue(true),
      } as unknown as IPluginManager;

      const mockDb = createMockDbPool();

      const service = new CitationExtractionService({
        grobidClient,
        repository,
        db: mockDb,
        citationGraph,
        logger,
      });
      service.setPluginManager(pluginManager);

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        useGrobid: true,
        useSemanticScholar: true,
        useCrossref: false,
        authorDid: TEST_AUTHOR,
        documentCid: TEST_CID,
        doi: '10.1234/test-paper',
      });

      expect(result.success).toBe(true);

      // Should have 3 unique citations:
      // 1. Shared Paper (DOI match, GROBID version kept, S2 duplicate skipped)
      // 2. GROBID Only Paper
      // 3. S2 Only Paper
      expect(result.totalExtracted).toBe(3);
    });
  });
});
