/**
 * Base class for plugins that track backlinks from ATProto ecosystem.
 *
 * @remarks
 * This module provides an abstract base class for plugins that index
 * backlinks from other ATProto applications (Semble, Leaflet, WhiteWind,
 * Bluesky) that reference Chive eprints.
 *
 * All backlinks follow ATProto compliance:
 * - Indexed from firehose (rebuildable by replay)
 * - Tracks deletions to honor record removal
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type {
  Backlink,
  BacklinkSourceType,
  IBacklinkService,
  IPluginContext,
} from '../../types/interfaces/plugin.interface.js';
import { BasePlugin } from '../builtin/base-plugin.js';

/**
 * ATProto record from firehose.
 *
 * @public
 * @since 0.1.0
 */
export interface FirehoseRecord {
  /**
   * AT-URI of the record.
   */
  readonly uri: string;

  /**
   * Collection NSID.
   */
  readonly collection: string;

  /**
   * DID of the record owner.
   */
  readonly did: string;

  /**
   * Record key.
   */
  readonly rkey: string;

  /**
   * Record data (null for deletions).
   */
  readonly record: Record<string, unknown> | null;

  /**
   * Whether this is a deletion event.
   */
  readonly deleted: boolean;

  /**
   * CID of the record (for create/update).
   */
  readonly cid?: string;

  /**
   * Timestamp of the event.
   */
  readonly timestamp: Date;
}

