/**
 * Event filtering for firehose consumption.
 *
 * @remarks
 * Filters repository operations to include only pub.chive.* collections,
 * reducing processing overhead by rejecting non-Chive events early.
 *
 * The filter uses NSID (Namespaced Identifier) matching to determine
 * which events to process. NSIDs follow the format:
 * `domain.namespace.collection` (e.g., "pub.chive.eprint.submission")
 *
 * @example
 * ```typescript
 * const filter = new EventFilter({
 *   collections: [
 *     'pub.chive.eprint.submission',
 *     'pub.chive.review.comment'
 *   ]
 * });
 *
 * for (const op of event.ops) {
 *   if (filter.shouldProcess(op)) {
 *     await processOperation(op);
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 * @public
 */

import type { NSID } from '../../types/atproto.js';
import type { RepoOp } from '../../types/interfaces/event-stream.interface.js';

/**
 * Event filter options.
 *
 * @public
 */
export interface EventFilterOptions {
  /**
   * Specific collections to include.
   *
   * @remarks
   * If provided, only operations for these exact collections are processed.
   * If omitted, all pub.chive.* collections are accepted.
   *
   * @example
   * ```typescript
   * {
   *   collections: [
   *     'pub.chive.eprint.submission',
   *     'pub.chive.review.comment'
   *   ]
   * }
   * ```
   */
  readonly collections?: readonly NSID[];

  /**
   * Foreign collections to admit for the plugin bus.
   *
   * @remarks
   * Collections outside `pub.chive.*` that Chive observes but does not index.
   * They are forwarded to the backlink plugins by the event processor; nothing
   * writes them to a Chive index. Omitted means no foreign collection is
   * admitted, which is what starved every backlink plugin.
   *
   * @example
   * ```typescript
   * { observedCollections: ['at.margin.note', 'com.whtwnd.blog.entry'] }
   * ```
   */
  readonly observedCollections?: readonly string[];

  /**
   * Enable strict validation of collection NSIDs.
   *
   * @remarks
   * When true, validates NSID format strictly. When false, performs
   * basic string matching only.
   *
   * @defaultValue true
   */
  readonly strictValidation?: boolean;
}

/**
 * Filters firehose events by collection NSID.
 *
 * @remarks
 * Performs early rejection of non-Chive events to minimize processing
 * overhead. All pub.chive.* collections are accepted by default, or
 * only specific collections if configured.
 *
 * The filter is stateless and thread-safe.
 *
 * @public
 */
export class EventFilter {
  private readonly collections?: ReadonlySet<NSID>;
  private readonly observedCollections: ReadonlySet<string>;
  private readonly strictValidation: boolean;

  /**
   * Creates an event filter.
   *
   * @param options - Filter options
   */
  constructor(options: EventFilterOptions = {}) {
    this.collections = options.collections ? new Set(options.collections) : undefined;
    this.observedCollections = new Set(options.observedCollections ?? []);
    this.strictValidation = options.strictValidation ?? true;
  }

  /**
   * Determines if an operation should be processed.
   *
   * @param op - Repository operation from firehose event
   * @returns `true` if operation should be processed
   *
   * @remarks
   * Returns `true` if:
   * 1. Collection starts with "pub.chive."
   * 2. Collection is in allowlist (if specified)
   * 3. NSID format is valid (if strict validation enabled)
   *
   * Returns `false` otherwise (reject early for performance).
   *
   * @example
   * ```typescript
   * const filter = new EventFilter();
   *
   * const op1 = { path: 'pub.chive.eprint.submission/abc123' };
   * filter.shouldProcess(op1); // true
   *
   * const op2 = { path: 'app.bsky.feed.post/xyz789' };
   * filter.shouldProcess(op2); // false
   * ```
   */
  shouldProcess(op: RepoOp): boolean {
    const collection = this.extractCollection(op.path);

    if (!collection) {
      return false;
    }

    // Foreign collections Chive observes for backlinks. They are admitted so
    // the event processor can forward them to the plugin bus, and are checked
    // before the `collections` allow-list below because that list names the
    // Chive collections to index and says nothing about these.
    if (this.observedCollections.has(collection)) {
      return this.strictValidation ? this.isValidNSID(collection) : true;
    }

    // Reject everything else outside the Chive namespace.
    if (!collection.startsWith('pub.chive.')) {
      return false;
    }

    // If specific collections specified, check membership
    if (this.collections && !this.collections.has(collection as NSID)) {
      return false;
    }

    // Validate NSID format if strict mode enabled
    if (this.strictValidation && !this.isValidNSID(collection)) {
      return false;
    }

    return true;
  }

