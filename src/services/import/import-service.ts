/**
 * Import service for tracking imported eprints.
 *
 * @remarks
 * This module implements the import service that manages the AppView
 * cache of eprints imported from external sources (arXiv, LingBuzz, etc.).
 *
 * ATProto Compliance:
 * - All data is ephemeral (AppView cache, not source of truth)
 * - Can be rebuilt from external sources
 * - Never stores blob data (only URLs)
 * - Tracks source for staleness detection
 *
 * @packageDocumentation
 * @public
 */

import { DatabaseError, NotFoundError } from '../../types/errors.js';
import type { IDatabasePool } from '../../types/interfaces/database.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  ExternalAuthor,
  IImportService,
  ImportedEprint,
  ImportSource,
} from '../../types/interfaces/plugin.interface.js';

/**
 * Database row type for imported eprints.
 */
interface ImportedEprintRow {
  id: number;
  source: string;
  external_id: string;
  external_url: string;
  title: string;
  abstract: string | null;
  authors: string; // JSON string
  publication_date: Date | null;
  original_categories: string[] | null;
  doi: string | null;
  pdf_url: string | null;
  imported_by_plugin: string;
  imported_at: Date;
  last_synced_at: Date | null;
  sync_status: string;
  claim_status: string;
  canonical_uri: string | null;
  claimed_by_did: string | null;
  claimed_at: Date | null;
  metadata: string | null; // JSON string
}

/**
 * Import service implementation.
 *
 * @remarks
 * Manages the PostgreSQL table `imported_eprints` which caches
 * eprints from external sources. All data is rebuildable.
 *
 * @public
 */
export class ImportService implements IImportService {
  private readonly logger: ILogger;
  private readonly db: IDatabasePool;

  constructor(logger: ILogger, db: IDatabasePool) {
    this.logger = logger;
    this.db = db;
  }

