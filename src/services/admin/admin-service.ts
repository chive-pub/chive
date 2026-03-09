/**
 * Admin service for dashboard operations.
 *
 * @remarks
 * Provides aggregate statistics, system health checks, alpha application
 * management, and user search for the admin dashboard. All queries target
 * the local PostgreSQL index; no PDS writes occur.
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';
import type { Pool } from 'pg';

import type { ElasticsearchConnectionPool } from '../../storage/elasticsearch/connection.js';
import type { Neo4jConnection } from '../../storage/neo4j/connection.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Aggregate counts from all index tables.
 */
export interface AdminOverview {
  readonly eprints: number;
  readonly authors: number;
  readonly reviews: number;
  readonly endorsements: number;
  readonly collections: number;
  readonly tags: number;
}

/**
 * Health status of a single database connection.
 */
export interface DatabaseHealth {
  readonly name: string;
  readonly healthy: boolean;
  readonly latencyMs?: number;
  readonly error?: string;
}

/**
 * Overall system health status.
 */
export interface SystemHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly databases: readonly DatabaseHealth[];
  readonly uptime: number;
  readonly timestamp: string;
}

/**
 * Alpha application row from the database.
 */
export interface AlphaApplication {
  readonly id: string;
  readonly did: string;
  readonly handle: string | null;
  readonly email: string;
  readonly status: string;
  readonly sector: string;
  readonly sectorOther: string | null;
  readonly careerStage: string;
  readonly careerStageOther: string | null;
  readonly affiliations: unknown[];
  readonly researchKeywords: unknown[];
  readonly motivation: string | null;
  readonly zulipInvited: boolean;
  readonly reviewedAt: string | null;
  readonly reviewedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Alpha application statistics.
 */
export interface AlphaStats {
  readonly byStatus: Record<string, number>;
  readonly bySector: Record<string, number>;
  readonly byCareerStage: Record<string, number>;
  readonly recentByDay: readonly { date: string; count: number }[];
  readonly total: number;
}

/**
 * User detail for admin search.
 */
export interface UserDetail {
  readonly did: string;
  readonly handle: string | null;
  readonly displayName: string | null;
  readonly eprintCount: number;
  readonly reviewCount: number;
  readonly endorsementCount: number;
  readonly roles: readonly string[];
  readonly createdAt: string | null;
}

/**
 * Paginated result for list queries.
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly cursor?: string;
}

/**
 * Review row from the reviews_index table.
 */
export interface ReviewRow {
  readonly uri: string;
  readonly cid: string;
  readonly eprintUri: string;
  readonly reviewerDid: string;
  readonly motivation: string;
  readonly replyCount: number;
  readonly endorsementCount: number;
  readonly eprintTitle?: string;
  readonly createdAt: string;
  readonly indexedAt: string;
}

/**
 * Endorsement row from the endorsements_index table.
 */
export interface EndorsementRow {
  readonly uri: string;
  readonly cid: string;
  readonly eprintUri: string;
  readonly endorserDid: string;
  readonly endorsementType: string;
  readonly comment: string | null;
  readonly eprintTitle?: string;
  readonly createdAt: string;
  readonly indexedAt: string;
}

/**
 * Time-series bucket for view/download metrics.
 */
export interface TimeSeriesBucket {
  readonly timestamp: string;
  readonly views: number;
  readonly downloads: number;
}

/**
 * Import row from the eprints_index table.
 */
export interface ImportRow {
  readonly uri: string;
  readonly title: string;
  readonly submittedBy: string;
  readonly pdsUrl: string;
  readonly createdAt: string;
  readonly indexedAt: string;
}

/**
 * Search analytics aggregate data.
 */
export interface SearchAnalytics {
  readonly totalQueries: number;
  readonly totalClicks: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly ctr: number;
  readonly avgDwellTimeMs: number | null;
  readonly positionDistribution: readonly { position: number; count: number }[];
  readonly topQueries: readonly {
    query: string;
    impressionCount: number;
    clickCount: number;
  }[];
  readonly zeroResultCount: number;
  readonly relevanceGradeDistribution: readonly {
    relevanceGrade: number;
    count: number;
  }[];
  readonly timestamp: string;
}

/**
 * Audit log entry returned from the governance_audit_log table.
 */
export interface AuditLogRow {
  readonly id: string;
  readonly actorDid: string;
  readonly actorHandle?: string;
  readonly action: string;
  readonly collection?: string;
  readonly targetUri?: string;
  readonly targetDid?: string;
  readonly ipAddress?: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: string;
}

/**
 * Warning entry returned from the user_warnings table.
 */
export interface WarningRow {
  readonly id: string;
  readonly targetDid: string;
  readonly targetHandle?: string;
  readonly reason: string;
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly acknowledged: boolean;
  readonly acknowledgedAt?: string | null;
}

/**
 * Violation entry returned from the user_violations table.
 */
export interface ViolationRow {
  readonly id: string;
  readonly targetDid: string;
  readonly targetHandle?: string;
  readonly type: string;
  readonly severity: string;
  readonly description: string;
  readonly targetUri?: string;
  readonly detectedAt: string;
  readonly resolvedAt?: string;
  readonly resolution?: string;
}

/**
 * PDS entry for the admin dashboard.
 */
export interface PDSEntryRow {
  readonly url: string;
  readonly status: string;
  readonly lastScanAt?: string;
  readonly recordCount: number;
  readonly userCount: number;
}

/**
 * Raw alpha application row from PostgreSQL with aliased columns.
 */
interface AlphaApplicationRow {
  id: string;
  did: string;
  handle: string | null;
  email: string;
  status: string;
  sector: string;
  sectorOther: string | null;
  careerStage: string;
  careerStageOther: string | null;
  affiliations: unknown[] | null;
  researchKeywords: unknown[] | null;
  motivation: string | null;
  zulipInvited: boolean;
  reviewedAt: Date | string | null;
  reviewedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Raw user row from PostgreSQL with aliased columns.
 */
interface UserRow {
  did: string;
  handle: string | null;
  displayName: string | null;
  eprintCount: number;
  reviewCount: number;
  endorsementCount: number;
  createdAt: Date | string | null;
}

/**
 * Converts a Date or string value to an ISO string.
 *
 * @param value - date value from PostgreSQL
 * @returns ISO string or the original string
 */
function toISOString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Converts a nullable Date or string value to an ISO string or null.
 *
 * @param value - nullable date value from PostgreSQL
 * @returns ISO string, null, or the original string
 */
function toISOStringOrNull(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Converts a raw alpha application row to the public interface.
 *
 * @param row - raw database row
 * @returns normalized alpha application
 */
function normalizeAlphaRow(row: AlphaApplicationRow): AlphaApplication {
  return {
    id: row.id,
    did: row.did,
    handle: row.handle,
    email: row.email,
    status: row.status,
    sector: row.sector,
    sectorOther: row.sectorOther,
    careerStage: row.careerStage,
    careerStageOther: row.careerStageOther,
    affiliations: row.affiliations ?? [],
    researchKeywords: row.researchKeywords ?? [],
    motivation: row.motivation,
    zulipInvited: row.zulipInvited,
    reviewedAt: toISOStringOrNull(row.reviewedAt),
    reviewedBy: row.reviewedBy,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt),
  };
}

/**
 * Admin service for dashboard operations.
 *
 * @public
 */
export class AdminService {
  private readonly pool: Pool;
  private readonly redis: Redis;
  private readonly esPool: ElasticsearchConnectionPool;
  private readonly neo4jConnection: Neo4jConnection;
  private readonly logger: ILogger;

