/**
 * Reconciliation service for governance records.
 *
 * @remarks
 * This module implements the reconciliation service that creates governance
 * records linking imported eprints to their canonical ATProto records.
 *
 * ATProto Compliance:
 * - Reconciliation records live in Governance PDS (did:plc:chive-governance)
 * - Records are published to firehose (portable across AppViews)
 * - Signed by governance key (auditable)
 * - Optional enhancement - claims work without reconciliation records
 *
 * Record Type: pub.chive.graph.reconciliation
 * - Links import URI to canonical URI
 * - Includes verification evidence summary
 * - Status tracking (verified, disputed, superseded)
 *
 * @packageDocumentation
 * @public
 */

import { injectable, inject } from 'tsyringe';

import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { ClaimEvidence } from '../../types/interfaces/plugin.interface.js';

/**
 * Reconciliation record type (matches pub.chive.graph.reconciliation lexicon).
 */
export interface ReconciliationRecord {
  /**
   * Lexicon type identifier.
   */
  readonly $type: 'pub.chive.graph.reconciliation';

  /**
   * AT-URI or internal reference to the imported eprint.
   */
  readonly importUri: string;

  /**
   * AT-URI of the user's canonical record in their PDS.
   */
  readonly canonicalUri: string;

  /**
   * Type of reconciliation.
   */
  readonly reconciliationType: 'claim' | 'merge' | 'supersede';

  /**
   * Summary of verification evidence.
   */
  readonly evidence: readonly ReconciliationEvidence[];

  /**
   * Reconciliation status.
   */
  readonly status: 'verified' | 'disputed' | 'superseded';

  /**
   * DID of the authority that verified this reconciliation.
   */
  readonly verifiedBy?: string;

  /**
   * Timestamp of verification.
   */
  readonly verifiedAt?: string;

  /**
   * Optional notes or context.
   */
  readonly notes?: string;
}

/**
 * Evidence summary for reconciliation records.
 */
export interface ReconciliationEvidence {
  /**
   * Type of evidence.
   */
  readonly type: string;

  /**
   * Confidence score (0-1).
   */
  readonly score: number;
}

/**
 * Database row type for reconciliation records.
 */
interface ReconciliationRow {
  id: number;
  import_uri: string;
  canonical_uri: string;
  reconciliation_type: string;
  evidence: string; // JSON string
  status: string;
  verified_by: string | null;
  verified_at: Date | null;
  notes: string | null;
  atproto_uri: string | null; // AT-URI in Governance PDS
  atproto_cid: string | null; // CID of the record
  created_at: Date;
  updated_at: Date;
}

/**
 * Stored reconciliation with metadata.
 */
export interface StoredReconciliation {
  readonly id: number;
  readonly importUri: string;
  readonly canonicalUri: string;
  readonly reconciliationType: 'claim' | 'merge' | 'supersede';
  readonly evidence: readonly ReconciliationEvidence[];
  readonly status: 'verified' | 'disputed' | 'superseded';
  readonly verifiedBy?: string;
  readonly verifiedAt?: Date;
  readonly notes?: string;
  readonly atprotoUri?: string;
  readonly atprotoCid?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Options for creating reconciliation records.
 */
export interface CreateReconciliationOptions {
  readonly importUri: string;
  readonly canonicalUri: string;
  readonly reconciliationType: 'claim' | 'merge' | 'supersede';
  readonly evidence: readonly ClaimEvidence[];
  readonly verifiedBy?: string;
  readonly notes?: string;
}

/**
 * Reconciliation service interface.
 */
export interface IReconciliationService {
  /**
   * Creates a reconciliation record.
   */
  createReconciliation(options: CreateReconciliationOptions): Promise<StoredReconciliation>;

  /**
   * Gets reconciliation by import URI.
   */
  getByImportUri(importUri: string): Promise<StoredReconciliation | null>;

  /**
   * Gets reconciliation by canonical URI.
   */
  getByCanonicalUri(canonicalUri: string): Promise<StoredReconciliation | null>;

  /**
   * Updates reconciliation status.
   */
  updateStatus(
    id: number,
    status: 'verified' | 'disputed' | 'superseded',
    notes?: string
  ): Promise<StoredReconciliation>;

  /**
   * Publishes reconciliation to Governance PDS.
   */
  publishToGovernancePds(id: number): Promise<{ uri: string; cid: string }>;
}

/**
 * Reconciliation service implementation.
 *
 * @remarks
 * Creates and manages reconciliation records that link imported eprints
 * to their canonical ATProto records created by users.
 *
 * Architecture:
 * 1. Reconciliation stored in PostgreSQL (AppView-specific)
 * 2. Optionally published to Governance PDS for portability
 * 3. Governance PDS records are ATProto-native and travel via firehose
 *
 * @public
 */
@injectable()
export class ReconciliationService implements IReconciliationService {
  constructor(
    @inject('ILogger') private readonly logger: ILogger,
    @inject('DatabasePool') private readonly db: DatabasePool,
    @inject('GovernancePdsClient')
    private readonly governancePds: GovernancePdsClient | null = null
  ) {}

