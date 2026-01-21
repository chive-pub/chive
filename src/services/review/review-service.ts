/**
 * Review service managing comments, endorsements, and threaded discussions.
 *
 * @remarks
 * Indexes review comments and endorsements from firehose, builds threaded
 * discussion trees for display.
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IStorageBackend } from '../../types/interfaces/storage.interface.js';
import { Err, Ok, type Result } from '../../types/result.js';
import type { RecordMetadata } from '../eprint/eprint-service.js';

/**
 * Text span target for inline comments (W3C Web Annotation model).
 *
 * @public
 */
export interface TextSpanTarget {
  /**
   * Type of selector (text position, text quote, etc.)
   */
  readonly type: 'TextPositionSelector' | 'TextQuoteSelector';

  /**
   * Start offset for position selector.
   */
  readonly start?: number;

  /**
   * End offset for position selector.
   */
  readonly end?: number;

  /**
   * Exact text content for quote selector.
   */
  readonly exact?: string;

  /**
   * Text before the quote for context.
   */
  readonly prefix?: string;

  /**
   * Text after the quote for context.
   */
  readonly suffix?: string;
}

/**
 * Review comment record from lexicon.
 *
 * @public
 */
export interface ReviewComment {
  readonly $type: 'pub.chive.review.comment';
  readonly subject: { readonly uri: AtUri; readonly cid: string };
  readonly text: string;
  readonly reviewType?: string;
  readonly parent?: AtUri;
  readonly createdAt: string;
  /**
   * Text span target for precise inline annotations.
   * Follows W3C Web Annotation data model.
   */
  readonly target?: TextSpanTarget;
}

/**
 * Endorsement record from lexicon.
 *
 * @remarks
 * Aligned with pub.chive.review.endorsement lexicon.
 * Uses `contributions` array for CRediT taxonomy roles.
 *
 * @public
 */
export interface Endorsement {
  readonly $type: 'pub.chive.review.endorsement';
  readonly eprintUri: AtUri;
  readonly contributions: readonly string[];
  readonly comment?: string;
  readonly createdAt: string;
}

/**
 * Extracts DID from AT URI.
 *
 * @param uri - AT URI in format at://did:xxx/collection/rkey
 * @returns DID portion of the URI
 *
 * @internal
 */
function extractDidFromUri(uri: AtUri): DID {
  // AT URI format: at://did:plc:xxx/collection/rkey
  const parts = uri.split('/');
  return parts[2] as DID;
}

/**
 * Endorsement view for display.
 *
 * @remarks
 * Aligned with pub.chive.review.endorsement lexicon.
 * Uses `contributions` array for CRediT taxonomy roles.
 *
 * @public
 */
export interface EndorsementView {
  readonly uri: AtUri;
  readonly endorser: DID;
  readonly eprintUri: AtUri;
  /**
   * Array of contribution slugs being endorsed.
   *
   * @remarks
   * Values from endorsement-contribution nodes in knowledge graph.
   * Examples: 'methodological', 'empirical', 'reproducibility'
   */
  readonly contributions: readonly string[];
  readonly comment?: string;
  readonly createdAt: Date;
}

/**
 * Review view for display.
 *
 * @public
 */
export interface ReviewView {
  readonly uri: AtUri;
  readonly author: string;
  readonly subject: AtUri;
  readonly text: string;
  readonly parent?: AtUri;
  readonly createdAt: Date;
  readonly replyCount: number;
}

/**
 * Threaded review tree.
 *
 * @public
 */
export interface ReviewThread {
  readonly root: ReviewView;
  readonly replies: readonly ReviewThread[];
  readonly totalReplies: number;
}

/**
 * Endorsement summary with aggregated counts.
 *
 * @public
 */
export interface EndorsementSummary {
  readonly eprintUri: AtUri;
  readonly total: number;
  readonly endorserCount: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly recentEndorsers: readonly {
    readonly did: DID;
    readonly endorsedAt: Date;
    readonly contributions: readonly string[];
  }[];
}

/**
 * Review notification view including eprint metadata for display.
 *
 * @public
 */
