/**
 * Annotation service for inline text annotations and entity links.
 *
 * @remarks
 * Indexes annotation comments and entity links from the firehose,
 * builds threaded annotation trees, and queries by eprint, page, or author.
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { Err, Ok, type Result } from '../../types/result.js';
import type { RecordMetadata } from '../eprint/eprint-service.js';

/**
 * Extracts DID from AT URI.
 *
 * @param uri - AT URI in format at://did:xxx/collection/rkey
 * @returns DID portion of the URI
 *
 * @internal
 */
function extractDidFromUri(uri: AtUri): DID {
  const parts = uri.split('/');
  return parts[2] as DID;
}

/**
 * Validates that an unknown record matches the pub.chive.annotation.comment schema.
 *
 * @param record - Record to validate
 * @returns True if record has required annotation comment fields
 *
 * @internal
 */
function isAnnotationComment(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.eprintUri === 'string' &&
    r.target != null &&
    Array.isArray(r.body) &&
    typeof r.createdAt === 'string'
  );
}

/**
 * Validates that an unknown record matches the pub.chive.annotation.entityLink schema.
 *
 * @param record - Record to validate
 * @returns True if record has required entity link fields
 *
 * @internal
 */
function isEntityLinkRecord(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.eprintUri === 'string' &&
    r.target != null &&
    r.linkedEntity != null &&
    typeof r.createdAt === 'string'
  );
}

/**
 * Extracts plain text from the body array by concatenating text items.
 *
 * @param body - Body array from annotation record
 * @returns Concatenated plain text content
 *
 * @internal
 */
function extractPlainText(body: unknown): string {
  if (!Array.isArray(body)) return '';
  const parts: string[] = [];
  for (const item of body) {
    if (item && typeof item === 'object' && 'content' in item) {
      const content = (item as Record<string, unknown>).content;
      if (typeof content === 'string') {
        parts.push(content);
      }
    }
  }
  return parts.join('');
}

/**
 * Target selector for text annotations (W3C Web Annotation model).
 *
 * @public
 */
export interface AnnotationSelector {
  readonly type: string;
  readonly exact?: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly start?: number;
  readonly end?: number;
}

/**
 * Refinement for annotation target (page, position, bounding rectangle).
 *
 * @public
 */
export interface AnnotationRefinement {
  readonly type: string;
  readonly pageNumber?: number;
  readonly start?: number;
  readonly end?: number;
  readonly boundingRect?: unknown;
}

/**
 * Annotation target describing where in the document the annotation is anchored.
 *
 * @public
 */
export interface AnnotationTarget {
  readonly source: string;
  readonly selector?: AnnotationSelector;
  readonly refinedBy?: AnnotationRefinement;
  readonly pageNumber?: number;
}

/**
 * Annotation view for display.
 *
 * @public
 */
export interface AnnotationView {
  readonly uri: AtUri;
  readonly cid: string;
  readonly annotator: DID;
  readonly eprintUri: AtUri;
  readonly target: AnnotationTarget;
  readonly body?: readonly unknown[];
  readonly content: string;
  readonly facets?: readonly unknown[];
  readonly motivation: string;
  readonly parentAnnotation?: AtUri;
  readonly replyCount: number;
  readonly createdAt: Date;
  readonly indexedAt: Date;
  readonly deleted: boolean;
}

/**
 * Entity link view for display.
 *
 * @public
 */
export interface EntityLinkView {
  readonly uri: AtUri;
  readonly cid: string;
  readonly creator: DID;
  readonly eprintUri: AtUri;
  readonly target: AnnotationTarget;
  readonly entityType: string;
  readonly entityData: unknown;
  readonly entityLabel: string;
  readonly confidence?: number;
  readonly createdAt: Date;
  readonly indexedAt: Date;
}

/**
 * Annotation thread node for nested replies.
 *
 * @public
 */
export interface AnnotationThread {
  readonly root: AnnotationView;
  readonly replies: readonly AnnotationThread[];
  readonly totalReplies: number;
}

/**
 * Pagination options for annotation queries.
 *
 * @public
 */