  constructor(
    pool: Pool,
    redis: Redis,
    esPool: ElasticsearchConnectionPool,
    neo4jConnection: Neo4jConnection,
    logger: ILogger
  ) {
    this.pool = pool;
    this.redis = redis;
    this.esPool = esPool;
    this.neo4jConnection = neo4jConnection;
    this.logger = logger.child({ service: 'AdminService' });
  }

  /**
   * Returns aggregate counts from all index tables.
   *
   * @returns overview statistics
   */
  async getOverview(): Promise<AdminOverview> {
    const result = await this.pool.query<AdminOverview>(`
      SELECT
        (SELECT COUNT(*)::int FROM eprints_index WHERE deleted_at IS NULL) as eprints,
        (SELECT COUNT(*)::int FROM authors_index) as authors,
        (SELECT COUNT(*)::int FROM reviews_index WHERE deleted_at IS NULL) as reviews,
        (SELECT COUNT(*)::int FROM endorsements_index WHERE deleted_at IS NULL) as endorsements,
        (SELECT COUNT(*)::int FROM collections_index) as collections,
        (SELECT COUNT(*)::int FROM user_tags_index WHERE deleted_at IS NULL) as tags
    `);

    const row = result.rows[0];
    if (!row) {
      return { eprints: 0, authors: 0, reviews: 0, endorsements: 0, collections: 0, tags: 0 };
    }

    return row;
  }

  /**
   * Checks health of each database connection.
   *
   * @returns system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const databases: DatabaseHealth[] = [];

    // PostgreSQL
    const pgHealth = await this.checkDatabase('postgresql', async () => {
      await this.pool.query('SELECT 1');
    });
    databases.push(pgHealth);

    // Elasticsearch
    const esHealth = await this.checkDatabase('elasticsearch', async () => {
      const result = await this.esPool.healthCheck();
      if (!result.healthy) {
        throw new Error(result.error ?? 'Cluster unhealthy');
      }
    });
    databases.push(esHealth);

    // Neo4j
    const neo4jHealth = await this.checkDatabase('neo4j', async () => {
      const result = await this.neo4jConnection.healthCheck();
      if (!result.healthy) {
        throw new Error(result.message ?? 'Connection unhealthy');
      }
    });
    databases.push(neo4jHealth);

    // Redis
    const redisHealth = await this.checkDatabase('redis', async () => {
      await this.redis.ping();
    });
    databases.push(redisHealth);

    const allHealthy = databases.every((db) => db.healthy);
    const anyHealthy = databases.some((db) => db.healthy);

    return {
      status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
      databases,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Lists alpha applications with optional status filter and pagination.
   *
   * @param status - filter by application status
   * @param limit - maximum number of results
   * @param cursor - pagination cursor (ISO date string)
   * @returns paginated list of alpha applications
   */
  async getAlphaApplications(
    status?: string,
    limit = 50,
    cursor?: string
  ): Promise<PaginatedResult<AlphaApplication>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    if (cursor) {
      conditions.push(`created_at < $${paramIdx++}`);
      params.push(cursor);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit + 1);
    const limitParam = `$${paramIdx}`;

