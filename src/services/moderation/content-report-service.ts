/**
 * Service for managing user-submitted content reports.
 *
 * @remarks
 * Provides CRUD operations for content reports, used by authenticated users
 * to flag inappropriate content and by admins to review and resolve reports.
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Allowed reasons for reporting content.
 *
 * @public
 */
export type ReportReason = 'spam' | 'inappropriate' | 'copyright' | 'misinformation' | 'other';

/**
 * Moderation status of a content report.
 *
 * @public
 */
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

/**
 * A content report record.
 *
 * @public
 */
export interface ContentReport {
  readonly id: number;
  readonly reporterDid: string;
  readonly targetUri: string;
  readonly targetCollection: string;
  readonly reason: ReportReason;
  readonly description: string | null;
  readonly status: ReportStatus;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
}

/**
 * Input for creating a content report.
 *
 * @public
 */
export interface CreateReportInput {
  readonly reporterDid: string;
  readonly targetUri: string;
  readonly targetCollection: string;
  readonly reason: ReportReason;
  readonly description?: string;
}

/**
 * Database row shape for content_reports table.
 */
interface ContentReportRow {
  id: number;
  reporter_did: string;
  target_uri: string;
  target_collection: string;
  reason: string;
  description: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

/**
 * Maps a database row to a ContentReport object.
 *
 * @param row - raw database row with snake_case column names
 * @returns mapped ContentReport with camelCase property names
 */
function mapRow(row: ContentReportRow): ContentReport {
  return {
    id: row.id,
    reporterDid: row.reporter_did,
    targetUri: row.target_uri,
    targetCollection: row.target_collection,
    reason: row.reason as ReportReason,
    description: row.description,
    status: row.status as ReportStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Service for creating, listing, and resolving content reports.
 *
 * @public
 */
export class ContentReportService {
  constructor(
    private readonly pool: Pool,
    private readonly logger: ILogger
  ) {}

  /**
   * Creates a content report, or returns the existing one if a duplicate.
   *
   * @param input - report details
   * @returns the created or existing content report
   */
  async createReport(input: CreateReportInput): Promise<ContentReport> {
    // Atomic upsert: insert or return existing report in a single query.
    // ON CONFLICT touches updated_at so RETURNING always yields a row.
    const result = await this.pool.query<ContentReportRow>(
      `INSERT INTO content_reports (reporter_did, target_uri, target_collection, reason, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_did, target_uri) DO UPDATE
         SET created_at = content_reports.created_at
       RETURNING *`,
      [
        input.reporterDid,
        input.targetUri,
        input.targetCollection,
        input.reason,
        input.description ?? null,
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Content report upsert returned no rows');
    }

    this.logger.info('Content report created', {
      reportId: row.id,
      targetUri: input.targetUri,
      reason: input.reason,
    });

    return mapRow(row);
  }

  /**
   * Retrieves all reports for a specific content URI.
   *
   * @param targetUri - AT-URI of the reported content
   * @returns list of reports ordered by creation date descending
   */
  async getReportsForContent(targetUri: string): Promise<ContentReport[]> {
    const result = await this.pool.query<ContentReportRow>(
      `SELECT * FROM content_reports WHERE target_uri = $1 ORDER BY created_at DESC`,
      [targetUri]
    );

    return result.rows.map(mapRow);
  }

  /**
   * Lists pending reports for admin review.
   *
   * @param limit - maximum number of reports to return (default 50)
   * @param offset - number of reports to skip for pagination (default 0)
   * @returns paginated list of pending reports with total count
   */
  async listPendingReports(
    limit = 50,
    offset = 0
  ): Promise<{ reports: ContentReport[]; total: number }> {
    const [countResult, dataResult] = await Promise.all([
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM content_reports WHERE status = 'pending'`
      ),
      this.pool.query<ContentReportRow>(
        `SELECT * FROM content_reports WHERE status = 'pending' ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = countResult.rows[0]?.total ?? 0;
    const reports = dataResult.rows.map(mapRow);

    return { reports, total };
  }

  /**
   * Updates the status of a content report.
   *
   * @param id - report ID
   * @param status - new status
   * @param reviewedBy - DID of the admin performing the review
   * @returns the updated report, or null if not found
   */
  async updateReportStatus(
    id: number,
    status: ReportStatus,
    reviewedBy: string
  ): Promise<ContentReport | null> {
    const result = await this.pool.query<ContentReportRow>(
      `UPDATE content_reports
       SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, reviewedBy, id]
    );

    if (result.rows.length === 0) {
      this.logger.warn('Content report not found for status update', { id, status });
      return null;
    }

    this.logger.info('Content report status updated', {
      reportId: id,
      status,
      reviewedBy,
    });

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return mapRow(row);
  }
}
