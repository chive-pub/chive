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
  private readonly strictValidation: boolean;

  /**
   * Creates an event filter.
   *
   * @param options - Filter options
   */
  constructor(options: EventFilterOptions = {}) {
    this.collections = options.collections ? new Set(options.collections) : undefined;
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

    // Reject non-Chive collections early
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

    // Validate each segment
    for (const segment of segments) {
      if (!this.isValidNSIDSegment(segment)) {
        return false;
      }
    }

    return true;
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