  /**
   * Checks if an eprint has been imported.
   */
  async exists(source: ImportSource, externalId: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM imported_eprints
        WHERE source = $1 AND external_id = $2
      ) as exists`,
      [source, externalId]
    );
    return result.rows[0]?.exists ?? false;
  }

  /**
   * Gets an imported eprint by source and external ID.
   */
  async get(source: ImportSource, externalId: string): Promise<ImportedEprint | null> {
    const result = await this.db.query<ImportedEprintRow>(
      `SELECT * FROM imported_eprints
       WHERE source = $1 AND external_id = $2`,
      [source, externalId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToEprint(row);
  }

  /**
   * Gets an imported eprint by internal ID.
   */
  async getById(id: number): Promise<ImportedEprint | null> {
    const result = await this.db.query<ImportedEprintRow>(
      `SELECT * FROM imported_eprints WHERE id = $1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToEprint(row);
  }

  /**
   * Creates a new imported eprint.
   */
  async create(data: {
    source: ImportSource;
    externalId: string;
    externalUrl: string;
    title: string;
    abstract?: string;
    authors: readonly ExternalAuthor[];
    publicationDate?: Date;
    doi?: string;
    pdfUrl?: string;
    categories?: readonly string[];
    importedByPlugin: string;
    metadata?: Record<string, unknown>;
  }): Promise<ImportedEprint> {
    const result = await this.db.query<ImportedEprintRow>(
      `INSERT INTO imported_eprints (
        source, external_id, external_url, title, abstract,
        authors, publication_date, doi, pdf_url, original_categories,
        imported_by_plugin, metadata, imported_at, sync_status, claim_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), 'active', 'unclaimed'
      )
      ON CONFLICT (source, external_id) DO UPDATE SET
        title = EXCLUDED.title,
        abstract = EXCLUDED.abstract,
        authors = EXCLUDED.authors,
        publication_date = EXCLUDED.publication_date,
        doi = EXCLUDED.doi,
        pdf_url = EXCLUDED.pdf_url,
        original_categories = EXCLUDED.original_categories,
        metadata = EXCLUDED.metadata,
        last_synced_at = NOW(),
        sync_status = 'active'
      RETURNING *`,
      [
        data.source,
        data.externalId,
        data.externalUrl,
        data.title,
        data.abstract ?? null,
        JSON.stringify(data.authors),
        data.publicationDate ?? null,
        data.doi ?? null,
        data.pdfUrl ?? null,
        data.categories ?? null,
        data.importedByPlugin,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new DatabaseError(
        'CREATE',
        'Failed to create imported eprint: no row returned from database'
      );
    }

    this.logger.info('Import created', {
      id: row.id,
      source: data.source,
      externalId: data.externalId,
    });

    return this.rowToEprint(row);
  }

  /**
   * Updates an imported eprint.
   */
  async update(
    id: number,
    data: Partial<{
      title: string;
      abstract: string;
      authors: readonly ExternalAuthor[];
      doi: string;
      pdfUrl: string;
      lastSyncedAt: Date;
      syncStatus: 'active' | 'stale' | 'unavailable';
      claimStatus: 'unclaimed' | 'pending' | 'claimed';
      canonicalUri: string;
      claimedByDid: string;
      claimedAt: Date;
    }>
  ): Promise<ImportedEprint> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.abstract !== undefined) {
      updates.push(`abstract = $${paramIndex++}`);
      values.push(data.abstract);
    }
    if (data.authors !== undefined) {
      updates.push(`authors = $${paramIndex++}`);
      values.push(JSON.stringify(data.authors));
    }
    if (data.doi !== undefined) {
      updates.push(`doi = $${paramIndex++}`);
      values.push(data.doi);
    }
    if (data.pdfUrl !== undefined) {
      updates.push(`pdf_url = $${paramIndex++}`);
      values.push(data.pdfUrl);
    }
    if (data.lastSyncedAt !== undefined) {
      updates.push(`last_synced_at = $${paramIndex++}`);
      values.push(data.lastSyncedAt);
    }
    if (data.syncStatus !== undefined) {
      updates.push(`sync_status = $${paramIndex++}`);
      values.push(data.syncStatus);
    }
    if (data.claimStatus !== undefined) {
      updates.push(`claim_status = $${paramIndex++}`);
      values.push(data.claimStatus);
    }
    if (data.canonicalUri !== undefined) {
      updates.push(`canonical_uri = $${paramIndex++}`);
      values.push(data.canonicalUri);
    }
    if (data.claimedByDid !== undefined) {
      updates.push(`claimed_by_did = $${paramIndex++}`);
      values.push(data.claimedByDid);
    }
    if (data.claimedAt !== undefined) {
      updates.push(`claimed_at = $${paramIndex++}`);
      values.push(data.claimedAt);
    }

    if (updates.length === 0) {
      const existing = await this.getById(id);
      if (!existing) {
        throw new NotFoundError('ImportedEprint', id.toString());
      }
      return existing;
    }

    values.push(id);

    const result = await this.db.query<ImportedEprintRow>(
      `UPDATE imported_eprints
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('ImportedEprint', id.toString());
    }

    return this.rowToEprint(row);
  }

  /**
   * Searches imported eprints.
   */
  async search(options: {
    query?: string;
    source?: ImportSource;
    claimStatus?: 'unclaimed' | 'pending' | 'claimed';
    authorName?: string;
    authorOrcid?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ eprints: ImportedEprint[]; cursor?: string }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.query) {
      conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex++})`);
      values.push(options.query);
    }

    if (options.source) {
      conditions.push(`source = $${paramIndex++}`);
      values.push(options.source);
    }

    if (options.claimStatus) {
      conditions.push(`claim_status = $${paramIndex++}`);
      values.push(options.claimStatus);
    }

    if (options.authorName) {
      conditions.push(`authors::jsonb @> $${paramIndex++}::jsonb`);
      values.push(JSON.stringify([{ name: options.authorName }]));
    }

    if (options.authorOrcid) {
      conditions.push(`authors::jsonb @> $${paramIndex++}::jsonb`);
      values.push(JSON.stringify([{ orcid: options.authorOrcid }]));
    }

    // Cursor-based pagination
    if (options.cursor) {
      const cursorId = parseInt(options.cursor, 10);
      conditions.push(`id > $${paramIndex++}`);
      values.push(cursorId);
    }

    const limit = Math.min(options.limit ?? 50, 100);
    values.push(limit + 1); // Fetch one extra to determine if there's more

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.query<ImportedEprintRow>(
      `SELECT * FROM imported_eprints
       ${whereClause}
       ORDER BY id ASC
       LIMIT $${paramIndex}`,
      values
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const eprints = rows.map((row) => this.rowToEprint(row));

    const lastRow = rows[rows.length - 1];
    return {
      eprints,
      cursor: hasMore && lastRow ? lastRow.id.toString() : undefined,
    };
  }

  /**
   * Marks an eprint as claimed.
   */
  async markClaimed(id: number, canonicalUri: string, claimedByDid: string): Promise<void> {
    await this.update(id, {
      claimStatus: 'claimed',
      canonicalUri,
      claimedByDid,
      claimedAt: new Date(),
    });

    this.logger.info('Import marked as claimed', {
      id,
      canonicalUri,
      claimedByDid,
    });
  }

  /**
   * Converts a database row to ImportedEprint.
   */
  private rowToEprint(row: ImportedEprintRow): ImportedEprint {
    // PostgreSQL JSONB columns are auto-parsed by pg driver; handle both cases.
    const authors = (
      typeof row.authors === 'string' ? JSON.parse(row.authors) : row.authors
    ) as ExternalAuthor[];
    const metadata = row.metadata
      ? typeof row.metadata === 'string'
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata as Record<string, unknown>)
      : undefined;

    return {
      id: row.id,
      source: row.source,
      externalId: row.external_id,
      url: row.external_url,
      title: row.title,
      abstract: row.abstract ?? undefined,
      authors,
      publicationDate: row.publication_date ?? undefined,
      categories: row.original_categories ?? undefined,
      doi: row.doi ?? undefined,
      pdfUrl: row.pdf_url ?? undefined,
      importedByPlugin: row.imported_by_plugin,
      importedAt: row.imported_at,
      lastSyncedAt: row.last_synced_at ?? undefined,
      syncStatus: row.sync_status as 'active' | 'stale' | 'unavailable',
      claimStatus: row.claim_status as 'unclaimed' | 'pending' | 'claimed',
      canonicalUri: row.canonical_uri ?? undefined,
      claimedByDid: row.claimed_by_did ?? undefined,
      claimedAt: row.claimed_at ?? undefined,
      metadata,
    };
  }
}
