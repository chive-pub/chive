/**
 * Alpha application service for managing alpha tester signups.
 *
 * @remarks
 * Handles alpha tester applications during the alpha phase.
 * Applications are stored in PostgreSQL and roles are managed via Redis.
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Alpha application status.
 */
export type AlphaApplicationStatus = 'pending' | 'approved' | 'rejected';

/**
 * Sector/organization type for alpha applications.
 */
export type AlphaSector =
  | 'academia'
  | 'industry'
  | 'government'
  | 'nonprofit'
  | 'healthcare'
  | 'independent'
  | 'other';

/**
 * Career stage/position for alpha applications.
 */
export type AlphaCareerStage =
  | 'undergraduate'
  | 'graduate-masters'
  | 'graduate-phd'
  | 'postdoc'
  | 'research-staff'
  | 'junior-faculty'
  | 'senior-faculty'
  | 'research-admin'
  | 'librarian'
  | 'science-communicator'
  | 'policy-professional'
  | 'retired'
  | 'other';

/**
 * Alpha application affiliation.
 */
export interface AlphaAffiliation {
  readonly name: string;
  readonly rorId?: string;
}

/**
 * Alpha application research keyword.
 */
export interface AlphaResearchKeyword {
  readonly label: string;
  readonly fastId?: string;
  readonly wikidataId?: string;
}

/**
 * Alpha application input.
 */
export interface ApplyInput {
  readonly did: DID;
  readonly handle?: string;
  readonly email: string;
  readonly sector: AlphaSector;
  readonly sectorOther?: string;
  readonly careerStage: AlphaCareerStage;
  readonly careerStageOther?: string;
  readonly affiliations?: readonly AlphaAffiliation[];
  readonly researchKeywords: readonly AlphaResearchKeyword[];
  readonly motivation?: string;
}

/**
 * Alpha application record.
 */