    const result = await this.pool.query<AlphaApplicationRow>(
      `SELECT
        id, did, handle, email, status,
        sector, sector_other as "sectorOther",
        career_stage as "careerStage", career_stage_other as "careerStageOther",
        affiliations, research_keywords as "researchKeywords",
        motivation, zulip_invited as "zulipInvited",
        reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM alpha_applications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitParam}`,
      params
    );

    const items = result.rows.slice(0, limit).map(normalizeAlphaRow);

    const hasMore = result.rows.length > limit;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.createdAt : undefined;

    // Get total count
    const countConditions = status ? `WHERE status = $1` : '';
    const countParams = status ? [status] : [];
    const countResult = await this.pool.query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM alpha_applications ${countConditions}`,
      countParams
    );

    return {
      items,
      total: countResult.rows[0]?.count ?? 0,
      cursor: nextCursor,
    };
  }

  /**
   * Gets a single alpha application by DID.
   *
   * @param did - applicant's DID
   * @returns the application, or null if not found
   */
  async getAlphaApplication(did: string): Promise<AlphaApplication | null> {
    const result = await this.pool.query<AlphaApplicationRow>(
      `SELECT
        id, did, handle, email, status,
        sector, sector_other as "sectorOther",
        career_stage as "careerStage", career_stage_other as "careerStageOther",
        affiliations, research_keywords as "researchKeywords",
        motivation, zulip_invited as "zulipInvited",
        reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM alpha_applications WHERE did = $1`,
      [did]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    if (!row) return null;

    return normalizeAlphaRow(row);
  }

  /**
   * Updates an alpha application status (approve, reject, or revoke).
   *
   * @param did - applicant's DID
   * @param action - action to take
   * @param reviewer - DID of the reviewing admin
   * @returns updated application
   */
  async updateAlphaApplication(
    did: string,
    action: 'approve' | 'reject' | 'revoke',
    reviewer: string
  ): Promise<AlphaApplication | null> {
    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      revoke: 'revoked',
    } as const;

    const status = statusMap[action];

    await this.pool.query(
      `UPDATE alpha_applications
       SET status = $1, reviewed_at = now(), reviewed_by = $2, updated_at = now()
       WHERE did = $3`,
      [status, reviewer, did]
    );

    this.logger.info('Alpha application updated', { did, action, status, reviewer });

    return this.getAlphaApplication(did);
  }

  /**
   * Returns aggregate statistics for alpha applications.
   *
   * @returns alpha application statistics
   */
  async getAlphaStats(): Promise<AlphaStats> {
    const [statusResult, sectorResult, careerResult, recentResult, totalResult] = await Promise.all(
      [
        this.pool.query<{ status: string; count: number }>(
          `SELECT status, COUNT(*)::int as count FROM alpha_applications GROUP BY status`
        ),
        this.pool.query<{ sector: string; count: number }>(
          `SELECT sector, COUNT(*)::int as count FROM alpha_applications GROUP BY sector ORDER BY count DESC`
        ),
        this.pool.query<{ career_stage: string; count: number }>(
          `SELECT career_stage, COUNT(*)::int as count FROM alpha_applications GROUP BY career_stage ORDER BY count DESC`
        ),
        this.pool.query<{ date: Date; count: number }>(`
          SELECT created_at::date as date, COUNT(*)::int as count
          FROM alpha_applications
          WHERE created_at > now() - interval '7 days'
          GROUP BY created_at::date
          ORDER BY date DESC
        `),
        this.pool.query<{ count: number }>(`SELECT COUNT(*)::int as count FROM alpha_applications`),
      ]
    );

    return {
      byStatus: Object.fromEntries(statusResult.rows.map((r) => [r.status, r.count])),
      bySector: Object.fromEntries(sectorResult.rows.map((r) => [r.sector, r.count])),
      byCareerStage: Object.fromEntries(careerResult.rows.map((r) => [r.career_stage, r.count])),
      recentByDay: recentResult.rows.map((r) => ({
        date: r.date instanceof Date ? (r.date.toISOString().split('T')[0] ?? '') : String(r.date),
        count: r.count,
      })),
      total: totalResult.rows[0]?.count ?? 0,
    };
  }

  /**
   * Searches users by handle or DID.
   *
   * @param query - search term (handle or DID prefix)
   * @param limit - maximum number of results
   * @returns matching users with basic stats
   */
  async searchUsers(query: string, limit = 20): Promise<readonly UserDetail[]> {
    const searchTerm = `%${query}%`;

    const result = await this.pool.query<UserRow>(
      `SELECT
        a.did,
        a.handle,
        a.display_name as "displayName",
        (SELECT COUNT(*)::int FROM eprints_index WHERE submitted_by = a.did AND deleted_at IS NULL) as "eprintCount",
        (SELECT COUNT(*)::int FROM reviews_index WHERE author_did = a.did AND deleted_at IS NULL) as "reviewCount",
        (SELECT COUNT(*)::int FROM endorsements_index WHERE author_did = a.did AND deleted_at IS NULL) as "endorsementCount",
        a.indexed_at as "createdAt"
      FROM authors_index a
      WHERE a.handle ILIKE $1 OR a.did ILIKE $1
      ORDER BY a.handle ASC
      LIMIT $2`,
      [searchTerm, limit]
    );

    // Enrich with roles from Redis
    const users: UserDetail[] = [];
    for (const row of result.rows) {
      const roleKey = `chive:authz:roles:${row.did}`;
      const roles = await this.redis.smembers(roleKey);

      users.push({
        did: row.did,
        handle: row.handle,
        displayName: row.displayName,
        eprintCount: row.eprintCount,
        reviewCount: row.reviewCount,
        endorsementCount: row.endorsementCount,
        roles,
        createdAt: toISOStringOrNull(row.createdAt),
      });
    }

    return users;
  }

  /**
   * Gets detailed information about a specific user.
   *
   * @param did - user's DID
   * @returns user detail, or null if not found
   */
  async getUserDetail(did: string): Promise<UserDetail | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT
        a.did,
        a.handle,
        a.display_name as "displayName",
        (SELECT COUNT(*)::int FROM eprints_index WHERE submitted_by = a.did AND deleted_at IS NULL) as "eprintCount",
        (SELECT COUNT(*)::int FROM reviews_index WHERE author_did = a.did AND deleted_at IS NULL) as "reviewCount",
        (SELECT COUNT(*)::int FROM endorsements_index WHERE author_did = a.did AND deleted_at IS NULL) as "endorsementCount",
        a.indexed_at as "createdAt"
      FROM authors_index a
      WHERE a.did = $1`,
      [did]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    if (!row) return null;

