/**
 * Collaboration service: manages invites, acceptances, and derived active-
 * collaborator state for any Chive-authored subject record.
 *
 * @remarks
 * The collaboration model follows Chive's write-authority philosophy:
 * each party writes a record in its own PDS declaring its side of the
 * handshake. The AppView observes both sides from the firehose and
 * computes derived state — mirroring the governance consensus model.
 *
 * Records:
 *
 * - `pub.chive.collaboration.invite` — lives in the subject-record author's
 *   PDS. Owner declares "I invite this DID to collaborate on this record."
 * - `pub.chive.collaboration.inviteAcceptance` — lives in the invitee's
 *   PDS. Invitee declares "I accept this specific invite."
 *
 * Active collaboration exists when both an invite and a matching
 * acceptance are non-deleted. Either party can revoke by deleting their
 * own record; the other party's record remains in their PDS but is no
 * longer surfaced in the derived view.
 *
 * ATProto Compliance:
 * - Read-only AppView: all state is derived from firehose records
 * - Never writes to foreign PDSes
 * - Out-of-order firehose delivery is handled via
 *   `collaboration_pending_state`, so no valid handshake is silently
 *   dropped
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { Err, Ok, type Result } from '../../types/result.js';
import type { RecordMetadata } from '../eprint/eprint-service.js';

/**
 * Options for constructing a `CollaborationService`.
 *
 * @public
 */
export interface CollaborationServiceOptions {
  readonly pool: Pool;
  readonly logger: ILogger;
}

/**
 * A single active collaborator on a subject record.
 *
 * @public
 */
export interface ActiveCollaborator {
  readonly did: DID;
  readonly inviteUri: string;
  readonly acceptanceUri: string;
  readonly role?: string;
  readonly acceptedAt: Date;
}

/**
 * Derived state of an individual invite (from the invitee's perspective).
 *
 * @public
 */
export interface InviteView {
  readonly uri: AtUri;
  readonly inviter: DID;
  readonly invitee: DID;
  readonly subjectUri: AtUri;
  readonly subjectCollection: string;
  readonly role?: string;
  readonly message?: string;
  readonly state: 'pending' | 'accepted' | 'rejected' | 'expired';
  readonly acceptanceUri?: string;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly acceptedAt?: Date;
}

/**
 * Parsed invite record body.
 *
 * @public
 */