export interface AnnotationPaginationOptions {
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Paginated result for annotation queries.
 *
 * @public
 */
export interface PaginatedAnnotationResult<T> {
  readonly items: readonly T[];
  readonly cursor?: string;
  readonly hasMore: boolean;
  readonly total: number;
}

/**
 * Filter options for annotation queries.
 *
 * @public
 */
export interface AnnotationFilterOptions {
  readonly pageNumber?: number;
  readonly motivation?: string;
}

/**
 * Annotation service configuration.
 *
 * @public
 */
export interface AnnotationServiceOptions {
  readonly pool: Pool;
  readonly logger: ILogger;
}

/**
 * Annotation service for indexing and querying inline text annotations and entity links.
 *
 * @example
 * ```typescript
 * const service = new AnnotationService({ pool, logger });
 *
 * // Index annotation from firehose
 * await service.indexAnnotation(record, metadata);
 *
 * // Get threaded annotations for an eprint
 * const threads = await service.getAnnotations(eprintUri);
 * ```
 *
 * @public
 */
export class AnnotationService {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  constructor(options: AnnotationServiceOptions) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  /**
   * Indexes an annotation comment from the firehose.
   *
   * @param record - Annotation comment record (unknown, validated internally)
   * @param metadata - Record metadata from the firehose event
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexAnnotation(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    if (!isAnnotationComment(record)) {
      const validationError = new ValidationError(
        'Record does not match pub.chive.annotation.comment schema',
        'record',
        'schema'
      );
      this.logger.warn('Invalid annotation comment record', { uri: metadata.uri });
      return Err(validationError);
    }

    const r = record as Record<string, unknown>;

    try {
      const body = JSON.stringify(r.body);

      // Extract facets from body items
      const facets: unknown[] = [];
      if (Array.isArray(r.body)) {
        for (const item of r.body as Record<string, unknown>[]) {
          if (item && typeof item === 'object' && 'facets' in item && Array.isArray(item.facets)) {
            facets.push(...(item.facets as unknown[]));
          }
        }
      }
      const facetsJson = facets.length > 0 ? JSON.stringify(facets) : null;

      // Build anchor from target
      const target = r.target as Record<string, unknown> | null;
      const anchor = target
        ? JSON.stringify({
            source: (target.versionUri as string | undefined) ?? (r.eprintUri as string),
            selector: target.selector,
            refinedBy: target.refinedBy,
            pageNumber:
              (target.refinedBy as Record<string, unknown> | undefined)?.pageNumber ??
              (target.selector &&
              typeof target.selector === 'object' &&
              '$type' in (target.selector as Record<string, unknown>) &&
              (target.selector as Record<string, unknown>).$type ===
                'pub.chive.annotation.comment#fragmentSelector'
                ? parseInt(
                    ((target.selector as Record<string, unknown>).value as string) ?? '0',
                    10
                  )
                : undefined),
          })
        : null;

      // Extract page number for indexed filtering
      const pageNumber =
        (target?.refinedBy as Record<string, unknown> | undefined)?.pageNumber ?? null;

      // Get motivation with fallback
      const motivation = (r.motivationFallback as string | undefined) ?? 'commenting';

      await this.pool.query(
        `INSERT INTO annotations_index (
          uri, cid, eprint_uri, annotator_did, body, parent_annotation,
          anchor, page_number, motivation, facets,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          body = EXCLUDED.body,
          anchor = EXCLUDED.anchor,
          page_number = EXCLUDED.page_number,
          motivation = EXCLUDED.motivation,
          facets = EXCLUDED.facets,
          updated_at = NOW(),
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          r.eprintUri as string,
          extractDidFromUri(metadata.uri),
          body,
          (r.parentAnnotation as string | undefined) ?? null,
          anchor,
          pageNumber,
          motivation,
          facetsJson,
          new Date(r.createdAt as string),
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed annotation', {
        uri: metadata.uri,
        eprintUri: r.eprintUri as string,
        hasParent: !!(r.parentAnnotation as string | undefined),
        pageNumber,
      });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index annotation: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index annotation', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Indexes an entity link from the firehose.
   *
   * @param record - Entity link record (unknown, validated internally)
   * @param metadata - Record metadata from the firehose event
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexEntityLink(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    if (!isEntityLinkRecord(record)) {
      const validationError = new ValidationError(
        'Record does not match pub.chive.annotation.entityLink schema',
        'record',
        'schema'
      );
      this.logger.warn('Invalid entity link record', { uri: metadata.uri });
      return Err(validationError);
    }

    const r = record as Record<string, unknown>;

    try {
      const target = r.target as Record<string, unknown> | null;
      const anchor = target ? JSON.stringify(target) : null;

      const pageNumber =
        (target?.refinedBy as Record<string, unknown> | undefined)?.pageNumber ?? null;

      const linkedEntity = r.linkedEntity as Record<string, unknown>;
      const entityType = (linkedEntity.type as string | undefined) ?? 'unknown';
      const entityData = JSON.stringify(linkedEntity.data ?? linkedEntity);
      const entityLabel = (linkedEntity.label as string | undefined) ?? '';
      const confidence = r.confidence as number | undefined;

      await this.pool.query(
        `INSERT INTO entity_links_index (
          uri, cid, eprint_uri, creator_did, anchor, page_number,
          entity_type, entity_data, entity_label, confidence,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          anchor = EXCLUDED.anchor,
          page_number = EXCLUDED.page_number,
          entity_type = EXCLUDED.entity_type,
          entity_data = EXCLUDED.entity_data,
          entity_label = EXCLUDED.entity_label,
          confidence = EXCLUDED.confidence,
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          r.eprintUri as string,
          extractDidFromUri(metadata.uri),
          anchor,
          pageNumber,
          entityType,
          entityData,
          entityLabel,
          confidence ?? null,
          new Date(r.createdAt as string),
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed entity link', {
        uri: metadata.uri,
        eprintUri: r.eprintUri as string,
        entityType,
        entityLabel,
      });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index entity link: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index entity link', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Gets threaded annotations for an eprint with optional filtering.
   *
   * @param eprintUri - Eprint URI to query annotations for
   * @param opts - Optional filters for page number and motivation
   * @returns Annotation threads ordered by page number, then creation time
   *
   * @remarks
   * Includes soft-deleted annotations if they have replies to preserve thread structure.
   * Deleted annotations are marked with `deleted: true` and have empty content.
   *
   * @public
   */
  async getAnnotations(
    eprintUri: AtUri,
    opts?: AnnotationFilterOptions
  ): Promise<readonly AnnotationThread[]> {
    try {
      let query = `SELECT a.uri, a.cid, a.annotator_did, a.eprint_uri,
              CASE WHEN a.deleted_at IS NOT NULL THEN NULL ELSE a.body END as body,
              CASE WHEN a.deleted_at IS NOT NULL THEN NULL ELSE a.facets END as facets,
              a.parent_annotation, a.created_at, a.indexed_at,
              a.anchor, a.page_number, a.motivation, a.deleted_at
       FROM annotations_index a
       WHERE a.eprint_uri = $1
         AND (a.deleted_at IS NULL OR EXISTS (
           SELECT 1 FROM annotations_index a2
           WHERE a2.parent_annotation = a.uri
             AND a2.deleted_at IS NULL
         ))`;

      const params: unknown[] = [eprintUri];

      if (opts?.pageNumber != null) {
        params.push(opts.pageNumber);
        query += ` AND a.page_number = $${params.length}`;
      }

      if (opts?.motivation) {
        params.push(opts.motivation);
        query += ` AND a.motivation = $${params.length}`;
      }

      query += ` ORDER BY a.page_number ASC NULLS LAST, a.created_at ASC`;

      const result = await this.pool.query<{
        uri: string;
        cid: string;
        annotator_did: string;
        eprint_uri: string;
        body: unknown[] | null;
        facets: unknown[] | null;
        parent_annotation: string | null;
        created_at: Date;
        indexed_at: Date;
        anchor: Record<string, unknown> | null;
        page_number: number | null;
        motivation: string | null;
        deleted_at: Date | null;
      }>(query, params);

      // Build view map and count replies
      const viewMap = new Map<string, AnnotationView & { parentUri?: string }>();
      const replyCounts = new Map<string, number>();

      for (const row of result.rows) {
        if (row.parent_annotation && !row.deleted_at) {
          replyCounts.set(row.parent_annotation, (replyCounts.get(row.parent_annotation) ?? 0) + 1);
        }
      }

      for (const row of result.rows) {
        const anchor = row.anchor;
        const view: AnnotationView & { parentUri?: string } = {
          uri: row.uri as AtUri,
          cid: row.cid,
          annotator: row.annotator_did as DID,
          eprintUri: row.eprint_uri as AtUri,
          target: {
            source: (anchor?.source as string) ?? row.eprint_uri,
            selector: anchor?.selector as AnnotationSelector | undefined,
            refinedBy: anchor?.refinedBy as AnnotationRefinement | undefined,
            pageNumber: (anchor?.pageNumber as number) ?? row.page_number ?? undefined,
          },
          body: row.body ?? undefined,
          content: row.deleted_at ? '' : extractPlainText(row.body),
          facets: row.facets ?? undefined,
          motivation: row.motivation ?? 'commenting',
          parentAnnotation: (row.parent_annotation as AtUri) ?? undefined,
          replyCount: replyCounts.get(row.uri) ?? 0,
          createdAt: new Date(row.created_at),
          indexedAt: new Date(row.indexed_at),
          deleted: !!row.deleted_at,
          parentUri: row.parent_annotation ?? undefined,
        };
        viewMap.set(row.uri, view);
      }

      // Build thread tree
      const buildThread = (annotationUri: string): AnnotationThread => {
        const annotation = viewMap.get(annotationUri);
        if (!annotation) {
          throw new DatabaseError('READ', `Annotation not found in map: ${annotationUri}`);
        }
        const replies: AnnotationThread[] = [];

        for (const [uri, a] of viewMap) {
          if (a.parentUri === annotationUri) {
            replies.push(buildThread(uri));
          }
        }

        const countReplies = (threads: readonly AnnotationThread[]): number => {
          let count = threads.length;
          for (const thread of threads) {
            count += countReplies(thread.replies);
          }
          return count;
        };

        return {
          root: {
            uri: annotation.uri,
            cid: annotation.cid,
            annotator: annotation.annotator,
            eprintUri: annotation.eprintUri,
            target: annotation.target,
            body: annotation.body,
            content: annotation.content,
            facets: annotation.facets,
            motivation: annotation.motivation,
            parentAnnotation: annotation.parentAnnotation,
            replyCount: annotation.replyCount,
            createdAt: annotation.createdAt,
            indexedAt: annotation.indexedAt,
            deleted: annotation.deleted,
          },
          replies,
          totalReplies: countReplies(replies),
        };
      };

      const threads: AnnotationThread[] = [];
      for (const [uri, annotation] of viewMap) {
        if (!annotation.parentUri) {
          threads.push(buildThread(uri));
        }
      }

      return threads;
    } catch (error) {
      this.logger.error('Failed to get annotations', error instanceof Error ? error : undefined, {
        eprintUri,
      });
      return [];
    }
  }

