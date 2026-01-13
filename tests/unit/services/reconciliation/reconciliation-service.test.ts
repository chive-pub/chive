/**
 * Unit tests for ReconciliationService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ReconciliationService } from '../../../../src/services/reconciliation/reconciliation-service.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { ClaimEvidence } from '../../../../src/types/interfaces/plugin.interface.js';

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

interface MockGovernancePdsClient {
  createRecord: ReturnType<typeof vi.fn>;
}

const createMockGovernancePdsClient = (): MockGovernancePdsClient => ({
  createRecord: vi.fn().mockResolvedValue({
    uri: 'at://did:plc:chive-governance/pub.chive.graph.reconciliation/abc123',
    cid: 'bafyreiexample',
  }),
});

// ============================================================================
// Sample Data (based on real linguistics research)
// ============================================================================

/**
 * Sample AT-URIs for reconciliation tests.
 *
 * Uses White & Rawlins (2020) as example paper.
 */
const SAMPLE_IMPORT_URI = 'chive:import:arxiv:2001.12345';
const SAMPLE_CANONICAL_URI = 'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude';

const SAMPLE_RECONCILIATION_ROW = {
  id: 1,
  import_uri: SAMPLE_IMPORT_URI,
  canonical_uri: SAMPLE_CANONICAL_URI,
  reconciliation_type: 'claim',
  evidence: JSON.stringify([
    { type: 'orcid-match', score: 1.0 },
    { type: 'semantic-scholar-match', score: 0.9 },
  ]),
  status: 'verified',
  verified_by: 'did:plc:moderator',
  verified_at: new Date('2024-01-15T12:00:00Z'),
  notes: null,
  atproto_uri: null,
  atproto_cid: null,
  created_at: new Date('2024-01-15T10:00:00Z'),
  updated_at: new Date('2024-01-15T12:00:00Z'),
};

const SAMPLE_EVIDENCE: ClaimEvidence[] = [
  { type: 'orcid-match', score: 1.0, details: 'ORCID profile linked' },
  { type: 'semantic-scholar-match', score: 0.9, details: 'Semantic Scholar profile matched' },
];

