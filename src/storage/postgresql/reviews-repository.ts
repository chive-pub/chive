/**
 * Repository for review record operations.
 *
 * @remarks
 * Provides domain-specific queries and operations for review records
 * in the PostgreSQL index. Implements the repository pattern for clean
 * separation of data access logic.
 *
 * **Review Types:**
 * - Comments: Line-by-line or general feedback
 * - Endorsements: Methods/results/overall quality endorsements
 * - Threaded discussions: Nested comment threads
 *
 * **ATProto Compliance:**
 * - Stores indexes only, not source data
 * - Tracks PDS source for every review
 * - All data rebuildable from firehose
 *
 * @example
 * ```typescript
 * const repo = new ReviewsRepository(pool);
 *
 * // Find reviews for a preprint
 * const reviews = await repo.findByPreprint(
 *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!
 * );
 *
 * // Find reviews by reviewer
 * const myReviews = await repo.findByReviewer(
 *   toDID('did:plc:def')!
 * );
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { Pool } from 'pg';

import type { AtUri, CID, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';
import { Err, Ok, type Result } from '../../types/result.js';

/**
 * Content format for reviews.
 *
 * @public
 */
export type ReviewContentFormat = 'plain' | 'markdown';

/**
 * Annotation motivation for reviews (W3C Web Annotation).
 *
 * @public
 */
export type ReviewMotivation =
  | 'commenting'
  | 'highlighting'
  | 'questioning'
  | 'replying'
  | 'assessing'
  | 'bookmarking'
  | 'classifying'
  | 'describing'
  | 'editing'
  | 'linking'
  | 'moderating'
  | 'tagging';

/**
 * Review anchor for inline annotations.
 *
 * @remarks
 * Specifies a target location within a preprint for inline reviews/comments.
 *
 * @public
 */
export interface ReviewAnchor {
  /**
   * AT URI of the target document (preprint).
   */
  readonly source: AtUri;

  /**
   * Text position selector.
   */
  readonly selector?: {
    /**
     * Selector type.
     */
    readonly type: 'TextPositionSelector';

    /**
     * Start offset in characters.
     */
    readonly start: number;

    /**
     * End offset in characters.
     */
    readonly end: number;
  };

  /**
   * Page number (for PDF targeting).
   */
  readonly page?: number;
}

/**
 * Stored review metadata.
 *
 * @remarks
 * Full review storage structure supporting threaded discussions,
 * inline annotations, and rich text formatting.
 *
 * @public
 */
export interface StoredReview {
  /**
   * AT URI of the review record.
   */
  readonly uri: AtUri;

  /**
   * CID of the review record.
   */
  readonly cid: CID;

  /**
   * Record key.
   */
  readonly rkey: string;

  /**
   * Preprint being reviewed.
   */
  readonly preprintUri: AtUri;

  /**
   * CID of the preprint at time of review.
   */
  readonly preprintCid: CID;

  /**
   * Reviewer DID.
   */
  readonly reviewerDid: DID;

  /**
   * Review content (plain text).
   */
  readonly content: string;

  /**
   * Content format.
   *
   * @defaultValue 'plain'
   */
  readonly contentFormat: ReviewContentFormat;

  /**
   * Annotation motivation.
   *
   * @defaultValue 'commenting'
   */
  readonly motivation: ReviewMotivation;

  /**
   * Parent review URI for threaded replies.
   */
  readonly parentUri: AtUri | null;

  /**
   * Root review URI for thread tracking.
   */
  readonly rootUri: AtUri | null;

  /**
   * Depth in reply tree (0 = top-level).
   */
  readonly replyDepth: number;

  /**
   * Anchor for inline annotations.
   */
  readonly anchor: ReviewAnchor | null;

  /**
   * Number of replies to this review.
   */
  readonly replyCount: number;

  /**
   * Number of endorsements for this review.
   */
  readonly endorsementCount: number;

  /**
   * PDS URL where review is stored.
   */
  readonly pdsUrl: string;

  /**
   * When review was created.
   */
  readonly createdAt: Date;

  /**
   * When review was indexed.
   */
  readonly indexedAt: Date;
}