/**
 * Base class for plugins that track backlinks from ATProto ecosystem.
 *
 * @remarks
 * Provides common functionality for tracking references to Chive eprints
 * from other ATProto applications:
 * - Firehose record filtering
 * - Backlink service integration
 * - Deletion handling
 * - Event emission
 *
 * Subclasses must implement:
 * - `trackedCollection` - ATProto collection to filter for
 * - `sourceType` - Type identifier for backlinks
 * - `extractEprintRefs()` - Extracts eprint AT-URIs from records
 *
 * Subclasses may override:
 * - `extractContext()` - Extracts context (title, description) from records
 * - `shouldProcess()` - Additional filtering logic
 *
 * @example
 * ```typescript
 * export class SembleBacklinksPlugin extends BacklinkTrackingPlugin {
 *   readonly id = 'pub.chive.plugin.semble-backlinks';
 *   readonly trackedCollection = 'xyz.semble.collection';
 *   readonly sourceType: BacklinkSourceType = 'semble.collection';
 *
 *   extractEprintRefs(record: unknown): string[] {
 *     const collection = record as SembleCollection;
 *     return collection.items
 *       .filter(item => item.uri?.includes('pub.chive.eprint'))
 *       .map(item => item.uri);
 *   }
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export abstract class BacklinkTrackingPlugin extends BasePlugin {
  /**
   * ATProto collection NSID to track.
   *
   * @remarks
   * Records from this collection will be processed for backlinks.
   *
   * @example "xyz.semble.collection", "app.bsky.feed.post"
   */
  abstract readonly trackedCollection: string;

  /**
   * Backlink source type identifier.
   *
   * @remarks
   * Used to categorize backlinks by source application.
   */
  abstract readonly sourceType: BacklinkSourceType;

  /**
   * Backlink service instance.
   *
   * @remarks
   * Set during initialization via dependency injection from context.
   */
  protected backlinkService!: IBacklinkService;

  /**
   * Initializes the backlink tracking plugin.
   *
   * @param context - Plugin context with injected dependencies
   *
   * @remarks
   * Retrieves backlink service from context and subscribes to
   * firehose events for the tracked collection.
   */
  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);

    // Get backlink service from context config
    const backlinkService = context.config.backlinkService as IBacklinkService | undefined;
    if (backlinkService) {
      this.backlinkService = backlinkService;
    }

    // Subscribe to firehose events for our collection
    // The firehose consumer will filter and emit these events
    this.context.eventBus.on(
      `firehose.${this.trackedCollection}`,
      (...args: readonly unknown[]) => {
        const record = args[0] as FirehoseRecord;
        void this.handleFirehoseRecord(record);
      }
    );

    this.logger.info('Backlink tracking initialized', {
      collection: this.trackedCollection,
      sourceType: this.sourceType,
    });
  }

  /**
   * Handles a firehose record event.
   *
   * @param record - Firehose record
   *
   * @remarks
   * Processes create/update and delete events for backlink tracking.
   */
  async handleFirehoseRecord(record: FirehoseRecord): Promise<void> {
    try {
      if (record.deleted) {
        await this.handleDeletion(record.uri);
      } else if (record.record) {
        await this.handleRecord(record.uri, record.record);
      }
    } catch (err) {
      this.logger.warn('Failed to process firehose record', {
        error: (err as Error).message,
        uri: record.uri,
        collection: record.collection,
      });
      this.recordCounter('backlink_errors', { source_type: this.sourceType });
    }
  }

  /**
   * Handles a record create/update event.
   *
   * @param uri - AT-URI of the record
   * @param record - Record data
   *
   * @remarks
   * Extracts eprint references and creates backlinks.
   */
  async handleRecord(uri: string, record: Record<string, unknown>): Promise<void> {
    // Check if we should process this record
    if (!this.shouldProcess(record)) {
      return;
    }

    // Extract eprint references
    const eprintRefs = this.extractEprintRefs(record);

    if (eprintRefs.length === 0) {
      return;
    }

    // Extract context (title, description, etc.)
    const context = this.extractContext(record);

    // Create backlinks for each reference
    for (const targetUri of eprintRefs) {
      await this.createBacklink(uri, targetUri, context);
    }

    this.logger.debug('Processed backlinks from record', {
      uri,
      targetCount: eprintRefs.length,
    });
  }

  /**
   * Handles a record deletion event.
   *
   * @param uri - AT-URI of the deleted record
   *
   * @remarks
   * Marks backlinks from this source as deleted.
   */
  async handleDeletion(uri: string): Promise<void> {
    if (!this.backlinkService) {
      return;
    }

    await this.backlinkService.deleteBacklink(uri);

    this.logger.debug('Backlink source deleted', { uri });
    this.recordCounter('backlinks_deleted', { source_type: this.sourceType });

    // Emit event for downstream processing
    this.context.eventBus.emit('backlink.deleted', {
      sourceUri: uri,
      sourceType: this.sourceType,
    });
  }

  /**
   * Creates a backlink.
   *
   * @param sourceUri - AT-URI of the source record
   * @param targetUri - AT-URI of the target eprint
   * @param context - Optional context (title, description)
   *
   * @returns Created backlink
   */
  protected async createBacklink(
    sourceUri: string,
    targetUri: string,
    context?: string
  ): Promise<Backlink | null> {
    if (!this.backlinkService) {
      this.logger.warn('Backlink service not available');
      return null;
    }

    const backlink = await this.backlinkService.createBacklink({
      sourceUri,
      sourceType: this.sourceType,
      targetUri,
      context,
    });

    this.recordCounter('backlinks_created', { source_type: this.sourceType });

    // Emit event for downstream processing
    this.context.eventBus.emit('backlink.created', {
      sourceUri,
      sourceType: this.sourceType,
      targetUri,
    });

    return backlink;
  }

  /**
   * Extracts eprint AT-URIs from a record.
   *
   * @param record - Record data
   * @returns Array of eprint AT-URIs referenced in the record
   *
   * @remarks
   * Must be implemented by subclasses. Should extract all AT-URIs
   * that reference Chive eprints (pub.chive.eprint.submission).
   *
   * @example
   * ```typescript
   * extractEprintRefs(record: unknown): string[] {
   *   const collection = record as SembleCollection;
   *   return collection.items
   *     .filter(item => isEprintUri(item.uri))
   *     .map(item => item.uri);
   * }
   * ```
   */
  abstract extractEprintRefs(record: unknown): string[];

  /**
   * Extracts context from a record.
   *
   * @param record - Record data
   * @returns Context string (title, description) or undefined
   *
   * @remarks
   * Override in subclass to extract meaningful context.
   * Default implementation returns undefined.
   *
   * @example
   * ```typescript
   * protected extractContext(record: unknown): string | undefined {
   *   const collection = record as SembleCollection;
   *   return collection.title || collection.description;
   * }
   * ```
   */
  protected extractContext(record: unknown): string | undefined {
    void record;
    return undefined;
  }

  /**
   * Determines if a record should be processed.
   *
   * @param record - Record data
   * @returns True if the record should be processed
   *
   * @remarks
   * Override in subclass for additional filtering logic.
   * Default implementation returns true (process all records).
   *
   * @example
   * ```typescript
   * protected shouldProcess(record: unknown): boolean {
   *   const collection = record as SembleCollection;
   *   // Only process public collections
   *   return collection.visibility === 'public';
   * }
   * ```
   */
  protected shouldProcess(record: unknown): boolean {
    void record;
    return true;
  }

  /**
   * Checks if a URI is a Chive eprint URI.
   *
   * @param uri - AT-URI to check
   * @returns True if the URI references a Chive eprint
   *
   * @remarks
   * Helper method for filtering URIs in `extractEprintRefs()`.
   */
  protected isEprintUri(uri: string | undefined | null): uri is string {
    if (!uri) return false;
    return uri.includes('pub.chive.eprint.submission');
  }

  /**
   * Extracts AT-URIs from text content.
   *
   * @param text - Text that may contain AT-URIs
   * @returns Array of AT-URIs found in the text
   *
   * @remarks
   * Helper method for extracting AT-URIs from markdown content
   * (e.g., WhiteWind blog posts).
   */
  protected extractUrisFromText(text: string): string[] {
    // Match at:// URIs
    const atUriPattern = /at:\/\/[a-zA-Z0-9:.]+\/[a-zA-Z0-9.]+\/[a-zA-Z0-9]+/g;
    const matches = text.match(atUriPattern) ?? [];

    // Filter for Chive eprint URIs
    return matches.filter((uri) => this.isEprintUri(uri));
  }

  /**
   * Default implementation of onInitialize.
   *
   * @remarks
   * Override in subclass for additional initialization logic.
   * The base BacklinkTrackingPlugin already handles firehose subscription
   * in the `initialize()` override.
   */
  protected onInitialize(): Promise<void> {
    return Promise.resolve();
  }
}