// ============================================================================
// Tests
// ============================================================================

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let logger: ILogger;
  let db: MockDatabasePool;
  let governancePds: MockGovernancePdsClient;

  beforeEach(() => {
    logger = createMockLogger();
    db = createMockDatabasePool();
    governancePds = createMockGovernancePdsClient();
    service = new ReconciliationService(
      logger,
      db as unknown as never,
      governancePds as unknown as never
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createReconciliation', () => {
    it('should create a new reconciliation record', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] });

      const result = await service.createReconciliation({
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
        reconciliationType: 'claim',
        evidence: SAMPLE_EVIDENCE,
        verifiedBy: 'did:plc:moderator',
      });

      expect(result).toMatchObject({
        id: 1,
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
        reconciliationType: 'claim',
        status: 'verified',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reconciliations'),
        expect.arrayContaining([SAMPLE_IMPORT_URI, SAMPLE_CANONICAL_URI, 'claim'])
      );
    });

    it('should convert claim evidence to reconciliation evidence', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] });

      const result = await service.createReconciliation({
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
        reconciliationType: 'claim',
        evidence: SAMPLE_EVIDENCE,
      });

      expect(result.evidence).toHaveLength(2);
      expect(result.evidence[0]).toMatchObject({ type: 'orcid-match', score: 1.0 });
    });

    it('should handle merge reconciliation type', async () => {
      const mergeRow = { ...SAMPLE_RECONCILIATION_ROW, reconciliation_type: 'merge' };
      db.query.mockResolvedValueOnce({ rows: [mergeRow] });

      const result = await service.createReconciliation({
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
        reconciliationType: 'merge',
        evidence: [],
      });

      expect(result.reconciliationType).toBe('merge');
    });

    it('should handle supersede reconciliation type', async () => {
      const supersedeRow = { ...SAMPLE_RECONCILIATION_ROW, reconciliation_type: 'supersede' };
      db.query.mockResolvedValueOnce({ rows: [supersedeRow] });

      const result = await service.createReconciliation({
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
        reconciliationType: 'supersede',
        evidence: [],
        notes: 'Superseded by new version',
      });

      expect(result.reconciliationType).toBe('supersede');
    });

    it('should throw DatabaseError if no row returned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createReconciliation({
          importUri: SAMPLE_IMPORT_URI,
          canonicalUri: SAMPLE_CANONICAL_URI,
          reconciliationType: 'claim',
          evidence: [],
        })
      ).rejects.toThrow('Failed to create reconciliation');
    });

    it('should log info on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] });

      await service.createReconciliation({
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
        reconciliationType: 'claim',
        evidence: [],
      });

      expect(logger.info).toHaveBeenCalledWith('Reconciliation created', expect.any(Object));
    });

    it('should handle upsert on conflict', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] });

      await service.createReconciliation({
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
        reconciliationType: 'claim',
        evidence: [],
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (import_uri) DO UPDATE'),
        expect.any(Array)
      );
    });
  });

  describe('getByImportUri', () => {
    it('should return reconciliation by import URI', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] });

      const result = await service.getByImportUri(SAMPLE_IMPORT_URI);

      expect(result).toMatchObject({
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
      });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('import_uri = $1'), [
        SAMPLE_IMPORT_URI,
      ]);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getByImportUri('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByCanonicalUri', () => {
    it('should return reconciliation by canonical URI', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] });

      const result = await service.getByCanonicalUri(SAMPLE_CANONICAL_URI);

      expect(result).toMatchObject({
        importUri: SAMPLE_IMPORT_URI,
        canonicalUri: SAMPLE_CANONICAL_URI,
      });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('canonical_uri = $1'), [
        SAMPLE_CANONICAL_URI,
      ]);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getByCanonicalUri('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update status to disputed', async () => {
      const disputedRow = { ...SAMPLE_RECONCILIATION_ROW, status: 'disputed' };
      db.query.mockResolvedValueOnce({ rows: [disputedRow] });

      const result = await service.updateStatus(1, 'disputed', 'Ownership contested');

      expect(result.status).toBe('disputed');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('status = $1'), [
        'disputed',
        'Ownership contested',
        1,
      ]);
    });

    it('should update status to superseded', async () => {
      const supersededRow = { ...SAMPLE_RECONCILIATION_ROW, status: 'superseded' };
      db.query.mockResolvedValueOnce({ rows: [supersededRow] });

      const result = await service.updateStatus(1, 'superseded');

      expect(result.status).toBe('superseded');
    });

    it('should throw NotFoundError if reconciliation does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateStatus(999, 'disputed')).rejects.toThrow('not found');
    });

    it('should log info on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] });

      await service.updateStatus(1, 'verified');

      expect(logger.info).toHaveBeenCalledWith('Reconciliation status updated', expect.any(Object));
    });
  });

  describe('publishToGovernancePds', () => {
    it('should publish reconciliation to Governance PDS', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] }) // getById
        .mockResolvedValueOnce({ rows: [] }); // update with URI/CID

      const result = await service.publishToGovernancePds(1);

      expect(result).toMatchObject({
        uri: expect.stringContaining('at://did:plc:chive-governance'),
        cid: expect.any(String),
      });
      expect(governancePds.createRecord).toHaveBeenCalledWith(
        'pub.chive.graph.reconciliation',
        expect.objectContaining({
          $type: 'pub.chive.graph.reconciliation',
          importUri: SAMPLE_IMPORT_URI,
          canonicalUri: SAMPLE_CANONICAL_URI,
        })
      );
    });

    it('should update local record with AT-URI and CID', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] })
        .mockResolvedValueOnce({ rows: [] });

      await service.publishToGovernancePds(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('atproto_uri = $1'),
        expect.arrayContaining([
          'at://did:plc:chive-governance/pub.chive.graph.reconciliation/abc123',
          'bafyreiexample',
          1,
        ])
      );
    });

    it('should throw ValidationError if Governance PDS not configured', async () => {
      const serviceWithoutPds = new ReconciliationService(logger, db as unknown as never, null);

      await expect(serviceWithoutPds.publishToGovernancePds(1)).rejects.toThrow(
        'Governance PDS client not configured'
      );
    });

    it('should throw NotFoundError if reconciliation does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.publishToGovernancePds(999)).rejects.toThrow('not found');
    });

    it('should log info on success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] })
        .mockResolvedValueOnce({ rows: [] });

      await service.publishToGovernancePds(1);

      expect(logger.info).toHaveBeenCalledWith(
        'Reconciliation published to Governance PDS',
        expect.any(Object)
      );
    });

    it('should include optional fields in record', async () => {
      const rowWithNotes = {
        ...SAMPLE_RECONCILIATION_ROW,
        notes: 'Verified via ORCID OAuth',
      };
      db.query.mockResolvedValueOnce({ rows: [rowWithNotes] }).mockResolvedValueOnce({ rows: [] });

      await service.publishToGovernancePds(1);

      expect(governancePds.createRecord).toHaveBeenCalledWith(
        'pub.chive.graph.reconciliation',
        expect.objectContaining({
          notes: 'Verified via ORCID OAuth',
        })
      );
    });
  });

  describe('row conversion', () => {
    it('should parse evidence JSON correctly', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_RECONCILIATION_ROW] });

      const result = await service.getByImportUri(SAMPLE_IMPORT_URI);

      expect(result?.evidence).toEqual([
        { type: 'orcid-match', score: 1.0 },
        { type: 'semantic-scholar-match', score: 0.9 },
      ]);
    });

    it('should handle null optional fields', async () => {
      const rowWithNulls = {
        ...SAMPLE_RECONCILIATION_ROW,
        verified_by: null,
        verified_at: null,
        notes: null,
        atproto_uri: null,
        atproto_cid: null,
      };
      db.query.mockResolvedValueOnce({ rows: [rowWithNulls] });

      const result = await service.getByImportUri(SAMPLE_IMPORT_URI);

      expect(result?.verifiedBy).toBeUndefined();
      expect(result?.verifiedAt).toBeUndefined();
      expect(result?.notes).toBeUndefined();
      expect(result?.atprotoUri).toBeUndefined();
      expect(result?.atprotoCid).toBeUndefined();
    });

    it('should include AT-URI and CID when present', async () => {
      const rowWithAtproto = {
        ...SAMPLE_RECONCILIATION_ROW,
        atproto_uri: 'at://did:plc:chive-governance/pub.chive.graph.reconciliation/abc123',
        atproto_cid: 'bafyreiexample',
      };
      db.query.mockResolvedValueOnce({ rows: [rowWithAtproto] });

      const result = await service.getByImportUri(SAMPLE_IMPORT_URI);

      expect(result?.atprotoUri).toBe(
        'at://did:plc:chive-governance/pub.chive.graph.reconciliation/abc123'
      );
      expect(result?.atprotoCid).toBe('bafyreiexample');
    });
  });
});
