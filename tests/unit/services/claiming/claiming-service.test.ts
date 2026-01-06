/**
 * Unit tests for ClaimingService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ClaimingService } from '../../../../src/services/claiming/claiming-service.js';
import type { IIdentityResolver } from '../../../../src/types/interfaces/identity.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ClaimEvidence,
  IImportService,
  ImportedPreprint,
} from '../../../../src/types/interfaces/plugin.interface.js';

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
 * Database pool interface matching ClaimingService expectations.
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

const createMockImportService = (): IImportService => ({
  exists: vi.fn().mockResolvedValue(false),
  get: vi.fn().mockResolvedValue(null),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn().mockResolvedValue({}),
  search: vi.fn().mockResolvedValue({ preprints: [] }),
  markClaimed: vi.fn(),
});

const createMockIdentityResolver = (): IIdentityResolver => ({
  resolveDID: vi.fn().mockResolvedValue({
    id: 'did:plc:test',
    verificationMethod: [],
    alsoKnownAs: ['at://test.user'],
  }),
  resolveHandle: vi.fn().mockResolvedValue('did:plc:test'),
  getPDSEndpoint: vi.fn().mockResolvedValue('https://pds.example.com'),
});

// ============================================================================
// Sample Data (based on real linguistics research)
// ============================================================================

/**
 * Sample imported preprint for claiming tests.
 *
 * Uses data from White & Rawlins (2020), DOI: 10.5334/gjgl.1001
 */
const SAMPLE_IMPORTED_PREPRINT: ImportedPreprint = {
  id: 1,
  source: 'arxiv',
  externalId: 'arxiv.2001.12345',
  url: 'https://arxiv.org/abs/2001.12345',
  title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
  abstract: 'The MegaAcceptability dataset provides acceptability judgments.',
  authors: [{ name: 'Aaron Steven White', orcid: '0000-0002-4921-5202' }, { name: 'Kyle Rawlins' }],
  publicationDate: new Date('2020-01-15'),
  categories: ['cs.CL', 'linguistics'],
  doi: '10.5334/gjgl.1001',
  pdfUrl: 'https://arxiv.org/pdf/2001.12345.pdf',
  importedByPlugin: 'pub.chive.plugin.arxiv',
  importedAt: new Date('2024-01-15T10:00:00Z'),
  lastSyncedAt: new Date('2024-01-15T12:00:00Z'),
  syncStatus: 'active',
  claimStatus: 'unclaimed',
};

const SAMPLE_CLAIM_ROW = {
  id: 1,
  import_id: 1,
  claimant_did: 'did:plc:aswhite',
  evidence: JSON.stringify([]),
  verification_score: 0,
  status: 'pending',
  canonical_uri: null,
  rejection_reason: null,
  reviewed_by_did: null,
  reviewed_at: null,
  created_at: new Date('2024-01-15T10:00:00Z'),
  updated_at: new Date('2024-01-15T10:00:00Z'),
  expires_at: null,
};

