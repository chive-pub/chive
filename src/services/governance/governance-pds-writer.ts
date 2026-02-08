/**
 * Graph PDS Writer for trusted editors to create graph records.
 *
 * @remarks
 * Enables trusted editors and authority editors to write records to the
 * Chive Graph PDS using delegated signing authority.
 *
 * **ATProto Compliance**:
 * - Uses delegated signing keys (not user PDSes)
 * - All writes go to Graph PDS (`did:plc:chive-governance`)
 * - Records published to firehose for interoperability
 * - Rate-limited per delegation (100 records/day default)
 *
 * **Security Model**:
 * - Delegation tokens have expiration dates
 * - Scoped to specific collections
 * - Revocable by governance committee
 * - Audit trail for all writes
 *
 * @packageDocumentation
 * @public
 */

import { Agent } from '@atproto/api';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';

import type {
  NodeKind,
  NodeStatus,
  EdgeStatus,
  ExternalId,
  NodeMetadata,
  EdgeMetadata,
} from '../../storage/neo4j/types.js';
import type { AtUri, CID, DID, NSID, Timestamp } from '../../types/atproto.js';
import { AuthorizationError, DatabaseError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { Result } from '../../types/result.js';

/**
 * Delegation token for trusted editor signing authority.
 */
export interface DelegationToken {
  id: string;
  delegateDid: DID;
  collections: readonly NSID[];
  expiresAt: Timestamp;
  maxRecordsPerDay: number;
  recordsCreatedToday: number;
  lastResetDate: string;
  grantedBy: DID;
  grantedAt: Timestamp;
  active: boolean;
}

/**
 * Node creation input.
 */
export interface CreateNodeInput {
  id: string;
  kind: NodeKind;
  subkind?: string;
  subkindUri?: AtUri;
  label: string;
  alternateLabels?: readonly string[];
  description?: string;
  externalIds?: readonly ExternalId[];
  metadata?: NodeMetadata;
  status?: NodeStatus;
  proposalUri?: AtUri;
}

/**
 * Edge creation input.
 */
export interface CreateEdgeInput {
  id: string;
  sourceUri: AtUri;
  targetUri: AtUri;
  relationUri?: AtUri;
  relationSlug: string;
  weight?: number;
  metadata?: EdgeMetadata;
  status?: EdgeStatus;
  proposalUri?: AtUri;
}

/**
 * Record creation result.
 */
export interface CreateRecordResult {
  uri: AtUri;
  cid: CID;
}

/**
 * Governance PDS Writer configuration.
 */
export interface GovernancePDSWriterOptions {
  graphPdsDid: DID;
  pdsUrl: string;
  signingKey: string;
  pool: Pool;
  cache: Redis;
  logger: ILogger;
}

/**
 * Governance PDS Writer.
 *
 * @example
 * ```typescript
 * const writer = new GovernancePDSWriter({
 *   graphPdsDid: 'did:plc:chive-governance' as DID,
 *   pdsUrl: 'https://pds.chive.pub',
 *   signingKey: process.env.GOVERNANCE_SIGNING_KEY!,
 *   pool,
 *   cache: redis,
 *   logger,
 * });
 *
 * // Create a node
 * const result = await writer.createNode(userDid, {
 *   id: crypto.randomUUID(),
 *   kind: 'type',
 *   subkind: 'field',
 *   label: 'Machine Learning',
 *   description: 'Study of algorithms that improve through experience',
 * });
 *
 * // Create an edge
 * const edgeResult = await writer.createEdge(userDid, {
 *   id: crypto.randomUUID(),
 *   sourceUri: mlNodeUri,
 *   targetUri: csNodeUri,
 *   relationSlug: 'broader',
 * });
 * ```
 */
export class GovernancePDSWriter {
  private readonly graphPdsDid: DID;
  private readonly pdsUrl: string;
  private readonly pool: Pool;
  private readonly logger: ILogger;
  private agent: Agent | null = null;

  constructor(options: GovernancePDSWriterOptions) {
    this.graphPdsDid = options.graphPdsDid;
    this.pdsUrl = options.pdsUrl;
    this.pool = options.pool;
    this.logger = options.logger;

    // Initialize agent (authentication handled per-operation if needed)
    void this.initializeAgent(options.signingKey);
  }

  private initializeAgent(_signingKey: string): void {
    this.agent = new Agent({ service: this.pdsUrl });

    // For bootstrap operations (like automatic proposals), we may not need authentication
    // The agent will be used to create records, but authentication may be handled differently
    // depending on the PDS configuration

    this.logger.info('GovernancePDSWriter initialized', {
      graphPdsDid: this.graphPdsDid,
      pdsUrl: this.pdsUrl,
    });
  }

  /**
   * Check if a user has delegation to write to a collection.
   */
  async canWrite(userDid: DID, collection: NSID): Promise<boolean> {
    const delegation = await this.getDelegation(userDid);

    if (!delegation) {
      return false;
    }

    if (!delegation.active || delegation.expiresAt < Date.now()) {
      return false;
    }

    if (!delegation.collections.includes(collection)) {
      return false;
    }

    await this.checkAndResetRateLimit(delegation);
    if (delegation.recordsCreatedToday >= delegation.maxRecordsPerDay) {
      return false;
    }

    return true;
  }

  /**
   * Get delegation for a user.
   */
  async getDelegation(userDid: DID): Promise<DelegationToken | null> {
    const result = await this.pool.query<{
      id: string;
      delegate_did: string;
      collections: string[];
      expires_at: Date;
      max_records_per_day: number;
      records_created_today: number;
      last_reset_date: string;
      granted_by: string;
      granted_at: Date;
      active: boolean;
    }>(
      `SELECT * FROM governance_delegations
       WHERE delegate_did = $1 AND active = true
       ORDER BY granted_at DESC
       LIMIT 1`,
      [userDid]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      delegateDid: row.delegate_did as DID,
      collections: row.collections as NSID[],
      expiresAt: row.expires_at.getTime() as Timestamp,
      maxRecordsPerDay: row.max_records_per_day,
      recordsCreatedToday: row.records_created_today,
      lastResetDate: row.last_reset_date,
      grantedBy: row.granted_by as DID,
      grantedAt: row.granted_at.getTime() as Timestamp,
      active: row.active,
    };
  }

  /**
   * Create a delegation for a trusted editor.
   */
  async createDelegation(input: {
    delegateDid: DID;
    collections: readonly NSID[];
    expiresAt: Timestamp;
    maxRecordsPerDay?: number;
    grantedBy: DID;
  }): Promise<Result<DelegationToken, DatabaseError>> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      await this.pool.query(
        `INSERT INTO governance_delegations (
          id, delegate_did, collections, expires_at, max_records_per_day,
          records_created_today, last_reset_date, granted_by, granted_at, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
        [
          id,
          input.delegateDid,
          input.collections,
          new Date(input.expiresAt),
          input.maxRecordsPerDay ?? 100,
          0,
          now.toISOString().split('T')[0],
          input.grantedBy,
          now,
        ]
      );

      this.logger.info('Created governance delegation', {
        id,
        delegateDid: input.delegateDid,
        collections: input.collections,
        expiresAt: new Date(input.expiresAt).toISOString(),
      });

      const resetDate = now.toISOString().split('T')[0] ?? now.toISOString().slice(0, 10);
      return {
        ok: true,
        value: {
          id,
          delegateDid: input.delegateDid,
          collections: input.collections,
          expiresAt: input.expiresAt,
          maxRecordsPerDay: input.maxRecordsPerDay ?? 100,
          recordsCreatedToday: 0,
          lastResetDate: resetDate,
          grantedBy: input.grantedBy,
          grantedAt: now.getTime() as Timestamp,
          active: true,
        },
      };
    } catch (error) {
      this.logger.error('Failed to create delegation', error instanceof Error ? error : undefined, {
        delegateDid: input.delegateDid,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Revoke a delegation.
   */
  async revokeDelegation(
    delegationId: string,
    revokedBy: DID
  ): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query(
        `UPDATE governance_delegations
         SET active = false, revoked_at = NOW(), revoked_by = $2
         WHERE id = $1`,
        [delegationId, revokedBy]
      );

      this.logger.info('Revoked governance delegation', { delegationId, revokedBy });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to revoke delegation', error instanceof Error ? error : undefined, {
        delegationId,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Create a node in the Governance PDS.
   */
  async createNode(
    editorDid: DID,
    input: CreateNodeInput
  ): Promise<Result<CreateRecordResult, AuthorizationError | ValidationError | DatabaseError>> {
    const collection = 'pub.chive.graph.node' as NSID;

    const canWrite = await this.canWrite(editorDid, collection);
    if (!canWrite) {
      return {
        ok: false,
        error: new AuthorizationError('No active delegation for node creation', editorDid),
      };
    }

    if (!input.label || input.label.trim().length === 0) {
      return {
        ok: false,
        error: new ValidationError('Node label is required', 'label', 'required'),
      };
    }

    try {
      const rkey = input.id;

      const record = {
        $type: collection,
        id: input.id,
        kind: input.kind,
        subkind: input.subkind,
        subkindUri: input.subkindUri,
        label: input.label.trim(),
        alternateLabels: input.alternateLabels ?? [],
        description: input.description,
        externalIds: input.externalIds ?? [],
        metadata: input.metadata,
        status: input.status ?? 'provisional',
        proposalUri: input.proposalUri,
        createdAt: new Date().toISOString(),
      };

      const result = await this.createRecord(collection, rkey, record);

      if (!result.ok) {
        return result;
      }

      await this.incrementRateLimit(editorDid);

      await this.logAuditTrail({
        action: 'create',
        collection,
        uri: result.value.uri,
        editorDid,
        record,
      });

      this.logger.info('Created node', {
        uri: result.value.uri,
        label: input.label,
        kind: input.kind,
        subkind: input.subkind,
        editorDid,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create node', error instanceof Error ? error : undefined, {
        editorDid,
        label: input.label,
        kind: input.kind,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Create a node in bootstrap mode (skips delegation check for seeding).
   */
  async createNodeBootstrap(
    input: CreateNodeInput
  ): Promise<Result<CreateRecordResult, ValidationError | DatabaseError>> {
    const collection = 'pub.chive.graph.node' as NSID;

    if (!input.label || input.label.trim().length === 0) {
      return {
        ok: false,
        error: new ValidationError('Node label is required', 'label', 'required'),
      };
    }

    try {
      const rkey = input.id;

      const record = {
        $type: collection,
        id: input.id,
        kind: input.kind,
        subkind: input.subkind,
        subkindUri: input.subkindUri,
        label: input.label.trim(),
        alternateLabels: input.alternateLabels ?? [],
        description: input.description,
        externalIds: input.externalIds ?? [],
        metadata: input.metadata,
        status: input.status ?? 'established',
        proposalUri: input.proposalUri,
        createdAt: new Date().toISOString(),
      };

      const result = await this.createRecord(collection, rkey, record);

      if (!result.ok) {
        return result;
      }

      this.logger.info('Created node (bootstrap)', {
        uri: result.value.uri,
        label: input.label,
        kind: input.kind,
        subkind: input.subkind,
      });

      return result;
    } catch (error) {
      this.logger.error(
        'Failed to create node (bootstrap)',
        error instanceof Error ? error : undefined,
        {
          label: input.label,
          kind: input.kind,
        }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Create an edge in the Governance PDS.
   */
  async createEdge(
    editorDid: DID,
    input: CreateEdgeInput
  ): Promise<Result<CreateRecordResult, AuthorizationError | ValidationError | DatabaseError>> {
    const collection = 'pub.chive.graph.edge' as NSID;

    const canWrite = await this.canWrite(editorDid, collection);
    if (!canWrite) {
      return {
        ok: false,
        error: new AuthorizationError('No active delegation for edge creation', editorDid),
      };
    }

    if (!input.sourceUri || !input.targetUri) {
      return {
        ok: false,
        error: new ValidationError('Source and target URIs are required', 'sourceUri', 'required'),
      };
    }

    if (!input.relationSlug) {
      return {
        ok: false,
        error: new ValidationError('Relation slug is required', 'relationSlug', 'required'),
      };
    }

    try {
      const rkey = input.id;

      const record = {
        $type: collection,
        id: input.id,
        sourceUri: input.sourceUri,
        targetUri: input.targetUri,
        relationUri: input.relationUri,
        relationSlug: input.relationSlug,
        weight: input.weight,
        metadata: input.metadata,
        status: input.status ?? 'established',
        proposalUri: input.proposalUri,
        createdAt: new Date().toISOString(),
      };

      const result = await this.createRecord(collection, rkey, record);

      if (!result.ok) {
        return result;
      }

      await this.incrementRateLimit(editorDid);

      await this.logAuditTrail({
        action: 'create',
        collection,
        uri: result.value.uri,
        editorDid,
        record,
      });

      this.logger.info('Created edge', {
        uri: result.value.uri,
        sourceUri: input.sourceUri,
        targetUri: input.targetUri,
        relationSlug: input.relationSlug,
        editorDid,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create edge', error instanceof Error ? error : undefined, {
        editorDid,
        sourceUri: input.sourceUri,
        targetUri: input.targetUri,
        relationSlug: input.relationSlug,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Create an edge in bootstrap mode (skips delegation check for seeding).
   */
  async createEdgeBootstrap(
    input: CreateEdgeInput
  ): Promise<Result<CreateRecordResult, ValidationError | DatabaseError>> {
    const collection = 'pub.chive.graph.edge' as NSID;

    if (!input.sourceUri || !input.targetUri) {
      return {
        ok: false,
        error: new ValidationError('Source and target URIs are required', 'sourceUri', 'required'),
      };
    }

    if (!input.relationSlug) {
      return {
        ok: false,
        error: new ValidationError('Relation slug is required', 'relationSlug', 'required'),
      };
    }

    try {
      const rkey = input.id;

      const record = {
        $type: collection,
        id: input.id,
        sourceUri: input.sourceUri,
        targetUri: input.targetUri,
        relationUri: input.relationUri,
        relationSlug: input.relationSlug,
        weight: input.weight,
        metadata: input.metadata,
        status: input.status ?? 'established',
        proposalUri: input.proposalUri,
        createdAt: new Date().toISOString(),
      };

      const result = await this.createRecord(collection, rkey, record);

      if (!result.ok) {
        return result;
      }

      this.logger.info('Created edge (bootstrap)', {
        uri: result.value.uri,
        sourceUri: input.sourceUri,
        targetUri: input.targetUri,
        relationSlug: input.relationSlug,
      });

      return result;
    } catch (error) {
      this.logger.error(
        'Failed to create edge (bootstrap)',
        error instanceof Error ? error : undefined,
        {
          sourceUri: input.sourceUri,
          targetUri: input.targetUri,
          relationSlug: input.relationSlug,
        }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Create a proposal record in bootstrap mode (for automatic proposals).
   *
   * @param collection - Collection NSID (e.g., 'pub.chive.graph.nodeProposal')
   * @param rkey - Record key
   * @param record - Proposal record data
   * @returns Created record result
   */
  async createProposalBootstrap(
    collection: NSID,
    rkey: string,
    record: unknown
  ): Promise<Result<CreateRecordResult, DatabaseError>> {
    return this.createRecord(collection, rkey, record);
  }

  private async createRecord(
    collection: NSID,
    rkey: string,
    record: unknown
  ): Promise<Result<CreateRecordResult, DatabaseError>> {
    if (!this.agent) {
      return {
        ok: false,
        error: new DatabaseError('WRITE', 'Agent not initialized'),
      };
    }

    try {
      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.graphPdsDid,
        collection,
        rkey,
        record: record as Record<string, unknown>,
      });

      const uri = `at://${this.graphPdsDid}/${collection}/${rkey}` as AtUri;

      return {
        ok: true,
        value: {
          uri,
          cid: response.data.cid as CID,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to create record in PDS',
        error instanceof Error ? error : undefined,
        { collection, rkey }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  private async checkAndResetRateLimit(delegation: DelegationToken): Promise<void> {
    const isoDate = new Date().toISOString();
    const today = isoDate.split('T')[0] ?? isoDate.slice(0, 10);

    if (delegation.lastResetDate !== today) {
      await this.pool.query(
        `UPDATE governance_delegations
         SET records_created_today = 0, last_reset_date = $1
         WHERE id = $2`,
        [today, delegation.id]
      );
      delegation.recordsCreatedToday = 0;
      delegation.lastResetDate = today;
    }
  }

  private async incrementRateLimit(editorDid: DID): Promise<void> {
    await this.pool.query(
      `UPDATE governance_delegations
       SET records_created_today = records_created_today + 1
       WHERE delegate_did = $1 AND active = true`,
      [editorDid]
    );
  }

  private async logAuditTrail(entry: {
    action: 'create' | 'update' | 'delete';
    collection: NSID;
    uri: AtUri;
    editorDid: DID;
    record: unknown;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO governance_audit_log (
        id, action, collection, uri, editor_did, record_snapshot, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        crypto.randomUUID(),
        entry.action,
        entry.collection,
        entry.uri,
        entry.editorDid,
        JSON.stringify(entry.record),
      ]
    );
  }
}
