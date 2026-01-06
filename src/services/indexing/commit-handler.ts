/**
 * Commit event handler for firehose operations.
 *
 * @remarks
 * Parses commit events from the firehose, extracting operations and
 * decoding records from CAR (Content Addressable aRchive) files.
 *
 * Commit events contain CAR files with IPLD blocks encoded as DAG-CBOR.
 * This handler decodes those blocks to extract the actual record data.
 *
 * **ATProto Commit Format:**
 * - Events contain binary CAR data
 * - CAR files contain multiple blocks (commit, record data, etc.)
 * - Blocks are CBOR-encoded
 * - CIDs are content-addressed hashes
 *
 * @example
 * ```typescript
 * const handler = new CommitHandler();
 *
 * // Parse commit event
 * const ops = await handler.parseCommit({
 *   $type: 'com.atproto.sync.subscribeRepos#commit',
 *   repo: 'did:plc:abc123',
 *   commit: 'bafyrei...',
 *   blocks: Uint8Array(...),  // CAR file bytes
 *   ops: [
 *     { action: 'create', path: 'pub.chive.preprint.submission/xyz', cid: 'bafyrei...' }
 *   ]
 * });
 *
 * for (const op of ops) {
 *   console.log(op.action, op.path, op.record);
 * }
 * ```
 *
 * @packageDocumentation
 * @public
 */

import { CarReader } from '@ipld/car';
import * as cbor from '@ipld/dag-cbor';
import { CID } from 'multiformats/cid';

import type { CID as BrandedCID, DID } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';
import type { RepoOp } from '../../types/interfaces/event-stream.interface.js';

/**
 * Commit event from firehose.
 *
 * @remarks
 * Simplified version of com.atproto.sync.subscribeRepos#commit event.
 *
 * @public
 */
export interface CommitEvent {
  /**
   * Event type discriminator.
   */
  readonly $type: 'com.atproto.sync.subscribeRepos#commit';

  /**
   * Repository DID.
   */
  readonly repo: DID;

  /**
   * Commit CID.
   */
  readonly commit: BrandedCID;

  /**
   * Operations in this commit.
   */
  readonly ops: readonly RepoOp[];

  /**
   * CAR file containing blocks (optional, may be undefined for tooBig events).
   */
  readonly blocks?: Uint8Array;

  /**
   * Sequence number.
   */
  readonly seq: number;

  /**
   * Event timestamp (ISO 8601).
   */
  readonly time: string;

  /**
   * If true, blocks were too large and must be fetched separately.
   */
  readonly tooBig?: boolean;

  /**
   * If true, repository was rebased.
   */
  readonly rebase?: boolean;
}

/**
 * Parsed operation with decoded record.
 *
 * @public
 */
export interface ParsedOp {
  /**
   * Operation type.
   */
  readonly action: 'create' | 'update' | 'delete';

  /**
   * Record path (collection/rkey).
   */
  readonly path: string;

  /**
   * Record CID (for create/update).
   *
   * @remarks
   * Uses branded CID type for type safety.
   */
  readonly cid?: BrandedCID;

  /**
   * Decoded record data (for create/update).
   *
   * @remarks
   * Undefined for delete operations.
   */
  readonly record?: unknown;
}

/**
 * Parse error details.
 *
 * @public
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly cid?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Handles commit event parsing and record decoding.
 *
 * @remarks
 * Decodes CAR files from commit events and extracts CBOR-encoded records.
 *
 * The handler is stateless and can be reused across multiple events.
 *
 * @public
 */
