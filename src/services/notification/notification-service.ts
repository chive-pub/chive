/**
 * Notification service for pull-based notification queries.
 *
 * @remarks
 * Notifications in Chive are not stored; they are computed on demand from
 * indexed records. This service answers two questions for an authenticated
 * user: who follows them, and which of their eprints other people have added
 * to a collection.
 *
 * **ATProto Compliance:**
 * - Reads only from local indexes built from the firehose
 * - Never writes to user PDSes
 * - Every result is rebuildable from the firehose
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { AtUri, DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Pagination options for notification queries.
 *
 * @public
 */
export interface NotificationPaginationOptions {
  /** Maximum number of notifications to return (capped at 100). */
  readonly limit?: number;
  /** Keyset cursor of the form `{ISO timestamp}::{AT-URI}`. */
  readonly cursor?: string;
}

/**
 * A page of notifications with its continuation cursor.
 *
 * @typeParam T - notification shape carried by the page
 *
 * @public
 */
export interface NotificationPage<T> {
  /** Notifications in the page, newest first. */
  readonly items: readonly T[];
  /** Cursor for the next page, absent when the page is the last one. */
  readonly cursor?: string;
  /** Whether more notifications follow this page. */
  readonly hasMore: boolean;
}

/**
 * Someone who follows the authenticated user.
 *
 * @remarks
 * A follow is an ordinary collection in the follower's own repository whose
 * metadata carries the followed person's DID.
 *
 * @public
 */
export interface FollowerNotification {
  /** AT-URI of the follower's collection holding the subscription. */
  readonly collectionUri: AtUri;
  /** Label of that collection. */
  readonly collectionLabel: string;
  /** DID of the follower. */
  readonly followerDid: DID;
  /** Handle of the follower, when the index knows one. */
  readonly followerHandle?: string;
  /** Display name of the follower, when the index knows one. */
  readonly followerDisplayName?: string;
  /** Activity types the follower subscribed to. */
  readonly activityTypes?: readonly string[];
  /** When the follower created the collection. */
  readonly createdAt: Date;
}

/**
 * One of the authenticated user's eprints added to somebody else's collection.
 *
 * @public
 */
export interface CollectionAddNotification {
  /** AT-URI of the edge that added the eprint to the collection. */
  readonly uri: AtUri;
  /** DID of the person who added the eprint. */
  readonly actorDid: DID;
  /** Handle of that person, when the index knows one. */
  readonly actorHandle?: string;
  /** Display name of that person, when the index knows one. */
  readonly actorDisplayName?: string;
  /** AT-URI of the collection the eprint was added to. */
  readonly collectionUri: AtUri;
  /** Label of that collection. */
  readonly collectionLabel?: string;
  /** AT-URI of the eprint. */
  readonly eprintUri: AtUri;
  /** Title of the eprint. */
  readonly eprintTitle: string;
  /** When the eprint was added. */
  readonly createdAt: Date;
}

/**
 * Constructor options for {@link NotificationService}.
 *
 * @public
 */
export interface NotificationServiceOptions {
  /** PostgreSQL connection pool. */
  readonly pool: Pool;
  /** Logger instance. */
  readonly logger: ILogger;
}

/** Largest page a caller may request. */
const MAX_LIMIT = 100;

/** Page size used when a caller does not ask for one. */
const DEFAULT_LIMIT = 25;

/**
 * Splits a keyset cursor into its timestamp and URI halves.
 *
 * @param cursor - cursor of the form `{ISO timestamp}::{AT-URI}`
 * @returns the parsed pair, or null when the cursor is unusable
 *
 * @internal
 */
function parseCursor(cursor: string): { timestamp: Date; uri: string } | null {
  const separator = cursor.indexOf('::');
  if (separator === -1) return null;

  const timestamp = new Date(cursor.slice(0, separator));
  const uri = cursor.slice(separator + 2);
  if (Number.isNaN(timestamp.getTime()) || uri === '') return null;

  return { timestamp, uri };
}

/**
 * Builds the cursor pointing just past the last row of a page.
 *
 * @param createdAt - timestamp of the last row
 * @param uri - URI of the last row
 * @returns the cursor string
 *
 * @internal
 */
function buildCursor(createdAt: Date, uri: string): string {
  return `${createdAt.toISOString()}::${uri}`;
}

/**
 * Computes notifications for an authenticated user from indexed records.
 *
 * @example
 * ```typescript
 * const service = new NotificationService({ pool, logger });
 * const page = await service.listFollowers('did:plc:abc123' as DID, { limit: 25 });
 * for (const follower of page.items) {
 *   console.log(`${follower.followerDid} follows you`);
 * }
 * ```
 *
 * @public
 */
