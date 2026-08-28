/**
 * XRPC handler for pub.chive.actor.listMutes.
 *
 * @remarks
 * Returns the authenticated user's mutes from `muted_authors_index`, which is
 * built from their own `pub.chive.actor.mute` records on the firehose.
 *
 * Before 0.11.0 there was no such index. The client reads mutes from the PDS
 * directly and always could; what did not exist was any server-side knowledge
 * of them, so a mute could not be applied in a feed, a search or a
 * notification.
 *
 * This endpoint exists for server-side consumers and for clients that want the
 * list without a per-request PDS round trip. The frontend deliberately still
 * reads its own repository: the index lags the firehose by a moment, and a user
 * should not watch their own mute disappear and come back.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  MutedAuthor,
} from '../../../../lexicons/generated/types/pub/chive/actor/listMutes.js';
import type { AtUri, DID } from '../../../../types/atproto.js';
import { AuthenticationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters for pub.chive.actor.listMutes. */
export type ListMutesParams = QueryParams;

/** Re-exported output schema for pub.chive.actor.listMutes. */
export type ListMutesOutput = OutputSchema;

/** Largest page this endpoint will return. */
const MAX_LIMIT = 200;

/**
 * XRPC method for pub.chive.actor.listMutes query.
 *
 * @public
 */
export const listMutes: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    const pool = c.get('pool');
    if (!pool) {
      throw new ServiceUnavailableError('Mute list is not available', 'postgresql');
    }
    const limit = Math.min(params.limit ?? 100, MAX_LIMIT);

    // Keyset pagination on (created_at, uri): a stable pair, unlike an offset,
    // which shifts under the reader when a mute is added mid-page.
    const cursorParts = params.cursor ? params.cursor.split('::') : null;
    const cursorTime = cursorParts?.[0];
    const cursorUri = cursorParts?.[1];

    const conditions = ['muter_did = $1'];
    const values: unknown[] = [user.did];

    if (cursorTime && cursorUri) {
      conditions.push(`(created_at, uri) < ($${values.length + 1}, $${values.length + 2})`);
      values.push(new Date(cursorTime), cursorUri);
    }

    // One extra row tells us whether another page exists without a second query.
    values.push(limit + 1);

    const result = await pool.query<{
      subject_did: string;
      uri: string;
      created_at: Date;
    }>(
      `SELECT subject_did, uri, created_at
         FROM muted_authors_index
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, uri DESC
        LIMIT $${values.length}`,
      values
    );

    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);

    const mutes: MutedAuthor[] = rows.map((row) => ({
      subjectDid: row.subject_did as DID,
      uri: row.uri as AtUri,
      createdAt: row.created_at.toISOString(),
    }));

    const last = rows[rows.length - 1];
    const cursor = hasMore && last ? `${last.created_at.toISOString()}::${last.uri}` : undefined;

    logger.debug('Listed mutes', { did: user.did, count: mutes.length });

    return {
      encoding: 'application/json',
      body: { mutes, ...(cursor ? { cursor } : {}) },
    };
  },
};