  /**
   * Extracts collection NSID from operation path.
   *
   * @param path - Operation path (format: "collection/rkey")
   * @returns Collection NSID or empty string if invalid
   *
   * @remarks
   * Operation paths follow the format: `collection/rkey`
   * Example: `pub.chive.eprint.submission/3kj5h2k3j5h`
   *
   * @example
   * ```typescript
   * const filter = new EventFilter();
   * const collection = filter.extractCollection('pub.chive.eprint.submission/abc123');
   * // Returns: 'pub.chive.eprint.submission'
   * ```
   *
   * @public
   */
  extractCollection(path: string): string {
    if (!path) {
      return '';
    }

    const parts = path.split('/');
    return parts[0] ?? '';
  }

  /**
   * Validates NSID format.
   *
   * @param nsid - NSID to validate
   * @returns `true` if valid NSID format
   *
   * @remarks
   * Valid NSID format: `domain.namespace.name`
   * - Minimum 3 segments (domain authority + 2 name segments)
   * - Maximum 253 total characters
   * - Each segment: lowercase letters, digits, hyphens
   * - No consecutive hyphens, no leading/trailing hyphens
   *
   * @see {@link https://atproto.com/specs/nsid | NSID Specification}
   *
   * @internal
   */
  private isValidNSID(nsid: string): boolean {
    if (!nsid || nsid.length > 253) {
      return false;
    }

    const segments = nsid.split('.');

    // Must have at least 3 segments (domain authority + 2 name segments)
    if (segments.length < 3) {
      return false;
    }

    // An NSID is a domain authority followed by a name. They have different
    // rules, and treating them alike is what made this filter drop seven of
    // Chive's own collections: the authority segments are domain labels and
    // are lowercase, but the final name segment allows any letter, which is
    // where camelCase lives — `userTag`, `nodeProposal`, `createRecord`.
    const name = segments[segments.length - 1];
    const authority = segments.slice(0, -1);

    if (name === undefined) {
      return false;
    }

    for (const segment of authority) {
      if (!this.isValidNSIDSegment(segment)) {
        return false;
      }
    }

    return this.isValidNSIDName(name);
  }

  /**
   * Validates the final (name) segment of an NSID.
   *
   * @param segment - Name segment
   * @returns `true` if valid
   *
   * @remarks
   * The grammar is `name = alpha *( alpha / number )`: a letter, then letters
   * or digits, up to 63 characters. Unlike the authority segments it carries no
   * hyphens and cannot begin with a digit, and its conventional form is
   * camelCase — which is the part this filter used to reject.
   *
   * Checked against the regex `@atproto/syntax` uses, so `userTag`,
   * `collectionLinkRemoval` and `submission3` are accepted while
   * `submission-type` and `user_tag` are not.
   *
   * @see {@link https://atproto.com/specs/nsid | NSID specification}
   *
   * @internal
   */
  private isValidNSIDName(segment: string): boolean {
    return /^[A-Za-z][A-Za-z0-9]{0,62}$/.test(segment);
  }

  /**
   * Validates individual NSID segment.
   *
   * @param segment - NSID segment to validate
   * @returns `true` if valid segment
   *
   * @remarks
   * Valid segment:
   * - Length: 1-63 characters
   * - Characters: lowercase letters, digits, hyphens
   * - No consecutive hyphens
   * - No leading/trailing hyphens
   *
   * @internal
   */
  private isValidNSIDSegment(segment: string): boolean {
    if (!segment || segment.length > 63) {
      return false;
    }

    // Must start and end with alphanumeric
    if (!/^[a-z0-9]/.test(segment) || !/[a-z0-9]$/.test(segment)) {
      return false;
    }

    // Only lowercase letters, digits, and hyphens allowed
    if (!/^[a-z0-9-]+$/.test(segment)) {
      return false;
    }

    // No consecutive hyphens
    if (segment.includes('--')) {
      return false;
    }

    return true;
  }

  /**
   * Gets configured collection filter.
   *
   * @returns Set of allowed collections or undefined if all pub.chive.* allowed
   */
  getCollectionFilter(): ReadonlySet<NSID> | undefined {
    return this.collections;
  }
}
