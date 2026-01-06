/**
 * Backlink service for tracking ATProto ecosystem references.
 *
 * @remarks
 * This module implements the backlink service that tracks references to
 * Chive preprints from across the ATProto ecosystem (Semble, Leaflet,
 * WhiteWind, Bluesky).
 *
 * ATProto Compliance:
 * - All backlinks indexed from firehose (rebuildable via replay)
 * - Tracks deletions to honor record removal
 * - Never writes to user PDSes
 * - Source URI tracked for staleness detection
 *
 * Backlink Sources:
 * - Semble collections (xyz.semble.collection)
 * - Leaflet reading lists (xyz.leaflet.list)
 * - WhiteWind blog posts (com.whitewind.blog.entry)
 * - Bluesky posts/embeds (app.bsky.feed.post)
 * - Chive comments (pub.chive.review.comment)
 * - Chive endorsements (pub.chive.review.endorsement)
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { DatabaseError, ValidationError } from '../../types/errors.js';
import type { IDatabasePool } from '../../types/interfaces/database.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  Backlink,
  BacklinkCounts,
  BacklinkSourceType,
  IBacklinkService,
} from '../../types/interfaces/plugin.interface.js';

/**
 * Database row type for backlinks.
 *
 * @internal
 */
interface BacklinkRow {
  id: number;
  source_uri: string;
  source_type: string;
  source_did: string;
  target_uri: string;
  context: string | null;
  indexed_at: Date;
  is_deleted: boolean;
  deleted_at: Date | null;
}

/**
 * Database row for backlink counts.
 *
 * @remarks
 * Matches the backlink_counts table schema after migration
 * 1734700000000_separate-bluesky-counts.ts
 *
 * @internal
 */
interface BacklinkCountsRow {
  target_uri: string;
  semble_count: number;
  leaflet_count: number;
  whitewind_count: number;
  bluesky_post_count: number;
  bluesky_embed_count: number;
  comment_count: number;
  endorsement_count: number;
  other_count: number;
  total_count: number;
  last_updated_at: Date;
}

/**
 * Backlink service implementation.
 *
 * @remarks
 * Manages PostgreSQL tables `backlinks` and `backlink_counts` which track
 * references to Chive preprints from the ATProto ecosystem.
 *
 * All data is rebuildable from firehose replay, making this ATProto-compliant.
 *
 * @example
 * ```typescript
 * const backlinkService = container.resolve<IBacklinkService>('IBacklinkService');
 *
 * // Create a backlink from a Bluesky post mentioning a preprint
 * const backlink = await backlinkService.createBacklink({
 *   sourceUri: 'at://did:plc:aswhite123abc/app.bsky.feed.post/3jt7k9xyzab',
 *   sourceType: 'bluesky.post',
 *   targetUri: 'at://did:plc:aswhite123abc/pub.chive.preprint.submission/3jt7k9xyzab',
 *   context: 'Check out this preprint on clause-embedding verbs!',
 * });
 *
 * // Get backlink counts for a preprint
 * const counts = await backlinkService.getCounts(
 *   'at://did:plc:aswhite123abc/pub.chive.preprint.submission/3jt7k9xyzab'
 * );
 * console.log(`Total backlinks: ${counts.total}`);
 * ```
 *
 * @public
 * @since 0.1.0
 */
export class BacklinkService implements IBacklinkService {
  private readonly logger: ILogger;
  private readonly db: IDatabasePool;

  constructor(logger: ILogger, db: IDatabasePool) {
    this.logger = logger;
    this.db = db;
  }

