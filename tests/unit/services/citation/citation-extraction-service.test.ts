/**
 * Unit tests for CitationExtractionService.
 *
 * @remarks
 * Tests the citation extraction orchestration including GROBID extraction,
 * Semantic Scholar enrichment, Crossref resolution, matching against
 * Chive-indexed eprints, storage, and Neo4j graph edge creation.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  CitationExtractionService,
  type ExtractedCitation,
} from '@/services/citation/citation-extraction-service.js';
import type { GrobidClient, GrobidReference } from '@/services/citation/grobid-client.js';
import type { AtUri, CID, DID } from '@/types/atproto.js';
import type { IDatabasePool } from '@/types/interfaces/database.interface.js';
import type { ICitationGraph } from '@/types/interfaces/discovery.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IPluginManager } from '@/types/interfaces/plugin.interface.js';
import type { IRepository } from '@/types/interfaces/repository.interface.js';

// ============================================================================
// Mock: observability (withSpan passthrough, no-op metrics)
// ============================================================================

vi.mock('@/observability/tracer.js', () => ({
  withSpan: vi.fn((_name: string, fn: () => unknown) => Promise.resolve(fn())),
  addSpanAttributes: vi.fn(),
  recordSpanError: vi.fn(),
}));

vi.mock('@/observability/prometheus-registry.js', () => ({
  citationMetrics: {
    extractionsTotal: { inc: vi.fn() },
    citationsExtracted: { inc: vi.fn() },
    citationsMatched: { inc: vi.fn() },
    extractionDuration: {
      startTimer: vi.fn(() => vi.fn()),
    },
  },
}));

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

interface MockDatabasePool extends IDatabasePool {
  query: ReturnType<typeof vi.fn> & IDatabasePool['query'];
}

const createMockDatabasePool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
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
  getCitingPapers: vi.fn().mockResolvedValue({ citations: [], total: 0, hasMore: false }),
  getReferences: vi.fn().mockResolvedValue({ citations: [], total: 0, hasMore: false }),
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

interface MockGrobidClient {
  extractReferences: ReturnType<typeof vi.fn>;
  isAvailable: ReturnType<typeof vi.fn>;
}

const createMockGrobidClient = (): MockGrobidClient => ({
  extractReferences: vi.fn().mockResolvedValue([]),
  isAvailable: vi.fn().mockResolvedValue(true),
});

const createMockRepository = (): {
  getRecord: ReturnType<typeof vi.fn>;
  listRecords: ReturnType<typeof vi.fn>;
  getBlob: ReturnType<typeof vi.fn>;
} => ({
  getRecord: vi.fn().mockResolvedValue(null),
  listRecords: vi.fn(),
  getBlob: vi.fn().mockResolvedValue(createMockReadableStream(Buffer.from('fake-pdf'))),
});

/**
 * Creates a mock ReadableStream from a Buffer (simulates PDS blob fetch).
 */
function createMockReadableStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

interface MockS2Plugin {
  id: string;
  getPaperByDoi: ReturnType<typeof vi.fn>;
  getReferences: ReturnType<typeof vi.fn>;
}

const createMockS2Plugin = (): MockS2Plugin => ({
  id: 'pub.chive.plugin.semantic-scholar',
  getPaperByDoi: vi.fn().mockResolvedValue({ paperId: 's2-paper-123' }),
  getReferences: vi.fn().mockResolvedValue({
    references: [],
    next: undefined,
  }),
});

const createMockPluginManager = (
  s2Plugin?: MockS2Plugin
): { getPlugin: ReturnType<typeof vi.fn> } => ({
  getPlugin: vi.fn().mockImplementation((id: string) => {
    if (id === 'pub.chive.plugin.semantic-scholar') return s2Plugin;
    return undefined;
  }),
});

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_EPRINT_URI = 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789' as AtUri;
const TEST_AUTHOR_DID = 'did:plc:abc123' as DID;
const TEST_DOCUMENT_CID = 'bafyreib2rxk3example' as CID;