/**
 * Database row type for reviews.
 *
 * @internal
 */
interface ReviewRow {
  uri: string;
  cid: string;
  rkey: string;
  preprint_uri: string;
  preprint_cid: string;
  reviewer_did: string;
  content: string;
  content_format: string;
  motivation: string;
  parent_uri: string | null;
  root_uri: string | null;
  reply_depth: number;
  anchor: string | null; // JSON string
  reply_count: number;
  endorsement_count: number;
  pds_url: string;
  created_at: Date;
  indexed_at: Date;
}

/**
 * Repository for review record operations.
 *
 * @remarks
 * Implements the repository pattern for review data access.
 * All database operations for reviews go through this repository.
 *
 * **Operations Provided:**
 * - Find reviews by preprint
 * - Find reviews by reviewer
 * - Count reviews for a preprint
 * - Store and update reviews
 *
 * @public
 * @since 0.1.0
 */
export class ReviewsRepository {
  private readonly pool: Pool;

  /**
   * Creates a reviews repository.
   *
   * @param pool - PostgreSQL connection pool
   *
   * @remarks
   * The pool should be created with createPool() for correct configuration.
   * The repository does not close the pool; caller is responsible for cleanup.
   */
  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Maps a database row to a StoredReview object.
   *
   * @param row - Database row
   * @returns StoredReview object
   */
  private mapRowToStoredReview(row: ReviewRow): StoredReview {
    return {
      uri: row.uri as AtUri,
      cid: row.cid as CID,
      rkey: row.rkey,
      preprintUri: row.preprint_uri as AtUri,
      preprintCid: row.preprint_cid as CID,
      reviewerDid: row.reviewer_did as DID,
      content: row.content,
      contentFormat: row.content_format as ReviewContentFormat,
      motivation: row.motivation as ReviewMotivation,
      parentUri: row.parent_uri as AtUri | null,
      rootUri: row.root_uri as AtUri | null,
      replyDepth: row.reply_depth,
      anchor: row.anchor ? (JSON.parse(row.anchor) as ReviewAnchor) : null,
      replyCount: row.reply_count,
      endorsementCount: row.endorsement_count,
      pdsUrl: row.pds_url,
      createdAt: new Date(row.created_at),
      indexedAt: new Date(row.indexed_at),
    };
  }

