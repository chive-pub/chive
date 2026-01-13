/**
 * Unit tests for ImportService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ImportService } from '../../../../src/services/import/import-service.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { ImportSource } from '../../../../src/types/interfaces/plugin.interface.js';

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

interface MockDatabasePool {
  query: ReturnType<typeof vi.fn>;
}

const createMockDatabasePool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
});

// ============================================================================
// Sample Data (based on real linguistics research)
// ============================================================================

/**
 * Sample imported eprint row based on real paper metadata.
 *
 * Uses data from White & Rawlins (2020), DOI: 10.5334/gjgl.1001
 */
const SAMPLE_IMPORT_ROW = {
  id: 1,
  source: 'arxiv',
  external_id: 'arxiv.2001.12345',
  external_url: 'https://arxiv.org/abs/2001.12345',
  title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
  abstract:
    'The MegaAcceptability dataset provides acceptability judgments on the distribution of 1,000 attitude verbs in 50 syntactic frames in English.',
  authors: JSON.stringify([
    { name: 'Aaron Steven White', orcid: '0000-0002-4921-5202' },
    { name: 'Kyle Rawlins' },
  ]),
  publication_date: new Date('2020-01-15'),
  original_categories: ['cs.CL', 'linguistics'],
  doi: '10.5334/gjgl.1001',
  pdf_url: 'https://arxiv.org/pdf/2001.12345.pdf',
  imported_by_plugin: 'pub.chive.plugin.arxiv',
  imported_at: new Date('2024-01-15T10:00:00Z'),
  last_synced_at: new Date('2024-01-15T12:00:00Z'),
  sync_status: 'active',
  claim_status: 'unclaimed',
  canonical_uri: null,
  claimed_by_did: null,
  claimed_at: null,
  metadata: null,
};

/**
 * Sample eprint from LingBuzz based on Charlow (2014).
 */
const SAMPLE_LINGBUZZ_ROW = {
  ...SAMPLE_IMPORT_ROW,
  id: 2,
  source: 'lingbuzz',
  external_id: '006789',
  external_url: 'https://ling.auf.net/lingbuzz/006789',
  title: 'On the Semantics of Exceptional Scope',
  abstract: 'This dissertation motivates a new theory of exceptional scope phenomena.',
  authors: JSON.stringify([{ name: 'Simon Charlow' }]),
  publication_date: new Date('2014-09-01'),
  original_categories: ['semantics', 'syntax'],
  doi: null,
  pdf_url: 'https://ling.auf.net/lingbuzz/006789/current.pdf',
  imported_by_plugin: 'pub.chive.plugin.lingbuzz',
};

// ============================================================================
// Tests
// ============================================================================