const SAMPLE_EVIDENCE: ClaimEvidence[] = [
  { type: 'orcid-match', score: 1.0, details: 'ORCID profile linked', data: { verified: true } },
  {
    type: 'semantic-scholar-match',
    score: 0.9,
    details: 'Semantic Scholar profile matched',
    data: { verified: true },
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('ClaimingService', () => {
  let service: ClaimingService;
  let logger: ILogger;
  let db: MockDatabasePool;
  let importService: IImportService;
  let identity: IIdentityResolver;

  beforeEach(() => {
    logger = createMockLogger();
    db = createMockDatabasePool();
    importService = createMockImportService();
    identity = createMockIdentityResolver();
    service = new ClaimingService(logger, db, importService, identity);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startClaim', () => {
    it('should create a new claim request', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_PREPRINT);
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing claim
        .mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] }); // Insert claim

      const result = await service.startClaim(1, 'did:plc:aswhite');

      expect(result).toMatchObject({
        id: 1,
        importId: 1,
        claimantDid: 'did:plc:aswhite',
        status: 'pending',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO claim_requests'),
        expect.any(Array)
      );
    });

    it('should throw NotFoundError if import does not exist', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(null);

      await expect(service.startClaim(999, 'did:plc:aswhite')).rejects.toThrow('not found');
    });

    it('should throw ValidationError if import already claimed', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce({
        ...SAMPLE_IMPORTED_PREPRINT,
        claimStatus: 'claimed',
      });

      await expect(service.startClaim(1, 'did:plc:aswhite')).rejects.toThrow(
        'already been claimed'
      );
    });

    it('should throw ValidationError if claim already pending', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_PREPRINT);
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, status: 'pending' }],
      });

      await expect(service.startClaim(1, 'did:plc:aswhite')).rejects.toThrow('already pending');
    });

    it('should compute initial score with provided evidence', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_PREPRINT);
      const claimRowWithScore = {
        ...SAMPLE_CLAIM_ROW,
        evidence: JSON.stringify(SAMPLE_EVIDENCE),
        verification_score: 0.485, // 0.35 * 1.0 + 0.15 * 0.9
      };
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [claimRowWithScore] });

      const result = await service.startClaim(1, 'did:plc:aswhite', SAMPLE_EVIDENCE);

      expect(result.verificationScore).toBeGreaterThan(0);
    });

    it('should update import status to pending', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_PREPRINT);
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.startClaim(1, 'did:plc:aswhite');

      expect(importService.update).toHaveBeenCalledWith(1, { claimStatus: 'pending' });
    });

    it('should log info on success', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_PREPRINT);
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.startClaim(1, 'did:plc:aswhite');

      expect(logger.info).toHaveBeenCalledWith('Claim started', expect.any(Object));
    });
  });

  describe('collectEvidence', () => {
    it('should collect evidence and update claim', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] }) // getClaim
        .mockResolvedValueOnce({ rows: [{ ...SAMPLE_CLAIM_ROW, evidence: '[]' }] }); // updateClaimEvidence
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_PREPRINT);

      const result = await service.collectEvidence(1);

      expect(result).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('Evidence collected', expect.any(Object));
    });

    it('should throw NotFoundError if claim does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.collectEvidence(999)).rejects.toThrow('not found');
    });

    it('should throw NotFoundError if import does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });
      vi.mocked(importService.getById).mockResolvedValueOnce(null);

      await expect(service.collectEvidence(1)).rejects.toThrow('not found');
    });
  });

  describe('computeScore', () => {
    it('should compute score with single evidence type', () => {
      const evidence: ClaimEvidence[] = [
        { type: 'orcid-match', score: 1.0, details: 'ORCID match' },
      ];

      const { score, decision } = service.computeScore(evidence);

      expect(score).toBeCloseTo(0.35); // 0.35 * 1.0
      expect(decision).toBe('insufficient'); // Below 0.50 threshold
    });

    it('should compute score with multiple evidence types', () => {
      const evidence: ClaimEvidence[] = [
        { type: 'orcid-match', score: 1.0, details: 'ORCID match' },
        { type: 'semantic-scholar-match', score: 1.0, details: 'S2 match' },
        { type: 'openreview-match', score: 1.0, details: 'OpenReview match' },
        { type: 'openalex-match', score: 1.0, details: 'OpenAlex match' },
        { type: 'arxiv-ownership', score: 1.0, details: 'arXiv ownership' },
      ];

      const { score, decision } = service.computeScore(evidence);

      expect(score).toBeCloseTo(0.85); // 0.35 + 0.15 + 0.15 + 0.10 + 0.10
      expect(decision).toBe('expedited'); // Between 0.70 and 0.90
    });

    it('should return auto-approve for high scores', () => {
      const evidence: ClaimEvidence[] = [
        { type: 'orcid-match', score: 1.0, details: 'ORCID match' },
        { type: 'semantic-scholar-match', score: 1.0, details: 'S2 match' },
        { type: 'openreview-match', score: 1.0, details: 'OpenReview match' },
        { type: 'openalex-match', score: 1.0, details: 'OpenAlex match' },
        { type: 'arxiv-ownership', score: 1.0, details: 'arXiv ownership' },
        { type: 'institutional-email', score: 1.0, details: 'Email verified' },
      ];

      const { score, decision } = service.computeScore(evidence);

      expect(score).toBeGreaterThanOrEqual(0.9);
      expect(decision).toBe('auto-approve');
    });

    it('should return manual for moderate scores', () => {
      const evidence: ClaimEvidence[] = [
        { type: 'orcid-match', score: 1.0, details: 'ORCID match' },
        { type: 'semantic-scholar-match', score: 1.0, details: 'S2 match' },
      ];

      const { score, decision } = service.computeScore(evidence);

      expect(score).toBeCloseTo(0.5); // 0.35 + 0.15
      expect(decision).toBe('manual');
    });

    it('should cap score at 1.0', () => {
      const evidence: ClaimEvidence[] = [
        { type: 'orcid-match', score: 1.0, details: 'ORCID match' },
        { type: 'semantic-scholar-match', score: 1.0, details: 'S2 match' },
        { type: 'openreview-match', score: 1.0, details: 'OpenReview match' },
        { type: 'openalex-match', score: 1.0, details: 'OpenAlex match' },
        { type: 'arxiv-ownership', score: 1.0, details: 'arXiv ownership' },
        { type: 'institutional-email', score: 1.0, details: 'Email verified' },
        { type: 'ror-affiliation', score: 1.0, details: 'ROR affiliation' },
        { type: 'author-claim', score: 1.0, details: 'Author claim' },
        { type: 'coauthor-overlap', score: 1.0, details: 'Coauthor overlap' },
        { type: 'name-match', score: 1.0, details: 'Name match' },
      ];

      const { score } = service.computeScore(evidence);

      expect(score).toBe(1.0);
    });

    it('should return zero for empty evidence', () => {
      const { score, decision } = service.computeScore([]);

      expect(score).toBe(0);
      expect(decision).toBe('insufficient');
    });

    it('should weight evidence by individual scores', () => {
      const evidence: ClaimEvidence[] = [
        { type: 'orcid-match', score: 0.5, details: 'ORCID match' }, // 0.35 * 0.5 = 0.175
      ];

      const { score } = service.computeScore(evidence);

      expect(score).toBeCloseTo(0.175);
    });
  });

  describe('completeClaim', () => {
    it('should complete a pending claim', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.completeClaim(
        1,
        'at://did:plc:aswhite/pub.chive.preprint.submission/megaattitude'
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'approved'"),
        expect.any(Array)
      );
      expect(importService.markClaimed).toHaveBeenCalled();
    });

    it('should complete an approved claim', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, status: 'approved' }],
      });

      await service.completeClaim(
        1,
        'at://did:plc:aswhite/pub.chive.preprint.submission/megaattitude'
      );

      expect(importService.markClaimed).toHaveBeenCalled();
    });

    it('should throw NotFoundError if claim does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.completeClaim(999, 'at://did:plc:aswhite/pub.chive.preprint.submission/test')
      ).rejects.toThrow('not found');
    });

    it('should throw ValidationError for rejected claims', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, status: 'rejected' }],
      });

      await expect(
        service.completeClaim(1, 'at://did:plc:aswhite/pub.chive.preprint.submission/test')
      ).rejects.toThrow('Cannot complete claim');
    });

    it('should log info on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.completeClaim(
        1,
        'at://did:plc:aswhite/pub.chive.preprint.submission/megaattitude'
      );

      expect(logger.info).toHaveBeenCalledWith('Claim completed', expect.any(Object));
    });
  });

  describe('rejectClaim', () => {
    it('should reject a pending claim', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.rejectClaim(1, 'Insufficient evidence', 'did:plc:moderator');

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status = 'rejected'"), [
        'Insufficient evidence',
        'did:plc:moderator',
        1,
      ]);
    });

    it('should reset import claim status to unclaimed', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.rejectClaim(1, 'Insufficient evidence', 'did:plc:moderator');

      expect(importService.update).toHaveBeenCalledWith(1, { claimStatus: 'unclaimed' });
    });

    it('should throw NotFoundError if claim does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.rejectClaim(999, 'Reason', 'did:plc:moderator')).rejects.toThrow(
        'not found'
      );
    });

    it('should throw ValidationError for non-pending claims', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, status: 'approved' }],
      });

      await expect(service.rejectClaim(1, 'Reason', 'did:plc:moderator')).rejects.toThrow(
        'Cannot reject claim'
      );
    });

    it('should log info on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.rejectClaim(1, 'Insufficient evidence', 'did:plc:moderator');

      expect(logger.info).toHaveBeenCalledWith('Claim rejected', expect.any(Object));
    });
  });

  describe('getClaim', () => {
    it('should return claim by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      const result = await service.getClaim(1);

      expect(result).toMatchObject({
        id: 1,
        importId: 1,
        claimantDid: 'did:plc:aswhite',
      });
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getClaim(999);

      expect(result).toBeNull();
    });
  });

  describe('getUserClaims', () => {
    it('should return all claims for a user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [SAMPLE_CLAIM_ROW, { ...SAMPLE_CLAIM_ROW, id: 2, import_id: 2 }],
      });

      const result = await service.getUserClaims('did:plc:aswhite');

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('claimant_did = $1'), [
        'did:plc:aswhite',
      ]);
    });

    it('should return empty array if no claims', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getUserClaims('did:plc:unknown');

      expect(result).toEqual([]);
    });
  });

  describe('findClaimable', () => {
    it('should delegate to import service search', async () => {
      vi.mocked(importService.search).mockResolvedValueOnce({
        preprints: [SAMPLE_IMPORTED_PREPRINT],
        cursor: undefined,
      });

      const result = await service.findClaimable({
        q: 'Aaron Steven White',
        source: 'arxiv',
      });

      expect(result.preprints).toHaveLength(1);
      expect(importService.search).toHaveBeenCalledWith({
        claimStatus: 'unclaimed',
        query: 'Aaron Steven White',
        source: 'arxiv',
        limit: undefined,
        cursor: undefined,
      });
    });
  });

  describe('approveClaim', () => {
    it('should approve a pending claim', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.approveClaim(1, 'did:plc:moderator');

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status = 'approved'"), [
        'did:plc:moderator',
        1,
      ]);
    });

    it('should throw NotFoundError if claim does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.approveClaim(999, 'did:plc:moderator')).rejects.toThrow('not found');
    });

    it('should throw ValidationError for non-pending claims', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, status: 'approved' }],
      });

      await expect(service.approveClaim(1, 'did:plc:moderator')).rejects.toThrow(
        'Cannot approve claim'
      );
    });

    it('should log info on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.approveClaim(1, 'did:plc:moderator');

      expect(logger.info).toHaveBeenCalledWith('Claim approved', expect.any(Object));
    });
  });

  describe('getClaimsForImport', () => {
    it('should return all claims for an import', async () => {
      db.query.mockResolvedValueOnce({
        rows: [SAMPLE_CLAIM_ROW, { ...SAMPLE_CLAIM_ROW, id: 2, claimant_did: 'did:plc:other' }],
      });

      const result = await service.getClaimsForImport(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('import_id = $1'), [1]);
    });

    it('should return empty array if no claims', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getClaimsForImport(999);

      expect(result).toEqual([]);
    });
  });

  describe('getPendingClaims', () => {
    it('should return pending claims', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      const result = await service.getPendingClaims();

      expect(result.claims).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'pending'"),
        expect.any(Array)
      );
    });

    it('should filter by minScore', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, verification_score: 0.75 }],
      });

      await service.getPendingClaims({ minScore: 0.7 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('verification_score >= $'),
        expect.arrayContaining([0.7])
      );
    });

    it('should filter by maxScore', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, verification_score: 0.65 }],
      });

      await service.getPendingClaims({ maxScore: 0.7 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('verification_score < $'),
        expect.arrayContaining([0.7])
      );
    });

    it('should handle pagination with cursor', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, id: 5 }],
      });

      await service.getPendingClaims({ cursor: '4' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('id > $'),
        expect.arrayContaining([4])
      );
    });

    it('should return cursor for more results', async () => {
      const rows = [
        { ...SAMPLE_CLAIM_ROW, id: 1 },
        { ...SAMPLE_CLAIM_ROW, id: 2 },
        { ...SAMPLE_CLAIM_ROW, id: 3 },
      ];
      db.query.mockResolvedValueOnce({ rows });

      const result = await service.getPendingClaims({ limit: 2 });

      expect(result.claims).toHaveLength(2);
      expect(result.cursor).toBe('2');
    });

    it('should return no cursor if no more results', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      const result = await service.getPendingClaims({ limit: 10 });

      expect(result.cursor).toBeUndefined();
    });
  });
});
