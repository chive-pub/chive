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

import {
  isRecord as isCommentRecord,
  type Main as CommentRecord,
} from '../../lexicons/generated/types/pub/chive/review/comment.js';
import {
  isRecord as isEndorsementRecord,
  type Main as EndorsementRecord,
} from '../../lexicons/generated/types/pub/chive/review/endorsement.js';
import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, ValidationError } from '../../types/errors.js';
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
 * Re-export generated lexicon types for external use.
 *
 * @public
 */
export type { CommentRecord as ReviewComment, EndorsementRecord as Endorsement };

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
/**
 * Anchor data for inline annotations (W3C Web Annotation format).
 */
export interface ReviewAnchor {
  readonly source?: string;
  readonly selector?: {
    readonly type: string;
    readonly exact?: string;
    readonly prefix?: string;
    readonly suffix?: string;
  };
  readonly refinedBy?: {
    readonly type?: string;
    readonly pageNumber?: number;
    readonly start?: number;
    readonly end?: number;
    readonly boundingRect?: {
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly width: number;
      readonly height: number;
    };
  };
  readonly pageNumber?: number;
}

export interface ReviewView {
  readonly uri: AtUri;
  readonly author: string;
  readonly subject: AtUri;
  readonly text: string;
  /** Rich text body array */
  readonly body?: readonly unknown[];
  /** ATProto-style facets for links, mentions, etc. */
  readonly facets?: readonly unknown[];
  readonly parent?: AtUri;
  readonly createdAt: Date;
  readonly replyCount: number;
  /** Anchor for inline annotations */
  readonly anchor?: ReviewAnchor;
  /** W3C motivation type */
  readonly motivation?: string;
  /** Whether this review has been soft-deleted */
  readonly deleted?: boolean;
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
   * @param record - Review comment record (unknown, validated internally)
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexReview(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    // Validate record against lexicon schema
    if (!isCommentRecord(record)) {
      const validationError = new ValidationError(
        'Record does not match pub.chive.review.comment schema',
        'record',
        'schema'
      );
      this.logger.warn('Invalid review comment record', { uri: metadata.uri });
      return Err(validationError);
    }

    // Cast to the validated type (isCommentRecord validates schema compliance)
    const comment = record as CommentRecord;

    try {
      // Body is already a rich text array from the lexicon
      const body = JSON.stringify(comment.body);

      // Extract facets from body items (if present)
      const facets: unknown[] = [];
      if (Array.isArray(comment.body)) {
        for (const item of comment.body) {
          if (item && typeof item === 'object' && 'facets' in item && Array.isArray(item.facets)) {
            facets.push(...item.facets);
          }
        }
      }
      const facetsJson = facets.length > 0 ? JSON.stringify(facets) : null;

      // Convert target to anchor format for storage
      // Include refinedBy for position data (pageNumber, boundingRect)
      const anchor = comment.target
        ? JSON.stringify({
            source: comment.target.versionUri ?? comment.eprintUri,
            selector: comment.target.selector,
            refinedBy: comment.target.refinedBy,
            pageNumber:
              // Get pageNumber from refinedBy if available, otherwise from fragment selector
              comment.target.refinedBy?.pageNumber ??
              (comment.target.selector &&
              '$type' in comment.target.selector &&
              comment.target.selector.$type === 'pub.chive.review.comment#fragmentSelector'
                ? parseInt((comment.target.selector as { value: string }).value, 10)
                : undefined),
          })
        : null;

      // Get motivation (prefer fallback, URI would need resolution)
      // Default to 'commenting' if not specified (matches database default)
      const motivation = comment.motivationFallback ?? 'commenting';

      await this.pool.query(
        `INSERT INTO reviews_index (
          uri, cid, eprint_uri, reviewer_did, body, parent_comment,
          anchor, motivation, facets,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          body = EXCLUDED.body,
          anchor = EXCLUDED.anchor,
          motivation = EXCLUDED.motivation,
          facets = EXCLUDED.facets,
          updated_at = NOW(),
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          comment.eprintUri,
          extractDidFromUri(metadata.uri),
          body,
          comment.parentComment ?? null,
          anchor,
          motivation,
          facetsJson,
          new Date(comment.createdAt),
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed review', {
        uri: metadata.uri,
        eprintUri: comment.eprintUri,
        hasParent: !!comment.parentComment,
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
   * @param record - Endorsement record (unknown, validated internally)
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexEndorsement(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    // Validate record against lexicon schema
    if (!isEndorsementRecord(record)) {
      const validationError = new ValidationError(
        'Record does not match pub.chive.review.endorsement schema',
        'record',
        'schema'
      );
      this.logger.warn('Invalid endorsement record', { uri: metadata.uri });
      return Err(validationError);
    }

    // Cast to the validated type (isEndorsementRecord validates schema compliance)
    const endorsement = record as EndorsementRecord;

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
          endorsement.eprintUri,
          extractDidFromUri(metadata.uri),
          endorsement.contributions,
          endorsement.comment ?? null,
          new Date(endorsement.createdAt),
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed endorsement', {
        uri: metadata.uri,
        eprintUri: endorsement.eprintUri,
        contributions: endorsement.contributions,
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
   * @remarks
   * Includes soft-deleted reviews if they have replies to preserve thread structure.
   * Deleted reviews are marked with `deleted: true` and have empty text.
   *
   * @param eprintUri - Eprint URI
   * @returns Review threads
   *
   * @public
   */
  async getReviews(eprintUri: AtUri): Promise<readonly ReviewThread[]> {
    try {
      // Fetch all reviews for this eprint
      // Include deleted reviews that have replies to preserve thread structure
      // Extract text from body JSONB (body is array of {type, content} objects)
      const result = await this.pool.query<{
        uri: string;
        reviewer_did: string;
        text: string;
        body: unknown[] | null;
        facets: unknown[] | null;
        parent_comment: string | null;
        created_at: Date;
        anchor: ReviewAnchor | null;
        motivation: string | null;
        deleted_at: Date | null;
      }>(
        `SELECT r.uri, r.reviewer_did,
                CASE WHEN r.deleted_at IS NOT NULL THEN '' ELSE COALESCE(r.body->0->>'content', '') END as text,
                CASE WHEN r.deleted_at IS NOT NULL THEN NULL ELSE r.body END as body,
                CASE WHEN r.deleted_at IS NOT NULL THEN NULL ELSE r.facets END as facets,
                r.parent_comment, r.created_at,
                r.anchor, r.motivation, r.deleted_at
         FROM reviews_index r
         WHERE r.eprint_uri = $1
           AND (r.deleted_at IS NULL OR EXISTS (
             SELECT 1 FROM reviews_index r2
             WHERE r2.parent_comment = r.uri
               AND r2.deleted_at IS NULL
           ))
         ORDER BY r.created_at ASC`,
        [eprintUri]
      );

      // Build a map of reviews by URI
      const reviewMap = new Map<string, ReviewView & { parentUri?: string }>();
      const replyCounts = new Map<string, number>();

      // First pass: count replies for each review (only non-deleted replies)
      for (const row of result.rows) {
        if (row.parent_comment && !row.deleted_at) {
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
          body: row.body ?? undefined,
          facets: row.facets ?? undefined,
          parent: (row.parent_comment as AtUri) ?? undefined,
          createdAt: new Date(row.created_at),
          replyCount: replyCounts.get(row.uri) ?? 0,
          parentUri: row.parent_comment ?? undefined,
          anchor: row.anchor ?? undefined,
          motivation: row.motivation ?? undefined,
          deleted: row.deleted_at !== null,
        });
      }

      // Build thread tree
      const buildThread = (reviewUri: string): ReviewThread => {
        const review = reviewMap.get(reviewUri);
        if (!review) {
          throw new DatabaseError('READ', `Review not found in map: ${reviewUri}`);
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
            body: review.body,
            facets: review.facets,
            parent: review.parent,
            createdAt: review.createdAt,
            replyCount: review.replyCount,
            anchor: review.anchor,
            motivation: review.motivation,
            deleted: review.deleted,
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
   * Lists endorsements given by a specific user.
   *
   * @param endorserDid - DID of the endorser
   * @param options - Pagination options
   * @returns Paginated endorsement results
   *
   * @public
   */
  async listEndorsementsByUser(
    endorserDid: DID,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<EndorsementView>> {
    const limit = Math.min(options.limit ?? 50, 100);

    try {
      // Get total count
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM endorsements_index
         WHERE endorser_did = $1`,
        [endorserDid]
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      // Build query with cursor support
      let query = `SELECT uri, endorser_did, eprint_uri, contributions, comment, created_at
         FROM endorsements_index
         WHERE endorser_did = $1`;
      const params: unknown[] = [endorserDid];

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
      this.logger.error(
        'Failed to list endorsements by user',
        error instanceof Error ? error : undefined,
        {
          endorserDid,
        }
      );
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

  /**
   * Looks up author info for a set of DIDs.
   *
   * @param dids - Set of DIDs to look up
   * @returns Map of DID to author info
   *
   * @public
   */
  async getAuthorInfoByDids(
    dids: Set<string>
  ): Promise<Map<string, { handle?: string; displayName?: string; avatar?: string }>> {
    const result = new Map<string, { handle?: string; displayName?: string; avatar?: string }>();

    if (dids.size === 0) {
      return result;
    }

    try {
      const queryResult = await this.pool.query<{
        did: string;
        handle: string | null;
        display_name: string | null;
        avatar_blob_cid: string | null;
        pds_url: string;
      }>(
        `SELECT did, handle, display_name, avatar_blob_cid, pds_url
         FROM authors_index
         WHERE did = ANY($1)`,
        [Array.from(dids)]
      );

      for (const row of queryResult.rows) {
        // Construct avatar URL from PDS URL and blob CID
        let avatarUrl: string | undefined;
        if (row.avatar_blob_cid && row.pds_url) {
          avatarUrl = `${row.pds_url}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(row.did)}&cid=${row.avatar_blob_cid}`;
        }

        result.set(row.did, {
          handle: row.handle ?? undefined,
          displayName: row.display_name ?? undefined,
          avatar: avatarUrl,
        });
      }

      // For DIDs not found in authors_index OR without avatars, fetch from Bluesky public API
      const didsNeedingProfiles = Array.from(dids).filter((did) => {
        const info = result.get(did);
        return !info?.avatar;
      });
      if (didsNeedingProfiles.length > 0) {
        await this.fetchBlueskyProfiles(didsNeedingProfiles, result);
      }
    } catch (error) {
      this.logger.warn('Failed to lookup author info', { error, didCount: dids.size });
    }

    return result;
  }

  /**
   * Fetches profiles from Bluesky public API for DIDs not in authors_index.
   *
   * @param dids - DIDs to fetch profiles for
   * @param result - Map to populate with results
   *
   * @internal
   */
  private async fetchBlueskyProfiles(
    dids: string[],
    result: Map<string, { handle?: string; displayName?: string; avatar?: string }>
  ): Promise<void> {
    // Batch fetch up to 25 profiles at a time (API limit)
    const batchSize = 25;
    for (let i = 0; i < dids.length; i += batchSize) {
      const batch = dids.slice(i, i + batchSize);
      try {
        const params = new URLSearchParams();
        for (const did of batch) {
          params.append('actors', did);
        }
        const response = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${params.toString()}`,
          {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as {
            profiles: {
              did: string;
              handle: string;
              displayName?: string;
              avatar?: string;
            }[];
          };
          for (const profile of data.profiles) {
            result.set(profile.did, {
              handle: profile.handle,
              displayName: profile.displayName,
              avatar: profile.avatar,
            });
          }
        }
      } catch (error) {
        this.logger.debug('Failed to fetch Bluesky profiles', {
          error: error instanceof Error ? error.message : String(error),
          batchSize: batch.length,
        });
      }
    }
  }

  /**
   * Soft-deletes a review by setting the deleted_at timestamp.
   *
   * @remarks
   * Instead of removing the review from the database, this marks it as deleted.
   * Deleted reviews with replies are kept to preserve thread structure, displayed
   * as tombstones with "This comment has been deleted" placeholder text.
   *
   * @param uri - AT-URI of the review to delete
   * @param source - Source of the deletion ('firehose_tombstone' | 'admin' | 'pds_404')
   * @returns Result indicating success or failure
   *
   * @public
   */
  async softDeleteReview(
    uri: AtUri,
    source: 'firehose_tombstone' | 'admin' | 'pds_404' = 'firehose_tombstone'
  ): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query(
        `UPDATE reviews_index
         SET deleted_at = NOW(),
             deletion_source = $2
         WHERE uri = $1`,
        [uri, source]
      );

      this.logger.info('Soft-deleted review', { uri, source });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'UPDATE',
        `Failed to soft-delete review: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to soft-delete review', dbError, { uri });
      return Err(dbError);
    }
  }

  /**
   * Checks if a review has replies.
   *
   * @param uri - AT-URI of the review
   * @returns True if the review has replies
   *
   * @public
   */
  async hasReplies(uri: AtUri): Promise<boolean> {
    try {
      const result = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM reviews_index
         WHERE parent_comment = $1
           AND deleted_at IS NULL`,
        [uri]
      );
      return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
    } catch (error) {
      this.logger.error('Failed to check for replies', error instanceof Error ? error : undefined, {
        uri,
      });
      return false;
    }
  }

  /**
   * Soft-deletes an endorsement by setting the deleted_at timestamp.
   *
   * @param uri - AT-URI of the endorsement to delete
   * @param source - Source of the deletion ('firehose_tombstone' | 'admin' | 'pds_404')
   * @returns Result indicating success or failure
   *
   * @public
   */
  async softDeleteEndorsement(
    uri: AtUri,
    source: 'firehose_tombstone' | 'admin' | 'pds_404' = 'firehose_tombstone'
  ): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query(
        `UPDATE endorsements_index
         SET deleted_at = NOW(),
             deletion_source = $2
         WHERE uri = $1`,
        [uri, source]
      );

      this.logger.info('Soft-deleted endorsement', { uri, source });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'UPDATE',
        `Failed to soft-delete endorsement: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to soft-delete endorsement', dbError, { uri });
      return Err(dbError);
    }
  }
}