  /**
   * Creates a backlink.
   *
   * @param data - Backlink data
   * @returns Created backlink
   * @throws {ValidationError} If sourceUri is not a valid AT-URI format
   * @throws {DatabaseError} If database insert fails
   */
  async createBacklink(data: {
    sourceUri: string;
    sourceType: BacklinkSourceType;
    targetUri: string;
    context?: string;
  }): Promise<Backlink> {
    // Extract DID from source URI (at://did:plc:xxx/collection/rkey)
    const sourceDid = this.extractDidFromUri(data.sourceUri);

    const result = await this.db.query<BacklinkRow>(
      `INSERT INTO backlinks (
        source_uri, source_type, source_did, target_uri, context,
        indexed_at, is_deleted
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), false
      )
      ON CONFLICT (source_uri) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        target_uri = EXCLUDED.target_uri,
        context = EXCLUDED.context,
        indexed_at = NOW(),
        is_deleted = false,
        deleted_at = NULL
      RETURNING *`,
      [data.sourceUri, data.sourceType, sourceDid, data.targetUri, data.context ?? null]
    );

    const row = result.rows[0];
    if (!row) {
      throw new DatabaseError('CREATE', 'Failed to create backlink: no row returned from database');
    }

    const backlink = this.rowToBacklink(row);

    // Update counts asynchronously
    void this.updateCounts(data.targetUri);

    this.logger.debug('Backlink created', {
      sourceUri: data.sourceUri,
      sourceType: data.sourceType,
      targetUri: data.targetUri,
    });

    return backlink;
  }

  /**
   * Deletes a backlink (marks as deleted).
   *
   * @param sourceUri - AT-URI of the source record
   *
   * @remarks
   * Soft deletes the backlink by setting is_deleted = true.
   * This honors ATProto deletion semantics.
   */
  async deleteBacklink(sourceUri: string): Promise<void> {
    const result = await this.db.query<{ target_uri: string }>(
      `UPDATE backlinks
       SET is_deleted = true, deleted_at = NOW()
       WHERE source_uri = $1 AND is_deleted = false
       RETURNING target_uri`,
      [sourceUri]
    );

    if (result.rows.length > 0) {
      // Update counts for affected targets
      for (const row of result.rows) {
        void this.updateCounts(row.target_uri);
      }

      this.logger.debug('Backlink deleted', { sourceUri });
    }
  }

