/**
 * Identity resolver interface for DID resolution.
 *
 * @remarks
 * This interface provides DID resolution capabilities, enabling Chive to
 * resolve DIDs to DID documents, handles to DIDs, and find PDS endpoints.
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../atproto.js';

/**
 * DID document from identity resolution.
 *
 * @remarks
 * Represents a resolved DID document containing verification methods and
 * service endpoints.
 *
 * @see {@link https://www.w3.org/TR/did-core/ | W3C DID Core Specification}
 *
 * @public
 */
export interface DIDDocument {
  /**
   * DID being described.
   */
  readonly id: DID;

  /**
   * Alternative identifiers (e.g., handles).
   *
   * @example ["at://handle.bsky.social"]
   */
  readonly alsoKnownAs?: readonly string[];

  /**
   * Verification methods (public keys).
   *
   * @remarks
   * Used for verifying signatures and authenticating the DID subject.
   */
  readonly verificationMethod: readonly {
    readonly id: string;
    readonly type: string;
    readonly controller: DID;
    readonly publicKeyMultibase?: string;
  }[];

  /**
   * Service endpoints.
   *
   * @remarks
   * Includes PDS URL and other services.
   */
  readonly service?: readonly {
    readonly id: string;
    readonly type: string;
    readonly serviceEndpoint: string;
  }[];
}

/**
 * Identity resolver interface.
 *
 * @remarks
 * Provides DID and handle resolution for the AT Protocol.
 *
 * Implementation notes:
 * - Uses `did:plc` directory or `did:web` resolution
 * - Caches DID documents with TTL
 * - Retries on failure with exponential backoff
 *
 * @public
 */
export interface IIdentityResolver {
  /**
   * Resolves a DID to its DID document.
   *
   * @param did - DID to resolve
   * @returns DID document or null if not found
   *
   * @example
   * ```typescript
   * const doc = await resolver.resolveDID(toDID('did:plc:z72i7hdynmk6r22z27h6tvur')!);
   * if (doc) {
   *   console.log('PDS:', await resolver.getPDSEndpoint(doc.id));
   * }
   * ```
   *
   * @public
   */
  resolveDID(did: DID): Promise<DIDDocument | null>;

  /**
   * Resolves a handle to its DID.
   *
   * @param handle - Handle to resolve (e.g., "alice.bsky.social")
   * @returns DID or null if not found
   *
   * @example
   * ```typescript
   * const did = await resolver.resolveHandle('alice.bsky.social');
   * if (did) {
   *   console.log('DID:', did);
   * }
   * ```
   *
   * @public
   */
  resolveHandle(handle: string): Promise<DID | null>;

  /**
   * Gets PDS endpoint URL for a DID.
   *
   * @param did - DID
   * @returns PDS URL or null if not found
   *
   * @remarks
   * Extracts PDS URL from DID document's service endpoints.
   *
   * @example
   * ```typescript
   * const pdsUrl = await resolver.getPDSEndpoint(toDID('did:plc:abc123')!);
   * console.log('PDS URL:', pdsUrl); // "https://pds.example.com"
   * ```
   *
   * @public
   */
  getPDSEndpoint(did: DID): Promise<string | null>;
}