describe('ImportService', () => {
  let service: ImportService;
  let logger: ILogger;
  let db: MockDatabasePool;

  beforeEach(() => {
    logger = createMockLogger();
    db = createMockDatabasePool();
    service = new ImportService(logger, db as unknown as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exists', () => {
    it('should return true if import exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      const result = await service.exists('arxiv', 'arxiv.2001.12345');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('EXISTS'), [
        'arxiv',
        'arxiv.2001.12345',
      ]);
    });

    it('should return false if import does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await service.exists('arxiv', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should return false if query returns no rows', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.exists('arxiv', 'arxiv.2001.12345');

      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should return imported eprint by source and external ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      const result = await service.get('arxiv', 'arxiv.2001.12345');

      expect(result).toMatchObject({
        id: 1,
        source: 'arxiv',
        externalId: 'arxiv.2001.12345',
        title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
      });
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.get('arxiv', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should parse authors JSON', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      const result = await service.get('arxiv', 'arxiv.2001.12345');

      expect(result?.authors).toEqual([
        { name: 'Aaron Steven White', orcid: '0000-0002-4921-5202' },
        { name: 'Kyle Rawlins' },
      ]);
    });
  });

  describe('getById', () => {
    it('should return imported eprint by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      const result = await service.getById(1);

      expect(result).toMatchObject({
        id: 1,
        source: 'arxiv',
        externalId: 'arxiv.2001.12345',
      });
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new import', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      const result = await service.create({
        source: 'arxiv' as ImportSource,
        externalId: 'arxiv.2001.12345',
        externalUrl: 'https://arxiv.org/abs/2001.12345',
        title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
        abstract: 'The MegaAcceptability dataset...',
        authors: [
          { name: 'Aaron Steven White', orcid: '0000-0002-4921-5202' },
          { name: 'Kyle Rawlins' },
        ],
        publicationDate: new Date('2020-01-15'),
        doi: '10.5334/gjgl.1001',
        pdfUrl: 'https://arxiv.org/pdf/2001.12345.pdf',
        categories: ['cs.CL', 'linguistics'],
        importedByPlugin: 'pub.chive.plugin.arxiv',
      });

      expect(result.id).toBe(1);
      expect(result.source).toBe('arxiv');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO imported_eprints'),
        expect.any(Array)
      );
    });

    it('should handle optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_LINGBUZZ_ROW] });

      const result = await service.create({
        source: 'lingbuzz' as ImportSource,
        externalId: '006789',
        externalUrl: 'https://ling.auf.net/lingbuzz/006789',
        title: 'On the Semantics of Exceptional Scope',
        authors: [{ name: 'Simon Charlow' }],
        importedByPlugin: 'pub.chive.plugin.lingbuzz',
      });

      expect(result.source).toBe('lingbuzz');
      expect(result.doi).toBeUndefined();
    });

    it('should throw DatabaseError if no row returned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.create({
          source: 'arxiv' as ImportSource,
          externalId: 'test',
          externalUrl: 'https://example.com',
          title: 'Test',
          authors: [],
          importedByPlugin: 'test',
        })
      ).rejects.toThrow('Failed to create imported eprint');
    });

    it('should log info on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      await service.create({
        source: 'arxiv' as ImportSource,
        externalId: 'arxiv.2001.12345',
        externalUrl: 'https://arxiv.org/abs/2001.12345',
        title: 'Test',
        authors: [],
        importedByPlugin: 'test',
      });

      expect(logger.info).toHaveBeenCalledWith('Import created', expect.any(Object));
    });
  });

  describe('update', () => {
    it('should update specified fields', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_IMPORT_ROW, title: 'Updated Title' }],
      });

      const result = await service.update(1, {
        title: 'Updated Title',
        abstract: 'Updated abstract',
      });

      expect(result.title).toBe('Updated Title');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE imported_eprints'),
        expect.arrayContaining(['Updated Title', 'Updated abstract', 1])
      );
    });

    it('should return existing if no updates provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      const result = await service.update(1, {});

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [1]);
    });

    it('should throw NotFoundError if ID does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.update(999, { title: 'Test' })).rejects.toThrow('not found');
    });

    it('should update claim status', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            ...SAMPLE_IMPORT_ROW,
            claim_status: 'claimed',
            claimed_by_did: 'did:plc:aswhite',
          },
        ],
      });

      const result = await service.update(1, {
        claimStatus: 'claimed',
        claimedByDid: 'did:plc:aswhite',
        claimedAt: new Date(),
      });

      expect(result.claimStatus).toBe('claimed');
    });
  });

  describe('search', () => {
    it('should return all eprints without filters', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW, SAMPLE_LINGBUZZ_ROW] });

      const result = await service.search({});

      expect(result.eprints).toHaveLength(2);
    });

    it('should filter by source', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      await service.search({ source: 'arxiv' as ImportSource });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('source = $'),
        expect.arrayContaining(['arxiv'])
      );
    });

    it('should filter by claim status', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      await service.search({ claimStatus: 'unclaimed' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('claim_status = $'),
        expect.arrayContaining(['unclaimed'])
      );
    });

    it('should handle pagination with cursor', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_LINGBUZZ_ROW] });

      await service.search({ cursor: '1' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('id > $'),
        expect.arrayContaining([1])
      );
    });

    it('should return cursor for more results', async () => {
      const rows = [SAMPLE_IMPORT_ROW, SAMPLE_LINGBUZZ_ROW, { ...SAMPLE_IMPORT_ROW, id: 3 }];
      db.query.mockResolvedValueOnce({ rows });

      const result = await service.search({ limit: 2 });

      expect(result.eprints).toHaveLength(2);
      expect(result.cursor).toBe('2');
    });

    it('should filter by author name', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      await service.search({ authorName: 'Aaron Steven White' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('authors::jsonb @>'),
        expect.any(Array)
      );
    });

    it('should filter by author ORCID', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_IMPORT_ROW] });

      await service.search({ authorOrcid: '0000-0002-4921-5202' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('authors::jsonb @>'),
        expect.any(Array)
      );
    });
  });

  describe('markClaimed', () => {
    it('should mark eprint as claimed', async () => {
      const claimedRow = {
        ...SAMPLE_IMPORT_ROW,
        claim_status: 'claimed',
        canonical_uri: 'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude',
        claimed_by_did: 'did:plc:aswhite',
        claimed_at: new Date('2024-01-16T10:00:00Z'),
      };
      db.query.mockResolvedValueOnce({ rows: [claimedRow] });

      await service.markClaimed(
        1,
        'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude',
        'did:plc:aswhite'
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE imported_eprints'),
        expect.arrayContaining(['claimed', 'did:plc:aswhite'])
      );
    });

    it('should log info on success', async () => {
      const claimedRow = {
        ...SAMPLE_IMPORT_ROW,
        claim_status: 'claimed',
      };
      db.query.mockResolvedValueOnce({ rows: [claimedRow] });

      await service.markClaimed(
        1,
        'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude',
        'did:plc:aswhite'
      );

      expect(logger.info).toHaveBeenCalledWith('Import marked as claimed', expect.any(Object));
    });
  });
});