export class NotificationService {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  /**
   * Creates a notification service.
   *
   * @param options - pool and logger dependencies
   */
  constructor(options: NotificationServiceOptions) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  /**
   * Lists the people who follow the given user, newest follow first.
   *
   * @param did - DID of the followed user
   * @param options - pagination options
   * @returns a page of follower notifications; an empty page when the query fails
   *
   * @remarks
   * A follow is a collection in the follower's own repository whose
   * `metadata.subscriptionDid` names the followed user. Collections the user
   * owns themselves are excluded, so following yourself notifies nobody.
   *
   * @public
   */
  async listFollowers(
    did: DID,
    options: NotificationPaginationOptions = {}
  ): Promise<NotificationPage<FollowerNotification>> {
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    try {
      const params: unknown[] = [did];
      let sql = `
        SELECT
          c.uri,
          c.owner_did,
          c.label,
          c.metadata->'activityTypes' AS activity_types,
          c.created_at,
          a.handle,
          a.display_name
        FROM collections_index c
        LEFT JOIN authors_index a ON a.did = c.owner_did
        WHERE c.metadata->>'subscriptionDid' = $1
          AND c.owner_did <> $1`;

      const cursor = options.cursor ? parseCursor(options.cursor) : null;
      if (cursor) {
        sql += ` AND (c.created_at, c.uri) < ($${params.length + 1}, $${params.length + 2})`;
        params.push(cursor.timestamp, cursor.uri);
      }

      sql += ` ORDER BY c.created_at DESC, c.uri DESC LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await this.pool.query<{
        uri: string;
        owner_did: string;
        label: string;
        activity_types: string[] | null;
        created_at: Date;
        handle: string | null;
        display_name: string | null;
      }>(sql, params);

      const hasMore = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      const lastRow = rows[rows.length - 1];

      return {
        items: rows.map((row) => ({
          collectionUri: row.uri as AtUri,
          collectionLabel: row.label,
          followerDid: row.owner_did as DID,
          ...(row.handle !== null ? { followerHandle: row.handle } : {}),
          ...(row.display_name !== null ? { followerDisplayName: row.display_name } : {}),
          ...(Array.isArray(row.activity_types) ? { activityTypes: row.activity_types } : {}),
          createdAt: new Date(row.created_at),
        })),
        ...(hasMore && lastRow
          ? { cursor: buildCursor(new Date(lastRow.created_at), lastRow.uri) }
          : {}),
        hasMore,
      };
    } catch (error) {
      this.logger.error('Failed to list followers', error instanceof Error ? error : undefined, {
        did,
      });
      return { items: [], hasMore: false };
    }
  }

  /**
   * Lists the user's eprints that other people added to their collections.
   *
   * @param did - DID of the eprint author
   * @param options - pagination options
   * @returns a page of collection-add notifications; an empty page when the query fails
   *
   * @remarks
   * A collection item is a personal graph node with `subkind = 'eprint'` whose
   * `metadata.eprintUri` names the eprint, joined to its collection by a
   * `contains` edge. The eprint must still be present and undeleted in
   * `eprints_index` with the user among its authors, so an item pointing at a
   * withdrawn or re-created record notifies nobody. Edges the user owns
   * themselves are excluded.
   *
   * @public
   */
  async listCollectionAdds(
    did: DID,
    options: NotificationPaginationOptions = {}
  ): Promise<NotificationPage<CollectionAddNotification>> {
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    try {
      const params: unknown[] = [did];
      let sql = `
        SELECT
          ce.uri,
          ce.owner_did,
          ce.source_uri,
          COALESCE(c.label, cn.label) AS collection_label,
          n.metadata->>'eprintUri' AS eprint_uri,
          e.title AS eprint_title,
          ce.created_at,
          a.handle,
          a.display_name
        FROM collection_edges_index ce
        JOIN personal_graph_nodes_index n
          ON n.uri = ce.target_uri AND n.subkind = 'eprint'
        JOIN eprints_index e
          ON e.uri = n.metadata->>'eprintUri' AND e.deleted_at IS NULL
        LEFT JOIN collections_index c ON c.uri = ce.source_uri
        LEFT JOIN personal_graph_nodes_index cn ON cn.uri = ce.source_uri
        LEFT JOIN authors_index a ON a.did = ce.owner_did
        WHERE ce.relation_slug = 'contains'
          AND ce.owner_did <> $1
          AND e.authors @> jsonb_build_array(jsonb_build_object('did', $1::text))`;

      const cursor = options.cursor ? parseCursor(options.cursor) : null;
      if (cursor) {
        sql += ` AND (ce.created_at, ce.uri) < ($${params.length + 1}, $${params.length + 2})`;
        params.push(cursor.timestamp, cursor.uri);
      }

      sql += ` ORDER BY ce.created_at DESC, ce.uri DESC LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await this.pool.query<{
        uri: string;
        owner_did: string;
        source_uri: string;
        collection_label: string | null;
        eprint_uri: string;
        eprint_title: string;
        created_at: Date;
        handle: string | null;
        display_name: string | null;
      }>(sql, params);

      const hasMore = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      const lastRow = rows[rows.length - 1];

      return {
        items: rows.map((row) => ({
          uri: row.uri as AtUri,
          actorDid: row.owner_did as DID,
          ...(row.handle !== null ? { actorHandle: row.handle } : {}),
          ...(row.display_name !== null ? { actorDisplayName: row.display_name } : {}),
          collectionUri: row.source_uri as AtUri,
          ...(row.collection_label !== null ? { collectionLabel: row.collection_label } : {}),
          eprintUri: row.eprint_uri as AtUri,
          eprintTitle: row.eprint_title,
          createdAt: new Date(row.created_at),
        })),
        ...(hasMore && lastRow
          ? { cursor: buildCursor(new Date(lastRow.created_at), lastRow.uri) }
          : {}),
        hasMore,
      };
    } catch (error) {
      this.logger.error(
        'Failed to list collection adds',
        error instanceof Error ? error : undefined,
        { did }
      );
      return { items: [], hasMore: false };
    }
  }
}