  /**
   * Creates a reconciliation record.
   *
   * @param options - Reconciliation options
   * @returns Created reconciliation
   */
  async createReconciliation(options: CreateReconciliationOptions): Promise<StoredReconciliation> {
    // Convert claim evidence to reconciliation evidence summary
    const evidenceSummary: ReconciliationEvidence[] = options.evidence.map((e) => ({
      type: e.type,
      score: e.score,
    }));

    const result = await this.db.query<ReconciliationRow>(
      `INSERT INTO reconciliations (
        import_uri, canonical_uri, reconciliation_type, evidence,
        status, verified_by, verified_at, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'verified', $5, NOW(), $6, NOW(), NOW()
      )
      ON CONFLICT (import_uri) DO UPDATE SET
        canonical_uri = EXCLUDED.canonical_uri,
        reconciliation_type = EXCLUDED.reconciliation_type,
        evidence = EXCLUDED.evidence,
        status = EXCLUDED.status,
        verified_by = EXCLUDED.verified_by,
        verified_at = NOW(),
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [
        options.importUri,
        options.canonicalUri,
        options.reconciliationType,
        JSON.stringify(evidenceSummary),
        options.verifiedBy ?? null,
        options.notes ?? null,
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new DatabaseError(
        'CREATE',
        'Failed to create reconciliation: no row returned from database'
      );
    }
    const reconciliation = this.rowToStoredReconciliation(row);

    this.logger.info('Reconciliation created', {
      id: reconciliation.id,
      importUri: options.importUri,
      canonicalUri: options.canonicalUri,
      type: options.reconciliationType,
    });

    return reconciliation;
  }

  /**
   * Gets reconciliation by import URI.
   */
  async getByImportUri(importUri: string): Promise<StoredReconciliation | null> {
    const result = await this.db.query<ReconciliationRow>(
      `SELECT * FROM reconciliations WHERE import_uri = $1`,
      [importUri]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToStoredReconciliation(row);
  }

  /**
   * Gets reconciliation by canonical URI.
   */
  async getByCanonicalUri(canonicalUri: string): Promise<StoredReconciliation | null> {
    const result = await this.db.query<ReconciliationRow>(
      `SELECT * FROM reconciliations WHERE canonical_uri = $1`,
      [canonicalUri]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToStoredReconciliation(row);
  }

  /**
   * Updates reconciliation status.
   */
  async updateStatus(
    id: number,
    status: 'verified' | 'disputed' | 'superseded',
    notes?: string
  ): Promise<StoredReconciliation> {
    const result = await this.db.query<ReconciliationRow>(
      `UPDATE reconciliations
       SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, notes ?? null, id]
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Reconciliation', id.toString());
    }

    const reconciliation = this.rowToStoredReconciliation(row);

    this.logger.info('Reconciliation status updated', {
      id,
      status,
    });

    return reconciliation;
  }

  /**
   * Publishes reconciliation to Governance PDS.
   *
   * @remarks
   * Creates a pub.chive.graph.reconciliation record in the Governance PDS.
   * This makes the reconciliation ATProto-native and portable.
   *
   * The record is:
   * - Published to firehose (other AppViews can index)
   * - Signed by governance key (auditable)
   * - Portable (lives in Governance PDS, not just Chive database)
   *
   * @throws ValidationError if Governance PDS client not configured
   * @throws NotFoundError if reconciliation not found
   */
  async publishToGovernancePds(id: number): Promise<{ uri: string; cid: string }> {
    if (!this.governancePds) {
      throw new ValidationError(
        'Governance PDS client not configured',
        'governancePds',
        'required'
      );
    }

    const reconciliation = await this.getById(id);
    if (!reconciliation) {
      throw new NotFoundError('Reconciliation', id.toString());
    }

    // Build the ATProto record
    const record: ReconciliationRecord = {
      $type: 'pub.chive.graph.reconciliation',
      importUri: reconciliation.importUri,
      canonicalUri: reconciliation.canonicalUri,
      reconciliationType: reconciliation.reconciliationType,
      evidence: reconciliation.evidence,
      status: reconciliation.status,
      verifiedBy: reconciliation.verifiedBy,
      verifiedAt: reconciliation.verifiedAt?.toISOString(),
      notes: reconciliation.notes,
    };

    // Create record in Governance PDS
    const { uri, cid } = await this.governancePds.createRecord(
      'pub.chive.graph.reconciliation',
      record
    );

    // Update local record with AT-URI and CID
    await this.db.query(
      `UPDATE reconciliations
       SET atproto_uri = $1, atproto_cid = $2, updated_at = NOW()
       WHERE id = $3`,
      [uri, cid, id]
    );

    this.logger.info('Reconciliation published to Governance PDS', {
      id,
      uri,
      cid,
    });

    return { uri, cid };
  }

  /**
   * Gets reconciliation by ID.
   */
  private async getById(id: number): Promise<StoredReconciliation | null> {
    const result = await this.db.query<ReconciliationRow>(
      `SELECT * FROM reconciliations WHERE id = $1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToStoredReconciliation(row);
  }

  /**
   * Converts database row to StoredReconciliation.
   */
  private rowToStoredReconciliation(row: ReconciliationRow): StoredReconciliation {
    // PostgreSQL JSONB columns are auto-parsed by pg driver
    const evidence = (
      typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence
    ) as ReconciliationEvidence[];

    return {
      id: row.id,
      importUri: row.import_uri,
      canonicalUri: row.canonical_uri,
      reconciliationType: row.reconciliation_type as StoredReconciliation['reconciliationType'],
      evidence,
      status: row.status as StoredReconciliation['status'],
      verifiedBy: row.verified_by ?? undefined,
      verifiedAt: row.verified_at ?? undefined,
      notes: row.notes ?? undefined,
      atprotoUri: row.atproto_uri ?? undefined,
      atprotoCid: row.atproto_cid ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Database pool interface.
 */
interface DatabasePool {
  query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Governance PDS client interface.
 *
 * @remarks
 * Used to create records in the Governance PDS (did:plc:chive-governance).
 * In production, this would use the ATProto agent.
 */
interface GovernancePdsClient {
  createRecord(collection: string, record: unknown): Promise<{ uri: string; cid: string }>;
}