  /**
   * Gets annotations for a specific page of an eprint.
   *
   * @param eprintUri - Eprint URI to query
   * @param pageNumber - Page number to filter by
   * @returns Annotation threads for the specified page
   *
   * @public
   */
  async getAnnotationsForPage(
    eprintUri: AtUri,
    pageNumber: number
  ): Promise<readonly AnnotationThread[]> {
    return this.getAnnotations(eprintUri, { pageNumber });
  }

  /**
   * Gets entity links for an eprint with optional page filtering.
   *
   * @param eprintUri - Eprint URI to query
   * @param opts - Optional filter for page number
   * @returns Entity link views ordered by creation time
   *
   * @public
   */
  async getEntityLinks(
    eprintUri: AtUri,
    opts?: { pageNumber?: number }
  ): Promise<readonly EntityLinkView[]> {
    try {
      let query = `SELECT uri, cid, creator_did, eprint_uri, anchor, page_number,
              entity_type, entity_data, entity_label, confidence,
              created_at, indexed_at
       FROM entity_links_index
       WHERE eprint_uri = $1 AND deleted_at IS NULL`;

      const params: unknown[] = [eprintUri];

      if (opts?.pageNumber != null) {
        params.push(opts.pageNumber);
        query += ` AND page_number = $${params.length}`;
      }

      query += ` ORDER BY created_at ASC`;

      const result = await this.pool.query<{
        uri: string;
        cid: string;
        creator_did: string;
        eprint_uri: string;
        anchor: Record<string, unknown> | null;
        page_number: number | null;
        entity_type: string;
        entity_data: unknown;
        entity_label: string;
        confidence: number | null;
        created_at: Date;
        indexed_at: Date;
      }>(query, params);

      return result.rows.map((row) => {
        const anchor = row.anchor;
        return {
          uri: row.uri as AtUri,
          cid: row.cid,
          creator: row.creator_did as DID,
          eprintUri: row.eprint_uri as AtUri,
          target: {
            source: (anchor?.source as string) ?? row.eprint_uri,
            selector: anchor?.selector as AnnotationSelector | undefined,
            refinedBy: anchor?.refinedBy as AnnotationRefinement | undefined,
            pageNumber: (anchor?.pageNumber as number) ?? row.page_number ?? undefined,
          },
          entityType: row.entity_type,
          entityData: row.entity_data,
          entityLabel: row.entity_label,
          confidence: row.confidence ?? undefined,
          createdAt: new Date(row.created_at),
          indexedAt: new Date(row.indexed_at),
        };
      });
    } catch (error) {
      this.logger.error('Failed to get entity links', error instanceof Error ? error : undefined, {
        eprintUri,
      });
      return [];
    }
  }

