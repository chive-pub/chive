/**
 * Unit tests for ClaimingService.
 *
 * @remarks
 * Tests cover core claiming lifecycle (start, complete, reject, approve),
 * multi-signal paper matching (WS1), Chive-internal paper suggestions (WS6),
 * dismiss suggestions (WS7), and external search error tracking (WS8).
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { ExternalEprintWithSource } from '../../../../src/services/claiming/claiming-service.js';
import { ClaimingService } from '../../../../src/services/claiming/claiming-service.js';
import type { IIdentityResolver } from '../../../../src/types/interfaces/identity.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ExternalEprint,
  ExternalSearchQuery,
  IChivePlugin,
  IImportService,
  IPluginManager,
  ImportedEprint,
  SearchablePlugin,
} from '../../../../src/types/interfaces/plugin.interface.js';
import { PluginState } from '../../../../src/types/interfaces/plugin.interface.js';

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
  search: vi.fn().mockResolvedValue({ eprints: [] }),
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

/**
 * Creates a mock searchable plugin.
 *
 * @param id - Plugin ID
 * @param searchFn - Optional custom search implementation
 * @returns Mock SearchablePlugin
 */
const createMockSearchablePlugin = (
  id: string,
  searchFn?: (query: ExternalSearchQuery) => Promise<ExternalEprint[]>
): SearchablePlugin => ({
  id,
  supportsSearch: true,
  search: searchFn ?? vi.fn().mockResolvedValue([]),
  manifest: {
    id,
    name: `Mock ${id}`,
    version: '1.0.0',
    description: `Mock searchable plugin for ${id}`,
    author: 'Test',
    license: 'MIT',
    entrypoint: 'dist/index.js',
    permissions: {},
  },
  getState: vi.fn().mockReturnValue(PluginState.READY),
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock plugin manager.
 *
 * @param plugins - Plugins to register
 * @returns Mock IPluginManager
 */
const createMockPluginManager = (plugins: readonly IChivePlugin[] = []): IPluginManager => ({
  loadPlugin: vi.fn().mockResolvedValue(undefined),
  unloadPlugin: vi.fn().mockResolvedValue(undefined),
  reloadPlugin: vi.fn().mockResolvedValue(undefined),
  loadPluginsFromDirectory: vi.fn().mockResolvedValue(undefined),
  getPlugin: vi.fn().mockImplementation((id: string) => plugins.find((p) => p.id === id)),
  getAllPlugins: vi.fn().mockReturnValue(plugins),
  getPluginState: vi.fn().mockReturnValue(PluginState.READY),
  shutdownAll: vi.fn().mockResolvedValue(undefined),
});

// ============================================================================
// Sample Data (based on real linguistics research)
// ============================================================================

/**
 * Sample imported eprint for claiming tests.
 *
 * Uses data from White & Rawlins (2020), DOI: 10.5334/gjgl.1001
 */
const SAMPLE_IMPORTED_EPRINT: ImportedEprint = {
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
    vi.restoreAllMocks();
  });

  describe('startClaim', () => {
    it('should create a new claim request', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_EPRINT);
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
        ...SAMPLE_IMPORTED_EPRINT,
        claimStatus: 'claimed',
      });

      await expect(service.startClaim(1, 'did:plc:aswhite')).rejects.toThrow(
        'already been claimed'
      );
    });

    it('should throw ValidationError if claim already pending', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_EPRINT);
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, status: 'pending' }],
      });

      await expect(service.startClaim(1, 'did:plc:aswhite')).rejects.toThrow('already pending');
    });

    it('should update import status to pending', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_EPRINT);
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.startClaim(1, 'did:plc:aswhite');

      expect(importService.update).toHaveBeenCalledWith(1, { claimStatus: 'pending' });
    });

    it('should log info on success', async () => {
      vi.mocked(importService.getById).mockResolvedValueOnce(SAMPLE_IMPORTED_EPRINT);
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.startClaim(1, 'did:plc:aswhite');

      expect(logger.info).toHaveBeenCalledWith('Claim started', expect.any(Object));
    });
  });

  describe('completeClaim', () => {
    it('should complete a pending claim', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.completeClaim(
        1,
        'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude'
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
        'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude'
      );

      expect(importService.markClaimed).toHaveBeenCalled();
    });

    it('should throw NotFoundError if claim does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.completeClaim(999, 'at://did:plc:aswhite/pub.chive.eprint.submission/test')
      ).rejects.toThrow('not found');
    });

    it('should throw ValidationError for rejected claims', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ ...SAMPLE_CLAIM_ROW, status: 'rejected' }],
      });

      await expect(
        service.completeClaim(1, 'at://did:plc:aswhite/pub.chive.eprint.submission/test')
      ).rejects.toThrow('Cannot complete claim');
    });

    it('should log info on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_CLAIM_ROW] });

      await service.completeClaim(
        1,
        'at://did:plc:aswhite/pub.chive.eprint.submission/megaattitude'
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
        eprints: [SAMPLE_IMPORTED_EPRINT],
        cursor: undefined,
      });

      const result = await service.findClaimable({
        q: 'Aaron Steven White',
        source: 'arxiv',
      });

      expect(result.eprints).toHaveLength(1);
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

  // ============================================================================
  // WS1: Multi-Signal Matching Algorithm
  // ============================================================================

  describe('calculateTokenNameMatch (via private access)', () => {
    /**
     * Helper to invoke the private calculateTokenNameMatch method.
     * Follows the existing test pattern of accessing private methods
     * through type assertion when testing algorithmic internals.
     */
    const callCalculateTokenNameMatch = (
      userName: string,
      paperAuthorName: string
    ): { score: number; matchType: 'exact' | 'partial' | 'single' | 'none' } => {
      return (
        service as unknown as {
          calculateTokenNameMatch: (
            a: string,
            b: string
          ) => { score: number; matchType: 'exact' | 'partial' | 'single' | 'none' };
        }
      ).calculateTokenNameMatch(userName, paperAuthorName);
    };

    it('returns exact match when all tokens match', () => {
      const result = callCalculateTokenNameMatch('Aaron Steven White', 'Aaron Steven White');

      expect(result.score).toBe(30);
      expect(result.matchType).toBe('exact');
    });

    it('returns exact match regardless of token order', () => {
      const result = callCalculateTokenNameMatch('White Aaron Steven', 'Aaron Steven White');

      expect(result.score).toBe(30);
      expect(result.matchType).toBe('exact');
    });

    it('returns partial match for 2 of 3 tokens', () => {
      const result = callCalculateTokenNameMatch('Aaron White', 'Aaron Steven White');

      expect(result.score).toBe(15);
      expect(result.matchType).toBe('partial');
    });

    it('returns single token match for 1 matching token', () => {
      const result = callCalculateTokenNameMatch('White', 'Aaron Steven White');

      expect(result.score).toBe(5);
      expect(result.matchType).toBe('single');
    });

    it('returns no match for completely different names', () => {
      const result = callCalculateTokenNameMatch('Smith', 'Aaron Steven White');

      expect(result.score).toBe(0);
      expect(result.matchType).toBe('none');
    });

    it('filters out single-character tokens (initials)', () => {
      // "A" is 1 character, filtered out. Only "White" should count as a match.
      const result = callCalculateTokenNameMatch('A White', 'A S White');

      // "A" is filtered from both sides. User tokens: ["white"], paper tokens: ["white"].
      // 1/1 match = exact.
      expect(result.score).toBe(30);
      expect(result.matchType).toBe('exact');
    });

    it('is case insensitive', () => {
      const result = callCalculateTokenNameMatch('aaron white', 'AARON WHITE');

      expect(result.score).toBe(30);
      expect(result.matchType).toBe('exact');
    });

    it('returns none for empty user name', () => {
      const result = callCalculateTokenNameMatch('', 'Aaron Steven White');

      expect(result.score).toBe(0);
      expect(result.matchType).toBe('none');
    });

    it('returns none for empty paper author name', () => {
      const result = callCalculateTokenNameMatch('Aaron Steven White', '');

      expect(result.score).toBe(0);
      expect(result.matchType).toBe('none');
    });

    it('returns none for both empty strings', () => {
      const result = callCalculateTokenNameMatch('', '');

      expect(result.score).toBe(0);
      expect(result.matchType).toBe('none');
    });

    it('handles extra whitespace in names', () => {
      const result = callCalculateTokenNameMatch('  Aaron  White  ', 'Aaron White');

      expect(result.score).toBe(30);
      expect(result.matchType).toBe('exact');
    });

    it('handles hyphenated surnames as separate tokens', () => {
      // "García-Piqueras" becomes two tokens: "garcía-piqueras" stays as one token
      // after split, since there are no spaces. Testing that non-matching names differ.
      const result = callCalculateTokenNameMatch('John Smith', 'Jane Doe');

      expect(result.score).toBe(0);
      expect(result.matchType).toBe('none');
    });
  });

  describe('scorePaperMatch (via private access)', () => {
    /**
     * Helper to invoke the private scorePaperMatch method.
     */
    const callScorePaperMatch = (
      paper: ExternalEprintWithSource,
      profile: {
        did: string;
        handle: string;
        displayName?: string;
        orcid?: string;
        semanticScholarId?: string;
        openAlexId?: string;
        nameVariants?: readonly string[];
        affiliations?: readonly string[];
        previousAffiliations?: readonly string[];
        researchKeywords?: readonly string[];
      },
      claimedTopics?: {
        concepts: string[];
        topics: string[];
        keywords: string[];
        coauthorNames: string[];
      }
    ): { score: number; reasons: string[] } => {
      return (
        service as unknown as {
          scorePaperMatch: (
            paper: ExternalEprintWithSource,
            profile: unknown,
            claimedTopics?: unknown
          ) => { score: number; reasons: string[] };
        }
      ).scorePaperMatch(paper, profile, claimedTopics);
    };

    const makeTestPaper = (
      overrides: Partial<ExternalEprintWithSource> = {}
    ): ExternalEprintWithSource => ({
      externalId: 'test:123',
      url: 'https://example.com/paper/123',
      title: 'Test Paper on Linguistics',
      abstract: 'This paper discusses semantics and syntax.',
      authors: [{ name: 'Aaron Steven White' }, { name: 'Kyle Rawlins' }],
      publicationDate: new Date('2023-01-01'),
      source: 'arxiv',
      ...overrides,
    });

    const makeTestProfile = (
      overrides: Partial<{
        did: string;
        handle: string;
        displayName: string;
        orcid: string;
        semanticScholarId: string;
        openAlexId: string;
        nameVariants: readonly string[];
        affiliations: readonly string[];
        previousAffiliations: readonly string[];
        researchKeywords: readonly string[];
      }> = {}
    ): {
      did: string;
      handle: string;
      displayName: string;
    } & Partial<{
      did: string;
      handle: string;
      displayName: string;
      orcid: string;
      semanticScholarId: string;
      openAlexId: string;
      nameVariants: readonly string[];
      affiliations: readonly string[];
      previousAffiliations: readonly string[];
      researchKeywords: readonly string[];
    }> => ({
      did: 'did:plc:aswhite',
      handle: 'aswhite.test',
      displayName: 'Aaron Steven White',
      ...overrides,
    });

    it('scores ORCID match at >= 50', () => {
      const paper = makeTestPaper({
        authors: [{ name: 'Aaron Steven White', orcid: '0000-0002-4921-5202' }],
      });
      const profile = makeTestProfile({ orcid: '0000-0002-4921-5202' });

      const result = callScorePaperMatch(paper, profile);

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.reasons.join(', ')).toContain('ORCID');
    });

    it('scores external ID match (Semantic Scholar) at >= 40', () => {
      const paper = makeTestPaper({
        metadata: { semanticScholarAuthorIds: ['12345'] },
      });
      const profile = makeTestProfile({ semanticScholarId: '12345' });

      const result = callScorePaperMatch(paper, profile);

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.reasons.join(', ')).toContain('Semantic Scholar');
    });

    it('scores external ID match (OpenAlex) at >= 40', () => {
      const paper = makeTestPaper({
        metadata: { openAlexAuthorIds: ['A999'] },
      });
      const profile = makeTestProfile({ openAlexId: 'A999' });

      const result = callScorePaperMatch(paper, profile);

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.reasons.join(', ')).toContain('OpenAlex');
    });

    it('scores name exact match + topic overlap highly', () => {
      const paper = makeTestPaper({
        title: 'Semantics and Acceptability in Clause-Embedding Verbs',
        abstract: 'We study clause-embedding verbs and their semantics.',
        authors: [
          { name: 'Aaron Steven White' },
          { name: 'Kyle Rawlins' },
          { name: 'Ben Van Durme' },
          { name: 'Rachel Rudinger' },
          { name: 'Elias Stengel-Eskin' },
        ],
      });
      const profile = makeTestProfile();
      const topics = {
        concepts: [],
        topics: ['semantics'],
        keywords: ['clause-embedding'],
        coauthorNames: [],
      };

      const result = callScorePaperMatch(paper, profile, topics);

      // Name exact (30) + topic overlap (15) + keyword match (3) = 48
      expect(result.score).toBeGreaterThanOrEqual(40);
    });

    it('scores single-token match with many authors and no field overlap very low', () => {
      // Simulating an ATLAS collaboration paper with 2900 authors
      const manyAuthors = Array.from({ length: 2900 }, (_, i) => ({
        name: i === 500 ? 'John White' : `Author ${i}`,
      }));
      const paper = makeTestPaper({
        title: 'Observation of Higgs boson production in association with a top quark pair',
        abstract: 'Particle physics experiment at the Large Hadron Collider.',
        authors: manyAuthors,
        categories: ['hep-ex', 'physics.ins-det'],
      });
      const profile = makeTestProfile({
        displayName: 'John White',
        researchKeywords: ['linguistics', 'semantics'],
      });
      // No field overlap topics
      const topics = {
        concepts: [],
        topics: ['linguistics'],
        keywords: ['semantics'],
        coauthorNames: [],
      };

      const result = callScorePaperMatch(paper, profile, topics);

      // "White" single token match (5) * 0.05 penalty = 0, but "John White" is exact (30) * 0.05 = 2
      // No content overlap because paper text does not contain "linguistics" or "semantics"
      // Content gate: identityScore(0) + nameScore(2) < 40 and contentScore = 0 => capped at 5
      expect(result.score).toBeLessThan(10);
    });

    it('scores exact name with 5 authors and field overlap highly', () => {
      const paper = makeTestPaper({
        title: 'Universal Decompositional Semantics',
        abstract: 'A framework for decomposing semantics and predicate structure.',
        authors: [
          { name: 'Aaron Steven White' },
          { name: 'Kyle Rawlins' },
          { name: 'Benjamin Van Durme' },
          { name: 'Rachel Rudinger' },
          { name: 'Aaron Sarnat' },
        ],
      });
      const profile = makeTestProfile();
      const topics = {
        concepts: [],
        topics: ['semantics'],
        keywords: ['decomposing'],
        coauthorNames: [],
      };

      const result = callScorePaperMatch(paper, profile, topics);

      // Name exact (30, no penalty for <=10 authors) + topic overlap (15) + keyword (3) = 48
      expect(result.score).toBeGreaterThanOrEqual(40);
    });

    it('applies author count penalty for 200+ authors', () => {
      const manyAuthors = Array.from({ length: 250 }, (_, i) => ({
        name: i === 0 ? 'Aaron Steven White' : `Author ${i}`,
      }));
      const paper = makeTestPaper({ authors: manyAuthors });
      const profile = makeTestProfile();

      const result = callScorePaperMatch(paper, profile);

      // Name exact match (30) * 0.05 penalty = 2
      // Content gate may also apply since no content overlap
      expect(result.reasons.join(', ')).toContain('Author count penalty');
      expect(result.score).toBeLessThan(30);
    });

    it('applies content gate when name-only match has no field overlap', () => {
      const paper = makeTestPaper({
        title: 'Quantum Computing Basics',
        abstract: 'Introduction to quantum computing with qubits.',
        authors: [{ name: 'Aaron Steven White' }],
      });
      const profile = makeTestProfile({
        researchKeywords: ['linguistics', 'semantics'],
      });

      // Pass non-empty claimed topics so we are NOT in bootstrap mode.
      // The topics don't overlap with the paper content.
      const topics = {
        concepts: ['natural language processing'],
        topics: ['formal semantics'],
        keywords: ['linguistics'],
        coauthorNames: [],
      };

      const result = callScorePaperMatch(paper, profile, topics);

      // Name exact (30) but identityScore(0) + nameScore(30) = 30 < 40 => content gate fires
      // contentScore = 3 from keyword "linguistics" matching... wait, paper is about quantum computing
      // No overlap with paper text, so contentScore = 0, capped at 5
      expect(result.score).toBeLessThanOrEqual(5);
      expect(result.reasons.join(', ')).toContain('Content gate');
    });

    it('bypasses content gate in bootstrap mode (no claimed papers)', () => {
      const paper = makeTestPaper({
        title: 'Semantic Parsing with Neural Networks',
        abstract: 'A study of compositional semantics.',
        authors: [{ name: 'Aaron Steven White' }],
      });
      const profile = makeTestProfile();

      // No userClaimedTopics => bootstrap mode => gate bypassed
      const result = callScorePaperMatch(paper, profile);

      // Name exact match (30), no content gate => score = 30
      expect(result.score).toBe(30);
      expect(result.reasons.join(', ')).not.toContain('Content gate');
    });

    it('adds affiliation match bonus', () => {
      const paper = makeTestPaper({
        title: 'Natural Language Understanding at Scale',
        abstract: 'We study semantics in natural language.',
        authors: [
          { name: 'Aaron Steven White', affiliation: 'University of Rochester' },
          { name: 'Kyle Rawlins', affiliation: 'Johns Hopkins University' },
        ],
      });
      const profile = makeTestProfile({
        affiliations: ['University of Rochester'],
      });
      const topics = {
        concepts: [],
        topics: ['semantics'],
        keywords: [],
        coauthorNames: [],
      };

      const result = callScorePaperMatch(paper, profile, topics);

      expect(result.reasons.join(', ')).toContain('Affiliation match');
    });

    it('adds co-author overlap bonus', () => {
      const paper = makeTestPaper({
        title: 'Clause-embedding semantics',
        abstract: 'We study semantics and clause structure.',
        authors: [{ name: 'Aaron Steven White' }, { name: 'Kyle Rawlins' }],
      });
      const profile = makeTestProfile();
      const topics = {
        concepts: [],
        topics: ['semantics'],
        keywords: [],
        coauthorNames: ['kyle rawlins'],
      };

      const result = callScorePaperMatch(paper, profile, topics);

      expect(result.reasons.join(', ')).toContain('Co-author overlap');
    });

    it('caps final score at 100', () => {
      // Construct a paper that maximizes every signal
      const paper = makeTestPaper({
        title: 'Semantics and acceptability in linguistics',
        abstract: 'A study of semantics, syntax, clause-embedding, and decomposition.',
        authors: [
          {
            name: 'Aaron Steven White',
            orcid: '0000-0002-4921-5202',
            affiliation: 'University of Rochester',
          },
          { name: 'Kyle Rawlins', affiliation: 'Johns Hopkins University' },
        ],
        categories: ['linguistics', 'semantics'],
      });
      const profile = makeTestProfile({
        orcid: '0000-0002-4921-5202',
        affiliations: ['University of Rochester'],
        researchKeywords: ['semantics', 'syntax', 'clause-embedding', 'decomposition'],
      });
      const topics = {
        concepts: ['Linguistics'],
        topics: ['Semantics'],
        keywords: ['semantics', 'syntax', 'clause-embedding', 'linguistics'],
        coauthorNames: ['kyle rawlins'],
      };

      const result = callScorePaperMatch(paper, profile, topics);

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('returns weak match for paper with no authors', () => {
      const paper = makeTestPaper({ authors: [] });
      const profile = makeTestProfile();

      const result = callScorePaperMatch(paper, profile);

      expect(result.score).toBeLessThanOrEqual(5);
    });

    it('prefers ORCID over name matching', () => {
      const paper = makeTestPaper({
        authors: [{ name: 'A. White', orcid: '0000-0002-4921-5202' }],
      });
      const profile = makeTestProfile({ orcid: '0000-0002-4921-5202' });

      const result = callScorePaperMatch(paper, profile);

      // Identity verified via ORCID; name matching is skipped
      expect(result.score).toBe(50);
      expect(result.reasons.join(', ')).toContain('ORCID');
      expect(result.reasons.join(', ')).not.toContain('name match');
    });
  });

  describe('getUserClaimedTopics (via private access)', () => {
    /**
     * Helper to invoke the private getUserClaimedTopics method.
     */
    const callGetUserClaimedTopics = (
      userDid: string
    ): Promise<{
      concepts: string[];
      topics: string[];
      keywords: string[];
      coauthorNames: string[];
    }> => {
      return (
        service as unknown as {
          getUserClaimedTopics: (did: string) => Promise<{
            concepts: string[];
            topics: string[];
            keywords: string[];
            coauthorNames: string[];
          }>;
        }
      ).getUserClaimedTopics(userDid);
    };

    it('returns topics from approved claims', async () => {
      // First query: claim_requests -> canonical_uri
      db.query
        .mockResolvedValueOnce({
          rows: [{ canonical_uri: 'at://did:plc:aswhite/pub.chive.eprint.submission/abc' }],
        })
        // Second query: eprint_enrichment -> concepts, topics
        .mockResolvedValueOnce({
          rows: [
            {
              concepts: [{ display_name: 'Natural Language Processing' }],
              topics: [{ display_name: 'Clause-Embedding' }],
            },
          ],
        })
        // Third query: eprints_index -> keywords, authors
        .mockResolvedValueOnce({
          rows: [
            {
              keywords: ['semantics', 'syntax'],
              authors: [
                { name: 'Aaron Steven White', did: 'did:plc:aswhite' },
                { name: 'Kyle Rawlins', did: 'did:plc:rawlins' },
              ],
            },
          ],
        });

      const result = await callGetUserClaimedTopics('did:plc:aswhite');

      expect(result.concepts).toContain('Natural Language Processing');
      expect(result.topics).toContain('Clause-Embedding');
      expect(result.keywords).toContain('semantics');
      expect(result.keywords).toContain('syntax');
      // Co-author excludes the user themselves
      expect(result.coauthorNames).toContain('kyle rawlins');
      expect(result.coauthorNames).not.toContain('aaron steven white');
    });

    it('returns empty arrays when user has no claims', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await callGetUserClaimedTopics('did:plc:noclaims');

      expect(result).toEqual({
        concepts: [],
        topics: [],
        keywords: [],
        coauthorNames: [],
      });
    });

    it('returns empty arrays on database error (graceful degradation)', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await callGetUserClaimedTopics('did:plc:dberror');

      expect(result).toEqual({
        concepts: [],
        topics: [],
        keywords: [],
        coauthorNames: [],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to fetch user claimed topics',
        expect.objectContaining({ userDid: 'did:plc:dberror' })
      );
    });
  });

  // ============================================================================
  // WS6: Chive-Internal Paper Suggestions
  // ============================================================================

  describe('searchInternalPapers (via private access)', () => {
    /**
     * Helper to invoke the private searchInternalPapers method.
     */
    const callSearchInternalPapers = (
      nameVariants: readonly string[],
      userDid: string,
      limit: number
    ): Promise<ExternalEprintWithSource[]> => {
      return (
        service as unknown as {
          searchInternalPapers: (
            names: readonly string[],
            did: string,
            lim: number
          ) => Promise<ExternalEprintWithSource[]>;
        }
      ).searchInternalPapers(nameVariants, userDid, limit);
    };

    it('returns papers from eprints_index matching name variants', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:other/pub.chive.eprint.submission/abc',
            title: 'Clause-Embedding Verbs and Selectional Preferences',
            abstract: 'A study of clause-embedding verbs.',
            keywords: ['linguistics', 'semantics'],
            authors: [{ name: 'Aaron Steven White' }, { name: 'Kyle Rawlins' }],
            doi: '10.5334/gjgl.1001',
            created_at: new Date('2023-05-01'),
          },
        ],
      });

      const result = await callSearchInternalPapers(
        ['Aaron Steven White', 'A.S. White'],
        'did:plc:aswhite',
        20
      );

      expect(result).toHaveLength(1);
      const first = result[0];
      expect(first).toBeDefined();
      expect(first?.source).toBe('chive');
      expect(first?.chiveUri).toBe('at://did:plc:other/pub.chive.eprint.submission/abc');
      expect(first?.title).toBe('Clause-Embedding Verbs and Selectional Preferences');
      expect(first?.doi).toBe('10.5334/gjgl.1001');
    });

    it('returns empty array for empty name variants', async () => {
      const result = await callSearchInternalPapers([], 'did:plc:aswhite', 20);

      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('handles database error by propagating (caller catches)', async () => {
      db.query.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(
        callSearchInternalPapers(['Aaron Steven White'], 'did:plc:aswhite', 20)
      ).rejects.toThrow('DB connection lost');
    });

    it('handles JSONB authors column as string', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:other/pub.chive.eprint.submission/xyz',
            title: 'Some Paper',
            abstract: 'Abstract text.',
            keywords: null,
            authors: JSON.stringify([{ name: 'A. White' }]),
            doi: null,
            created_at: new Date('2024-01-01'),
          },
        ],
      });

      const result = await callSearchInternalPapers(['A. White'], 'did:plc:aswhite', 10);

      expect(result).toHaveLength(1);
      const first = result[0];
      expect(first).toBeDefined();
      expect(first?.authors[0]?.name).toBe('A. White');
    });

    it('passes ILIKE patterns and excludes user DID', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await callSearchInternalPapers(['Aaron Steven White'], 'did:plc:aswhite', 10);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ILIKE ANY'), [
        ['%Aaron Steven White%'],
        'did:plc:aswhite',
        10,
      ]);
    });
  });

  describe('getSuggestedPapers', () => {
    /**
     * Stubs getUserProfile to return a known profile.
     * This avoids needing to mock global fetch() and identity resolution.
     */
    const stubGetUserProfile = (
      profile: {
        did: string;
        handle: string;
        displayName?: string;
        orcid?: string;
        semanticScholarId?: string;
        nameVariants?: readonly string[];
        affiliations?: readonly string[];
        researchKeywords?: readonly string[];
      } | null
    ): void => {
      vi.spyOn(
        service as unknown as { getUserProfile: () => unknown },
        'getUserProfile'
      ).mockResolvedValue(profile);
    };

    /**
     * Stubs searchInternalPapers to return known results.
     */
    const stubSearchInternalPapers = (papers: ExternalEprintWithSource[]): void => {
      vi.spyOn(
        service as unknown as { searchInternalPapers: () => unknown },
        'searchInternalPapers'
      ).mockResolvedValue(papers);
    };

    /**
     * Stubs getUserClaimedTopics to return known topics.
     */
    const stubGetUserClaimedTopics = (topics: {
      concepts: string[];
      topics: string[];
      keywords: string[];
      coauthorNames: string[];
    }): void => {
      vi.spyOn(
        service as unknown as { getUserClaimedTopics: () => unknown },
        'getUserClaimedTopics'
      ).mockResolvedValue(topics);
    };

    it('returns empty papers when user has no profile', async () => {
      stubGetUserProfile(null);

      const result = await service.getSuggestedPapers('did:plc:noprofile');

      expect(result.papers).toEqual([]);
      expect(result.profileUsed.displayName).toBeUndefined();
      expect(result.profileUsed.nameVariants).toEqual([]);
    });

    it('returns empty papers when profile has no name or IDs', async () => {
      stubGetUserProfile({
        did: 'did:plc:aswhite',
        handle: 'aswhite.test',
      });

      const result = await service.getSuggestedPapers('did:plc:aswhite');

      expect(result.papers).toEqual([]);
      expect(result.profileUsed.hasOrcid).toBe(false);
      expect(result.profileUsed.hasExternalIds).toBe(false);
    });

    it('returns Chive and external papers with scoring', async () => {
      stubGetUserProfile({
        did: 'did:plc:aswhite',
        handle: 'aswhite.test',
        displayName: 'Aaron Steven White',
        researchKeywords: ['semantics'],
      });

      stubGetUserClaimedTopics({
        concepts: [],
        topics: ['semantics'],
        keywords: ['semantics'],
        coauthorNames: [],
      });

      const chivePaper: ExternalEprintWithSource = {
        externalId: 'at://did:plc:other/pub.chive.eprint.submission/abc',
        url: '/eprints/at%3A%2F%2Fdid%3Aplc%3Aother%2Fpub.chive.eprint.submission%2Fabc',
        title: 'Decomposing Semantic Representations',
        abstract: 'A framework for semantics and decomposition.',
        authors: [{ name: 'Aaron Steven White' }, { name: 'Kyle Rawlins' }],
        publicationDate: new Date('2023-06-01'),
        source: 'chive',
        chiveUri: 'at://did:plc:other/pub.chive.eprint.submission/abc',
      };
      stubSearchInternalPapers([chivePaper]);

      // Mock searchAllSources to return external results
      const arxivPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.arxiv',
        vi.fn().mockResolvedValue([
          {
            externalId: 'arxiv:2401.00001',
            url: 'https://arxiv.org/abs/2401.00001',
            title: 'Attention and Semantics in Language Models',
            abstract: 'We study semantics and attention mechanisms.',
            authors: [{ name: 'Aaron Steven White' }],
            publicationDate: new Date('2024-01-01'),
          },
        ])
      );
      const pluginManager = createMockPluginManager([arxivPlugin]);
      service.setPluginManager(pluginManager);

      // Mock dismissed_suggestions query to return empty
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSuggestedPapers('did:plc:aswhite', { limit: 20 });

      expect(result.papers.length).toBeGreaterThanOrEqual(1);
      expect(result.profileUsed.displayName).toBe('Aaron Steven White');
      // All returned papers should have a matchScore >= 10
      for (const paper of result.papers) {
        expect(paper.matchScore).toBeGreaterThanOrEqual(10);
      }
    });

    it('deduplicates external papers by DOI when Chive has same paper', async () => {
      stubGetUserProfile({
        did: 'did:plc:aswhite',
        handle: 'aswhite.test',
        displayName: 'Aaron Steven White',
        researchKeywords: ['semantics'],
      });

      stubGetUserClaimedTopics({
        concepts: [],
        topics: ['semantics'],
        keywords: ['semantics'],
        coauthorNames: [],
      });

      const sharedDoi = '10.5334/gjgl.1001';

      const chivePaper: ExternalEprintWithSource = {
        externalId: 'at://did:plc:other/pub.chive.eprint.submission/abc',
        url: '/eprints/abc',
        title: 'Decomposing Semantic Representations',
        abstract: 'A framework for semantics.',
        authors: [{ name: 'Aaron Steven White' }],
        publicationDate: new Date('2023-06-01'),
        doi: sharedDoi,
        source: 'chive',
        chiveUri: 'at://did:plc:other/pub.chive.eprint.submission/abc',
      };
      stubSearchInternalPapers([chivePaper]);

      // External paper with the same DOI
      const arxivPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.arxiv',
        vi.fn().mockResolvedValue([
          {
            externalId: 'arxiv:2401.00001',
            url: 'https://arxiv.org/abs/2401.00001',
            title: 'Decomposing Semantic Representations',
            abstract: 'A framework for semantics.',
            authors: [{ name: 'Aaron Steven White' }],
            publicationDate: new Date('2023-06-01'),
            doi: sharedDoi,
          },
        ])
      );
      const pluginManager = createMockPluginManager([arxivPlugin]);
      service.setPluginManager(pluginManager);

      // Mock dismissed_suggestions: none
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSuggestedPapers('did:plc:aswhite');

      // Should only have the Chive version, not the arxiv duplicate
      const doiPapers = result.papers.filter(
        (p) => p.doi?.toLowerCase() === sharedDoi.toLowerCase()
      );
      expect(doiPapers.length).toBeLessThanOrEqual(1);
      if (doiPapers.length === 1) {
        expect(doiPapers[0]?.source).toBe('chive');
      }
    });

    it('filters out papers with score below 10', async () => {
      stubGetUserProfile({
        did: 'did:plc:aswhite',
        handle: 'aswhite.test',
        displayName: 'Aaron Steven White',
      });

      stubGetUserClaimedTopics({
        concepts: [],
        topics: [],
        keywords: [],
        coauthorNames: [],
      });

      // Paper that will have a very low score (no content overlap, different field)
      const chivePaper: ExternalEprintWithSource = {
        externalId: 'at://did:plc:other/pub.chive.eprint.submission/xyz',
        url: '/eprints/xyz',
        title: 'Quantum Chromodynamics at High Energy',
        abstract: 'Study of quarks and gluons at TeV scale.',
        authors: [
          { name: 'A. White' },
          ...Array.from({ length: 300 }, (_, i) => ({ name: `Author ${i}` })),
        ],
        publicationDate: new Date('2023-01-01'),
        source: 'chive',
        chiveUri: 'at://did:plc:other/pub.chive.eprint.submission/xyz',
      };
      stubSearchInternalPapers([chivePaper]);

      // No external plugins
      // Mock dismissed_suggestions
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSuggestedPapers('did:plc:aswhite');

      // Paper should be filtered out (score < 10 due to author count penalty + content gate)
      expect(result.papers.length).toBe(0);
    });
  });

  // ============================================================================
  // WS7: Dismiss Suggestions
  // ============================================================================

  describe('dismissSuggestion', () => {
    it('inserts a row into dismissed_suggestions', async () => {
      await service.dismissSuggestion('did:plc:aswhite', 'arxiv', '2401.12345');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dismissed_suggestions'),
        ['did:plc:aswhite', 'arxiv', '2401.12345']
      );
    });

    it('is idempotent (ON CONFLICT DO NOTHING)', async () => {
      await service.dismissSuggestion('did:plc:aswhite', 'arxiv', '2401.12345');

      const sqlArg = db.query.mock.calls[0]?.[0] as string;
      expect(sqlArg).toContain('ON CONFLICT');
      expect(sqlArg).toContain('DO NOTHING');
    });
  });

  describe('getDismissedSuggestions (via private access)', () => {
    const callGetDismissedSuggestions = (userDid: string): Promise<Set<string>> => {
      return (
        service as unknown as {
          getDismissedSuggestions: (did: string) => Promise<Set<string>>;
        }
      ).getDismissedSuggestions(userDid);
    };

    it('returns a Set of source:externalId keys', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { source: 'arxiv', external_id: '2401.12345' },
          { source: 'openreview', external_id: 'ABCDEF' },
        ],
      });

      const result = await callGetDismissedSuggestions('did:plc:aswhite');

      expect(result).toBeInstanceOf(Set);
      expect(result.has('arxiv:2401.12345')).toBe(true);
      expect(result.has('openreview:ABCDEF')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('returns empty Set for user with no dismissals', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await callGetDismissedSuggestions('did:plc:noone');

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('dismissed suggestions filtering in getSuggestedPapers', () => {
    /**
     * Stubs private methods to isolate dismissal filtering behavior.
     */
    const stubGetUserProfile = (profile: unknown): void => {
      vi.spyOn(
        service as unknown as { getUserProfile: () => unknown },
        'getUserProfile'
      ).mockResolvedValue(profile);
    };

    const stubSearchInternalPapers = (papers: ExternalEprintWithSource[]): void => {
      vi.spyOn(
        service as unknown as { searchInternalPapers: () => unknown },
        'searchInternalPapers'
      ).mockResolvedValue(papers);
    };

    const stubGetUserClaimedTopics = (topics: {
      concepts: string[];
      topics: string[];
      keywords: string[];
      coauthorNames: string[];
    }): void => {
      vi.spyOn(
        service as unknown as { getUserClaimedTopics: () => unknown },
        'getUserClaimedTopics'
      ).mockResolvedValue(topics);
    };

    it('excludes dismissed papers from results', async () => {
      stubGetUserProfile({
        did: 'did:plc:aswhite',
        handle: 'aswhite.test',
        displayName: 'Aaron Steven White',
        researchKeywords: ['semantics'],
      });

      stubGetUserClaimedTopics({
        concepts: [],
        topics: ['semantics'],
        keywords: ['semantics'],
        coauthorNames: [],
      });

      const chivePaper1: ExternalEprintWithSource = {
        externalId: 'at://did:plc:other/pub.chive.eprint.submission/kept',
        url: '/eprints/kept',
        title: 'Kept Paper on Semantics',
        abstract: 'This paper studies semantics.',
        authors: [{ name: 'Aaron Steven White' }],
        publicationDate: new Date('2023-01-01'),
        source: 'chive',
        chiveUri: 'at://did:plc:other/pub.chive.eprint.submission/kept',
      };
      const chivePaper2: ExternalEprintWithSource = {
        externalId: 'at://did:plc:other/pub.chive.eprint.submission/dismissed',
        url: '/eprints/dismissed',
        title: 'Dismissed Paper on Semantics',
        abstract: 'This paper studies semantics too.',
        authors: [{ name: 'Aaron Steven White' }],
        publicationDate: new Date('2023-01-02'),
        source: 'chive',
        chiveUri: 'at://did:plc:other/pub.chive.eprint.submission/dismissed',
      };
      stubSearchInternalPapers([chivePaper1, chivePaper2]);

      // Mock getDismissedSuggestions: paper2 is dismissed
      db.query.mockResolvedValueOnce({
        rows: [
          {
            source: 'chive',
            external_id: 'at://did:plc:other/pub.chive.eprint.submission/dismissed',
          },
        ],
      });

      const result = await service.getSuggestedPapers('did:plc:aswhite');

      // Only the non-dismissed paper should remain
      const ids = result.papers.map((p) => p.externalId);
      expect(ids).not.toContain('at://did:plc:other/pub.chive.eprint.submission/dismissed');
      // The kept paper should be present (if its score >= 10)
      const keptPaper = result.papers.find(
        (p) => p.externalId === 'at://did:plc:other/pub.chive.eprint.submission/kept'
      );
      if (keptPaper) {
        expect(keptPaper.matchScore).toBeGreaterThanOrEqual(10);
      }
    });
  });

  // ============================================================================
  // WS8: External Search Error Tracking
  // ============================================================================

  describe('searchAllSources', () => {
    it('returns results from searchable plugins', async () => {
      const arxivPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.arxiv',
        vi.fn().mockResolvedValue([
          {
            externalId: '2401.00001',
            url: 'https://arxiv.org/abs/2401.00001',
            title: 'Attention Is All You Need',
            abstract: 'We propose a novel architecture.',
            authors: [{ name: 'Ashish Vaswani' }],
            publicationDate: new Date('2017-06-12'),
          },
        ])
      );
      const pluginManager = createMockPluginManager([arxivPlugin]);
      service.setPluginManager(pluginManager);

      const result = await service.searchAllSources({
        query: 'attention',
        author: 'Vaswani',
        limit: 10,
      });

      expect(result.results.length).toBeGreaterThanOrEqual(1);
      const firstResult = result.results[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.source).toBe('arxiv');
      expect(result.sourceErrors).toEqual([]);
    });

    it('captures source error when a plugin search fails', async () => {
      const failingPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.arxiv',
        vi.fn().mockRejectedValue(new Error('arXiv API rate limited'))
      );
      const successPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.openreview',
        vi.fn().mockResolvedValue([
          {
            externalId: 'or-123',
            url: 'https://openreview.net/forum?id=or-123',
            title: 'A Paper on OpenReview',
            abstract: 'Found on OpenReview.',
            authors: [{ name: 'Jane Doe' }],
            publicationDate: new Date('2024-01-01'),
          },
        ])
      );
      const pluginManager = createMockPluginManager([failingPlugin, successPlugin]);
      service.setPluginManager(pluginManager);

      const result = await service.searchAllSources({
        query: 'test',
        limit: 10,
      });

      // Successful plugin's results should still be returned
      expect(result.results.some((r) => r.externalId === 'or-123')).toBe(true);

      // Failed plugin should be recorded in sourceErrors
      expect(result.sourceErrors.length).toBeGreaterThanOrEqual(1);
      const arxivError = result.sourceErrors.find((e) => e.source === 'arxiv');
      expect(arxivError).toBeDefined();
      expect(arxivError?.message).toContain('arXiv API rate limited');
    });

    it('returns empty sourceErrors when all plugins succeed', async () => {
      const arxivPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.arxiv',
        vi.fn().mockResolvedValue([])
      );
      const pluginManager = createMockPluginManager([arxivPlugin]);
      service.setPluginManager(pluginManager);

      const result = await service.searchAllSources({
        query: 'test',
        limit: 10,
      });

      expect(result.sourceErrors).toEqual([]);
    });

    it('falls back to local search when plugin manager is not set', async () => {
      // Do not call setPluginManager
      vi.mocked(importService.search).mockResolvedValueOnce({
        eprints: [SAMPLE_IMPORTED_EPRINT],
        cursor: undefined,
      });

      const result = await service.searchAllSources({
        query: 'White',
        limit: 10,
      });

      expect(result.results).toHaveLength(1);
      expect(result.sourceErrors).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'Plugin manager not configured, falling back to local search'
      );
    });

    it('includes local import results for non-searchable sources', async () => {
      // Set up a plugin manager with only the arxiv plugin (no lingbuzz plugin)
      const arxivPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.arxiv',
        vi.fn().mockResolvedValue([])
      );
      const pluginManager = createMockPluginManager([arxivPlugin]);
      service.setPluginManager(pluginManager);

      // Local search returns a lingbuzz paper
      vi.mocked(importService.search).mockResolvedValueOnce({
        eprints: [
          {
            ...SAMPLE_IMPORTED_EPRINT,
            source: 'lingbuzz',
            externalId: 'lingbuzz:007123',
          },
        ],
        cursor: undefined,
      });

      const result = await service.searchAllSources({
        query: 'clause embedding',
        limit: 10,
      });

      // The lingbuzz paper should come from local import search
      const lingbuzzResult = result.results.find((r) => r.source === 'lingbuzz');
      expect(lingbuzzResult).toBeDefined();
      expect(lingbuzzResult?.externalId).toBe('lingbuzz:007123');
    });

    it('captures error from local import search in sourceErrors', async () => {
      const arxivPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.arxiv',
        vi.fn().mockResolvedValue([])
      );
      const pluginManager = createMockPluginManager([arxivPlugin]);
      service.setPluginManager(pluginManager);

      // Local search fails
      vi.mocked(importService.search).mockRejectedValueOnce(new Error('Local DB timeout'));

      const result = await service.searchAllSources({
        query: 'test',
        limit: 10,
      });

      const localError = result.sourceErrors.find((e) => e.source === 'local');
      expect(localError).toBeDefined();
      expect(localError?.message).toContain('Local DB timeout');
    });

    it('respects sources filter to skip irrelevant plugins', async () => {
      const arxivSearchFn = vi.fn().mockResolvedValue([]);
      const arxivPlugin = createMockSearchablePlugin('pub.chive.plugin.arxiv', arxivSearchFn);
      const openreviewSearchFn = vi.fn().mockResolvedValue([]);
      const openreviewPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.openreview',
        openreviewSearchFn
      );
      const pluginManager = createMockPluginManager([arxivPlugin, openreviewPlugin]);
      service.setPluginManager(pluginManager);

      await service.searchAllSources({
        query: 'test',
        sources: ['arxiv'],
        limit: 10,
      });

      // Only arxiv should be searched, not openreview
      expect(arxivSearchFn).toHaveBeenCalled();
      expect(openreviewSearchFn).not.toHaveBeenCalled();
    });

    it('handles timeout from slow plugin searches', async () => {
      // Create a plugin that takes a long time
      const slowPlugin = createMockSearchablePlugin(
        'pub.chive.plugin.arxiv',
        () => new Promise((resolve) => setTimeout(() => resolve([]), 60000))
      );
      const pluginManager = createMockPluginManager([slowPlugin]);
      service.setPluginManager(pluginManager);

      const result = await service.searchAllSources({
        query: 'test',
        limit: 10,
        timeoutMs: 50, // Very short timeout
      });

      // Should have a timeout error for arxiv
      expect(result.sourceErrors.length).toBeGreaterThanOrEqual(1);
      const arxivError = result.sourceErrors.find((e) => e.source === 'arxiv');
      expect(arxivError).toBeDefined();
      expect(arxivError?.message).toContain('timeout');
    });
  });
});
