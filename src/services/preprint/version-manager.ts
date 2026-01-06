/**
 * Version manager for tracking preprint version chains.
 *
 * @remarks
 * Helper utility for traversing and managing preprint version history.
 * Preprints can have multiple versions linked via previousVersionUri.
 *
 * @packageDocumentation
 * @public
 */

import { toTimestamp } from '../../types/atproto-validators.js';
import type { AtUri, CID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';
import type { IStorageBackend } from '../../types/interfaces/storage.interface.js';
import type { PreprintVersion } from '../../types/models/preprint.js';

/**
 * Version chain result.
 *
 * @public
 */
export interface VersionChain {
  /**
   * All versions ordered chronologically (oldest first).
   */
  readonly versions: readonly PreprintVersion[];

  /**
   * Latest version.
   */
  readonly latest: PreprintVersion;

  /**
   * Total version count.
   */
  readonly totalVersions: number;
}

/**
 * Version manager configuration.
 *
 * @public
 */
export interface VersionManagerOptions {
  /**
   * Storage backend for fetching version records.
   */
  readonly storage: IStorageBackend;

  /**
   * Maximum versions to traverse (prevents infinite loops).
   *
   * @defaultValue 100
   */
  readonly maxVersions?: number;
}

/**
 * Version manager for preprint version chains.
 *
 * @remarks
 * Handles version history traversal following previousVersionUri links.
 * Builds chronologically ordered version chains for display.
 *
 * @example
 * ```typescript
 * const manager = new VersionManager({ storage });
 *
 * // Get complete version chain
 * const chain = await manager.getVersionChain(latestUri);
 * console.log(`${chain.totalVersions} versions`);
 *
 * // Get specific version
 * const v1 = await manager.getVersion(chain.versions[0].uri);
 * ```
 *
 * @public
 */
export class VersionManager {
  private readonly storage: IStorageBackend;
  private readonly maxVersions: number;

  /**
   * Creates version manager.
   *
   * @param options - Configuration options
   */
  constructor(options: VersionManagerOptions) {
    this.storage = options.storage;
    this.maxVersions = options.maxVersions ?? 100;
  }

  /**
   * Gets complete version chain for preprint.
   *
   * @param uri - URI of any version in chain
   * @returns Complete version chain
   *
   * @remarks
   * Traverses previousVersionUri links backwards to find all versions.
   * Returns chronologically ordered list (oldest first).
   *
   * **Algorithm:**
   * 1. Start from given URI
   * 2. Follow previousVersionUri chain backwards
   * 3. Stop at first version (no previousVersionUri)
   * 4. Return array ordered oldest to newest
   *
   * @throws {Error}
   * Thrown if version chain exceeds maxVersions (likely circular reference).
   *
   * @example
   * ```typescript
   * const chain = await manager.getVersionChain(currentUri);
   * console.log(`Version ${chain.latest.versionNumber} of ${chain.totalVersions}`);
   *
   * // Display history
   * for (const version of chain.versions) {
   *   console.log(`v${version.versionNumber}: ${version.changes}`);
   * }
   * ```
   *
   * @public
   */
  async getVersionChain(uri: AtUri): Promise<VersionChain> {
    const tempVersions: {
      uri: AtUri;
      cid: CID;
      previousVersionUri?: AtUri;
      changes: string;
      createdAt: ReturnType<typeof toTimestamp>;
    }[] = [];
    let currentUri: AtUri | undefined = uri;
    let iterations = 0;

    while (currentUri && iterations < this.maxVersions) {
      const preprint = await this.storage.getPreprint(currentUri);

      if (!preprint) {
        throw new NotFoundError('PreprintVersion', currentUri);
      }

      tempVersions.push({
        uri: preprint.uri,
        cid: preprint.cid,
        previousVersionUri: preprint.previousVersionUri,
        changes: preprint.versionNotes ?? '',
        createdAt: toTimestamp(preprint.createdAt),
      });

      currentUri = preprint.previousVersionUri;
      iterations++;
    }

    if (iterations >= this.maxVersions) {
      throw new DatabaseError(
        'READ',
        `Version chain exceeded max length (${this.maxVersions}), possible circular reference`
      );
    }

    tempVersions.reverse();

    const versions: PreprintVersion[] = tempVersions.map((v, index) => ({
      ...v,
      versionNumber: index + 1,
    }));

    const latest = versions[versions.length - 1];
    if (!latest) {
      throw new DatabaseError('READ', 'Version chain is empty');
    }

    return {
      versions,
      latest,
      totalVersions: versions.length,
    };
  }

  /**
   * Gets specific version by URI.
   *
   * @param uri - Version URI
   * @returns Version or null if not found
   *
   * @public
   */
  async getVersion(uri: AtUri): Promise<PreprintVersion | null> {
    const preprint = await this.storage.getPreprint(uri);

    if (!preprint) {
      return null;
    }

    const chain = await this.getVersionChain(uri);
    const positionInChain = chain.versions.findIndex((v) => v.uri === uri);

    if (positionInChain === -1) {
      throw new DatabaseError('READ', `Version ${uri} not found in its own chain`);
    }

    return {
      uri: preprint.uri,
      cid: preprint.cid,
      versionNumber: positionInChain + 1,
      previousVersionUri: preprint.previousVersionUri,
      changes: preprint.versionNotes ?? '',
      createdAt: toTimestamp(preprint.createdAt),
    };
  }

  /**
   * Gets latest version in chain.
   *
   * @param uri - URI of any version in chain
   * @returns Latest version
   *
   * @remarks
   * Traverses forward from given URI to find latest.
   *
   * @public
   */
  async getLatestVersion(uri: AtUri): Promise<PreprintVersion> {
    const chain = await this.getVersionChain(uri);
    return chain.latest;
  }

  /**
   * Checks if version is latest in chain.
   *
   * @param uri - Version URI
   * @returns True if this is the latest version
   *
   * @public
   */
  async isLatestVersion(uri: AtUri): Promise<boolean> {
    const chain = await this.getVersionChain(uri);
    return chain.latest.uri === uri;
  }
}
