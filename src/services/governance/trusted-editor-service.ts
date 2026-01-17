/**
 * Trusted editor service for role management and elevation.
 *
 * @remarks
 * Manages the trusted editor and authority editor roles based on
 * community contribution metrics and verification.
 *
 * **Role Hierarchy:**
 * - Community Member (default)
 * - Trusted Editor (automatic elevation)
 * - Authority Editor (manual verification)
 * - Domain Expert (field-specific)
 * - Administrator (governance committee)
 *
 * **Automatic Elevation Criteria for Trusted Editor:**
 * - Account age > 90 days
 * - 10+ eprints published with 5+ endorsements each
 * - 20+ constructive graph proposals/votes
 * - No violations or warnings
 * - Reputation score > 0.7
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { DID, NSID, Timestamp } from '../../types/atproto.js';
import { DatabaseError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { Result } from '../../types/result.js';

/**
 * User role in the governance system.
 *
 * @public
 */
export type GovernanceRole =
  | 'community-member'
  | 'trusted-editor'
  | 'graph-editor'
  | 'domain-expert'
  | 'administrator';

/**
 * Vote weight multipliers by role.
 *
 * @public
 */
export const ROLE_VOTE_WEIGHTS: Record<GovernanceRole, number> = {
  'community-member': 1.0,
  'trusted-editor': 2.0,
  'graph-editor': 3.0,
  'domain-expert': 3.0,
  administrator: 5.0,
};

/**
 * Authority editor vote weight on authority proposals.
 */
export const AUTHORITY_EDITOR_AUTHORITY_WEIGHT = 4.5;

/**
 * User reputation metrics.
 *
 * @public
 */
export interface ReputationMetrics {
  /** User DID */
  did: DID;
  /** Account creation date */
  accountCreatedAt: Timestamp;
  /** Account age in days */
  accountAgeDays: number;
  /** Number of published eprints */
  eprintCount: number;
  /** Number of eprints with 5+ endorsements */
  wellEndorsedEprintCount: number;
  /** Total endorsements received */
  totalEndorsements: number;
  /** Number of graph proposals created */
  proposalCount: number;
  /** Number of votes cast */
  voteCount: number;
  /** Number of proposals that reached consensus */
  successfulProposals: number;
  /** Number of active warnings */
  warningCount: number;
  /** Number of violations */
  violationCount: number;
  /** Computed reputation score (0-1) */
  reputationScore: number;
  /** Current role */
  role: GovernanceRole;
  /** Whether eligible for trusted editor */
  eligibleForTrustedEditor: boolean;
  /** Missing criteria for trusted editor */
  missingCriteria: string[];
}

/**
 * Editor status with delegation info.
 *
 * @public
 */
export interface EditorStatus {
  /** User DID */
  did: DID;
  /** Display name */
  displayName?: string;
  /** Current role */
  role: GovernanceRole;
  /** When the role was granted */
  roleGrantedAt?: Timestamp;
  /** Who granted the role */
  roleGrantedBy?: DID;
  /** Has active delegation to write to Governance PDS */
  hasDelegation: boolean;
  /** Delegation expiration if active */
  delegationExpiresAt?: Timestamp;
  /** Collections allowed in delegation */
  delegationCollections?: readonly NSID[];
  /** Records created today */
  recordsCreatedToday: number;
  /** Daily rate limit */
  dailyRateLimit: number;
  /** Reputation metrics */
  metrics: ReputationMetrics;
}

/**
 * Trusted editor service configuration.
 *
 * @public
 */
export interface TrustedEditorServiceOptions {
  /** PostgreSQL pool */
  pool: Pool;
  /** Logger instance */
  logger: ILogger;
}

/**
 * Criteria thresholds for automatic elevation.
 */
const TRUSTED_EDITOR_CRITERIA = {
  minAccountAgeDays: 90,
  minEprints: 10,
  minEndorsementsPerEprint: 5,
  minProposalsAndVotes: 20,
  maxWarnings: 0,
  maxViolations: 0,
  minReputationScore: 0.7,
};

