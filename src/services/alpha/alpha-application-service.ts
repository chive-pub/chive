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
import { DatabaseError, ValidationError } from '../../types/errors.js';
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
  readonly affiliation?: AlphaAffiliation;
  readonly researchField: string;
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
  readonly affiliation?: AlphaAffiliation;
  readonly researchField: string;
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
      affiliation,
      researchField,
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
        affiliation_name: string | null;
        affiliation_ror_id: string | null;
        research_field: string;
        motivation: string | null;
        status: string;
        zulip_invited: boolean;
        reviewed_at: Date | null;
        reviewed_by: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO alpha_applications (did, handle, email, sector, sector_other, career_stage, career_stage_other, affiliation_name, affiliation_ror_id, research_field, motivation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          did,
          handle,
          email,
          sector,
          sectorOther,
          careerStage,
          careerStageOther,
          affiliation?.name,
          affiliation?.rorId,
          researchField,
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
        affiliation_name: string | null;
        affiliation_ror_id: string | null;
        research_field: string;
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

  private mapRowToApplication(row: {
    id: string;
    did: string;
    handle: string | null;
    email: string;
    sector: string;
    sector_other: string | null;
    career_stage: string;
    career_stage_other: string | null;
    affiliation_name: string | null;
    affiliation_ror_id: string | null;
    research_field: string;
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
      affiliation: row.affiliation_name
        ? { name: row.affiliation_name, rorId: row.affiliation_ror_id ?? undefined }
        : undefined,
      researchField: row.research_field,
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