export class CommitHandler {
  /**
   * Parses a commit event and extracts operations with decoded records.
   *
   * @param event - Commit event from firehose
   * @returns Array of parsed operations
   *
   * @throws {@link ParseError}
   * Thrown when CAR parsing or CBOR decoding fails.
   *
   * @remarks
   * Processing steps:
   * 1. Check for tooBig flag (blocks must be fetched separately)
   * 2. Parse CAR file from blocks bytes
   * 3. For each operation:
   *    - Delete operations: return as-is (no record)
   *    - Create/update operations: fetch block from CAR and decode CBOR
   * 4. Return array of parsed operations
   *
   * **Delete Operations:**
   * Delete operations have no CID or record data. They are returned
   * with only action and path.
   *
   * **tooBig Events:**
   * When tooBig is true, blocks are not included in the event. The
   * caller must fetch blocks separately from the PDS using
   * `com.atproto.sync.getRepo` or `com.atproto.sync.getBlocks`.
   *
   * @example
   * ```typescript
   * const handler = new CommitHandler();
   *
   * try {
   *   const ops = await handler.parseCommit(event);
   *
   *   for (const op of ops) {
   *     if (op.action === 'delete') {
   *       console.log('Deleted:', op.path);
   *     } else {
   *       console.log('Record:', op.path, op.record);
   *     }
   *   }
   * } catch (error) {
   *   if (error instanceof ParseError) {
   *     console.error('Parse failed for CID:', error.cid);
   *   }
   * }
   * ```
   */
  async parseCommit(event: CommitEvent): Promise<ParsedOp[]> {
    // Handle tooBig events (blocks must be fetched separately)
    if (event.tooBig) {
      throw new ParseError('Event blocks too large - must fetch separately from PDS', event.commit);
    }

    // No blocks provided
    if (!event.blocks || event.blocks.length === 0) {
      // Return operations without records (caller must handle)
      return event.ops.map((op) => ({
        action: op.action,
        path: op.path,
        cid: op.cid,
      }));
    }

    try {
      // Parse CAR file
      const car = await CarReader.fromBytes(event.blocks);

      const parsedOps: ParsedOp[] = [];

      for (const op of event.ops) {
        if (op.action === 'delete') {
          // Delete operations have no CID or record
          parsedOps.push({
            action: 'delete',
            path: op.path,
          });
          continue;
        }

        // Create/update operations have CID and record data
        if (!op.cid) {
          throw new ParseError(`Missing CID for ${op.action} operation`, undefined);
        }

        try {
          // Parse CID
          const cid = CID.parse(op.cid);

          // Fetch block from CAR
          const block = await car.get(cid);

          if (!block) {
            throw new ParseError(`Block not found in CAR`, op.cid);
          }

          // Decode CBOR
          const record = cbor.decode(block.bytes);

          parsedOps.push({
            action: op.action,
            path: op.path,
            cid: op.cid,
            record,
          });
        } catch (error) {
          throw new ParseError(
            `Failed to decode record for ${op.path}`,
            op.cid,
            error instanceof Error ? error : undefined
          );
        }
      }

      return parsedOps;
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }

      throw new ParseError(
        'Failed to parse CAR file',
        event.commit,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validates a parsed operation.
   *
   * @param op - Parsed operation to validate
   * @returns `true` if valid
   *
   * @remarks
   * Validation checks:
   * - Delete operations: must have path, no cid or record
   * - Create/update operations: must have path, cid, and record
   *
   * @example
   * ```typescript
   * const handler = new CommitHandler();
   * const op = await handler.parseCommit(event);
   *
   * if (handler.validateOperation(op[0])) {
   *   await processOperation(op[0]);
   * }
   * ```
   *
   * @public
   */
  validateOperation(op: ParsedOp): boolean {
    if (!op.path) {
      return false;
    }

    if (op.action === 'delete') {
      // Delete operations should not have cid or record
      return !op.cid && !op.record;
    }

    // Create/update operations must have cid and record
    return !!op.cid && !!op.record;
  }

  /**
   * Extracts collection and record key from operation path.
   *
   * @param path - Operation path (format: "collection/rkey")
   * @returns Collection and rkey
   *
   * @remarks
   * Path format: `collection/rkey`
   * Example: `pub.chive.preprint.submission/3kj5h2k3j5h`
   *
   * @throws {Error}
   * Thrown if path format is invalid.
   *
   * @example
   * ```typescript
   * const handler = new CommitHandler();
   * const { collection, rkey } = handler.parsePath('pub.chive.preprint.submission/abc123');
   * // collection: 'pub.chive.preprint.submission'
   * // rkey: 'abc123'
   * ```
   *
   * @public
   */
  parsePath(path: string): { collection: string; rkey: string } {
    const parts = path.split('/');

    if (parts.length !== 2) {
      throw new ValidationError(`Invalid operation path format: ${path}`, 'path', 'format');
    }

    const collection = parts[0];
    const rkey = parts[1];

    if (!collection || !rkey) {
      throw new ValidationError(`Invalid operation path format: ${path}`, 'path', 'format');
    }

    return { collection, rkey };
  }
}