  /**
   * Finds reviews for a preprint.
   *
   * @param preprintUri - AT URI of the preprint
   * @param options - Query options (limit, offset)
   * @returns Array of reviews for this preprint
   *
   * @remarks
   * Returns reviews in chronological order (newest first).
   *
   * @example
   * ```typescript
   * const reviews = await repo.findByPreprint(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
   *   { limit: 20 }
   * );
   *
   * reviews.forEach(r => console.log(r.content));
   * ```
   *
   * @public
   */
  async findByPreprint(
    preprintUri: AtUri,
    options: { limit?: number; offset?: number } = {}
  ): Promise<StoredReview[]> {
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;

    try {
      const result = await this.pool.query<ReviewRow>(
        `SELECT uri, cid, rkey, preprint_uri, preprint_cid, reviewer_did, content,
                content_format, motivation, parent_uri, root_uri, reply_depth,
                anchor, reply_count, endorsement_count, pds_url, created_at, indexed_at
         FROM reviews_index
         WHERE preprint_uri = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [preprintUri, limit, offset]
      );

      return result.rows.map((row) => this.mapRowToStoredReview(row));
    } catch (error) {
      throw new DatabaseError(
        'READ',
        `Failed to find reviews for preprint: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds reviews by reviewer.
   *
   * @param reviewerDid - Reviewer DID
   * @param options - Query options (limit, offset)
   * @returns Array of reviews by this reviewer
   *
   * @remarks
   * Returns reviews in chronological order (newest first).
   *
   * @example
   * ```typescript
   * const myReviews = await repo.findByReviewer(
   *   toDID('did:plc:def')!,
   *   { limit: 20 }
   * );
   *
   * console.log(`You've written ${myReviews.length} reviews`);
   * ```
   *
   * @public
   */
  async findByReviewer(
    reviewerDid: DID,
    options: { limit?: number; offset?: number } = {}
  ): Promise<StoredReview[]> {
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;

    try {
      const result = await this.pool.query<ReviewRow>(
        `SELECT uri, cid, rkey, preprint_uri, preprint_cid, reviewer_did, content,
                content_format, motivation, parent_uri, root_uri, reply_depth,
                anchor, reply_count, endorsement_count, pds_url, created_at, indexed_at
         FROM reviews_index
         WHERE reviewer_did = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [reviewerDid, limit, offset]
      );

      return result.rows.map((row) => this.mapRowToStoredReview(row));
    } catch (error) {
      throw new DatabaseError(
        'READ',
        `Failed to find reviews by reviewer: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Counts reviews for a preprint.
   *
   * @param preprintUri - AT URI of the preprint
   * @returns Number of reviews for this preprint
   *
   * @example
   * ```typescript
   * const count = await repo.countByPreprint(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!
   * );
   *
   * console.log(`${count} reviews`);
   * ```
   *
   * @public
   */
  async countByPreprint(preprintUri: AtUri): Promise<number> {
    try {
      const result = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM reviews_index WHERE preprint_uri = $1',
        [preprintUri]
      );

      const row = result.rows[0];
      return row ? parseInt(row.count, 10) : 0;
    } catch (error) {
      throw new DatabaseError(
        'READ',
        `Failed to count reviews: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Stores or updates a review.
   *
   * @param review - Review to store
   * @returns Result indicating success or failure
   *
   * @remarks
   * Upserts the review (insert or update based on URI).
   *
   * @example
   * ```typescript
   * const result = await repo.store({
   *   uri: toAtUri('at://did:plc:def/pub.chive.review.comment/abc')!,
   *   preprintUri: toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
   *   reviewerDid: toDID('did:plc:def')!,
   *   content: 'Excellent methodology!',
   *   pdsUrl: 'https://pds.example.com',
   *   createdAt: new Date(),
   *   indexedAt: new Date()
   * });
   * ```
   *
   * @public
   */
  async store(review: StoredReview): Promise<Result<void, Error>> {
    try {
      await this.pool.query(
        `INSERT INTO reviews_index (
           uri, cid, rkey, preprint_uri, preprint_cid, reviewer_did, content,
           content_format, motivation, parent_uri, root_uri, reply_depth,
           anchor, reply_count, endorsement_count, pds_url, created_at, indexed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (uri) DO UPDATE SET
           cid = EXCLUDED.cid,
           content = EXCLUDED.content,
           content_format = EXCLUDED.content_format,
           reply_count = EXCLUDED.reply_count,
           endorsement_count = EXCLUDED.endorsement_count,
           indexed_at = EXCLUDED.indexed_at`,
        [
          review.uri,
          review.cid,
          review.rkey,
          review.preprintUri,
          review.preprintCid,
          review.reviewerDid,
          review.content,
          review.contentFormat,
          review.motivation,
          review.parentUri,
          review.rootUri,
          review.replyDepth,
          review.anchor ? JSON.stringify(review.anchor) : null,
          review.replyCount,
          review.endorsementCount,
          review.pdsUrl,
          review.createdAt,
          review.indexedAt,
        ]
      );

      return Ok(undefined);
    } catch (error) {
      return Err(
        new DatabaseError(
          'WRITE',
          `Failed to store review: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  /**
   * Deletes a review from the index.
   *
   * @param uri - Review URI
   * @returns Result indicating success or failure
   *
   * @remarks
   * Removes the review from the local index. Does not delete from PDS
   * (ATProto compliance - never write to user PDSes).
   *
   * @example
   * ```typescript
   * const result = await repo.delete(
   *   toAtUri('at://did:plc:def/pub.chive.review.comment/abc')!
   * );
   * ```
   *
   * @public
   */
  async delete(uri: AtUri): Promise<Result<void, Error>> {
    try {
      const result = await this.pool.query('DELETE FROM reviews_index WHERE uri = $1', [uri]);

      if (result.rowCount === 0) {
        return Err(new NotFoundError('Review', uri));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        new DatabaseError(
          'DELETE',
          `Failed to delete review: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  /**
   * Gets a review by URI.
   *
   * @param uri - Review URI
   * @returns Review if found, null otherwise
   *
   * @example
   * ```typescript
   * const review = await repo.getByUri(
   *   toAtUri('at://did:plc:def/pub.chive.review.comment/abc')!
   * );
   * if (review) {
   *   console.log(review.content);
   * }
   * ```
   *
   * @public
   */
  async getByUri(uri: AtUri): Promise<StoredReview | null> {
    try {
      const result = await this.pool.query<ReviewRow>(
        `SELECT uri, cid, rkey, preprint_uri, preprint_cid, reviewer_did, content,
                content_format, motivation, parent_uri, root_uri, reply_depth,
                anchor, reply_count, endorsement_count, pds_url, created_at, indexed_at
         FROM reviews_index
         WHERE uri = $1`,
        [uri]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return this.mapRowToStoredReview(row);
    } catch (error) {
      throw new DatabaseError(
        'READ',
        `Failed to get review: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets a review thread with all replies.
   *
   * @param rootUri - URI of the root review (thread starter)
   * @param maxDepth - Maximum depth of replies to retrieve (default: 10)
   * @returns Array of reviews in the thread, ordered by depth then date
   *
   * @remarks
   * Uses the `get_review_thread` PostgreSQL function for recursive retrieval.
   * Returns the root review plus all nested replies up to maxDepth.
   *
   * @example
   * ```typescript
   * const thread = await repo.getThread(
   *   toAtUri('at://did:plc:def/pub.chive.review.comment/abc')!,
   *   5
   * );
   *
   * console.log(`Thread has ${thread.length} reviews`);
   * ```
   *
   * @public
   */
  async getThread(rootUri: AtUri, maxDepth = 10): Promise<StoredReview[]> {
    try {
      // First try using the stored function if it exists
      const result = await this.pool.query<ReviewRow>(
        `SELECT uri, cid, rkey, preprint_uri, preprint_cid, reviewer_did, content,
                content_format, motivation, parent_uri, root_uri, reply_depth,
                anchor, reply_count, endorsement_count, pds_url, created_at, indexed_at
         FROM get_review_thread($1, $2)`,
        [rootUri, maxDepth]
      );

      return result.rows.map((row) => this.mapRowToStoredReview(row));
    } catch {
      // Fall back to manual recursive query if function doesn't exist
      return this.getThreadFallback(rootUri, maxDepth);
    }
  }

  /**
   * Fallback thread retrieval using recursive CTE.
   *
   * @param rootUri - Root review URI
   * @param maxDepth - Maximum depth
   * @returns Thread reviews
   *
   * @internal
   */
  private async getThreadFallback(rootUri: AtUri, maxDepth: number): Promise<StoredReview[]> {
    const result = await this.pool.query<ReviewRow>(
      `WITH RECURSIVE thread AS (
         -- Base case: the root review
         SELECT uri, cid, rkey, preprint_uri, preprint_cid, reviewer_did, content,
                content_format, motivation, parent_uri, root_uri, reply_depth,
                anchor, reply_count, endorsement_count, pds_url, created_at, indexed_at,
                0 AS depth
         FROM reviews_index
         WHERE uri = $1

         UNION ALL

         -- Recursive case: direct replies
         SELECT r.uri, r.cid, r.rkey, r.preprint_uri, r.preprint_cid, r.reviewer_did, r.content,
                r.content_format, r.motivation, r.parent_uri, r.root_uri, r.reply_depth,
                r.anchor, r.reply_count, r.endorsement_count, r.pds_url, r.created_at, r.indexed_at,
                t.depth + 1
         FROM reviews_index r
         INNER JOIN thread t ON r.parent_uri = t.uri
         WHERE t.depth < $2
       )
       SELECT uri, cid, rkey, preprint_uri, preprint_cid, reviewer_did, content,
              content_format, motivation, parent_uri, root_uri, reply_depth,
              anchor, reply_count, endorsement_count, pds_url, created_at, indexed_at
       FROM thread
       ORDER BY depth ASC, created_at ASC`,
      [rootUri, maxDepth]
    );

    return result.rows.map((row) => this.mapRowToStoredReview(row));
  }
}
