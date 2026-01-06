/**
 * CID verification for blob integrity checking.
 *
 * @remarks
 * Verifies that blob data matches its Content Identifier (CID) to prevent
 * tampering, substitution attacks, or data corruption.
 *
 * **CID Structure** (IPLD):
 * ```
 * CID = <multibase><version><multicodec><multihash>
 * ```
 *
 * **ATProto Blobs**:
 * - CID version: 1
 * - Multicodec: raw (0x55) or dag-cbor (0x71)
 * - Multihash: SHA-256 (0x12)
 * - Multibase: base32 (default for CIDv1)
 *
 * Industry standard approach used by:
 * - IPFS (InterPlanetary File System)
 * - Filecoin
 * - AT Protocol
 *
 * @packageDocumentation
 * @public
 */

import * as dagCbor from '@ipld/dag-cbor';
import { CID as IPLDCid } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';

import type { CID } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * CID verifier configuration.
 *
 * @public
 */
export interface CIDVerifierConfig {
  /**
   * Logger for verification events.
   */
  readonly logger?: ILogger;
}

/**
 * CID verification result.
 *
 * @public
 */
export interface CIDVerificationResult {
  /**
   * Whether CID matches blob data.
   */
  readonly isValid: boolean;

  /**
   * Expected CID (from parameter).
   */
  readonly expectedCID: string;

  /**
   * Computed CID (from blob data).
   */
  readonly computedCID: string;

  /**
   * Codec used (raw or dag-cbor).
   */
  readonly codec: 'raw' | 'dag-cbor';

  /**
   * Hash algorithm used.
   */
  readonly hashAlgorithm: 'sha256';
}

/**
 * CID verifier for blob integrity checking.
 *
 * @remarks
 * Computes CID from blob data and compares against expected CID.
 *
 * **Verification Process**:
 * 1. Parse expected CID string to IPLD CID
 * 2. Determine codec (raw or dag-cbor) from CID
 * 3. Compute multihash of blob data using SHA-256
 * 4. Construct CID from multihash
 * 5. Compare computed CID with expected CID
 *
 * @example
 * ```typescript
 * const verifier = new CIDVerifier({ logger });
 *
 * const result = await verifier.verify(expectedCID, blobData);
 *
 * if (!result.isValid) {
 *   throw new ValidationError(
 *     `CID mismatch: expected ${result.expectedCID}, got ${result.computedCID}`,
 *     'cid',
 *     'integrity'
 *   );
 * }
 * ```
 *
 * @public
 */
export class CIDVerifier {
  private readonly logger?: ILogger;

  constructor(config: CIDVerifierConfig = {}) {
    this.logger = config.logger;
  }

  /**
   * Verifies blob data matches expected CID.
   *
   * @param expectedCID - Expected CID (as branded string)
   * @param data - Blob data
   * @returns Verification result
   *
   * @remarks
   * **Algorithm**:
   * 1. Parse CID string to IPLD CID object
   * 2. Extract codec from CID
   * 3. Hash blob data with SHA-256
   * 4. Create CID from hash and codec
   * 5. Compare string representations
   *
   * @throws {@link ValidationError}
   * Thrown if CID format is invalid.
   *
   * @public
   */
  async verify(expectedCID: CID, data: Buffer): Promise<CIDVerificationResult> {
    try {
      // Parse expected CID
      const expectedCIDObj = IPLDCid.parse(expectedCID);

      // Determine codec from CID
      const codec = this.getCodecName(expectedCIDObj.code);

      // Compute hash of data
      const hash = await sha256.digest(data);

      // Create CID from hash
      const computedCIDObj = IPLDCid.create(expectedCIDObj.version, expectedCIDObj.code, hash);

      const computedCIDStr = computedCIDObj.toString();
      const expectedCIDStr = expectedCIDObj.toString();

      const isValid = computedCIDStr === expectedCIDStr;

      if (!isValid) {
        this.logger?.warn('CID verification failed', {
          expectedCID: expectedCIDStr,
          computedCID: computedCIDStr,
          codec,
        });
      } else {
        this.logger?.debug('CID verification succeeded', {
          cid: expectedCIDStr,
          codec,
        });
      }

      return {
        isValid,
        expectedCID: expectedCIDStr,
        computedCID: computedCIDStr,
        codec,
        hashAlgorithm: 'sha256',
      };
    } catch (error) {
      throw new ValidationError(
        `Invalid CID format: ${expectedCID}`,
        'cid',
        'format',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Verifies blob data matches expected CID (simplified version).
   *
   * @param expectedCID - Expected CID
   * @param data - Blob data
   * @returns True if valid, false otherwise
   *
   * @remarks
   * Wrapper around {@link verify} that returns boolean.
   * Use {@link verify} for detailed verification results.
   *
   * @public
   */
  async isValid(expectedCID: CID, data: Buffer): Promise<boolean> {
    try {
      const result = await this.verify(expectedCID, data);
      return result.isValid;
    } catch (error) {
      this.logger?.error('CID verification error', error instanceof Error ? error : undefined, {
        cid: expectedCID,
      });
      return false;
    }
  }

  /**
   * Computes CID for blob data.
   *
   * @param data - Blob data
   * @param codec - Codec to use (default: raw)
   * @returns Computed CID
   *
   * @remarks
   * Creates CIDv1 with specified codec and SHA-256 hash.
   *
   * **Codec Selection**:
   * - `raw` (0x55): For binary blobs (PDFs, images)
   * - `dag-cbor` (0x71): For structured data (JSON, CBOR)
   *
   * @example
   * ```typescript
   * const verifier = new CIDVerifier();
   *
   * // For PDF blob
   * const pdfCID = await verifier.computeCID(pdfData, 'raw');
   *
   * // For CBOR data
   * const cborCID = await verifier.computeCID(cborData, 'dag-cbor');
   * ```
   *
   * @public
   */
  async computeCID(data: Buffer, codec: 'raw' | 'dag-cbor' = 'raw'): Promise<string> {
    const hash = await sha256.digest(data);

    const codecCode = codec === 'raw' ? raw.code : dagCbor.code;

    const cid = IPLDCid.create(1, codecCode, hash);

    return cid.toString();
  }

  /**
   * Gets codec name from codec code.
   *
   * @param code - Multicodec code
   * @returns Codec name
   *
   * @remarks
   * Codec codes:
   * - 0x55 (85): raw
   * - 0x71 (113): dag-cbor
   *
   * @private
   */
  private getCodecName(code: number): 'raw' | 'dag-cbor' {
    switch (code) {
      case raw.code:
        return 'raw';
      case dagCbor.code:
        return 'dag-cbor';
      default:
        return 'raw'; // Default fallback
    }
  }
}