  /**
   * Gets an annotation thread using recursive CTE.
   *
   * @param rootUri - URI of the root annotation
   * @param maxDepth - Maximum depth of replies (default: 10)
   * @returns Flat list of annotation views in the thread, ordered by depth then creation time
   *
   * @public
   */
  async getAnnotationThread(rootUri: AtUri, maxDepth = 10): Promise<AnnotationView[]> {
    try {
      const result = await this.pool.query<{
        uri: string;
        cid: string;
        annotator_did: string;
        eprint_uri: string;
        body: unknown[] | null;
        facets: unknown[] | null;
        parent_annotation: string | null;
        created_at: Date;
        indexed_at: Date;
        anchor: Record<string, unknown> | null;
        page_number: number | null;
        motivation: string | null;
        deleted_at: Date | null;
        depth: number;
      }>(
        `WITH RECURSIVE thread AS (
           SELECT uri, cid, annotator_did, eprint_uri, body, facets,
                  parent_annotation, created_at, indexed_at,
                  anchor, page_number, motivation, deleted_at, 0 AS depth
           FROM annotations_index
           WHERE uri = $1

           UNION ALL

           SELECT a.uri, a.cid, a.annotator_did, a.eprint_uri, a.body, a.facets,
                  a.parent_annotation, a.created_at, a.indexed_at,
                  a.anchor, a.page_number, a.motivation, a.deleted_at, t.depth + 1
           FROM annotations_index a
           INNER JOIN thread t ON a.parent_annotation = t.uri
           WHERE t.depth < $2
         )
         SELECT uri, cid, annotator_did, eprint_uri, body, facets,
                parent_annotation, created_at, indexed_at,
                anchor, page_number, motivation, deleted_at, depth
         FROM thread
         ORDER BY depth ASC, created_at ASC`,
        [rootUri, maxDepth]
      );

      // Get reply counts for all annotations in thread
      const uris = result.rows.map((r) => r.uri);
      const replyCountResult =
        uris.length > 0
          ? await this.pool.query<{ parent_uri: string; count: string }>(
              `SELECT parent_annotation as parent_uri, COUNT(*)::text as count
             FROM annotations_index
             WHERE parent_annotation = ANY($1)
             GROUP BY parent_annotation`,
              [uris]
            )
          : { rows: [] };

      const replyCounts = new Map<string, number>();
      for (const row of replyCountResult.rows) {
        replyCounts.set(row.parent_uri, parseInt(row.count, 10));
      }

      return result.rows.map((row) => {
        const anchor = row.anchor;
        return {
          uri: row.uri as AtUri,
          cid: row.cid,
          annotator: row.annotator_did as DID,
          eprintUri: row.eprint_uri as AtUri,
          target: {
            source: (anchor?.source as string) ?? row.eprint_uri,
            selector: anchor?.selector as AnnotationSelector | undefined,
            refinedBy: anchor?.refinedBy as AnnotationRefinement | undefined,
            pageNumber: (anchor?.pageNumber as number) ?? row.page_number ?? undefined,
          },
          body: row.deleted_at ? undefined : (row.body ?? undefined),
          content: row.deleted_at ? '' : extractPlainText(row.body),
          facets: row.deleted_at ? undefined : (row.facets ?? undefined),
          motivation: row.motivation ?? 'commenting',
          parentAnnotation: (row.parent_annotation as AtUri) ?? undefined,
          replyCount: replyCounts.get(row.uri) ?? 0,
          createdAt: new Date(row.created_at),
          indexedAt: new Date(row.indexed_at),
          deleted: !!row.deleted_at,
        };
      });
    } catch (error) {
      this.logger.error(
        'Failed to get annotation thread',
        error instanceof Error ? error : undefined,
        { rootUri }
      );
      return [];
    }
  }

