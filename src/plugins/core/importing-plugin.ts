/**
 * Base class for plugins that import eprints from external sources.
 *
 * @remarks
 * This module provides an abstract base class for plugins that fetch
 * eprints from external archives (arXiv, LingBuzz, OpenReview, etc.)
 * and import them into the Chive AppView cache.
 *
 * All imports follow ATProto compliance:
 * - Imports are stored in AppView (ephemeral, rebuildable)
 * - Never writes to user PDSes
 * - Users claim ownership by creating records in THEIR PDS
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { PluginError } from '../../types/errors.js';
import type {
  ExternalAuthor,
  ExternalEprint,
  FetchOptions,
  IImportService,
  ImportedEprint,
  ImportSource,
  IPluginContext,
} from '../../types/interfaces/plugin.interface.js';
import { BasePlugin } from '../builtin/base-plugin.js';

/**
 * Base class for plugins that import eprints from external sources.
 *
 * @remarks
 * Provides common functionality for importing eprints:
 * - Import service integration
 * - Deduplication checking
 * - Rate limiting helpers
 * - Event emission for import lifecycle
 *
 * Subclasses must implement:
 * - `source` - The external source identifier
 * - `fetchEprints()` - Fetches eprints from the external source
 *
 * Subclasses may override:
 * - `parseExternalId()` - Extracts external ID from URL
 * - `normalizeEprint()` - Normalizes fetched data
 *
 * @example
 * ```typescript
 * export class ArxivPlugin extends ImportingPlugin {
 *   readonly id = 'pub.chive.plugin.arxiv';
 *   readonly source: ImportSource = 'arxiv';
 *
 *   async *fetchEprints(options?: FetchOptions): AsyncIterable<ExternalEprint> {
 *     // Fetch from arXiv OAI-PMH endpoint
 *     const records = await this.oaiPmhClient.listRecords(options);
 *     for (const record of records) {
 *       yield this.mapToExternalEprint(record);
 *     }
 *   }
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export abstract class ImportingPlugin extends BasePlugin {
  /**
   * External source identifier.
   *
   * @remarks
   * Used for tracking imports and preventing duplicates.
   */
  abstract readonly source: ImportSource;

  /**
   * Import service instance.
   *
   * @remarks
   * Set during initialization via dependency injection from context.
   */
  protected importService!: IImportService;

  /**
   * Timestamp of last external request (for rate limiting).
   */
  private lastRequestTime = 0;

  /**
   * Minimum delay between requests in milliseconds.
   *
   * @remarks
   * Override in subclass to set source-specific rate limit.
   * Default: 1000ms (1 request per second)
   */
  protected rateLimitDelayMs = 1000;

  /**
   * Initializes the importing plugin.
   *
   * @param context - Plugin context with injected dependencies
   *
   * @remarks
   * Retrieves import service from context and calls `onInitialize()`.
   */
  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);

    // Get import service from context config
    // In production, this would be injected via TSyringe
    const importService = context.config.importService as IImportService | undefined;
    if (importService) {
      this.importService = importService;
    }
  }

  /**
   * Fetches eprints from the external source.
   *
   * @param options - Fetch options (pagination, filters)
   * @returns Async iterable of external eprints
   *
   * @remarks
   * Implementations should:
   * - Respect rate limits using `rateLimit()`
   * - Handle pagination via cursor
   * - Catch and log errors for individual items
   *
   * @example
   * ```typescript
   * async *fetchEprints(options?: FetchOptions): AsyncIterable<ExternalEprint> {
   *   let cursor = options?.cursor;
   *   do {
   *     await this.rateLimit();
   *     const response = await this.fetchPage(cursor);
   *     for (const item of response.items) {
   *       yield this.mapToEprint(item);
   *     }
   *     cursor = response.nextCursor;
   *   } while (cursor && (!options?.limit || count < options.limit));
   * }
   * ```
   */
  abstract fetchEprints(options?: FetchOptions): AsyncIterable<ExternalEprint>;

  /**
   * Checks if an eprint has already been imported.
   *
   * @param externalId - Source-specific identifier
   * @returns True if already imported
   */
  async isImported(externalId: string): Promise<boolean> {
    if (!this.importService) {
      this.logger.warn('Import service not available, skipping dedup check');
      return false;
    }
    return this.importService.exists(this.source, externalId);
  }

  /**
   * Gets an existing import by external ID.
   *
   * @param externalId - Source-specific identifier
   * @returns Imported eprint or null if not found
   */
  async getExistingImport(externalId: string): Promise<ImportedEprint | null> {
    if (!this.importService) {
      return null;
    }
    return this.importService.get(this.source, externalId);
  }

  /**
   * Imports an eprint into the AppView cache.
   *
   * @param eprint - External eprint data
   * @returns Created or existing imported eprint
   *
   * @remarks
   * Performs deduplication and emits `import.created` event on success.
   *
   * @throws Error if import service unavailable
   */
  async importEprint(eprint: ExternalEprint): Promise<ImportedEprint> {
    if (!this.importService) {
      throw new PluginError(this.id, 'EXECUTE', 'Import service not available');
    }

    // Check for existing import
    const existing = await this.importService.get(this.source, eprint.externalId);
    if (existing) {
      this.logger.debug('Eprint already imported', {
        source: this.source,
        externalId: eprint.externalId,
      });
      return existing;
    }

    // Create new import
    const imported = await this.importService.create({
      source: this.source,
      externalId: eprint.externalId,
      externalUrl: eprint.url,
      title: eprint.title,
      abstract: eprint.abstract,
      authors: eprint.authors,
      publicationDate: eprint.publicationDate,
      doi: eprint.doi,
      pdfUrl: eprint.pdfUrl,
      categories: eprint.categories,
      importedByPlugin: this.id,
      metadata: eprint.metadata,
    });

    this.logger.info('Eprint imported', {
      source: this.source,
      externalId: eprint.externalId,
      title: eprint.title,
    });

    // Record metrics
    this.recordCounter('imports_created', { source: this.source });

    // Emit event for downstream processing
    this.context.eventBus.emit('import.created', {
      importId: imported.id,
      source: this.source,
      externalId: eprint.externalId,
      title: eprint.title,
    });

    return imported;
  }

  /**
   * Updates an existing import with new data.
   *
   * @param id - Internal import ID
   * @param eprint - Updated eprint data
   * @returns Updated imported eprint
   */
  async updateImport(id: number, eprint: Partial<ExternalEprint>): Promise<ImportedEprint> {
    if (!this.importService) {
      throw new PluginError(this.id, 'EXECUTE', 'Import service not available');
    }

    const updated = await this.importService.update(id, {
      title: eprint.title,
      abstract: eprint.abstract,
      authors: eprint.authors as ExternalAuthor[] | undefined,
      doi: eprint.doi,
      pdfUrl: eprint.pdfUrl,
      lastSyncedAt: new Date(),
      syncStatus: 'active',
    });

    this.logger.debug('Import updated', {
      id,
      source: this.source,
    });

    // Record metrics
    this.recordCounter('imports_updated', { source: this.source });

    // Emit event
    this.context.eventBus.emit('import.updated', {
      importId: id,
      source: this.source,
    });

    return updated;
  }

  /**
   * Runs a full import cycle.
   *
   * @param options - Fetch options
   * @returns Import statistics
   *
   * @remarks
   * Fetches eprints and imports new ones, updating existing ones.
   * Respects rate limits and handles errors gracefully.
   */
  async runImportCycle(options?: FetchOptions): Promise<ImportCycleResult> {
    const result: ImportCycleResult = {
      totalFetched: 0,
      newImports: 0,
      updated: 0,
      errors: 0,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const endTimer = this.startTimer('import_cycle_duration', { source: this.source });

    try {
      for await (const eprint of this.fetchEprints(options)) {
        result.totalFetched++;

        try {
          const existing = await this.getExistingImport(eprint.externalId);

          if (existing) {
            // Update existing import
            await this.updateImport(existing.id, eprint);
            result.updated++;
          } else {
            // Create new import
            await this.importEprint(eprint);
            result.newImports++;
          }
        } catch (err) {
          this.logger.warn('Failed to process eprint', {
            error: (err as Error).message,
            externalId: eprint.externalId,
          });
          result.errors++;
          this.recordCounter('import_errors', { source: this.source });
        }
      }
    } finally {
      endTimer();
      result.completedAt = new Date();
    }

    this.logger.info('Import cycle completed', {
      source: this.source,
      ...result,
    });

    return result;
  }

  /**
   * Enforces rate limiting for external requests.
   *
   * @remarks
   * Call this before making external API/HTTP requests.
   * Delays execution if needed to respect rate limit.
   */
  protected async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.rateLimitDelayMs) {
      const delay = this.rateLimitDelayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Parses external ID from a URL.
   *
   * @param url - URL to parse
   * @returns External ID or null if not parseable
   *
   * @remarks
   * Override in subclass for source-specific URL parsing.
   * Default implementation returns null.
   *
   * @example
   * ```typescript
   * // ArXiv: https://arxiv.org/abs/2401.12345
   * parseExternalId('https://arxiv.org/abs/2401.12345'); // '2401.12345'
   * ```
   */
  parseExternalId(url: string): string | null {
    // Default: subclasses should override
    void url;
    return null;
  }

  /**
   * Builds the canonical URL for an eprint.
   *
   * @param externalId - Source-specific identifier
   * @returns Full URL to the eprint
   *
   * @remarks
   * Override in subclass for source-specific URL building.
   */
  abstract buildEprintUrl(externalId: string): string;

  /**
   * Builds the PDF URL for an eprint (if available).
   *
   * @param externalId - Source-specific identifier
   * @returns PDF URL or null if not available
   *
   * @remarks
   * Override in subclass for source-specific PDF URL building.
   * Default implementation returns null.
   */
  buildPdfUrl(externalId: string): string | null {
    void externalId;
    return null;
  }
}

/**
 * Result of an import cycle.
 *
 * @public
 */
export interface ImportCycleResult {
  /**
   * Total eprints fetched from source.
   */
  totalFetched: number;

  /**
   * Number of new imports created.
   */
  newImports: number;

  /**
   * Number of existing imports updated.
   */
  updated: number;

  /**
   * Number of errors encountered.
   */
  errors: number;

  /**
   * When the cycle started.
   */
  startedAt: Date;

  /**
   * When the cycle completed.
   */
  completedAt: Date;
}