    const roleKey = `chive:authz:roles:${did}`;
    const roles = await this.redis.smembers(roleKey);

    return {
      did: row.did,
      handle: row.handle,
      displayName: row.displayName,
      eprintCount: row.eprintCount,
      reviewCount: row.reviewCount,
      endorsementCount: row.endorsementCount,
      roles,
      createdAt: toISOStringOrNull(row.createdAt),
    };
  }

  /**
   * Lists eprints from the eprints_index table with optional search and pagination.
   *
   * @param q - optional search term matched against title or abstract
   * @param limit - maximum number of results
   * @param offset - number of rows to skip
   * @returns paginated list of eprints
   */
  async listEprints(
    q: string | undefined,
    limit: number,
    offset: number
  ): Promise<{ eprints: readonly Record<string, unknown>[]; total: number }> {
    const conditions = ['deleted_at IS NULL'];
    const params: (string | number)[] = [];

    if (q?.trim()) {
      params.push(`%${q.trim()}%`);
      conditions.push(
        `(title ILIKE $${params.length} OR abstract_plain_text ILIKE $${params.length})`
      );
    }

    const where = conditions.join(' AND ');
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT uri, cid, title, submitted_by, publication_status,
                keywords, fields, created_at, indexed_at
         FROM eprints_index
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      this.pool.query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM eprints_index WHERE ${where}`,
        params.slice(0, params.length - 2)
      ),
    ]);

    const eprints = dataResult.rows.map((row: Record<string, unknown>) => ({
      uri: row.uri,
      title: row.title,
      authorDid: row.submitted_by,
      status: row.publication_status ?? 'eprint',
      fieldUris: Array.isArray(row.fields)
        ? (row.fields as { uri?: string }[]).map((f) => f.uri).filter(Boolean)
        : undefined,
      createdAt: toISOString(row.created_at as Date | string),
      indexedAt: toISOString(row.indexed_at as Date | string),
    }));

    return { eprints, total: countResult.rows[0]?.count ?? 0 };
  }

  /**
   * Lists reviews from the reviews_index table with pagination.
   *
   * @param limit - maximum number of results
   * @param offset - number of rows to skip
   * @returns paginated list of reviews
   */
  async listReviews(limit: number, offset: number): Promise<{ items: ReviewRow[]; total: number }> {
    const [dataResult, countResult] = await Promise.all([
      this.pool.query<{
        uri: string;
        cid: string;
        eprint_uri: string;
        reviewer_did: string;
        motivation: string;
        reply_count: number;
        endorsement_count: number;
        eprint_title: string | null;
        created_at: Date | string;
        indexed_at: Date | string;
      }>(
        `SELECT r.uri, r.cid, r.eprint_uri, r.reviewer_did, r.motivation,
                r.reply_count, r.endorsement_count, r.created_at, r.indexed_at,
                e.title as eprint_title
         FROM reviews_index r
         LEFT JOIN eprints_index e ON e.uri = r.eprint_uri
         WHERE r.deleted_at IS NULL
         ORDER BY r.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      this.pool.query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM reviews_index WHERE deleted_at IS NULL`
      ),
    ]);

    const items: ReviewRow[] = dataResult.rows.map((row) => ({
      uri: row.uri,
      cid: row.cid,
      eprintUri: row.eprint_uri,
      reviewerDid: row.reviewer_did,
      motivation: row.motivation,
      replyCount: row.reply_count,
      endorsementCount: row.endorsement_count,
      eprintTitle: row.eprint_title ?? undefined,
      createdAt: toISOString(row.created_at),
      indexedAt: toISOString(row.indexed_at),
    }));

    return { items, total: countResult.rows[0]?.count ?? 0 };
  }

  /**
   * Lists endorsements from the endorsements_index table with pagination.
   *
   * @param limit - maximum number of results
   * @param offset - number of rows to skip
   * @returns paginated list of endorsements
   */
  async listEndorsements(
    limit: number,
    offset: number
  ): Promise<{ items: EndorsementRow[]; total: number }> {
    const [dataResult, countResult] = await Promise.all([
      this.pool.query<{
        uri: string;
        cid: string;
        eprint_uri: string;
        endorser_did: string;
        endorsement_type: string;
        comment: string | null;
        eprint_title: string | null;
        created_at: Date | string;
        indexed_at: Date | string;
      }>(
        `SELECT en.uri, en.cid, en.eprint_uri, en.endorser_did, en.endorsement_type,
                en.comment, en.created_at, en.indexed_at,
                e.title as eprint_title
         FROM endorsements_index en
         LEFT JOIN eprints_index e ON e.uri = en.eprint_uri
         WHERE en.deleted_at IS NULL
         ORDER BY en.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      this.pool.query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM endorsements_index WHERE deleted_at IS NULL`
      ),
    ]);

    const items: EndorsementRow[] = dataResult.rows.map((row) => ({
      uri: row.uri,
      cid: row.cid,
      eprintUri: row.eprint_uri,
      endorserDid: row.endorser_did,
      endorsementType: row.endorsement_type,
      comment: row.comment,
      eprintTitle: row.eprint_title ?? undefined,
      createdAt: toISOString(row.created_at),
      indexedAt: toISOString(row.indexed_at),
    }));

    return { items, total: countResult.rows[0]?.count ?? 0 };
  }

  /**
   * Returns view/download time-series data from eprint_metrics.
   *
   * @param uri - optional eprint URI to filter by
   * @param granularity - 'hour' or 'day' (defaults to 'day')
   * @returns time-series buckets with view and download counts
   */
  async getViewDownloadTimeSeries(
    uri?: string,
    granularity?: string
  ): Promise<{ buckets: TimeSeriesBucket[]; timestamp: string }> {
    const now = new Date();

    if (uri && granularity === 'hour') {
      // Query Redis sorted set for hourly granularity over the last 24 hours
      const redisKey = `chive:metrics:views:24h:${uri}`;
      try {
        const entries = await this.redis.zrangebyscore(
          redisKey,
          now.getTime() - 24 * 60 * 60 * 1000,
          now.getTime()
        );

        // Bucket entries by hour
        const hourBuckets = new Map<string, number>();
        for (let i = 0; i < 24; i++) {
          const bucketTime = new Date(now.getTime() - i * 60 * 60 * 1000);
          bucketTime.setMinutes(0, 0, 0);
          hourBuckets.set(bucketTime.toISOString(), 0);
        }

        for (const entry of entries) {
          const parts = entry.split(':');
          const ts = parseInt(parts[0] ?? '0', 10);
          if (ts > 0) {
            const bucketTime = new Date(ts);
            bucketTime.setMinutes(0, 0, 0);
            const key = bucketTime.toISOString();
            hourBuckets.set(key, (hourBuckets.get(key) ?? 0) + 1);
          }
        }

        const buckets: TimeSeriesBucket[] = Array.from(hourBuckets.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([timestamp, views]) => ({ timestamp, views, downloads: 0 }));

        return { buckets, timestamp: now.toISOString() };
      } catch {
        this.logger.warn('Failed to read Redis time-series data; falling back to PostgreSQL', {
          uri,
        });
      }
    }

    // Default: query eprint_metrics for aggregate data
    try {
      if (uri) {
        const result = await this.pool.query<{
          uri: string;
          total_views: string;
          total_downloads: string;
          last_flushed_at: Date | string;
        }>(
          `SELECT uri, total_views, total_downloads, last_flushed_at FROM eprint_metrics WHERE uri = $1`,
          [uri]
        );

        const row = result.rows[0];
        if (!row) {
          return { buckets: [], timestamp: now.toISOString() };
        }

        return {
          buckets: [
            {
              timestamp: toISOString(row.last_flushed_at),
              views: parseInt(String(row.total_views), 10),
              downloads: parseInt(String(row.total_downloads), 10),
            },
          ],
          timestamp: now.toISOString(),
        };
      }

      const result = await this.pool.query<{
        uri: string;
        total_views: string;
        total_downloads: string;
        last_flushed_at: Date | string;
      }>(
        `SELECT uri, total_views, total_downloads, last_flushed_at
         FROM eprint_metrics
         ORDER BY total_views DESC
         LIMIT 100`
      );

      const buckets: TimeSeriesBucket[] = result.rows.map((row) => ({
        timestamp: toISOString(row.last_flushed_at),
        views: parseInt(String(row.total_views), 10),
        downloads: parseInt(String(row.total_downloads), 10),
      }));

      return { buckets, timestamp: now.toISOString() };
    } catch {
      this.logger.warn('eprint_metrics table not available; returning empty buckets');
      return { buckets: [], timestamp: now.toISOString() };
    }
  }

  /**
   * Lists imported eprints with optional PDS source filter.
   *
   * @param limit - maximum number of results
   * @param offset - number of rows to skip
   * @param source - optional PDS URL to filter by
   * @returns paginated list of imported eprints
   */
  async listImports(
    limit: number,
    offset: number,
    source?: string
  ): Promise<{ items: ImportRow[]; total: number }> {
    const [dataResult, countResult] = await Promise.all([
      this.pool.query<{
        uri: string;
        title: string;
        submitted_by: string;
        pds_url: string;
        created_at: Date | string;
        indexed_at: Date | string;
      }>(
        `SELECT uri, title, submitted_by, pds_url, created_at, indexed_at
         FROM eprints_index
         WHERE deleted_at IS NULL AND ($1::text IS NULL OR pds_url = $1)
         ORDER BY indexed_at DESC
         LIMIT $2 OFFSET $3`,
        [source ?? null, limit, offset]
      ),
      this.pool.query<{ count: number }>(
        `SELECT COUNT(*)::int as count
         FROM eprints_index
         WHERE deleted_at IS NULL AND ($1::text IS NULL OR pds_url = $1)`,
        [source ?? null]
      ),
    ]);

    const items: ImportRow[] = dataResult.rows.map((row) => ({
      uri: row.uri,
      title: row.title,
      submittedBy: row.submitted_by,
      pdsUrl: row.pds_url,
      createdAt: toISOString(row.created_at),
      indexedAt: toISOString(row.indexed_at),
    }));

    return { items, total: countResult.rows[0]?.count ?? 0 };
  }

  /**
   * Deletes content from an index table by URI.
   *
   * @param uri - AT URI of the record to delete
   * @param table - target table name (must be in the allowlist)
   * @returns whether the deletion succeeded
   */
  async deleteContent(uri: string, table: string): Promise<{ deleted: boolean }> {
    const allowedTables = new Set([
      'eprints_index',
      'reviews_index',
      'endorsements_index',
      'user_tags_index',
    ]);

    if (!allowedTables.has(table)) {
      this.logger.error('Attempted deletion from disallowed table', undefined, { table, uri });
      return { deleted: false };
    }

    // Use soft-delete (set deleted_at) since these tables support it
    const result = await this.pool.query(
      `UPDATE ${table} SET deleted_at = NOW(), deletion_source = 'admin' WHERE uri = $1 AND deleted_at IS NULL`,
      [uri]
    );

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      this.logger.info('Content deleted from index', { uri, table });
    } else {
      this.logger.warn('No content found to delete', { uri, table });
    }

    return { deleted };
  }

  /**
   * Returns aggregate search analytics from relevance logging tables.
   *
   * @returns search analytics including queries, clicks, CTR, and relevance grades
   */
  async getSearchAnalytics(): Promise<SearchAnalytics> {
    const now = new Date().toISOString();

    // Run all queries in parallel with graceful fallbacks
    const [
      totalQueriesResult,
      totalClicksResult,
      ctrResult,
      avgDwellResult,
      positionResult,
      topQueriesResult,
      zeroResultResult,
      relevanceResult,
    ] = await Promise.all([
      this.pool
        .query<{
          total_queries: number;
        }>('SELECT COUNT(*)::int as total_queries FROM search_impressions')
        .catch(() => ({ rows: [{ total_queries: 0 }] })),
      this.pool
        .query<{ total_clicks: number }>('SELECT COUNT(*)::int as total_clicks FROM result_clicks')
        .catch(() => ({ rows: [{ total_clicks: 0 }] })),
      this.pool
        .query<{ impressions: number; clicks: number }>(
          `SELECT
            COUNT(DISTINCT si.id)::int as impressions,
            COUNT(DISTINCT rc.id)::int as clicks
           FROM search_impressions si
           LEFT JOIN result_clicks rc ON rc.impression_id = si.id`
        )
        .catch(() => ({ rows: [{ impressions: 0, clicks: 0 }] })),
      this.pool
        .query<{
          avg_dwell_time: number | null;
        }>(
          `SELECT AVG(dwell_time_ms)::int as avg_dwell_time FROM result_clicks WHERE dwell_time_ms IS NOT NULL`
        )
        .catch(() => ({ rows: [{ avg_dwell_time: null }] })),
      this.pool
        .query<{
          position: number;
          count: number;
        }>(
          `SELECT position::int, COUNT(*)::int as count FROM result_clicks GROUP BY position ORDER BY position`
        )
        .catch(() => ({ rows: [] as { position: number; count: number }[] })),
      this.pool
        .query<{ query: string; impression_count: number; click_count: number }>(
          `SELECT si.query, COUNT(si.id)::int as impression_count, COUNT(rc.id)::int as click_count
           FROM search_impressions si
           LEFT JOIN result_clicks rc ON rc.impression_id = si.id
           GROUP BY si.query
           ORDER BY impression_count DESC
           LIMIT 20`
        )
        .catch(() => ({
          rows: [] as { query: string; impression_count: number; click_count: number }[],
        })),
      this.pool
        .query<{
          zero_result_count: number;
        }>(
          `SELECT COUNT(*)::int as zero_result_count FROM search_impressions WHERE result_count = 0`
        )
        .catch(() => ({ rows: [{ zero_result_count: 0 }] })),
      this.pool
        .query<{
          relevance_grade: number;
          count: number;
        }>(
          `SELECT relevance_grade::int, COUNT(*)::int as count FROM v_judgment_list GROUP BY relevance_grade ORDER BY relevance_grade`
        )
        .catch(() => ({ rows: [] as { relevance_grade: number; count: number }[] })),
    ]);

    const impressions = ctrResult.rows[0]?.impressions ?? 0;
    const clicks = ctrResult.rows[0]?.clicks ?? 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;

    return {
      totalQueries: totalQueriesResult.rows[0]?.total_queries ?? 0,
      totalClicks: totalClicksResult.rows[0]?.total_clicks ?? 0,
      impressions,
      clicks,
      ctr,
      avgDwellTimeMs: avgDwellResult.rows[0]?.avg_dwell_time ?? null,
      positionDistribution: positionResult.rows.map((r) => ({
        position: r.position,
        count: r.count,
      })),
      topQueries: topQueriesResult.rows.map((r) => ({
        query: r.query,
        impressionCount: r.impression_count,
        clickCount: r.click_count,
      })),
      zeroResultCount: zeroResultResult.rows[0]?.zero_result_count ?? 0,
      relevanceGradeDistribution: relevanceResult.rows.map((r) => ({
        relevanceGrade: r.relevance_grade,
        count: r.count,
      })),
      timestamp: now,
    };
  }

  /**
   * Returns audit log entries from the governance_audit_log table.
   *
   * @param limit - maximum number of entries
   * @param offset - number of rows to skip
   * @param actorDid - optional filter by editor DID
   * @returns paginated audit log entries with total count
   */
  async getAuditLog(
    limit: number,
    offset: number,
    actorDid?: string
  ): Promise<{ entries: AuditLogRow[]; total: number }> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (actorDid) {
        conditions.push(`g.editor_did = $${paramIdx++}`);
        params.push(actorDid);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const dataParams = [...params, limit, offset];

      const [dataResult, countResult] = await Promise.all([
        this.pool.query<{
          id: string;
          action: string;
          collection: string;
          uri: string;
          editor_did: string;
          actor_handle: string | null;
          target_did: string | null;
          ip_address: string | null;
          record_snapshot: unknown;
          created_at: Date | string;
        }>(
          `SELECT g.id, g.action, g.collection, g.uri, g.editor_did,
                  a.handle AS actor_handle,
                  g.target_did,
                  g.ip_address,
                  g.record_snapshot, g.created_at
           FROM governance_audit_log g
           LEFT JOIN authors_index a ON a.did = g.editor_did
           ${whereClause}
           ORDER BY g.created_at DESC
           LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
          dataParams
        ),
        this.pool.query<{ count: number }>(
          `SELECT COUNT(*)::int as count FROM governance_audit_log ${whereClause}`,
          params
        ),
      ]);

      const entries: AuditLogRow[] = dataResult.rows.map((row) => ({
        id: row.id,
        action: row.action,
        collection: row.collection,
        targetUri: row.uri,
        actorDid: row.editor_did,
        actorHandle: row.actor_handle ?? undefined,
        targetDid: row.target_did ?? undefined,
        ipAddress: row.ip_address ?? undefined,
        details: row.record_snapshot as Record<string, unknown>,
        timestamp: toISOString(row.created_at),
      }));

      return { entries, total: countResult.rows[0]?.count ?? 0 };
    } catch {
      this.logger.warn('governance_audit_log table not available; returning empty result');
      return { entries: [], total: 0 };
    }
  }

  /**
   * Returns user warnings from the user_warnings table.
   *
   * @param limit - maximum number of entries
   * @param did - optional filter by user DID
   * @returns list of warnings
   */
  async listWarnings(limit: number, did?: string): Promise<{ warnings: WarningRow[] }> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (did) {
        conditions.push(`w.user_did = $${paramIdx++}`);
        params.push(did);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      params.push(limit);

      const result = await this.pool.query<{
        id: string;
        user_did: string;
        target_handle: string | null;
        reason: string;
        issued_by: string;
        issued_at: Date | string;
        expires_at: Date | string | null;
        active: boolean;
        resolved_at: Date | string | null;
        resolved_by: string | null;
      }>(
        `SELECT w.id, w.user_did, a.handle AS target_handle,
                w.reason, w.issued_by, w.issued_at, w.expires_at,
                w.active, w.resolved_at, w.resolved_by
         FROM user_warnings w
         LEFT JOIN authors_index a ON a.did = w.user_did
         ${whereClause}
         ORDER BY w.issued_at DESC
         LIMIT $${paramIdx}`,
        params
      );

      const warnings: WarningRow[] = result.rows.map((row) => ({
        id: row.id,
        targetDid: row.user_did,
        targetHandle: row.target_handle ?? undefined,
        reason: row.reason,
        issuedBy: row.issued_by,
        issuedAt: toISOString(row.issued_at),
        acknowledged: !row.active,
        acknowledgedAt: toISOStringOrNull(row.resolved_at),
      }));

      return { warnings };
    } catch {
      this.logger.warn('user_warnings table not available; returning empty result');
      return { warnings: [] };
    }
  }

  /**
   * Returns user violations from the user_violations table.
   *
   * @param limit - maximum number of entries
   * @param did - optional filter by user DID
   * @returns list of violations
   */
  async listViolations(limit: number, did?: string): Promise<{ violations: ViolationRow[] }> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (did) {
        conditions.push(`v.user_did = $${paramIdx++}`);
        params.push(did);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      params.push(limit);

      const result = await this.pool.query<{
        id: string;
        user_did: string;
        target_handle: string | null;
        violation_type: string;
        severity: string | null;
        description: string;
        issued_by: string;
        issued_at: Date | string;
        related_uri: string | null;
        resolved_at: Date | string | null;
        resolution: string | null;
      }>(
        `SELECT v.id, v.user_did, a.handle AS target_handle,
                v.violation_type,
                COALESCE(v.severity, 'medium') AS severity,
                v.description, v.issued_by, v.issued_at, v.related_uri,
                v.resolved_at, v.resolution
         FROM user_violations v
         LEFT JOIN authors_index a ON a.did = v.user_did
         ${whereClause}
         ORDER BY v.issued_at DESC
         LIMIT $${paramIdx}`,
        params
      );

      const violations: ViolationRow[] = result.rows.map((row) => ({
        id: row.id,
        targetDid: row.user_did,
        targetHandle: row.target_handle ?? undefined,
        type: row.violation_type,
        severity: row.severity ?? 'medium',
        description: row.description,
        targetUri: row.related_uri ?? undefined,
        detectedAt: toISOString(row.issued_at),
        resolvedAt: row.resolved_at ? toISOString(row.resolved_at) : undefined,
        resolution: row.resolution ?? undefined,
      }));

      return { violations };
    } catch {
      this.logger.warn('user_violations table not available; returning empty result');
      return { violations: [] };
    }
  }

  /**
   * Returns all PDS registry entries for the admin dashboard.
   *
   * @returns list of PDS entries with status, record count, and user count
   */
  async listPDSEntries(): Promise<PDSEntryRow[]> {
    try {
      const result = await this.pool.query<{
        pds_url: string;
        status: string;
        last_scan_at: Date | string | null;
        chive_record_count: number;
        user_count: number;
      }>(
        `SELECT
           pds_url,
           status,
           last_scan_at,
           chive_record_count,
           COALESCE(
             (SELECT COUNT(DISTINCT submitted_by)::int FROM eprints_index WHERE pds_url = pr.pds_url AND deleted_at IS NULL),
             0
           ) as user_count
         FROM pds_registry pr
         ORDER BY chive_record_count DESC`
      );

      return result.rows.map((row) => ({
        url: row.pds_url,
        status: row.status as 'active' | 'stale' | 'unreachable',
        lastScanAt: row.last_scan_at ? toISOString(row.last_scan_at) : undefined,
        recordCount: row.chive_record_count,
        userCount: row.user_count,
      }));
    } catch {
      this.logger.warn('pds_registry table not available; returning empty list');
      return [];
    }
  }

  /**
   * Returns the count of pending governance proposals.
   *
   * @returns number of proposals with status 'pending'
   */
  async getPendingProposalCount(): Promise<number> {
    try {
      const result = await this.pool.query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM field_proposals_index WHERE status = 'pending'`
      );
      return result.rows[0]?.count ?? 0;
    } catch {
      this.logger.warn('field_proposals_index table not available; returning 0');
      return 0;
    }
  }

  /**
   * Checks a single database connection health.
   *
   * @param name - database name
   * @param check - health check function
   * @returns health status
   */
  private async checkDatabase(name: string, check: () => Promise<void>): Promise<DatabaseHealth> {
    const start = Date.now();
    try {
      await check();
      return {
        name,
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name,
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
