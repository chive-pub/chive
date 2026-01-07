/**
 * Unit tests for AlphaApplicationService.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  AlphaApplicationService,
  type ApplyInput,
} from '../../../../src/services/alpha/alpha-application-service.js';
import type { DID } from '../../../../src/types/atproto.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';

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
 * Database pool interface matching AlphaApplicationService expectations.
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

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_DID = 'did:plc:testuser123' as DID;

const SAMPLE_APPLICATION_ROW = {
  id: 'app-uuid-123',
  did: SAMPLE_DID,
  handle: 'testuser.bsky.social',
  email: 'researcher@university.edu',
  sector: 'academia',
  sector_other: null,
  career_stage: 'postdoc',
  career_stage_other: null,
  affiliation_name: 'MIT',
  affiliation_ror_id: 'https://ror.org/042nb2s44',
  research_field: 'Computational Linguistics',
  motivation: 'I want to help test the platform',
  status: 'pending',
  zulip_invited: false,
  reviewed_at: null,
  reviewed_by: null,
  created_at: new Date('2024-01-15T10:00:00Z'),
  updated_at: new Date('2024-01-15T10:00:00Z'),
};

const SAMPLE_APPLY_INPUT: ApplyInput = {
  did: SAMPLE_DID,
  handle: 'testuser.bsky.social',
  email: 'researcher@university.edu',
  sector: 'academia',
  careerStage: 'postdoc',
  affiliation: {
    name: 'MIT',
    rorId: 'https://ror.org/042nb2s44',
  },
  researchField: 'Computational Linguistics',
  motivation: 'I want to help test the platform',
};

// ============================================================================
// Tests
// ============================================================================

describe('AlphaApplicationService', () => {
  let service: AlphaApplicationService;
  let logger: ILogger;
  let db: MockDatabasePool;

  beforeEach(() => {
    logger = createMockLogger();
    db = createMockDatabasePool();
    service = new AlphaApplicationService({ pool: db as unknown as import('pg').Pool, logger });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('apply', () => {
    it('should create a new application', async () => {
      // No existing application
      db.query.mockResolvedValueOnce({ rows: [] });
      // Insert returns new row
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_APPLICATION_ROW] });

      const result = await service.apply(SAMPLE_APPLY_INPUT);

      expect(result.id).toBe('app-uuid-123');
      expect(result.did).toBe(SAMPLE_DID);
      expect(result.email).toBe('researcher@university.edu');
      expect(result.sector).toBe('academia');
      expect(result.careerStage).toBe('postdoc');
      expect(result.affiliation?.name).toBe('MIT');
      expect(result.affiliation?.rorId).toBe('https://ror.org/042nb2s44');
      expect(result.researchField).toBe('Computational Linguistics');
      expect(result.status).toBe('pending');

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('Alpha application submitted', {
        did: SAMPLE_DID,
        email: 'researcher@university.edu',
      });
    });

    it('should reject duplicate applications', async () => {
      // Existing application found
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_APPLICATION_ROW] });

      await expect(service.apply(SAMPLE_APPLY_INPUT)).rejects.toThrow(
        /You have already submitted an application/
      );
    });

    it('should handle "other" sector and career stage', async () => {
      const inputWithOther: ApplyInput = {
        did: SAMPLE_DID,
        email: 'researcher@university.edu',
        sector: 'other',
        sectorOther: 'Science journalism',
        careerStage: 'other',
        careerStageOther: 'Freelance consultant',
        researchField: 'Science Communication',
      };

      const rowWithOther = {
        ...SAMPLE_APPLICATION_ROW,
        sector: 'other',
        sector_other: 'Science journalism',
        career_stage: 'other',
        career_stage_other: 'Freelance consultant',
      };

      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [rowWithOther] });

      const result = await service.apply(inputWithOther);

      expect(result.sector).toBe('other');
      expect(result.sectorOther).toBe('Science journalism');
      expect(result.careerStage).toBe('other');
      expect(result.careerStageOther).toBe('Freelance consultant');
    });

    it('should handle applications without affiliation', async () => {
      const inputNoAffiliation: ApplyInput = {
        did: SAMPLE_DID,
        email: 'independent@email.com',
        sector: 'independent',
        careerStage: 'retired',
        researchField: 'History of Science',
      };

      const rowNoAffiliation = {
        ...SAMPLE_APPLICATION_ROW,
        sector: 'independent',
        career_stage: 'retired',
        affiliation_name: null,
        affiliation_ror_id: null,
      };

      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [rowNoAffiliation] });

      const result = await service.apply(inputNoAffiliation);

      expect(result.affiliation).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No existing application
      db.query.mockRejectedValueOnce(new Error('Connection refused')); // Insert fails

      await expect(service.apply(SAMPLE_APPLY_INPUT)).rejects.toThrow(
        /Failed to submit application/
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle empty insert result', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No existing application
      db.query.mockResolvedValueOnce({ rows: [] }); // Empty insert result

      await expect(service.apply(SAMPLE_APPLY_INPUT)).rejects.toThrow(
        /Failed to (create|submit) application/
      );
    });
  });

  describe('getByDid', () => {
    it('should return application when found', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_APPLICATION_ROW] });

      const result = await service.getByDid(SAMPLE_DID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('app-uuid-123');
      expect(result!.did).toBe(SAMPLE_DID);
      expect(result!.email).toBe('researcher@university.edu');
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM alpha_applications WHERE did = $1', [
        SAMPLE_DID,
      ]);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getByDid(SAMPLE_DID);

      expect(result).toBeNull();
    });

    it('should return approved application with review info', async () => {
      const approvedRow = {
        ...SAMPLE_APPLICATION_ROW,
        status: 'approved',
        reviewed_at: new Date('2024-01-16T10:00:00Z'),
        reviewed_by: 'did:plc:admin123',
        zulip_invited: true,
      };

      db.query.mockResolvedValueOnce({ rows: [approvedRow] });

      const result = await service.getByDid(SAMPLE_DID);

      expect(result!.status).toBe('approved');
      expect(result!.reviewedAt).toEqual(new Date('2024-01-16T10:00:00Z'));
      expect(result!.reviewedBy).toBe('did:plc:admin123');
      expect(result!.zulipInvited).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(service.getByDid(SAMPLE_DID)).rejects.toThrow(
        /Failed to check application status/
      );

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return "none" when no application exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getStatus(SAMPLE_DID);

      expect(result.status).toBe('none');
      expect(result.appliedAt).toBeUndefined();
      expect(result.reviewedAt).toBeUndefined();
    });

    it('should return "pending" status with applied date', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_APPLICATION_ROW] });

      const result = await service.getStatus(SAMPLE_DID);

      expect(result.status).toBe('pending');
      expect(result.appliedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(result.reviewedAt).toBeUndefined();
    });

    it('should return "approved" status with review date', async () => {
      const approvedRow = {
        ...SAMPLE_APPLICATION_ROW,
        status: 'approved',
        reviewed_at: new Date('2024-01-16T10:00:00Z'),
      };

      db.query.mockResolvedValueOnce({ rows: [approvedRow] });

      const result = await service.getStatus(SAMPLE_DID);

      expect(result.status).toBe('approved');
      expect(result.appliedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(result.reviewedAt).toEqual(new Date('2024-01-16T10:00:00Z'));
    });

    it('should return "rejected" status', async () => {
      const rejectedRow = {
        ...SAMPLE_APPLICATION_ROW,
        status: 'rejected',
        reviewed_at: new Date('2024-01-16T10:00:00Z'),
      };

      db.query.mockResolvedValueOnce({ rows: [rejectedRow] });

      const result = await service.getStatus(SAMPLE_DID);

      expect(result.status).toBe('rejected');
      expect(result.reviewedAt).toEqual(new Date('2024-01-16T10:00:00Z'));
    });
  });

  describe('mapRowToApplication', () => {
    it('should correctly map all fields including affiliation', async () => {
      db.query.mockResolvedValueOnce({ rows: [SAMPLE_APPLICATION_ROW] });

      const result = await service.getByDid(SAMPLE_DID);

      expect(result).toMatchObject({
        id: 'app-uuid-123',
        did: SAMPLE_DID,
        handle: 'testuser.bsky.social',
        email: 'researcher@university.edu',
        sector: 'academia',
        sectorOther: undefined,
        careerStage: 'postdoc',
        careerStageOther: undefined,
        affiliation: {
          name: 'MIT',
          rorId: 'https://ror.org/042nb2s44',
        },
        researchField: 'Computational Linguistics',
        motivation: 'I want to help test the platform',
        status: 'pending',
        zulipInvited: false,
        reviewedAt: undefined,
        reviewedBy: undefined,
      });
    });

    it('should handle null optional fields', async () => {
      const minimalRow = {
        ...SAMPLE_APPLICATION_ROW,
        handle: null,
        sector_other: null,
        career_stage_other: null,
        affiliation_name: null,
        affiliation_ror_id: null,
        motivation: null,
        reviewed_at: null,
        reviewed_by: null,
      };

      db.query.mockResolvedValueOnce({ rows: [minimalRow] });

      const result = await service.getByDid(SAMPLE_DID);

      expect(result!.handle).toBeUndefined();
      expect(result!.sectorOther).toBeUndefined();
      expect(result!.careerStageOther).toBeUndefined();
      expect(result!.affiliation).toBeUndefined();
      expect(result!.motivation).toBeUndefined();
      expect(result!.reviewedAt).toBeUndefined();
      expect(result!.reviewedBy).toBeUndefined();
    });

    it('should handle affiliation with name but no ROR ID', async () => {
      const rowWithNameOnly = {
        ...SAMPLE_APPLICATION_ROW,
        affiliation_name: 'Small Research Lab',
        affiliation_ror_id: null,
      };

      db.query.mockResolvedValueOnce({ rows: [rowWithNameOnly] });

      const result = await service.getByDid(SAMPLE_DID);

      expect(result!.affiliation).toEqual({
        name: 'Small Research Lab',
        rorId: undefined,
      });
    });
  });
});