  /**
   * Gets backlinks for a target preprint.
   *
   * @param targetUri - AT-URI of the target preprint
   * @param options - Query options
   * @returns Backlinks and pagination cursor
   */
  async getBacklinks(
    targetUri: string,
    options?: {
      sourceType?: BacklinkSourceType;
      limit?: number;
      cursor?: string;
    }
  ): Promise<{ backlinks: Backlink[]; cursor?: string }> {
    const conditions: string[] = ['target_uri = $1', 'is_deleted = false'];
    const values: unknown[] = [targetUri];
    let paramIndex = 2;

    if (options?.sourceType) {
      conditions.push(`source_type = $${paramIndex++}`);
      values.push(options.sourceType);
    }

    if (options?.cursor) {
      const cursorId = parseInt(options.cursor, 10);
      conditions.push(`id > $${paramIndex++}`);
      values.push(cursorId);
    }

    const limit = Math.min(options?.limit ?? 50, 100);
    values.push(limit + 1);

    const result = await this.db.query<BacklinkRow>(
      `SELECT * FROM backlinks
       WHERE ${conditions.join(' AND ')}
       ORDER BY id ASC
       LIMIT $${paramIndex}`,
      values
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const backlinks = rows.map((row) => this.rowToBacklink(row));

    const lastRow = rows[rows.length - 1];
    return {
      backlinks,
      cursor: hasMore && lastRow ? lastRow.id.toString() : undefined,
    };
  }

  /**
   * Gets aggregated backlink counts for a target.
   *
   * @param targetUri - AT-URI of the target preprint
   * @returns Backlink counts by type
   *
   * @remarks
   * Queries from the backlink_counts cache table for performance.
   * Returns separate counts for bluesky.post and bluesky.embed as required by frontend.
   */
  async getCounts(targetUri: string): Promise<BacklinkCounts> {
    const result = await this.db.query<BacklinkCountsRow>(
      `SELECT * FROM backlink_counts WHERE target_uri = $1`,
      [targetUri]
    );

    const row = result.rows[0];
    if (!row) {
      // Return zeros if no counts exist
      return {
        sembleCollections: 0,
        leafletLists: 0,
        whitewindBlogs: 0,
        blueskyPosts: 0,
        blueskyEmbeds: 0,
        other: 0,
        total: 0,
        updatedAt: new Date(),
      };
    }

    return {
      sembleCollections: row.semble_count,
      leafletLists: row.leaflet_count,
      whitewindBlogs: row.whitewind_count,
      blueskyPosts: row.bluesky_post_count,
      blueskyEmbeds: row.bluesky_embed_count,
      other: row.other_count,
      total: row.total_count,
      updatedAt: row.last_updated_at,
    };
  }

  /**
   * Updates backlink counts for a target.
   *
   * @param targetUri - AT-URI of the target preprint
   */
  async updateCounts(targetUri: string): Promise<void> {
    await this.db.query(`SELECT refresh_backlink_counts($1)`, [targetUri]);

    this.logger.debug('Backlink counts refreshed', { targetUri });
  }

  /**
   * Checks if a backlink exists.
   *
   * @param sourceUri - AT-URI of the source record
   * @returns True if backlink exists and is not deleted
   */
  async exists(sourceUri: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM backlinks
        WHERE source_uri = $1 AND is_deleted = false
      ) as exists`,
      [sourceUri]
    );
    return result.rows[0]?.exists ?? false;
  }

  /**
   * Gets a backlink by source URI.
   *
   * @param sourceUri - AT-URI of the source record
   * @returns Backlink or null if not found
   */
  async getBySourceUri(sourceUri: string): Promise<Backlink | null> {
    const result = await this.db.query<BacklinkRow>(
      `SELECT * FROM backlinks WHERE source_uri = $1 AND is_deleted = false`,
      [sourceUri]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToBacklink(row);
  }

  /**
   * Batch creates backlinks (for firehose catch-up).
   *
   * @param backlinks - Array of backlink data
   * @returns Number of backlinks created
   * @throws {ValidationError} If any sourceUri is not a valid AT-URI format
   * @throws {DatabaseError} If database insert fails
   */
  async batchCreateBacklinks(
    backlinks: {
      sourceUri: string;
      sourceType: BacklinkSourceType;
      targetUri: string;
      context?: string;
    }[]
  ): Promise<number> {
    if (backlinks.length === 0) {
      return 0;
    }

    // Build batch insert query
    const values: unknown[] = [];
    const valuePlaceholders: string[] = [];
    let paramIndex = 1;

    for (const bl of backlinks) {
      const sourceDid = this.extractDidFromUri(bl.sourceUri);
      valuePlaceholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW(), false)`
      );
      values.push(bl.sourceUri, bl.sourceType, sourceDid, bl.targetUri, bl.context ?? null);
    }

    const result = await this.db.query<{ target_uri: string }>(
      `INSERT INTO backlinks (
        source_uri, source_type, source_did, target_uri, context,
        indexed_at, is_deleted
      ) VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (source_uri) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        target_uri = EXCLUDED.target_uri,
        context = EXCLUDED.context,
        indexed_at = NOW(),
        is_deleted = false,
        deleted_at = NULL
      RETURNING target_uri`,
      values
    );

    // Refresh counts for affected targets
    const affectedTargets = new Set(result.rows.map((r) => r.target_uri));
    for (const targetUri of affectedTargets) {
      void this.updateCounts(targetUri);
    }

    this.logger.info('Batch backlinks created', {
      count: result.rows.length,
      targetsAffected: affectedTargets.size,
    });

    return result.rows.length;
  }

  /**
   * Converts database row to Backlink.
   *
   * @internal
   */
  private rowToBacklink(row: BacklinkRow): Backlink {
    return {
      id: row.id,
      sourceUri: row.source_uri,
      sourceType: row.source_type as BacklinkSourceType,
      targetUri: row.target_uri,
      context: row.context ?? undefined,
      indexedAt: row.indexed_at,
      deleted: row.is_deleted,
    };
  }

  /**
   * Extracts DID from AT-URI.
   *
   * @param uri - AT-URI (at://did:plc:xxx/collection/rkey)
   * @returns DID
   * @throws {ValidationError} If URI format is invalid
   *
   * @internal
   */
  private extractDidFromUri(uri: string): string {
    // AT-URI format: at://did:plc:xxx/collection/rkey
    const regex = /^at:\/\/(did:[a-z]+:[a-zA-Z0-9]+)/;
    const result = regex.exec(uri);
    if (!result?.[1]) {
      throw new ValidationError(`Invalid AT-URI format: ${uri}`, 'sourceUri', 'format');
    }
    return result[1];
  }
}