export interface AlphaApplication {
  readonly id: string;
  readonly did: DID;
  readonly handle?: string;
  readonly email: string;
  readonly sector: AlphaSector;
  readonly sectorOther?: string;
  readonly careerStage: AlphaCareerStage;
  readonly careerStageOther?: string;
  readonly affiliations: readonly AlphaAffiliation[];
  readonly researchKeywords: readonly AlphaResearchKeyword[];
  readonly motivation?: string;
  readonly status: AlphaApplicationStatus;
  readonly zulipInvited: boolean;
  readonly reviewedAt?: Date;
  readonly reviewedBy?: DID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Alpha status response.
 */
export interface AlphaStatusResult {
  readonly status: 'none' | AlphaApplicationStatus;
  readonly appliedAt?: Date;
  readonly reviewedAt?: Date;
}

/**
 * Alpha application service options.
 */
export interface AlphaApplicationServiceOptions {
  readonly pool: Pool;
  readonly logger: ILogger;
}

/**
 * Alpha application service.
 *
 * @public
 */
export class AlphaApplicationService {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  constructor(options: AlphaApplicationServiceOptions) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  /**
   * Submit an alpha application.
   *
   * @param input - Application data
   * @returns Created application
   */
  async apply(input: ApplyInput): Promise<AlphaApplication> {
    const {
      did,
      handle,
      email,
      sector,
      sectorOther,
      careerStage,
      careerStageOther,
      affiliations,
      researchKeywords,
      motivation,
    } = input;

    // Check for existing application
    const existing = await this.getByDid(did);
    if (existing) {
      throw new ValidationError('You have already submitted an application', 'did', 'unique');
    }

    try {
      const result = await this.pool.query<{
        id: string;
        did: string;
        handle: string | null;
        email: string;
        sector: string;
        sector_other: string | null;
        career_stage: string;
        career_stage_other: string | null;
        affiliations: AlphaAffiliation[];
        research_keywords: AlphaResearchKeyword[];
        motivation: string | null;
        status: string;
        zulip_invited: boolean;
        reviewed_at: Date | null;
        reviewed_by: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO alpha_applications (did, handle, email, sector, sector_other, career_stage, career_stage_other, affiliations, research_keywords, motivation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          did,
          handle,
          email,
          sector,
          sectorOther,
          careerStage,
          careerStageOther,
          JSON.stringify(affiliations ?? []),
          JSON.stringify(researchKeywords),
          motivation,
        ]
      );

      const row = result.rows[0];
      if (!row) {
        throw new DatabaseError('CREATE', 'Failed to create application');
      }

      this.logger.info('Alpha application submitted', { did, email });

      return this.mapRowToApplication(row);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      this.logger.error(
        'Failed to submit alpha application',
        error instanceof Error ? error : undefined
      );
      throw new DatabaseError(
        'CREATE',
        'Failed to submit application',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get application by DID.
   *
   * @param did - User's DID
   * @returns Application or null if not found
   */
  async getByDid(did: DID): Promise<AlphaApplication | null> {
    try {
      const result = await this.pool.query<{
        id: string;
        did: string;
        handle: string | null;
        email: string;
        sector: string;
        sector_other: string | null;
        career_stage: string;
        career_stage_other: string | null;
        affiliations: AlphaAffiliation[];
        research_keywords: AlphaResearchKeyword[];
        motivation: string | null;
        status: string;
        zulip_invited: boolean;
        reviewed_at: Date | null;
        reviewed_by: string | null;
        created_at: Date;
        updated_at: Date;
      }>('SELECT * FROM alpha_applications WHERE did = $1', [did]);

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return this.mapRowToApplication(row);
    } catch (error) {
      this.logger.error(
        'Failed to get alpha application',
        error instanceof Error ? error : undefined
      );
      throw new DatabaseError(
        'READ',
        'Failed to check application status',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get alpha status for a user.
   *
   * @param did - User's DID
   * @returns Status information
   */
  async getStatus(did: DID): Promise<AlphaStatusResult> {
    const application = await this.getByDid(did);

    if (!application) {
      return { status: 'none' };
    }

    return {
      status: application.status,
      appliedAt: application.createdAt,
      reviewedAt: application.reviewedAt,
    };
  }

  /**
   * Approve an alpha application.
   *
   * @param did - Applicant's DID
   * @param reviewerDid - Reviewer's DID (optional)
   * @returns Updated application
   * @throws NotFoundError if application not found
   * @throws ValidationError if application is not pending
   */
  async approve(did: DID, reviewerDid?: DID): Promise<AlphaApplication> {
    const existing = await this.getByDid(did);
    if (!existing) {
      throw new NotFoundError('AlphaApplication', did);
    }

    if (existing.status !== 'pending') {
      throw new ValidationError(
        `Application is already ${existing.status}`,
        'status',
        'pending_required'
      );
    }

    try {
      const result = await this.pool.query<{
        id: string;
        did: string;
        handle: string | null;
        email: string;
        sector: string;
        sector_other: string | null;
        career_stage: string;
        career_stage_other: string | null;
        affiliations: AlphaAffiliation[];
        research_keywords: AlphaResearchKeyword[];
        motivation: string | null;
        status: string;
        zulip_invited: boolean;
        reviewed_at: Date | null;
        reviewed_by: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `UPDATE alpha_applications
         SET status = 'approved',
             reviewed_at = NOW(),
             reviewed_by = $2,
             updated_at = NOW()
         WHERE did = $1
         RETURNING *`,
        [did, reviewerDid ?? null]
      );

      const row = result.rows[0];
      if (!row) {
        throw new DatabaseError('UPDATE', 'Failed to approve application');
      }

      this.logger.info('Alpha application approved', { did, reviewerDid });

      return this.mapRowToApplication(row);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      this.logger.error(
        'Failed to approve alpha application',
        error instanceof Error ? error : undefined
      );
      throw new DatabaseError(
        'UPDATE',
        'Failed to approve application',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Reject an alpha application.
   *
   * @param did - Applicant's DID
   * @param reviewerDid - Reviewer's DID (optional)
   * @returns Updated application
   * @throws NotFoundError if application not found
   * @throws ValidationError if application is not pending
   */
  async reject(did: DID, reviewerDid?: DID): Promise<AlphaApplication> {
    const existing = await this.getByDid(did);
    if (!existing) {
      throw new NotFoundError('AlphaApplication', did);
    }

    if (existing.status !== 'pending') {
      throw new ValidationError(
        `Application is already ${existing.status}`,
        'status',
        'pending_required'
      );
    }

    try {
      const result = await this.pool.query<{
        id: string;
        did: string;
        handle: string | null;
        email: string;
        sector: string;
        sector_other: string | null;
        career_stage: string;
        career_stage_other: string | null;
        affiliations: AlphaAffiliation[];
        research_keywords: AlphaResearchKeyword[];
        motivation: string | null;
        status: string;
        zulip_invited: boolean;
        reviewed_at: Date | null;
        reviewed_by: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `UPDATE alpha_applications
         SET status = 'rejected',
             reviewed_at = NOW(),
             reviewed_by = $2,
             updated_at = NOW()
         WHERE did = $1
         RETURNING *`,
        [did, reviewerDid ?? null]
      );

      const row = result.rows[0];
      if (!row) {
        throw new DatabaseError('UPDATE', 'Failed to reject application');
      }

      this.logger.info('Alpha application rejected', { did, reviewerDid });

      return this.mapRowToApplication(row);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      this.logger.error(
        'Failed to reject alpha application',
        error instanceof Error ? error : undefined
      );
      throw new DatabaseError(
        'UPDATE',
        'Failed to reject application',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Mark that Zulip invitation was sent.
   *
   * @param did - Applicant's DID
   * @throws NotFoundError if application not found
   */
  async markZulipInvited(did: DID): Promise<void> {
    try {
      const result = await this.pool.query(
        `UPDATE alpha_applications
         SET zulip_invited = true,
             updated_at = NOW()
         WHERE did = $1`,
        [did]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('AlphaApplication', did);
      }

      this.logger.info('Marked Zulip invited', { did });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.logger.error('Failed to mark Zulip invited', error instanceof Error ? error : undefined);
      throw new DatabaseError(
        'UPDATE',
        'Failed to mark Zulip invited',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List all pending applications.
   *
   * @returns List of pending applications
   */
  async listPending(): Promise<AlphaApplication[]> {
    try {
      const result = await this.pool.query<{
        id: string;
        did: string;
        handle: string | null;
        email: string;
        sector: string;
        sector_other: string | null;
        career_stage: string;
        career_stage_other: string | null;
        affiliations: AlphaAffiliation[];
        research_keywords: AlphaResearchKeyword[];
        motivation: string | null;
        status: string;
        zulip_invited: boolean;
        reviewed_at: Date | null;
        reviewed_by: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT * FROM alpha_applications
         WHERE status = 'pending'
         ORDER BY created_at ASC`
      );

      return result.rows.map((row) => this.mapRowToApplication(row));
    } catch (error) {
      this.logger.error(
        'Failed to list pending applications',
        error instanceof Error ? error : undefined
      );
      throw new DatabaseError(
        'READ',
        'Failed to list pending applications',
        error instanceof Error ? error : undefined
      );
    }
  }

  private mapRowToApplication(row: {
    id: string;
    did: string;
    handle: string | null;
    email: string;
    sector: string;
    sector_other: string | null;
    career_stage: string;
    career_stage_other: string | null;
    affiliations: AlphaAffiliation[];
    research_keywords: AlphaResearchKeyword[];
    motivation: string | null;
    status: string;
    zulip_invited: boolean;
    reviewed_at: Date | null;
    reviewed_by: string | null;
    created_at: Date;
    updated_at: Date;
  }): AlphaApplication {
    return {
      id: row.id,
      did: row.did as DID,
      handle: row.handle ?? undefined,
      email: row.email,
      sector: row.sector as AlphaSector,
      sectorOther: row.sector_other ?? undefined,
      careerStage: row.career_stage as AlphaCareerStage,
      careerStageOther: row.career_stage_other ?? undefined,
      affiliations: row.affiliations ?? [],
      researchKeywords: row.research_keywords ?? [],
      motivation: row.motivation ?? undefined,
      status: row.status as AlphaApplicationStatus,
      zulipInvited: row.zulip_invited,
      reviewedAt: row.reviewed_at ?? undefined,
      reviewedBy: (row.reviewed_by as DID) ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