/**
 * Trusted editor service for role management.
 *
 * @example
 * ```typescript
 * const service = new TrustedEditorService({ pool, logger });
 *
 * // Check user status
 * const status = await service.getEditorStatus(userDid);
 *
 * // Check if eligible for elevation
 * const metrics = await service.calculateReputationMetrics(userDid);
 * if (metrics.eligibleForTrustedEditor) {
 *   await service.elevateToTrustedEditor(userDid, adminDid);
 * }
 * ```
 *
 * @public
 */
export class TrustedEditorService {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  constructor(options: TrustedEditorServiceOptions) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  /**
   * Get editor status for a user.
   *
   * @param did - User DID
   * @returns Editor status with role and delegation info
   *
   * @public
   */
  async getEditorStatus(did: DID): Promise<Result<EditorStatus, DatabaseError>> {
    try {
      // Get user info and role
      const userResult = await this.pool.query<{
        did: string;
        display_name: string | null;
        role: string;
        role_granted_at: Date | null;
        role_granted_by: string | null;
        created_at: Date;
      }>(
        `SELECT
          a.did,
          a.display_name,
          COALESCE(gr.role, 'community-member') as role,
          gr.granted_at as role_granted_at,
          gr.granted_by as role_granted_by,
          a.indexed_at as created_at
        FROM authors_index a
        LEFT JOIN governance_roles gr ON gr.did = a.did AND gr.active = true
        WHERE a.did = $1`,
        [did]
      );

      // Get delegation info
      const delegationResult = await this.pool.query<{
        expires_at: Date;
        collections: string[];
        records_created_today: number;
        max_records_per_day: number;
      }>(
        `SELECT expires_at, collections, records_created_today, max_records_per_day
         FROM governance_delegations
         WHERE delegate_did = $1 AND active = true AND expires_at > NOW()
         ORDER BY granted_at DESC
         LIMIT 1`,
        [did]
      );

      // Calculate metrics
      const metricsResult = await this.calculateReputationMetrics(did);
      if (!metricsResult.ok) {
        return metricsResult;
      }

      const user = userResult.rows[0];
      const delegation = delegationResult.rows[0];
      const metrics = metricsResult.value;

      return {
        ok: true,
        value: {
          did,
          displayName: user?.display_name ?? undefined,
          role: (user?.role ?? 'community-member') as GovernanceRole,
          roleGrantedAt: user?.role_granted_at?.getTime() as Timestamp | undefined,
          roleGrantedBy: user?.role_granted_by as DID | undefined,
          hasDelegation: !!delegation,
          delegationExpiresAt: delegation?.expires_at.getTime() as Timestamp | undefined,
          delegationCollections: delegation?.collections as NSID[] | undefined,
          recordsCreatedToday: delegation?.records_created_today ?? 0,
          dailyRateLimit: delegation?.max_records_per_day ?? 0,
          metrics,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get editor status', error instanceof Error ? error : undefined, {
        did,
      });
      return {
        ok: false,
        error: new DatabaseError('READ', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Calculate reputation metrics for a user.
   *
   * @param did - User DID
   * @returns Reputation metrics
   *
   * @public
   */
  async calculateReputationMetrics(did: DID): Promise<Result<ReputationMetrics, DatabaseError>> {
    try {
      // Get account info
      const accountResult = await this.pool.query<{
        created_at: Date;
        role: string;
      }>(
        `SELECT
          a.indexed_at as created_at,
          COALESCE(gr.role, 'community-member') as role
        FROM authors_index a
        LEFT JOIN governance_roles gr ON gr.did = a.did AND gr.active = true
        WHERE a.did = $1`,
        [did]
      );

      const accountCreatedAt = accountResult.rows[0]?.created_at ?? new Date();
      const role = (accountResult.rows[0]?.role ?? 'community-member') as GovernanceRole;
      const accountAgeDays = Math.floor(
        (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Count eprints and endorsements
      const eprintResult = await this.pool.query<{
        eprint_count: string;
        well_endorsed_count: string;
        total_endorsements: string;
      }>(
        `SELECT
          COUNT(DISTINCT e.uri) as eprint_count,
          COUNT(DISTINCT CASE WHEN endorsement_count >= 5 THEN e.uri END) as well_endorsed_count,
          COALESCE(SUM(endorsement_count), 0) as total_endorsements
        FROM eprints_index e
        LEFT JOIN (
          SELECT eprint_uri, COUNT(*) as endorsement_count
          FROM endorsements_index
          GROUP BY eprint_uri
        ) enc ON enc.eprint_uri = e.uri
        WHERE e.submitted_by = $1`,
        [did]
      );

      const eprintCount = parseInt(eprintResult.rows[0]?.eprint_count ?? '0', 10);
      const wellEndorsedEprintCount = parseInt(
        eprintResult.rows[0]?.well_endorsed_count ?? '0',
        10
      );
      const totalEndorsements = parseInt(eprintResult.rows[0]?.total_endorsements ?? '0', 10);

      // Count proposals and votes
      const proposalResult = await this.pool.query<{
        proposal_count: string;
        vote_count: string;
        successful_proposals: string;
      }>(
        `SELECT
          (SELECT COUNT(*) FROM field_proposals_index WHERE proposer_did = $1) as proposal_count,
          (SELECT COUNT(*) FROM votes_index WHERE voter_did = $1) as vote_count,
          (SELECT COUNT(*) FROM field_proposals_index
           WHERE proposer_did = $1 AND status = 'approved') as successful_proposals`,
        [did]
      );

      const proposalCount = parseInt(proposalResult.rows[0]?.proposal_count ?? '0', 10);
      const voteCount = parseInt(proposalResult.rows[0]?.vote_count ?? '0', 10);
      const successfulProposals = parseInt(proposalResult.rows[0]?.successful_proposals ?? '0', 10);

      // Count warnings and violations
      const warningResult = await this.pool.query<{
        warning_count: string;
        violation_count: string;
      }>(
        `SELECT
          (SELECT COUNT(*) FROM user_warnings WHERE user_did = $1 AND active = true) as warning_count,
          (SELECT COUNT(*) FROM user_violations WHERE user_did = $1) as violation_count`,
        [did]
      );

      const warningCount = parseInt(warningResult.rows[0]?.warning_count ?? '0', 10);
      const violationCount = parseInt(warningResult.rows[0]?.violation_count ?? '0', 10);

      // Calculate reputation score
      const reputationScore = this.calculateReputationScore({
        accountAgeDays,
        eprintCount,
        wellEndorsedEprintCount,
        totalEndorsements,
        proposalCount,
        voteCount,
        successfulProposals,
        warningCount,
        violationCount,
      });

      // Check eligibility
      const missingCriteria: string[] = [];

      if (accountAgeDays < TRUSTED_EDITOR_CRITERIA.minAccountAgeDays) {
        missingCriteria.push(
          `Account age ${accountAgeDays} days < ${TRUSTED_EDITOR_CRITERIA.minAccountAgeDays} required`
        );
      }
      if (wellEndorsedEprintCount < TRUSTED_EDITOR_CRITERIA.minEprints) {
        missingCriteria.push(
          `Well-endorsed eprints ${wellEndorsedEprintCount} < ${TRUSTED_EDITOR_CRITERIA.minEprints} required`
        );
      }
      if (proposalCount + voteCount < TRUSTED_EDITOR_CRITERIA.minProposalsAndVotes) {
        missingCriteria.push(
          `Proposals + votes ${proposalCount + voteCount} < ${TRUSTED_EDITOR_CRITERIA.minProposalsAndVotes} required`
        );
      }
      if (warningCount > TRUSTED_EDITOR_CRITERIA.maxWarnings) {
        missingCriteria.push(`Active warnings ${warningCount} > 0`);
      }
      if (violationCount > TRUSTED_EDITOR_CRITERIA.maxViolations) {
        missingCriteria.push(`Violations ${violationCount} > 0`);
      }
      if (reputationScore < TRUSTED_EDITOR_CRITERIA.minReputationScore) {
        missingCriteria.push(
          `Reputation ${reputationScore.toFixed(2)} < ${TRUSTED_EDITOR_CRITERIA.minReputationScore} required`
        );
      }

      return {
        ok: true,
        value: {
          did,
          accountCreatedAt: accountCreatedAt.getTime() as Timestamp,
          accountAgeDays,
          eprintCount,
          wellEndorsedEprintCount,
          totalEndorsements,
          proposalCount,
          voteCount,
          successfulProposals,
          warningCount,
          violationCount,
          reputationScore,
          role,
          eligibleForTrustedEditor: missingCriteria.length === 0,
          missingCriteria,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to calculate reputation metrics',
        error instanceof Error ? error : undefined,
        { did }
      );
      return {
        ok: false,
        error: new DatabaseError('READ', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Calculate reputation score from metrics.
   *
   * @internal
   */
  private calculateReputationScore(metrics: {
    accountAgeDays: number;
    eprintCount: number;
    wellEndorsedEprintCount: number;
    totalEndorsements: number;
    proposalCount: number;
    voteCount: number;
    successfulProposals: number;
    warningCount: number;
    violationCount: number;
  }): number {
    // Weighted scoring formula
    let score = 0;

    // Account age (max 0.15)
    score += Math.min(metrics.accountAgeDays / 365, 1) * 0.15;

    // Eprints with endorsements (max 0.3)
    score += Math.min(metrics.wellEndorsedEprintCount / 20, 1) * 0.3;

    // Community participation (max 0.25)
    const participation = metrics.proposalCount + metrics.voteCount;
    score += Math.min(participation / 50, 1) * 0.25;

    // Success rate (max 0.2)
    if (metrics.proposalCount > 0) {
      score += (metrics.successfulProposals / metrics.proposalCount) * 0.2;
    }

    // Penalties
    score -= metrics.warningCount * 0.1;
    score -= metrics.violationCount * 0.25;

    // Clamp to 0-1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Elevate user to trusted editor.
   *
   * @param did - User DID
   * @param grantedBy - Admin DID granting the role
   * @returns Success or error
   *
   * @public
   */
  async elevateToTrustedEditor(
    did: DID,
    grantedBy: DID
  ): Promise<Result<void, ValidationError | DatabaseError>> {
    // Check eligibility
    const metricsResult = await this.calculateReputationMetrics(did);
    if (!metricsResult.ok) {
      return metricsResult;
    }

    if (!metricsResult.value.eligibleForTrustedEditor) {
      return {
        ok: false,
        error: new ValidationError(
          `Not eligible: ${metricsResult.value.missingCriteria.join(', ')}`,
          'eligibility',
          'not-met'
        ),
      };
    }

    return this.setRole(did, 'trusted-editor', grantedBy);
  }

  /**
   * Assign authority editor role (manual verification required).
   *
   * @param did - User DID
   * @param grantedBy - Admin DID granting the role
   * @param verificationNotes - Notes about library science verification
   * @returns Success or error
   *
   * @public
   */
  async assignAuthorityEditor(
    did: DID,
    grantedBy: DID,
    verificationNotes: string
  ): Promise<Result<void, DatabaseError>> {
    // Authority editor requires manual verification
    // This would typically involve checking MLS/MLIS credentials
    try {
      // Deactivate any existing active roles first
      await this.pool.query(
        `UPDATE governance_roles SET active = false WHERE did = $1 AND active = true`,
        [did]
      );

      // Insert the new authority editor role
      await this.pool.query(
        `INSERT INTO governance_roles (
          id, did, role, granted_at, granted_by, verification_notes, active
        ) VALUES ($1, $2, 'graph-editor', NOW(), $3, $4, true)`,
        [crypto.randomUUID(), did, grantedBy, verificationNotes]
      );

      this.logger.info('Assigned authority editor role', { did, grantedBy });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error(
        'Failed to assign authority editor',
        error instanceof Error ? error : undefined,
        { did }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Set role for a user.
   *
   * @param did - User DID
   * @param role - Role to assign
   * @param grantedBy - Admin DID
   * @returns Success or error
   *
   * @public
   */
  async setRole(
    did: DID,
    role: GovernanceRole,
    grantedBy: DID
  ): Promise<Result<void, DatabaseError>> {
    try {
      // Deactivate any existing active roles first
      await this.pool.query(
        `UPDATE governance_roles SET active = false WHERE did = $1 AND active = true`,
        [did]
      );

      // Insert the new role
      await this.pool.query(
        `INSERT INTO governance_roles (id, did, role, granted_at, granted_by, active)
         VALUES ($1, $2, $3, NOW(), $4, true)`,
        [crypto.randomUUID(), did, role, grantedBy]
      );

      this.logger.info('Set governance role', { did, role, grantedBy });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to set role', error instanceof Error ? error : undefined, {
        did,
        role,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Revoke role from a user.
   *
   * @param did - User DID
   * @param revokedBy - Admin DID
   * @param reason - Reason for revocation
   * @returns Success or error
   *
   * @public
   */
  async revokeRole(did: DID, revokedBy: DID, reason: string): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query(
        `UPDATE governance_roles
         SET active = false, revoked_at = NOW(), revoked_by = $2, revocation_reason = $3
         WHERE did = $1 AND active = true`,
        [did, revokedBy, reason]
      );

      this.logger.info('Revoked governance role', { did, revokedBy, reason });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to revoke role', error instanceof Error ? error : undefined, {
        did,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * List all trusted editors.
   *
   * @param limit - Maximum results
   * @param cursor - Pagination cursor
   * @returns List of trusted editors
   *
   * @public
   */
  async listTrustedEditors(
    limit = 50,
    cursor?: string
  ): Promise<Result<{ editors: EditorStatus[]; cursor?: string }, DatabaseError>> {
    try {
      const result = await this.pool.query<{
        did: string;
        display_name: string | null;
        role: string;
        granted_at: Date;
        granted_by: string;
      }>(
        `SELECT gr.did, a.display_name, gr.role, gr.granted_at, gr.granted_by
         FROM governance_roles gr
         JOIN authors_index a ON a.did = gr.did
         WHERE gr.active = true AND gr.role IN ('trusted-editor', 'graph-editor')
         ${cursor ? 'AND gr.granted_at < $2' : ''}
         ORDER BY gr.granted_at DESC
         LIMIT $1`,
        cursor ? [limit + 1, new Date(parseInt(cursor, 10))] : [limit + 1]
      );

      const editors = result.rows.slice(0, limit);
      const hasMore = result.rows.length > limit;

      // Get full status for each editor
      const editorStatuses: EditorStatus[] = [];
      for (const editor of editors) {
        const statusResult = await this.getEditorStatus(editor.did as DID);
        if (statusResult.ok) {
          editorStatuses.push(statusResult.value);
        }
      }

      return {
        ok: true,
        value: {
          editors: editorStatuses,
          cursor: hasMore
            ? editors[editors.length - 1]?.granted_at?.getTime()?.toString()
            : undefined,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to list trusted editors',
        error instanceof Error ? error : undefined
      );
      return {
        ok: false,
        error: new DatabaseError('READ', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Get vote weight for a user.
   *
   * @param did - User DID
   * @param proposalType - Type of proposal (authority proposals get higher weight for authority editors)
   * @returns Vote weight multiplier
   *
   * @public
   */
  async getVoteWeight(did: DID, proposalType?: 'field' | 'authority' | 'facet'): Promise<number> {
    try {
      const result = await this.pool.query<{ role: string }>(
        `SELECT role FROM governance_roles WHERE did = $1 AND active = true`,
        [did]
      );

      const role = (result.rows[0]?.role ?? 'community-member') as GovernanceRole;

      // Authority editors get higher weight on authority proposals
      if (role === 'graph-editor' && (proposalType === 'authority' || proposalType === 'facet')) {
        return AUTHORITY_EDITOR_AUTHORITY_WEIGHT;
      }

      return ROLE_VOTE_WEIGHTS[role];
    } catch {
      return ROLE_VOTE_WEIGHTS['community-member'];
    }
  }

  /**
   * List pending elevation requests.
   *
   * @param limit - Maximum results
   * @param cursor - Pagination cursor (offset)
   * @returns List of elevation requests
   *
   * @public
   */
  async listElevationRequests(
    limit = 50,
    cursor?: string
  ): Promise<
    Result<
      {
        requests: ElevationRequest[];
        cursor?: string;
        total: number;
      },
      DatabaseError
    >
  > {
    try {
      const offset = cursor ? parseInt(cursor, 10) : 0;

      // Note: current_role is a PostgreSQL reserved keyword, must be quoted
      const result = await this.pool.query<{
        id: string;
        did: string;
        requested_role: string;
        current_role: string;
        status: string;
        verification_notes: string | null;
        rejection_reason: string | null;
        requested_at: Date;
        processed_at: Date | null;
        processed_by: string | null;
      }>(
        `SELECT id, did, requested_role, "current_role", status,
                verification_notes, rejection_reason, requested_at,
                processed_at, processed_by
         FROM elevation_requests
         WHERE status = 'pending'
         ORDER BY requested_at DESC
         LIMIT $1 OFFSET $2`,
        [limit + 1, offset]
      );

      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM elevation_requests WHERE status = 'pending'`
      );

      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
      const hasMore = result.rows.length > limit;
      const requests = result.rows.slice(0, limit);

      // Enrich with user data
      const enrichedRequests: ElevationRequest[] = await Promise.all(
        requests.map(async (req) => {
          const authorResult = await this.pool.query<{
            handle: string | null;
            display_name: string | null;
          }>(`SELECT handle, display_name FROM authors_index WHERE did = $1`, [req.did]);

          return {
            id: req.id,
            did: req.did as DID,
            handle: authorResult.rows[0]?.handle ?? undefined,
            displayName: authorResult.rows[0]?.display_name ?? undefined,
            requestedRole: req.requested_role as GovernanceRole,
            currentRole: req.current_role as GovernanceRole,
            status: req.status as 'pending' | 'approved' | 'rejected',
            verificationNotes: req.verification_notes ?? undefined,
            rejectionReason: req.rejection_reason ?? undefined,
            requestedAt: req.requested_at.getTime() as Timestamp,
            processedAt: req.processed_at?.getTime() as Timestamp | undefined,
            processedBy: req.processed_by as DID | undefined,
          };
        })
      );

      return {
        ok: true,
        value: {
          requests: enrichedRequests,
          cursor: hasMore ? String(offset + limit) : undefined,
          total,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to list elevation requests',
        error instanceof Error ? error : undefined
      );
      return {
        ok: false,
        error: new DatabaseError('READ', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Approve an elevation request.
   *
   * @param requestId - Request ID
   * @param adminDid - Admin DID approving
   * @param verificationNotes - Optional notes
   * @returns Success or error
   *
   * @public
   */
  async approveElevationRequest(
    requestId: string,
    adminDid: DID,
    verificationNotes?: string
  ): Promise<Result<{ requestId: string; message: string }, DatabaseError | ValidationError>> {
    try {
      // Get the request
      const requestResult = await this.pool.query<{
        id: string;
        did: string;
        requested_role: string;
        status: string;
      }>(`SELECT id, did, requested_role, status FROM elevation_requests WHERE id = $1`, [
        requestId,
      ]);

      const request = requestResult.rows[0];
      if (!request) {
        return {
          ok: false,
          error: new ValidationError('Elevation request not found', 'requestId', requestId),
        };
      }

      if (request.status !== 'pending') {
        return {
          ok: false,
          error: new ValidationError(
            `Request has already been ${request.status}`,
            'status',
            request.status
          ),
        };
      }

      // Grant the role
      const setRoleResult = await this.setRole(
        request.did as DID,
        request.requested_role as GovernanceRole,
        adminDid
      );

      if (!setRoleResult.ok) {
        return setRoleResult;
      }

      // Update the request status
      await this.pool.query(
        `UPDATE elevation_requests
         SET status = 'approved',
             verification_notes = $1,
             processed_at = NOW(),
             processed_by = $2
         WHERE id = $3`,
        [verificationNotes ?? null, adminDid, requestId]
      );

      this.logger.info('Elevation request approved', {
        requestId,
        targetDid: request.did,
        newRole: request.requested_role,
        adminDid,
      });

      return {
        ok: true,
        value: {
          requestId,
          message: `Elevated to ${request.requested_role}`,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to approve elevation request',
        error instanceof Error ? error : undefined,
        { requestId }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Reject an elevation request.
   *
   * @param requestId - Request ID
   * @param adminDid - Admin DID rejecting
   * @param reason - Rejection reason
   * @returns Success or error
   *
   * @public
   */
  async rejectElevationRequest(
    requestId: string,
    adminDid: DID,
    reason: string
  ): Promise<Result<{ requestId: string; message: string }, DatabaseError | ValidationError>> {
    try {
      // Get the request
      const requestResult = await this.pool.query<{
        id: string;
        did: string;
        requested_role: string;
        status: string;
      }>(`SELECT id, did, requested_role, status FROM elevation_requests WHERE id = $1`, [
        requestId,
      ]);

      const request = requestResult.rows[0];
      if (!request) {
        return {
          ok: false,
          error: new ValidationError('Elevation request not found', 'requestId', requestId),
        };
      }

      if (request.status !== 'pending') {
        return {
          ok: false,
          error: new ValidationError(
            `Request has already been ${request.status}`,
            'status',
            request.status
          ),
        };
      }

      // Update the request status
      await this.pool.query(
        `UPDATE elevation_requests
         SET status = 'rejected',
             rejection_reason = $1,
             processed_at = NOW(),
             processed_by = $2
         WHERE id = $3`,
        [reason, adminDid, requestId]
      );

      this.logger.info('Elevation request rejected', {
        requestId,
        targetDid: request.did,
        adminDid,
        reason,
      });

      return {
        ok: true,
        value: {
          requestId,
          message: 'Elevation request rejected',
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to reject elevation request',
        error instanceof Error ? error : undefined,
        { requestId }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * List active delegations.
   *
   * @param limit - Maximum results
   * @param cursor - Pagination cursor (offset)
   * @returns List of delegations
   *
   * @public
   */
  async listDelegations(
    limit = 50,
    cursor?: string
  ): Promise<
    Result<
      {
        delegations: DelegationRecord[];
        cursor?: string;
        total: number;
      },
      DatabaseError
    >
  > {
    try {
      const offset = cursor ? parseInt(cursor, 10) : 0;

      const result = await this.pool.query<{
        id: string;
        delegate_did: string;
        collections: string[];
        expires_at: Date;
        max_records_per_day: number;
        records_created_today: number;
        granted_at: Date;
        granted_by: string;
        active: boolean;
      }>(
        `SELECT id, delegate_did, collections, expires_at, max_records_per_day,
                records_created_today, granted_at, granted_by, active
         FROM governance_delegations
         WHERE active = true AND expires_at > NOW()
         ORDER BY granted_at DESC
         LIMIT $1 OFFSET $2`,
        [limit + 1, offset]
      );

      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM governance_delegations WHERE active = true AND expires_at > NOW()`
      );

      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
      const hasMore = result.rows.length > limit;
      const delegations = result.rows.slice(0, limit);

      // Enrich with user data
      const enrichedDelegations: DelegationRecord[] = await Promise.all(
        delegations.map(async (del) => {
          const authorResult = await this.pool.query<{
            handle: string | null;
            display_name: string | null;
          }>(`SELECT handle, display_name FROM authors_index WHERE did = $1`, [del.delegate_did]);

          return {
            id: del.id,
            delegateDid: del.delegate_did as DID,
            handle: authorResult.rows[0]?.handle ?? undefined,
            displayName: authorResult.rows[0]?.display_name ?? undefined,
            collections: del.collections,
            expiresAt: del.expires_at.getTime() as Timestamp,
            maxRecordsPerDay: del.max_records_per_day,
            recordsCreatedToday: del.records_created_today,
            grantedAt: del.granted_at.getTime() as Timestamp,
            grantedBy: del.granted_by as DID,
            active: del.active,
          };
        })
      );

      return {
        ok: true,
        value: {
          delegations: enrichedDelegations,
          cursor: hasMore ? String(offset + limit) : undefined,
          total,
        },
      };
    } catch (error) {
      this.logger.error('Failed to list delegations', error instanceof Error ? error : undefined);
      return {
        ok: false,
        error: new DatabaseError('READ', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Grant a delegation.
   *
   * @param delegateDid - DID to delegate to
   * @param collections - Collections to allow
   * @param daysValid - Number of days delegation is valid
   * @param grantedBy - Admin DID granting delegation
   * @returns Success or error
   *
   * @public
   */
  async grantDelegation(
    delegateDid: DID,
    collections: string[],
    daysValid: number,
    grantedBy: DID
  ): Promise<Result<{ delegationId: string; message: string }, DatabaseError>> {
    try {
      const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
      const delegationId = crypto.randomUUID();
      const today = new Date().toISOString().split('T')[0];

      await this.pool.query(
        `INSERT INTO governance_delegations (
          id, delegate_did, collections, expires_at, max_records_per_day,
          records_created_today, last_reset_date, granted_at, granted_by, active
        ) VALUES ($1, $2, $3, $4, 100, 0, $5, NOW(), $6, true)`,
        [delegationId, delegateDid, collections, expiresAt, today, grantedBy]
      );

      this.logger.info('Delegation granted', {
        delegationId,
        delegateDid,
        collections,
        daysValid,
        grantedBy,
      });

      return {
        ok: true,
        value: {
          delegationId,
          message: `Delegation granted for ${daysValid} days`,
        },
      };
    } catch (error) {
      this.logger.error('Failed to grant delegation', error instanceof Error ? error : undefined, {
        delegateDid,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Revoke a delegation.
   *
   * @param delegationId - Delegation ID
   * @param revokedBy - Admin DID revoking
   * @returns Success or error
   *
   * @public
   */
  async revokeDelegation(
    delegationId: string,
    revokedBy: DID
  ): Promise<Result<{ message: string }, DatabaseError | ValidationError>> {
    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(delegationId)) {
        return {
          ok: false,
          error: new ValidationError(
            'Delegation not found or already revoked',
            'delegationId',
            delegationId
          ),
        };
      }

      const result = await this.pool.query(
        `UPDATE governance_delegations
         SET active = false
         WHERE id = $1 AND active = true
         RETURNING id`,
        [delegationId]
      );

      if (result.rowCount === 0) {
        return {
          ok: false,
          error: new ValidationError(
            'Delegation not found or already revoked',
            'delegationId',
            delegationId
          ),
        };
      }

      this.logger.info('Delegation revoked', { delegationId, revokedBy });

      return {
        ok: true,
        value: { message: 'Delegation revoked' },
      };
    } catch (error) {
      this.logger.error('Failed to revoke delegation', error instanceof Error ? error : undefined, {
        delegationId,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }
}

/**
 * Elevation request record.
 *
 * @public
 */
export interface ElevationRequest {
  id: string;
  did: DID;
  handle?: string;
  displayName?: string;
  requestedRole: GovernanceRole;
  currentRole: GovernanceRole;
  status: 'pending' | 'approved' | 'rejected';
  verificationNotes?: string;
  rejectionReason?: string;
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  processedBy?: DID;
}

/**
 * Delegation record.
 *
 * @public
 */
export interface DelegationRecord {
  id: string;
  delegateDid: DID;
  handle?: string;
  displayName?: string;
  collections: string[];
  expiresAt: Timestamp;
  maxRecordsPerDay: number;
  recordsCreatedToday: number;
  grantedAt: Timestamp;
  grantedBy: DID;
  active: boolean;
}
