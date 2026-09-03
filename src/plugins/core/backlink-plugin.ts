/**
 * Base class for plugins that track backlinks from ATProto ecosystem.
 *
 * @remarks
 * This module provides an abstract base class for plugins that index
 * backlinks from other ATProto applications (Cosmik, Leaflet, standard.site,
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
 * export class CosmikBacklinksPlugin extends BacklinkTrackingPlugin {
 *   readonly id = 'pub.chive.plugin.cosmik-backlinks';
 *   readonly trackedCollection = 'network.cosmik.collection';
 *   readonly sourceType: BacklinkSourceType = 'cosmik.collection';
 *
 *   extractEprintRefs(record: unknown): string[] {
 *     const collection = record as CosmikCollection;
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
   * @example "network.cosmik.collection", "app.bsky.feed.post"
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
   *   const collection = record as CosmikCollection;
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
   *   const collection = record as CosmikCollection;
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
   *   const collection = record as CosmikCollection;
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
  /**
   * Normalises a reference to an eprint into its AT-URI.
   *
   * @param value - A candidate reference, as an AT-URI or a chive.pub link
   * @returns The eprint's AT-URI, or undefined when the value names no eprint
   *
   * @remarks
   * A reference to a paper arrives written the way a person writes it. Someone
   * composing an essay pastes `https://chive.pub/eprints/...`; only a machine
   * writes the AT-URI. Both name the same work, and a backlink has to record
   * the AT-URI either way -- the URL is not something an eprint can be looked
   * up by, so a backlink stored under it points at nothing and renders nowhere.
   *
   * @see {@link BacklinkTrackingPlugin.isEprintUri} for the cheaper test that
   * only asks whether a string mentions an eprint at all.
   */
  protected toEprintUri(value: string | undefined | null): string | undefined {
    return value ? eprintUriFrom(value) : undefined;
  }

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
   * (e.g., Leaflet documents).
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

/**
 * The path an eprint is served under on the web.
 */
const EPRINT_PATH_PREFIX = '/eprints/';

/**
 * The collection every eprint AT-URI contains.
 */
const EPRINT_COLLECTION = 'pub.chive.eprint.submission';

/**
 * Normalises a reference to an eprint into its AT-URI.
 *
 * @param value - A candidate reference, as an AT-URI or a chive.pub link
 * @returns The eprint's AT-URI, or undefined when the value names no eprint
 *
 * @remarks
 * One implementation, shared. Each plugin reading foreign records needs this,
 * and a copy per plugin is how one of them comes to accept a form the others
 * reject.
 *
 * @public
 */
export function eprintUriFrom(value: string): string | undefined {
  if (!value.includes(EPRINT_COLLECTION)) {
    return undefined;
  }

  if (value.startsWith('at://')) {
    return trimTrailing(value);
  }

  const marker = value.indexOf(EPRINT_PATH_PREFIX);
  if (marker < 0) {
    return undefined;
  }

  const tail = value.slice(marker + EPRINT_PATH_PREFIX.length).split(/[?#]/)[0];
  if (!tail) {
    return undefined;
  }

  // Decoding an already-decoded AT-URI is a no-op, so one pass covers both
  // forms. A malformed encoding throws and means "not an eprint reference".
  let decoded: string;
  try {
    decoded = decodeURIComponent(tail);
  } catch {
    return undefined;
  }

  return decoded.startsWith('at://') && decoded.includes(EPRINT_COLLECTION)
    ? trimTrailing(decoded)
    : undefined;
}

/**
 * Drops a trailing slash, which a pasted link commonly carries.
 */
function trimTrailing(uri: string): string {
  return uri.endsWith('/') ? uri.slice(0, -1) : uri;
}