export interface ReviewNotification {
  readonly uri: AtUri;
  readonly reviewerDid: DID;
  readonly reviewerHandle?: string;
  readonly reviewerDisplayName?: string;
  readonly eprintUri: AtUri;
  readonly eprintTitle: string;
  readonly text: string;
  readonly isReply: boolean;
  readonly createdAt: Date;
}

/**
 * Endorsement notification view including eprint metadata for display.
 *
 * @public
 */
export interface EndorsementNotification {
  readonly uri: AtUri;
  readonly endorserDid: DID;
  readonly endorserHandle?: string;
  readonly endorserDisplayName?: string;
  readonly eprintUri: AtUri;
  readonly eprintTitle: string;
  readonly contributions: readonly string[];
  readonly comment?: string;
  readonly createdAt: Date;
}

/**
 * Pagination options for list queries.
 *
 * @public
 */
export interface PaginationOptions {
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Paginated result wrapper.
 *
 * @public
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly cursor?: string;
  readonly hasMore: boolean;
  readonly total: number;
}

/**
 * Review service configuration.
 *
 * @public
 */
export interface ReviewServiceOptions {
  readonly pool: Pool;
  readonly storage: IStorageBackend;
  readonly logger: ILogger;
}

/**
 * Review service implementation.
 *
 * @example
 * ```typescript
 * const service = new ReviewService({ pool, storage, logger });
 *
 * // Index review from firehose
 * await service.indexReview(reviewRecord, metadata);
 *
 * // Get threaded reviews
 * const threads = await service.getReviews(eprintUri);
 * ```
 *
 * @public
 */
export class ReviewService {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  constructor(options: ReviewServiceOptions) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  /**
   * Indexes review comment from firehose.
   *
   * @param record - Review comment record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexReview(
    record: ReviewComment,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      // Convert text to rich text body format
      const body = JSON.stringify([{ type: 'text', content: record.text }]);

      await this.pool.query(
        `INSERT INTO reviews_index (
          uri, cid, eprint_uri, reviewer_did, body, parent_comment,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          body = EXCLUDED.body,
          updated_at = NOW(),
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          record.subject.uri,
          extractDidFromUri(metadata.uri),
          body,
          record.parent ?? null,
          new Date(record.createdAt),
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed review', {
        uri: metadata.uri,
        eprintUri: record.subject.uri,
        hasParent: !!record.parent,
      });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index review: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index review', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Indexes endorsement from firehose.
   *
   * @param record - Endorsement record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexEndorsement(
    record: Endorsement,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query(
        `INSERT INTO endorsements_index (
          uri, cid, eprint_uri, endorser_did, contributions, comment,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          contributions = EXCLUDED.contributions,
          comment = EXCLUDED.comment,
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          record.eprintUri,
          extractDidFromUri(metadata.uri),
          record.contributions,
          record.comment ?? null,
          new Date(record.createdAt),
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed endorsement', {
        uri: metadata.uri,
        eprintUri: record.eprintUri,
        contributions: record.contributions,
      });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index endorsement: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index endorsement', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Gets threaded reviews for eprint.
   *
   * @param eprintUri - Eprint URI
   * @returns Review threads
   *
   * @public
   */
  async getReviews(eprintUri: AtUri): Promise<readonly ReviewThread[]> {
    try {
      // Fetch all reviews for this eprint
      // Extract text from body JSONB (body is array of {type, content} objects)
      const result = await this.pool.query<{
        uri: string;
        reviewer_did: string;
        text: string;
        parent_comment: string | null;
        created_at: Date;
      }>(
        `SELECT uri, reviewer_did,
                COALESCE(body->0->>'content', '') as text,
                parent_comment, created_at
         FROM reviews_index
         WHERE eprint_uri = $1
         ORDER BY created_at ASC`,
        [eprintUri]
      );

      // Build a map of reviews by URI
      const reviewMap = new Map<string, ReviewView & { parentUri?: string }>();
      const replyCounts = new Map<string, number>();

      // First pass: count replies for each review
      for (const row of result.rows) {
        if (row.parent_comment) {
          replyCounts.set(row.parent_comment, (replyCounts.get(row.parent_comment) ?? 0) + 1);
        }
      }

      // Second pass: create ReviewView objects
      for (const row of result.rows) {
        reviewMap.set(row.uri, {
          uri: row.uri as AtUri,
          author: row.reviewer_did,
          subject: eprintUri,
          text: row.text,
          parent: (row.parent_comment as AtUri) ?? undefined,
          createdAt: new Date(row.created_at),
          replyCount: replyCounts.get(row.uri) ?? 0,
          parentUri: row.parent_comment ?? undefined,
        });
      }

      // Build thread tree
      const buildThread = (reviewUri: string): ReviewThread => {
        const review = reviewMap.get(reviewUri);
        if (!review) {
          throw new Error(`Review not found in map: ${reviewUri}`);
        }
        const replies: ReviewThread[] = [];

        // Find all direct replies
        for (const [uri, r] of reviewMap) {
          if (r.parentUri === reviewUri) {
            replies.push(buildThread(uri));
          }
        }

        // Count total replies recursively
        const countReplies = (threads: readonly ReviewThread[]): number => {
          let count = threads.length;
          for (const thread of threads) {
            count += countReplies(thread.replies);
          }
          return count;
        };

        return {
          root: {
            uri: review.uri,
            author: review.author,
            subject: review.subject,
            text: review.text,
            parent: review.parent,
            createdAt: review.createdAt,
            replyCount: review.replyCount,
          },
          replies,
          totalReplies: countReplies(replies),
        };
      };

      // Find root reviews (no parent) and build threads
      const threads: ReviewThread[] = [];
      for (const [uri, review] of reviewMap) {
        if (!review.parentUri) {
          threads.push(buildThread(uri));
        }
      }

      return threads;
    } catch (error) {
      this.logger.error('Failed to get reviews', error instanceof Error ? error : undefined, {
        eprintUri,
      });
      return [];
    }
  }