  /**
   * Lists annotations by a specific author with pagination.
   *
   * @param did - DID of the annotator
   * @param opts - Pagination options (limit, cursor)
   * @returns Paginated list of annotations by the author
   *
   * @public
   */
  async listAnnotationsByAuthor(
    did: DID,
    opts: AnnotationPaginationOptions = {}
  ): Promise<PaginatedAnnotationResult<AnnotationView>> {
    const limit = Math.min(opts.limit ?? 50, 100);
    const offset = opts.cursor ? parseInt(opts.cursor, 10) : 0;

    try {
      const countResult = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM annotations_index WHERE annotator_did = $1 AND deleted_at IS NULL',
        [did]
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      const result = await this.pool.query<{
        uri: string;
        cid: string;
        annotator_did: string;
        eprint_uri: string;
        body: unknown[] | null;
        facets: unknown[] | null;
        parent_annotation: string | null;
        created_at: Date;
        indexed_at: Date;
        anchor: Record<string, unknown> | null;
        page_number: number | null;
        motivation: string | null;
        reply_count: number;
      }>(
        `SELECT a.uri, a.cid, a.annotator_did, a.eprint_uri, a.body, a.facets,
                a.parent_annotation, a.created_at, a.indexed_at,
                a.anchor, a.page_number, a.motivation,
                COALESCE((SELECT COUNT(*) FROM annotations_index a2 WHERE a2.parent_annotation = a.uri), 0)::int as reply_count
         FROM annotations_index a
         WHERE a.annotator_did = $1 AND a.deleted_at IS NULL
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [did, limit, offset]
      );

      const items: AnnotationView[] = result.rows.map((row) => {
        const anchor = row.anchor;
        return {
          uri: row.uri as AtUri,
          cid: row.cid,
          annotator: row.annotator_did as DID,
          eprintUri: row.eprint_uri as AtUri,
          target: {
            source: (anchor?.source as string) ?? row.eprint_uri,
            selector: anchor?.selector as AnnotationSelector | undefined,
            refinedBy: anchor?.refinedBy as AnnotationRefinement | undefined,
            pageNumber: (anchor?.pageNumber as number) ?? row.page_number ?? undefined,
          },
          body: row.body ?? undefined,
          content: extractPlainText(row.body),
          facets: row.facets ?? undefined,
          motivation: row.motivation ?? 'commenting',
          parentAnnotation: (row.parent_annotation as AtUri) ?? undefined,
          replyCount: row.reply_count,
          createdAt: new Date(row.created_at),
          indexedAt: new Date(row.created_at),
          deleted: false,
        };
      });

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
        'Failed to list annotations by author',
        error instanceof Error ? error : undefined,
        { did }
      );
      return { items: [], cursor: undefined, hasMore: false, total: 0 };
    }
  }

  /**
   * Soft-deletes an annotation by setting the deleted_at timestamp.
   *
   * @param uri - AT-URI of the annotation to delete
   * @param source - Source of the deletion
   * @returns Result indicating success or failure
   *
   * @remarks
   * Deleted annotations with replies are kept to preserve thread structure.
   *
   * @public
   */
  async softDeleteAnnotation(
    uri: AtUri,
    source: 'firehose_tombstone' | 'admin' | 'pds_404' = 'firehose_tombstone'
  ): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query(
        `UPDATE annotations_index
         SET deleted_at = NOW(),
             deletion_source = $2
         WHERE uri = $1`,
        [uri, source]
      );

      this.logger.info('Soft-deleted annotation', { uri, source });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'UPDATE',
        `Failed to soft-delete annotation: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to soft-delete annotation', dbError, { uri });
      return Err(dbError);
    }
  }

  /**
   * Soft-deletes an entity link by setting the deleted_at timestamp.
   *
   * @param uri - AT-URI of the entity link to delete
   * @param source - Source of the deletion
   * @returns Result indicating success or failure
   *
   * @public
   */
  async softDeleteEntityLink(
    uri: AtUri,
    source: 'firehose_tombstone' | 'admin' | 'pds_404' = 'firehose_tombstone'
  ): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query(
        `UPDATE entity_links_index
         SET deleted_at = NOW(),
             deletion_source = $2
         WHERE uri = $1`,
        [uri, source]
      );

      this.logger.info('Soft-deleted entity link', { uri, source });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'UPDATE',
        `Failed to soft-delete entity link: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to soft-delete entity link', dbError, { uri });
      return Err(dbError);
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

      // Fetch from Bluesky public API for DIDs not found or missing avatars
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
   * Fetches profiles from Bluesky public API.
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
}