export interface InviteRecord {
  subject: { uri: string; cid?: string };
  invitee: string;
  role?: string;
  message?: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * Parsed acceptance record body.
 *
 * @public
 */
export interface AcceptanceRecord {
  invite: { uri: string; cid?: string };
  subject: { uri: string; cid?: string };
  createdAt: string;
}

/**
 * Collaboration service.
 *
 * @public
 */
export class CollaborationService {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  constructor(options: CollaborationServiceOptions) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  /**
   * Indexes an invite record from the firehose.
   */
  async indexInvite(
    record: InviteRecord,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const inviterDid = extractDid(metadata.uri);
      const subjectAuthor = extractDid(record.subject.uri as AtUri);
      const subjectCollection = extractCollection(record.subject.uri as AtUri);

      await this.pool.query(
        `INSERT INTO collaboration_invites_index (
          uri, cid, inviter_did, invitee_did, subject_uri,
          subject_author_did, subject_collection, role, message,
          created_at, expires_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          role = EXCLUDED.role,
          message = EXCLUDED.message,
          expires_at = EXCLUDED.expires_at,
          deleted_at = NULL,
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          inviterDid,
          record.invitee,
          record.subject.uri,
          subjectAuthor,
          subjectCollection,
          record.role ?? null,
          record.message ?? null,
          new Date(record.createdAt),
          record.expiresAt ? new Date(record.expiresAt) : null,
          metadata.pdsUrl,
        ]
      );

      await this.reevaluatePair(record.subject.uri, record.invitee);

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError('WRITE', `Failed to index invite: ${toMessage(error)}`);
      this.logger.error('Failed to index invite', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Marks an invite as deleted (firehose delete event).
   */
  async deleteInvite(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      const result = await this.pool.query<{
        subject_uri: string;
        invitee_did: string;
      }>(
        `UPDATE collaboration_invites_index
         SET deleted_at = NOW()
         WHERE uri = $1
         RETURNING subject_uri, invitee_did`,
        [uri]
      );
      const row = result.rows[0];
      if (row) {
        await this.reevaluatePair(row.subject_uri, row.invitee_did);
      }
      return Ok(undefined);
    } catch (error) {
      return Err(new DatabaseError('DELETE', `Failed to delete invite: ${toMessage(error)}`));
    }
  }

  /**
   * Indexes an acceptance record from the firehose.
   */
  async indexAcceptance(
    record: AcceptanceRecord,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const accepterDid = extractDid(metadata.uri);

      await this.pool.query(
        `INSERT INTO collaboration_acceptances_index (
          uri, cid, accepter_did, invite_uri, subject_uri,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          deleted_at = NULL,
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          accepterDid,
          record.invite.uri,
          record.subject.uri,
          new Date(record.createdAt),
          metadata.pdsUrl,
        ]
      );

      await this.reevaluatePair(record.subject.uri, accepterDid);

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError('WRITE', `Failed to index acceptance: ${toMessage(error)}`);
      this.logger.error('Failed to index acceptance', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Marks an acceptance as deleted (firehose delete event).
   */
  async deleteAcceptance(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      const result = await this.pool.query<{
        subject_uri: string;
        accepter_did: string;
      }>(
        `UPDATE collaboration_acceptances_index
         SET deleted_at = NOW()
         WHERE uri = $1
         RETURNING subject_uri, accepter_did`,
        [uri]
      );
      const row = result.rows[0];
      if (row) {
        await this.reevaluatePair(row.subject_uri, row.accepter_did);
      }
      return Ok(undefined);
    } catch (error) {
      return Err(new DatabaseError('DELETE', `Failed to delete acceptance: ${toMessage(error)}`));
    }
  }

  /**
   * Gets the active collaborators on a subject record.
   *
   * @param subjectUri - AT-URI of the subject record
   * @returns Array of active collaborators (may be empty)
   */
  async getActiveCollaborators(subjectUri: AtUri): Promise<ActiveCollaborator[]> {
    try {
      const result = await this.pool.query<{
        did: string;
        invite_uri: string;
        acceptance_uri: string;
        role: string | null;
        accepted_at: Date;
      }>(
        `SELECT i.invitee_did AS did,
                i.uri AS invite_uri,
                a.uri AS acceptance_uri,
                i.role,
                a.created_at AS accepted_at
         FROM collaboration_invites_index i
         INNER JOIN collaboration_acceptances_index a
           ON a.invite_uri = i.uri
          AND a.accepter_did = i.invitee_did
          AND a.subject_uri = i.subject_uri
         WHERE i.subject_uri = $1
           AND i.deleted_at IS NULL
           AND a.deleted_at IS NULL
           AND (i.expires_at IS NULL OR i.expires_at > NOW())`,
        [subjectUri]
      );

      return result.rows.map((row) => ({
        did: row.did as DID,
        inviteUri: row.invite_uri,
        acceptanceUri: row.acceptance_uri,
        role: row.role ?? undefined,
        acceptedAt: new Date(row.accepted_at),
      }));
    } catch (error) {
      this.logger.error('Failed to get active collaborators', toError(error), { subjectUri });
      return [];
    }
  }

  /**
   * Checks whether a given DID is an active collaborator on a subject.
   */
  async isCollaborator(subjectUri: AtUri, did: DID): Promise<boolean> {
    try {
      const result = await this.pool.query<{ one: number }>(
        `SELECT 1 AS one
         FROM collaboration_invites_index i
         INNER JOIN collaboration_acceptances_index a
           ON a.invite_uri = i.uri
          AND a.accepter_did = i.invitee_did
          AND a.subject_uri = i.subject_uri
         WHERE i.subject_uri = $1
           AND i.invitee_did = $2
           AND i.deleted_at IS NULL
           AND a.deleted_at IS NULL
           AND (i.expires_at IS NULL OR i.expires_at > NOW())
         LIMIT 1`,
        [subjectUri, did]
      );
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error('Failed to check collaborator status', toError(error), {
        subjectUri,
        did,
      });
      return false;
    }
  }

  /**
   * Lists invites matching the given filters. Used by invitee inboxes and
   * inviter dashboards.
   */
  async listInvites(options: {
    invitee?: DID;
    inviter?: DID;
    subjectUri?: AtUri;
    subjectCollection?: string;
    state?: 'pending' | 'accepted' | 'rejected' | 'expired' | 'all';
    limit?: number;
    cursor?: string;
  }): Promise<{ invites: InviteView[]; cursor?: string; hasMore: boolean; total: number }> {
    const limit = Math.min(options.limit ?? 50, 100);
    const filters: string[] = [];
    const params: unknown[] = [];

    if (options.invitee) {
      params.push(options.invitee);
      filters.push(`i.invitee_did = $${params.length}`);
    }
    if (options.inviter) {
      params.push(options.inviter);
      filters.push(`i.inviter_did = $${params.length}`);
    }
    if (options.subjectUri) {
      params.push(options.subjectUri);
      filters.push(`i.subject_uri = $${params.length}`);
    }
    if (options.subjectCollection) {
      params.push(options.subjectCollection);
      filters.push(`i.subject_collection = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    try {
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM collaboration_invites_index i ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      let cursorClause = '';
      if (options.cursor) {
        params.push(new Date(options.cursor));
        cursorClause = `${filters.length > 0 ? 'AND' : 'WHERE'} i.created_at < $${params.length}`;
      }

      params.push(limit + 1);
      const result = await this.pool.query<{
        uri: string;
        inviter_did: string;
        invitee_did: string;
        subject_uri: string;
        subject_collection: string;
        role: string | null;
        message: string | null;
        created_at: Date;
        expires_at: Date | null;
        deleted_at: Date | null;
        acceptance_uri: string | null;
        acceptance_deleted_at: Date | null;
        acceptance_created_at: Date | null;
      }>(
        `SELECT i.uri, i.inviter_did, i.invitee_did, i.subject_uri,
                i.subject_collection, i.role, i.message, i.created_at,
                i.expires_at, i.deleted_at,
                a.uri AS acceptance_uri,
                a.deleted_at AS acceptance_deleted_at,
                a.created_at AS acceptance_created_at
         FROM collaboration_invites_index i
         LEFT JOIN collaboration_acceptances_index a
           ON a.invite_uri = i.uri
          AND a.accepter_did = i.invitee_did
          AND a.subject_uri = i.subject_uri
         ${whereClause} ${cursorClause}
         ORDER BY i.created_at DESC
         LIMIT $${params.length}`,
        params
      );

      const hasMore = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);

      const mapped = rows.map<InviteView>((row) => {
        const now = new Date();
        const isExpired = row.expires_at && row.expires_at < now;
        const isAccepted = row.acceptance_uri && !row.acceptance_deleted_at;
        const isDeleted = row.deleted_at;
        let state: InviteView['state'];
        if (isDeleted) state = 'rejected';
        else if (isExpired) state = 'expired';
        else if (isAccepted) state = 'accepted';
        else state = 'pending';

        return {
          uri: row.uri as AtUri,
          inviter: row.inviter_did as DID,
          invitee: row.invitee_did as DID,
          subjectUri: row.subject_uri as AtUri,
          subjectCollection: row.subject_collection,
          role: row.role ?? undefined,
          message: row.message ?? undefined,
          state,
          acceptanceUri: row.acceptance_uri ?? undefined,
          createdAt: new Date(row.created_at),
          expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
          acceptedAt: row.acceptance_created_at ? new Date(row.acceptance_created_at) : undefined,
        };
      });

      const filteredByState =
        options.state && options.state !== 'all'
          ? mapped.filter((view) => view.state === options.state)
          : mapped;

      const lastRow = rows[rows.length - 1];
      const cursor = hasMore && lastRow ? lastRow.created_at.toISOString() : undefined;

      return {
        invites: filteredByState,
        cursor,
        hasMore,
        total,
      };
    } catch (error) {
      this.logger.error('Failed to list invites', toError(error), options);
      return { invites: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Re-evaluates the pending-state row for a (subject_uri, did) pair after
   * an invite or acceptance event.
   *
   * @internal
   */
  private async reevaluatePair(subjectUri: string, did: string): Promise<void> {
    const inviteResult = await this.pool.query<{ uri: string; deleted_at: Date | null }>(
      `SELECT uri, deleted_at FROM collaboration_invites_index
       WHERE subject_uri = $1 AND invitee_did = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [subjectUri, did]
    );
    const acceptanceResult = await this.pool.query<{ uri: string; deleted_at: Date | null }>(
      `SELECT uri, deleted_at FROM collaboration_acceptances_index
       WHERE subject_uri = $1 AND accepter_did = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [subjectUri, did]
    );

    const invite = inviteResult.rows[0];
    const acceptance = acceptanceResult.rows[0];

    let state: 'pending-acceptance' | 'pending-invite' | 'active' | 'inactive';
    if (invite && !invite.deleted_at && acceptance && !acceptance.deleted_at) {
      state = 'active';
    } else if (invite && !invite.deleted_at && !acceptance) {
      state = 'pending-acceptance';
    } else if (!invite && acceptance && !acceptance.deleted_at) {
      state = 'pending-invite';
    } else {
      state = 'inactive';
    }

    await this.pool.query(
      `INSERT INTO collaboration_pending_state (
        subject_uri, did, invite_uri, acceptance_uri, state, received_at, last_updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (subject_uri, did) DO UPDATE SET
        invite_uri = EXCLUDED.invite_uri,
        acceptance_uri = EXCLUDED.acceptance_uri,
        state = EXCLUDED.state,
        last_updated_at = NOW()`,
      [subjectUri, did, invite?.uri ?? null, acceptance?.uri ?? null, state]
    );
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extracts the DID authority segment of an AT-URI.
 *
 * @internal
 */
function extractDid(uri: AtUri): DID {
  const parts = (uri as unknown as string).split('/');
  return (parts[2] ?? '') as DID;
}

/**
 * Extracts the collection NSID of an AT-URI.
 *
 * @internal
 */
function extractCollection(uri: AtUri): string {
  const parts = (uri as unknown as string).split('/');
  return parts[3] ?? '';
}

/**
 * Converts an unknown to an Error (identity for Error, stringified otherwise).
 *
 * @internal
 */
function toError(value: unknown): Error | undefined {
  return value instanceof Error ? value : undefined;
}

function toMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