const GROBID_REFS: GrobidReference[] = [
  {
    rawText: 'Smith et al. "Machine Learning," ICML 2020.',
    title: 'Machine Learning Fundamentals',
    authors: [{ firstName: 'Alice', lastName: 'Smith' }],
    doi: '10.1234/ml-fundamentals',
    year: 2020,
    journal: 'ICML',
  },
  {
    rawText: 'Jones, B. "Deep Learning." NeurIPS 2021.',
    title: 'Deep Learning Advances',
    authors: [{ firstName: 'Bob', lastName: 'Jones' }],
    year: 2021,
    journal: 'NeurIPS',
  },
  {
    rawText: 'Chen, C. "Transformers." 2022.',
    title: 'Transformers in NLP',
    authors: [{ lastName: 'Chen' }],
    doi: '10.5678/transformers',
    year: 2022,
  },
];

const S2_REFERENCES = [
  {
    paper: {
      title: 'Machine Learning Fundamentals',
      externalIds: { DOI: '10.1234/ml-fundamentals' },
      year: 2020,
      venue: 'ICML',
    },
  },
  {
    paper: {
      title: 'A New Paper from S2',
      externalIds: { DOI: '10.9999/new-paper' },
      year: 2023,
      venue: 'ACL',
    },
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('CitationExtractionService', () => {
  let service: CitationExtractionService;
  let grobidClient: MockGrobidClient;
  let repository: ReturnType<typeof createMockRepository>;
  let db: MockDatabasePool;
  let citationGraph: MockCitationGraph;
  let logger: ILogger;

  beforeEach(() => {
    grobidClient = createMockGrobidClient();
    repository = createMockRepository();
    db = createMockDatabasePool();
    citationGraph = createMockCitationGraph();
    logger = createMockLogger();

    service = new CitationExtractionService({
      grobidClient: grobidClient as unknown as GrobidClient,
      repository: repository as unknown as IRepository,
      db: db as IDatabasePool,
      citationGraph: citationGraph as unknown as ICitationGraph,
      logger,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // extractCitations: GROBID-only extraction
  // ==========================================================================

  describe('extractCitations', () => {
    it('extracts citations using GROBID when PDF blob is available', async () => {
      grobidClient.extractReferences.mockResolvedValue(GROBID_REFS);

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
        useCrossref: false,
      });

      expect(result.success).toBe(true);
      expect(result.grobidCount).toBe(3);
      expect(result.totalExtracted).toBe(3);
      expect(result.eprintUri).toBe(TEST_EPRINT_URI);

      // Verify GROBID was called
      expect(grobidClient.isAvailable).toHaveBeenCalled();
      expect(grobidClient.extractReferences).toHaveBeenCalled();

      // Verify blob was fetched from PDS
      expect(repository.getBlob).toHaveBeenCalledWith(TEST_AUTHOR_DID, TEST_DOCUMENT_CID);
    });

    it('skips GROBID when authorDid or documentCid is not provided', async () => {
      const result = await service.extractCitations(TEST_EPRINT_URI, {
        useSemanticScholar: false,
        useCrossref: false,
      });

      expect(result.success).toBe(true);
      expect(result.grobidCount).toBe(0);
      expect(result.totalExtracted).toBe(0);
      expect(grobidClient.extractReferences).not.toHaveBeenCalled();
    });

    it('skips GROBID when useGrobid is explicitly false', async () => {
      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useGrobid: false,
        useSemanticScholar: false,
        useCrossref: false,
      });

      expect(result.grobidCount).toBe(0);
      expect(grobidClient.extractReferences).not.toHaveBeenCalled();
    });

    // ========================================================================
    // extractCitations: graceful degradation
    // ========================================================================

    it('degrades gracefully when GROBID is unavailable', async () => {
      grobidClient.isAvailable.mockResolvedValue(false);

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
        useCrossref: false,
      });

      expect(result.success).toBe(true);
      expect(result.grobidCount).toBe(0);
      expect(grobidClient.extractReferences).not.toHaveBeenCalled();
    });

    it('degrades gracefully when GROBID extraction throws', async () => {
      grobidClient.isAvailable.mockResolvedValue(true);
      grobidClient.extractReferences.mockRejectedValue(new Error('GROBID crashed'));

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
        useCrossref: false,
      });

      expect(result.success).toBe(true);
      expect(result.grobidCount).toBe(0);
    });

    // ========================================================================
    // extractCitations: hybrid extraction (GROBID + S2)
    // ========================================================================

    it('enriches with Semantic Scholar when DOI is available', async () => {
      grobidClient.extractReferences.mockResolvedValue(GROBID_REFS);

      const s2Plugin = createMockS2Plugin();
      s2Plugin.getReferences.mockResolvedValue({
        references: S2_REFERENCES,
        next: undefined,
      });

      const pluginManager = createMockPluginManager(s2Plugin);
      service.setPluginManager(pluginManager as unknown as IPluginManager);

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        doi: '10.1234/my-paper',
        useCrossref: false,
      });

      expect(result.success).toBe(true);
      expect(result.grobidCount).toBe(3);
      expect(result.semanticScholarCount).toBe(2);
      // S2 found 2 refs but one has DOI already in GROBID results, so it is deduplicated
      // Total: 3 from GROBID + 1 new from S2 = 4
      expect(result.totalExtracted).toBe(4);
    });

    it('deduplicates S2 references that share DOIs with GROBID results', async () => {
      grobidClient.extractReferences.mockResolvedValue([
        {
          rawText: 'Smith et al. 2020',
          title: 'Existing Paper',
          doi: '10.1234/existing',
          year: 2020,
        },
      ]);

      const s2Plugin = createMockS2Plugin();
      s2Plugin.getReferences.mockResolvedValue({
        references: [
          {
            paper: {
              title: 'Existing Paper (S2 version)',
              externalIds: { DOI: '10.1234/existing' },
              year: 2020,
              venue: 'ICML',
            },
          },
          {
            paper: {
              title: 'New Paper Only In S2',
              externalIds: {},
              year: 2023,
              venue: 'NeurIPS',
            },
          },
        ],
        next: undefined,
      });

      const pluginManager = createMockPluginManager(s2Plugin);
      service.setPluginManager(pluginManager as unknown as IPluginManager);

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        doi: '10.1234/my-paper',
        useCrossref: false,
      });

      // 1 from GROBID + 1 new (non-duplicate) from S2 = 2
      expect(result.totalExtracted).toBe(2);
    });

    it('continues when S2 enrichment fails', async () => {
      grobidClient.extractReferences.mockResolvedValue(GROBID_REFS);

      const s2Plugin = createMockS2Plugin();
      s2Plugin.getPaperByDoi.mockRejectedValue(new Error('S2 API down'));

      const pluginManager = createMockPluginManager(s2Plugin);
      service.setPluginManager(pluginManager as unknown as IPluginManager);

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        doi: '10.1234/my-paper',
        useCrossref: false,
      });

      expect(result.success).toBe(true);
      expect(result.grobidCount).toBe(3);
      expect(result.semanticScholarCount).toBe(0);
    });

    it('skips S2 when plugin manager is not configured', async () => {
      grobidClient.extractReferences.mockResolvedValue(GROBID_REFS);

      // No pluginManager set
      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        doi: '10.1234/my-paper',
        useCrossref: false,
      });

      expect(result.semanticScholarCount).toBe(0);
    });

    // ========================================================================
    // extractCitations: storage and graph
    // ========================================================================

    it('stores extracted citations in PostgreSQL', async () => {
      grobidClient.extractReferences.mockResolvedValue(GROBID_REFS);

      await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
        useCrossref: false,
      });

      // Should delete existing then insert new
      const deleteCall = db.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('DELETE FROM extracted_citations')
      );
      expect(deleteCall).toBeDefined();

      const insertCall = db.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO extracted_citations')
      );
      expect(insertCall).toBeDefined();
    });

    it('creates CITES edges in Neo4j for matched citations', async () => {
      grobidClient.extractReferences.mockResolvedValue([
        {
          rawText: 'A paper with DOI',
          title: 'Matched Paper',
          doi: '10.1234/matched',
          year: 2020,
        },
      ]);

      // Mock DOI match in database
      db.query.mockImplementation((text: string) => {
        if (
          typeof text === 'string' &&
          text.includes('eprints_index') &&
          text.includes("published_version->>'doi'")
        ) {
          return {
            rows: [{ uri: 'at://did:plc:other/pub.chive.eprint.submission/matched123' as AtUri }],
          };
        }
        return { rows: [] };
      });

      await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
        useCrossref: false,
      });

      expect(citationGraph.upsertCitationsBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            citingUri: TEST_EPRINT_URI,
            citedUri: 'at://did:plc:other/pub.chive.eprint.submission/matched123',
            source: 'grobid',
          }),
        ])
      );
    });

    it('does not create graph edges when no citations match', async () => {
      grobidClient.extractReferences.mockResolvedValue(GROBID_REFS);
      // db.query returns empty rows by default (no matches)

      await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
        useCrossref: false,
      });

      expect(citationGraph.upsertCitationsBatch).not.toHaveBeenCalled();
    });

    it('returns correct result summary with all source counts', async () => {
      grobidClient.extractReferences.mockResolvedValue(GROBID_REFS);

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
        useCrossref: false,
      });

      expect(result).toEqual(
        expect.objectContaining({
          eprintUri: TEST_EPRINT_URI,
          totalExtracted: 3,
          grobidCount: 3,
          semanticScholarCount: 0,
          crossrefCount: 0,
          matchedToChive: 0,
          success: true,
          durationMs: expect.any(Number),
        })
      );
    });
  });

  // ==========================================================================
  // getExtractedCitations
  // ==========================================================================

  describe('getExtractedCitations', () => {
    it('queries stored citations from PostgreSQL', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            eprint_uri: TEST_EPRINT_URI,
            raw_text: 'Smith et al. 2020',
            title: 'ML Paper',
            authors: JSON.stringify([{ firstName: 'Alice', lastName: 'Smith' }]),
            doi: '10.1234/ml',
            year: 2020,
            venue: 'ICML',
            volume: '37',
            pages: '100-110',
            source: 'grobid',
            chive_match_uri: null,
            match_confidence: null,
            match_method: null,
            created_at: new Date(),
          },
        ],
      });

      const citations = await service.getExtractedCitations(TEST_EPRINT_URI);

      expect(citations).toHaveLength(1);
      expect(citations[0]).toEqual(
        expect.objectContaining({
          eprintUri: TEST_EPRINT_URI,
          rawText: 'Smith et al. 2020',
          title: 'ML Paper',
          doi: '10.1234/ml',
          year: 2020,
          venue: 'ICML',
          source: 'grobid',
        })
      );
      expect(citations[0]!.authors).toEqual([{ firstName: 'Alice', lastName: 'Smith' }]);
    });

    it('passes limit and offset parameters', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await service.getExtractedCitations(TEST_EPRINT_URI, { limit: 50, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([TEST_EPRINT_URI, 50, 10])
      );
    });

    it('filters to matched-only citations when option is set', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await service.getExtractedCitations(TEST_EPRINT_URI, { matchedOnly: true });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('chive_match_uri IS NOT NULL'),
        expect.any(Array)
      );
    });

    it('handles null authors column gracefully', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            eprint_uri: TEST_EPRINT_URI,
            raw_text: 'Some citation',
            title: 'Title',
            authors: null,
            doi: null,
            year: null,
            venue: null,
            volume: null,
            pages: null,
            source: 'grobid',
            chive_match_uri: null,
            match_confidence: null,
            match_method: null,
            created_at: new Date(),
          },
        ],
      });

      const citations = await service.getExtractedCitations(TEST_EPRINT_URI);

      expect(citations).toHaveLength(1);
      expect(citations[0]!.authors).toBeUndefined();
    });

    it('handles invalid JSON in authors column gracefully', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            eprint_uri: TEST_EPRINT_URI,
            raw_text: 'Some citation',
            title: 'Title',
            authors: 'not-valid-json',
            doi: null,
            year: null,
            venue: null,
            volume: null,
            pages: null,
            source: 'grobid',
            chive_match_uri: null,
            match_confidence: null,
            match_method: null,
            created_at: new Date(),
          },
        ],
      });

      const citations = await service.getExtractedCitations(TEST_EPRINT_URI);

      expect(citations).toHaveLength(1);
      expect(citations[0]!.authors).toBeUndefined();
    });

    it('uses default limit of 100 and offset of 0', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await service.getExtractedCitations(TEST_EPRINT_URI);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([TEST_EPRINT_URI, 100, 0])
      );
    });
  });

  // ==========================================================================
  // matchCitationsToChive
  // ==========================================================================

  describe('matchCitationsToChive', () => {
    it('matches by DOI with confidence 1.0', async () => {
      const matchedUri = 'at://did:plc:match/pub.chive.eprint.submission/abc' as AtUri;

      db.query.mockImplementation((text: string) => {
        if (typeof text === 'string' && text.includes("published_version->>'doi'")) {
          return { rows: [{ uri: matchedUri }] };
        }
        return { rows: [] };
      });

      const citations: ExtractedCitation[] = [
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'Some citation',
          title: 'A Paper',
          doi: '10.1234/matched',
          source: 'grobid',
        },
      ];

      const matched = await service.matchCitationsToChive(citations);

      expect(matched).toHaveLength(1);
      expect(matched[0]!.matchConfidence).toBe(1.0);
      expect(matched[0]!.matchMethod).toBe('doi');
      expect(matched[0]!.chiveMatchUri).toBe(matchedUri);
    });

    it('falls back to title match with confidence 0.8 when DOI is absent', async () => {
      const matchedUri = 'at://did:plc:match/pub.chive.eprint.submission/def' as AtUri;

      db.query.mockImplementation((text: string) => {
        if (typeof text === 'string' && text.includes('REGEXP_REPLACE')) {
          return { rows: [{ uri: matchedUri, title: 'a paper title' }] };
        }
        return { rows: [] };
      });

      const citations: ExtractedCitation[] = [
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'A Paper Title, 2020.',
          title: 'A Paper Title',
          source: 'grobid',
        },
      ];

      const matched = await service.matchCitationsToChive(citations);

      expect(matched).toHaveLength(1);
      expect(matched[0]!.matchConfidence).toBe(0.8);
      expect(matched[0]!.matchMethod).toBe('title');
      expect(matched[0]!.chiveMatchUri).toBe(matchedUri);
    });

    it('prefers DOI match over title match', async () => {
      const doiUri = 'at://did:plc:match/pub.chive.eprint.submission/doi-match' as AtUri;

      db.query.mockImplementation((text: string) => {
        if (typeof text === 'string' && text.includes("published_version->>'doi'")) {
          return { rows: [{ uri: doiUri }] };
        }
        // Title match would also succeed but should not be reached
        return { rows: [{ uri: 'at://other', title: 'Other' }] };
      });

      const citations: ExtractedCitation[] = [
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'Citation with both DOI and title',
          title: 'Both Fields Present',
          doi: '10.1234/both',
          source: 'grobid',
        },
      ];

      const matched = await service.matchCitationsToChive(citations);

      expect(matched[0]!.matchConfidence).toBe(1.0);
      expect(matched[0]!.matchMethod).toBe('doi');
      expect(matched[0]!.chiveMatchUri).toBe(doiUri);
    });

    it('returns unmatched citations with zero confidence', async () => {
      // db.query returns empty rows by default (no matches)
      const citations: ExtractedCitation[] = [
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'Unknown paper with no match',
          title: 'No Match Paper',
          doi: '10.9999/no-match',
          source: 'grobid',
        },
      ];

      const matched = await service.matchCitationsToChive(citations);

      expect(matched).toHaveLength(1);
      expect(matched[0]!.matchConfidence).toBe(0);
      expect(matched[0]!.chiveMatchUri).toBeUndefined();
    });

    it('returns empty array for empty input', async () => {
      const matched = await service.matchCitationsToChive([]);

      expect(matched).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('matches multiple citations independently', async () => {
      const uri1 = 'at://did:plc:match/pub.chive.eprint.submission/aaa' as AtUri;

      let callCount = 0;
      db.query.mockImplementation((text: string) => {
        if (typeof text === 'string' && text.includes("published_version->>'doi'")) {
          callCount++;
          if (callCount === 1) return { rows: [{ uri: uri1 }] };
          return { rows: [] };
        }
        return { rows: [] };
      });

      const citations: ExtractedCitation[] = [
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'First citation',
          doi: '10.1234/first',
          source: 'grobid',
        },
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'Second citation',
          doi: '10.1234/second',
          source: 'grobid',
        },
      ];

      const matched = await service.matchCitationsToChive(citations);

      expect(matched).toHaveLength(2);
      expect(matched[0]!.matchConfidence).toBe(1.0);
      expect(matched[1]!.matchConfidence).toBe(0);
    });

    it('skips title match for very short titles', async () => {
      // normalizeTitle strips punctuation; titles shorter than 10 chars
      // after normalization are skipped by findEprintByTitle
      const citations: ExtractedCitation[] = [
        {
          eprintUri: TEST_EPRINT_URI,
          rawText: 'Short',
          title: 'Hi',
          source: 'grobid',
        },
      ];

      const matched = await service.matchCitationsToChive(citations);

      expect(matched[0]!.matchConfidence).toBe(0);
      expect(matched[0]!.chiveMatchUri).toBeUndefined();
    });
  });

  // ==========================================================================
  // Crossref enrichment
  // ==========================================================================

  describe('Crossref enrichment', () => {
    it('enriches citations that have DOIs but missing metadata', async () => {
      const mockCrossrefClient = {
        work: vi.fn().mockResolvedValue({
          ok: true,
          content: {
            message: {
              title: ['Enriched Title'],
              published: { dateParts: [[2021]] },
              containerTitle: ['Enriched Journal'],
            },
          },
        }),
      };

      const serviceWithCrossref = new CitationExtractionService({
        grobidClient: grobidClient as unknown as GrobidClient,
        repository: repository as unknown as IRepository,
        db: db as IDatabasePool,
        citationGraph: citationGraph as unknown as ICitationGraph,
        logger,
        crossrefClient: mockCrossrefClient as never,
      });

      grobidClient.extractReferences.mockResolvedValue([
        {
          rawText: 'Citation with DOI only',
          doi: '10.1234/needs-enrichment',
        },
      ]);

      const result = await serviceWithCrossref.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
      });

      expect(result.crossrefCount).toBe(1);
      expect(mockCrossrefClient.work).toHaveBeenCalledWith('10.1234/needs-enrichment');
    });

    it('skips Crossref when crossrefClient is not configured', async () => {
      grobidClient.extractReferences.mockResolvedValue(GROBID_REFS);

      const result = await service.extractCitations(TEST_EPRINT_URI, {
        authorDid: TEST_AUTHOR_DID,
        documentCid: TEST_DOCUMENT_CID,
        useSemanticScholar: false,
      });

      // No crossrefClient on default service
      expect(result.crossrefCount).toBe(0);
    });
  });

  // ==========================================================================
  // setPluginManager
  // ==========================================================================

  describe('setPluginManager', () => {
    it('enables Semantic Scholar enrichment after configuration', async () => {
      const s2Plugin = createMockS2Plugin();
      s2Plugin.getReferences.mockResolvedValue({
        references: S2_REFERENCES,
        next: undefined,
      });

      const pluginManager = createMockPluginManager(s2Plugin);

      // Before setting plugin manager, S2 enrichment should not run
      grobidClient.extractReferences.mockResolvedValue([]);

      const resultBefore = await service.extractCitations(TEST_EPRINT_URI, {
        doi: '10.1234/test',
        useCrossref: false,
        useGrobid: false,
      });
      expect(resultBefore.semanticScholarCount).toBe(0);

      // After setting plugin manager, S2 enrichment should work
      service.setPluginManager(pluginManager as unknown as IPluginManager);

      const resultAfter = await service.extractCitations(TEST_EPRINT_URI, {
        doi: '10.1234/test',
        useCrossref: false,
        useGrobid: false,
      });
      expect(resultAfter.semanticScholarCount).toBe(2);
    });
  });
});