  /**
   * Gets endorsements for eprint.
   *
   * @param eprintUri - Eprint URI
   * @returns Endorsement views
   *
   * @public
   */
  async getEndorsements(eprintUri: AtUri): Promise<readonly EndorsementView[]> {
    try {
      const result = await this.pool.query<{
        uri: string;
        endorser_did: string;
        eprint_uri: string;
        contributions: string[] | null;
        comment: string | null;
        created_at: Date;
      }>(
        `SELECT uri, endorser_did, eprint_uri, contributions, comment, created_at
         FROM endorsements_index
         WHERE eprint_uri = $1
         ORDER BY created_at DESC`,
        [eprintUri]
      );

      return result.rows.map((row) => ({
        uri: row.uri as AtUri,
        endorser: row.endorser_did as DID,
        eprintUri: row.eprint_uri as AtUri,
        contributions: row.contributions ?? [],
        comment: row.comment ?? undefined,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      this.logger.error('Failed to get endorsements', error instanceof Error ? error : undefined, {
        eprintUri,
      });
      return [];
    }
  }

  /**
   * Gets endorsement summary with aggregated counts by type.
   *
   * @param eprintUri - Eprint URI
   * @returns Endorsement summary with counts and recent endorsers
   *
   * @public
   */
  async getEndorsementSummary(eprintUri: AtUri): Promise<EndorsementSummary> {
    try {
      // Get aggregated counts by unnesting the contributions array
      const countsResult = await this.pool.query<{
        contribution: string;
        count: string;
      }>(
        `SELECT c as contribution, COUNT(*) as count
         FROM endorsements_index, unnest(contributions) as c
         WHERE eprint_uri = $1
         GROUP BY c`,
        [eprintUri]
      );

      // Get unique endorser count
      const uniqueResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT endorser_did) as count
         FROM endorsements_index
         WHERE eprint_uri = $1`,
        [eprintUri]
      );

      // Get total count
      const totalResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM endorsements_index
         WHERE eprint_uri = $1`,
        [eprintUri]
      );

      // Get recent endorsers (last 5)
      const recentResult = await this.pool.query<{
        endorser_did: string;
        contributions: string[];
        created_at: Date;
      }>(
        `SELECT DISTINCT ON (endorser_did) endorser_did, contributions, created_at
         FROM endorsements_index
         WHERE eprint_uri = $1
         ORDER BY endorser_did, created_at DESC
         LIMIT 5`,
        [eprintUri]
      );

      // Build byType map
      const byType: Record<string, number> = {};
      for (const row of countsResult.rows) {
        byType[row.contribution] = parseInt(row.count, 10);
      }

      return {
        eprintUri,
        total: parseInt(totalResult.rows[0]?.count ?? '0', 10),
        endorserCount: parseInt(uniqueResult.rows[0]?.count ?? '0', 10),
        byType,
        recentEndorsers: recentResult.rows.map((row) => ({
          did: row.endorser_did as DID,
          endorsedAt: new Date(row.created_at),
          contributions: row.contributions,
        })),
      };
    } catch (error) {
      this.logger.error(
        'Failed to get endorsement summary',
        error instanceof Error ? error : undefined,
        { eprintUri }
      );
      return {
        eprintUri,
        total: 0,
        endorserCount: 0,
        byType: {},
        recentEndorsers: [],
      };
    }
  }

  /**
   * Gets a specific user's endorsement for an eprint.
   *
   * @param eprintUri - Eprint URI
   * @param userDid - User's DID
   * @returns Endorsement view or null if not found
   *
   * @public
   */
  async getEndorsementByUser(eprintUri: AtUri, userDid: DID): Promise<EndorsementView | null> {
    try {
      const result = await this.pool.query<{
        uri: string;
        endorser_did: string;
        eprint_uri: string;
        contributions: string[];
        comment: string | null;
        created_at: Date;
      }>(
        `SELECT uri, endorser_did, eprint_uri, contributions, comment, created_at
         FROM endorsements_index
         WHERE eprint_uri = $1 AND endorser_did = $2
         LIMIT 1`,
        [eprintUri, userDid]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        uri: row.uri as AtUri,
        endorser: row.endorser_did as DID,
        eprintUri: row.eprint_uri as AtUri,
        contributions: row.contributions ?? [],
        comment: row.comment ?? undefined,
        createdAt: new Date(row.created_at),
      };
    } catch (error) {
      this.logger.error(
        'Failed to get user endorsement',
        error instanceof Error ? error : undefined,
        { eprintUri, userDid }
      );
      return null;
    }
  }

  /**
   * Lists endorsements for an eprint with pagination.
   *
   * @param eprintUri - Eprint URI
   * @param options - Pagination options
   * @returns Paginated endorsement results
   *
   * @public
   */
  async listEndorsementsForEprint(
    eprintUri: AtUri,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<EndorsementView>> {
    const limit = Math.min(options.limit ?? 50, 100);

    try {
      // Get total count
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM endorsements_index
         WHERE eprint_uri = $1`,
        [eprintUri]
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      // Build query with cursor support
      let query = `SELECT uri, endorser_did, eprint_uri, contributions, comment, created_at
         FROM endorsements_index
         WHERE eprint_uri = $1`;
      const params: unknown[] = [eprintUri];

      if (options.cursor) {
        // Cursor is the created_at timestamp + uri for stable pagination
        const parts = options.cursor.split('::');
        const timestamp = parts[0] ?? new Date().toISOString();
        const cursorUri = parts[1] ?? '';
        query += ` AND (created_at, uri) < ($2, $3)`;
        params.push(new Date(timestamp), cursorUri);
      }

      query += ` ORDER BY created_at DESC, uri DESC LIMIT $${params.length + 1}`;
      params.push(limit + 1); // Fetch one extra to check hasMore

      const result = await this.pool.query<{
        uri: string;
        endorser_did: string;
        eprint_uri: string;
        contributions: string[];
        comment: string | null;
        created_at: Date;
      }>(query, params);

      const hasMore = result.rows.length > limit;
      const items = result.rows.slice(0, limit);

      // Generate next cursor from last item
      let cursor: string | undefined;
      const lastItem = items[items.length - 1];
      if (hasMore && lastItem) {
        cursor = `${lastItem.created_at.toISOString()}::${lastItem.uri}`;
      }

      return {
        items: items.map((row) => ({
          uri: row.uri as AtUri,
          endorser: row.endorser_did as DID,
          eprintUri: row.eprint_uri as AtUri,
          contributions: row.contributions ?? [],
          comment: row.comment ?? undefined,
          createdAt: new Date(row.created_at),
        })),
        cursor,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error('Failed to list endorsements', error instanceof Error ? error : undefined, {
        eprintUri,
      });
      return {
        items: [],
        hasMore: false,
        total: 0,
      };
    }
  }

  /**
   * Gets a review by URI.
   *
   * @param uri - Review AT-URI
   * @returns Review view or null if not found
   *
   * @public
   */
  async getReviewByUri(uri: AtUri): Promise<ReviewView | null> {
    try {
      const result = await this.pool.query<{
        uri: string;
        reviewer_did: string;
        eprint_uri: string;
        text: string;
        parent_comment: string | null;
        created_at: Date;
        reply_count: number;
      }>(
        `SELECT uri, reviewer_did, eprint_uri,
                COALESCE(body->0->>'content', '') as text,
                parent_comment, created_at,
                COALESCE((SELECT COUNT(*) FROM reviews_index r2 WHERE r2.parent_comment = reviews_index.uri), 0)::int as reply_count
         FROM reviews_index
         WHERE uri = $1`,
        [uri]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        uri: row.uri as AtUri,
        author: row.reviewer_did,
        subject: row.eprint_uri as AtUri,
        text: row.text,
        parent: (row.parent_comment as AtUri) ?? undefined,
        createdAt: new Date(row.created_at),
        replyCount: row.reply_count,
      };
    } catch (error) {
      this.logger.error('Failed to get review by URI', error instanceof Error ? error : undefined, {
        uri,
      });
      return null;
    }
  }

  /**
   * Gets a review thread with all replies.
   *
   * @param rootUri - URI of the root review
   * @param maxDepth - Maximum depth of replies (default: 10)
   * @returns Array of review views in the thread
   *
   * @public
   */
  async getReviewThread(rootUri: AtUri, maxDepth = 10): Promise<ReviewView[]> {
    try {
      // Use recursive CTE to get thread
      const result = await this.pool.query<{
        uri: string;
        reviewer_did: string;
        eprint_uri: string;
        text: string;
        parent_comment: string | null;
        created_at: Date;
        depth: number;
      }>(
        `WITH RECURSIVE thread AS (
           SELECT uri, reviewer_did, eprint_uri, COALESCE(body->0->>'content', '') as text, parent_comment, created_at, 0 AS depth
           FROM reviews_index
           WHERE uri = $1

           UNION ALL

           SELECT r.uri, r.reviewer_did, r.eprint_uri, COALESCE(r.body->0->>'content', '') as text, r.parent_comment, r.created_at, t.depth + 1
           FROM reviews_index r
           INNER JOIN thread t ON r.parent_comment = t.uri
           WHERE t.depth < $2
         )
         SELECT uri, reviewer_did, eprint_uri, text, parent_comment, created_at, depth
         FROM thread
         ORDER BY depth ASC, created_at ASC`,
        [rootUri, maxDepth]
      );

      // Get reply counts for all reviews in thread
      const uris = result.rows.map((r) => r.uri);
      const replyCountResult =
        uris.length > 0
          ? await this.pool.query<{ parent_uri: string; count: string }>(
              `SELECT parent_comment as parent_uri, COUNT(*)::text as count
             FROM reviews_index
             WHERE parent_comment = ANY($1)
             GROUP BY parent_comment`,
              [uris]
            )
          : { rows: [] };

      const replyCounts = new Map<string, number>();
      for (const row of replyCountResult.rows) {
        replyCounts.set(row.parent_uri, parseInt(row.count, 10));
      }

      return result.rows.map((row) => ({
        uri: row.uri as AtUri,
        author: row.reviewer_did,
        subject: row.eprint_uri as AtUri,
        text: row.text,
        parent: (row.parent_comment as AtUri) ?? undefined,
        createdAt: new Date(row.created_at),
        replyCount: replyCounts.get(row.uri) ?? 0,
      }));
    } catch (error) {
      this.logger.error('Failed to get review thread', error instanceof Error ? error : undefined, {
        rootUri,
      });
      return [];
    }
  }

  /**
   * Lists reviews by a specific reviewer.
   *
   * @param reviewerDid - DID of the reviewer
   * @param options - Pagination options
   * @returns Paginated list of reviews
   *
   * @public
   */
  async listReviewsByAuthor(
    reviewerDid: DID,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<PaginatedResult<ReviewView>> {
    const limit = options.limit ?? 50;
    const offset = options.cursor ? parseInt(options.cursor, 10) : 0;

    try {
      // Count total reviews by this author
      const countResult = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM reviews_index WHERE reviewer_did = $1',
        [reviewerDid]
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      // Get reviews with reply counts
      const result = await this.pool.query<{
        uri: string;
        reviewer_did: string;
        eprint_uri: string;
        text: string;
        parent_comment: string | null;
        created_at: Date;
        reply_count: number;
      }>(
        `SELECT r.uri, r.reviewer_did, r.eprint_uri,
                COALESCE(r.body->0->>'content', '') as text,
                r.parent_comment, r.created_at,
                COALESCE((SELECT COUNT(*) FROM reviews_index r2 WHERE r2.parent_comment = r.uri), 0)::int as reply_count
         FROM reviews_index r
         WHERE r.reviewer_did = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [reviewerDid, limit, offset]
      );

      const items: ReviewView[] = result.rows.map((row) => ({
        uri: row.uri as AtUri,
        author: row.reviewer_did,
        subject: row.eprint_uri as AtUri,
        text: row.text,
        parent: (row.parent_comment as AtUri) ?? undefined,
        createdAt: new Date(row.created_at),
        replyCount: row.reply_count,
      }));

      const nextOffset = offset + items.length;
      const hasMore = nextOffset < total;

      return {
        items,
        cursor: hasMore ? String(nextOffset) : undefined,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error(
        'Failed to list reviews by author',
        error instanceof Error ? error : undefined,
        { reviewerDid }
      );
      return { items: [], cursor: undefined, hasMore: false, total: 0 };
    }
  }

  /**
   * Lists reviews on papers where the given DID is an author.
   *
   * @param authorDid - DID of the paper author
   * @param options - Pagination options
   * @returns Paginated list of review notifications
   *
   * @remarks
   * This queries for reviews on eprints where authorDid appears in the
   * authors JSONB array. Excludes reviews written by the author themselves.
   *
   * @public
   */
  async listReviewsOnAuthorPapers(
    authorDid: DID,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ReviewNotification>> {
    const limit = Math.min(options.limit ?? 50, 100);

    try {
      // Count total reviews on author's papers (excluding self-reviews)
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count
         FROM reviews_index r
         INNER JOIN eprints_index e ON r.eprint_uri = e.uri
         WHERE e.authors @> $1::jsonb
           AND r.reviewer_did != $2`,
        [JSON.stringify([{ did: authorDid }]), authorDid]
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      // Build query with cursor support
      let query = `
        SELECT
          r.uri,
          r.reviewer_did,
          r.eprint_uri,
          COALESCE(r.body->0->>'content', '') as text,
          r.parent_comment,
          r.created_at,
          e.title as eprint_title,
          a.handle as reviewer_handle,
          a.display_name as reviewer_display_name
        FROM reviews_index r
        INNER JOIN eprints_index e ON r.eprint_uri = e.uri
        LEFT JOIN authors_index a ON r.reviewer_did = a.did
        WHERE e.authors @> $1::jsonb
          AND r.reviewer_did != $2`;
      const params: unknown[] = [JSON.stringify([{ did: authorDid }]), authorDid];

      if (options.cursor) {
        const parts = options.cursor.split('::');
        const timestamp = parts[0] ?? new Date().toISOString();
        const cursorUri = parts[1] ?? '';
        query += ` AND (r.created_at, r.uri) < ($3, $4)`;
        params.push(new Date(timestamp), cursorUri);
      }

      query += ` ORDER BY r.created_at DESC, r.uri DESC LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await this.pool.query<{
        uri: string;
        reviewer_did: string;
        eprint_uri: string;
        text: string;
        parent_comment: string | null;
        created_at: Date;
        eprint_title: string;
        reviewer_handle: string | null;
        reviewer_display_name: string | null;
      }>(query, params);

      const hasMore = result.rows.length > limit;
      const items = result.rows.slice(0, limit);

      let cursor: string | undefined;
      const lastItem = items[items.length - 1];
      if (hasMore && lastItem) {
        cursor = `${lastItem.created_at.toISOString()}::${lastItem.uri}`;
      }

      return {
        items: items.map((row) => ({
          uri: row.uri as AtUri,
          reviewerDid: row.reviewer_did as DID,
          reviewerHandle: row.reviewer_handle ?? undefined,
          reviewerDisplayName: row.reviewer_display_name ?? undefined,
          eprintUri: row.eprint_uri as AtUri,
          eprintTitle: row.eprint_title,
          text: row.text,
          isReply: !!row.parent_comment,
          createdAt: new Date(row.created_at),
        })),
        cursor,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error(
        'Failed to list reviews on author papers',
        error instanceof Error ? error : undefined,
        { authorDid }
      );
      return { items: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Lists endorsements on papers where the given DID is an author.
   *
   * @param authorDid - DID of the paper author
   * @param options - Pagination options
   * @returns Paginated list of endorsement notifications
   *
   * @remarks
   * This queries for endorsements on eprints where authorDid appears in the
   * authors JSONB array. Excludes self-endorsements.
   *
   * @public
   */
  async listEndorsementsOnAuthorPapers(
    authorDid: DID,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<EndorsementNotification>> {
    const limit = Math.min(options.limit ?? 50, 100);

    try {
      // Count total endorsements on author's papers (excluding self-endorsements)
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count
         FROM endorsements_index en
         INNER JOIN eprints_index e ON en.eprint_uri = e.uri
         WHERE e.authors @> $1::jsonb
           AND en.endorser_did != $2`,
        [JSON.stringify([{ did: authorDid }]), authorDid]
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      // Build query with cursor support
      let query = `
        SELECT
          en.uri,
          en.endorser_did,
          en.eprint_uri,
          en.contributions,
          en.comment,
          en.created_at,
          e.title as eprint_title,
          a.handle as endorser_handle,
          a.display_name as endorser_display_name
        FROM endorsements_index en
        INNER JOIN eprints_index e ON en.eprint_uri = e.uri
        LEFT JOIN authors_index a ON en.endorser_did = a.did
        WHERE e.authors @> $1::jsonb
          AND en.endorser_did != $2`;
      const params: unknown[] = [JSON.stringify([{ did: authorDid }]), authorDid];

      if (options.cursor) {
        const parts = options.cursor.split('::');
        const timestamp = parts[0] ?? new Date().toISOString();
        const cursorUri = parts[1] ?? '';
        query += ` AND (en.created_at, en.uri) < ($3, $4)`;
        params.push(new Date(timestamp), cursorUri);
      }

      query += ` ORDER BY en.created_at DESC, en.uri DESC LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await this.pool.query<{
        uri: string;
        endorser_did: string;
        eprint_uri: string;
        contributions: string[];
        comment: string | null;
        created_at: Date;
        eprint_title: string;
        endorser_handle: string | null;
        endorser_display_name: string | null;
      }>(query, params);

      const hasMore = result.rows.length > limit;
      const items = result.rows.slice(0, limit);

      let cursor: string | undefined;
      const lastItem = items[items.length - 1];
      if (hasMore && lastItem) {
        cursor = `${lastItem.created_at.toISOString()}::${lastItem.uri}`;
      }

      return {
        items: items.map((row) => ({
          uri: row.uri as AtUri,
          endorserDid: row.endorser_did as DID,
          endorserHandle: row.endorser_handle ?? undefined,
          endorserDisplayName: row.endorser_display_name ?? undefined,
          eprintUri: row.eprint_uri as AtUri,
          eprintTitle: row.eprint_title,
          contributions: row.contributions,
          comment: row.comment ?? undefined,
          createdAt: new Date(row.created_at),
        })),
        cursor,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error(
        'Failed to list endorsements on author papers',
        error instanceof Error ? error : undefined,
        { authorDid }
      );
      return { items: [], hasMore: false, total: 0 };
    }
  }
}
