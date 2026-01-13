/**
 * AT Protocol primitive types with compile-time safety via branded types.
 *
 * @remarks
 * These types provide type-safe wrappers around strings and primitives used
 * in the AT Protocol. Branded types prevent accidental mixing of different
 * identifier types at compile time while maintaining runtime string representation.
 *
 * All types in this module are opaque branded types that cannot be constructed
 * by simple type assertions. Use the corresponding validator functions from
 * atproto-validators.ts to safely construct these types.
 *
 * @packageDocumentation
 * @public
 */

/**
 * AT URI format for addressing records in the AT Protocol network.
 *
 * @remarks
 * AT URIs uniquely identify records across the distributed AT Protocol network.
 *
 * Format: `at://did/collection/rkey`
 * - `did`: Repository owner's DID
 * - `collection`: Record collection NSID (e.g., "pub.chive.eprint.submission")
 * - `rkey`: Record key (unique within collection)
 *
 * AT URIs are content-addressable when combined with CID, enabling
 * cryptographic verification of record integrity.
 *
 * @example
 * ```typescript
 * const uri = toAtUri('at://did:plc:abc123/pub.chive.eprint.submission/xyz789');
 * if (uri) {
 *   console.log('Valid AT URI:', uri);
 * }
 * ```
 *
 * @see {@link https://atproto.com/specs/at-uri-scheme | AT URI Specification}
 * @public
 */
export type AtUri = string & { readonly __brand: 'AtUri' };

/**
 * Decentralized Identifier (DID) for AT Protocol users.
 *
 * @remarks
 * DIDs provide globally unique, cryptographically verifiable identifiers
 * that don't require a central registration authority.
 *
 * Supported DID methods:
 * - `did:plc:*` - Placeholder DID (AT Protocol default)
 * - `did:web:*` - Web-based DID (domain-based)
 *
 * Format: `did:method:identifier`
 *
 * DIDs are resolved to DID Documents containing public keys, service
 * endpoints (PDS URLs), and verification methods.
 *
 * @example
 * Valid DIDs:
 * ```typescript
 * const did1 = toDID('did:plc:z72i7hdynmk6r22z27h6tvur');
 * const did2 = toDID('did:web:alice.example.com');
 * ```
 *
 * @see {@link https://www.w3.org/TR/did-core/ | W3C DID Core Specification}
 * @see {@link https://atproto.com/specs/did | AT Protocol DID Specification}
 * @public
 */
export type DID = string & { readonly __brand: 'DID' };

/**
 * Namespaced Identifier (NSID) for Lexicon schemas.
 *
 * @remarks
 * NSIDs provide globally unique identifiers for Lexicon schemas using
 * reverse domain name notation.
 *
 * Format: `authority.name.subname`
 * - `authority`: Reverse domain (e.g., "pub.chive")
 * - `name` and `subname`: Schema identifiers
 *
 * NSIDs are used to identify:
 * - Record collections (e.g., "pub.chive.eprint.submission")
 * - RPC procedures (e.g., "pub.chive.search.query")
 * - Event types (e.g., "pub.chive.notification.created")
 *
 * @example
 * ```typescript
 * const nsid = toNSID('pub.chive.eprint.submission');
 * if (nsid) {
 *   console.log('Valid NSID:', nsid);
 * }
 * ```
 *
 * @see {@link https://atproto.com/specs/nsid | NSID Specification}
 * @public
 */
export type NSID = string & { readonly __brand: 'NSID' };

/**
 * Content Identifier (CID) - cryptographic hash of content.
 *
 * @remarks
 * CIDs are self-describing content addresses using multihash, multicodec,
 * and multibase. They provide cryptographic integrity verification and
 * content deduplication.
 *
 * CIDs are used for:
 * - Blob references (PDFs, images, supplementary files)
 * - Record versioning (each record version has unique CID)
 * - Merkle tree construction (repository commits)
 *
 * Format: Base32-encoded multihash with codec prefix
 *
 * @example
 * ```typescript
 * const cid = 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q';
 * ```
 *
 * @see {@link https://docs.ipfs.tech/concepts/content-addressing/ | CID Specification}
 * @public
 */
export type CID = string & { readonly __brand: 'CID' };

/**
 * Blob reference pointing to content in a user's PDS.
 *
 * @remarks
 * BlobRefs are metadata about blobs stored in user PDSes. They contain
 * the CID for content addressing, MIME type, and size.
 *
 * Chive stores BlobRefs only, not blob data. Blob data remains in the user's
 * PDS. When serving blobs, Chive proxies requests to the user's PDS using the
 * BlobRef CID.
 *
 * This ensures user data sovereignty (users control their files), ATProto
 * compliance (AppViews do not store source data), and scalability (no blob
 * storage costs for Chive).
 *
 * @example
 * ```typescript
 * const blobRef: BlobRef = {
 *   $type: 'blob',
 *   ref: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q' as CID,
 *   mimeType: 'application/pdf',
 *   size: 2048576
 * };
 * ```
 *
 * @public
 */
export interface BlobRef {
  /**
   * Type discriminator for blob references.
   */
  readonly $type: 'blob';

  /**
   * CID of the blob in the user's PDS.
   *
   * @remarks
   * Used to fetch blob from PDS via `com.atproto.sync.getBlob`.
   */
  readonly ref: CID;

  /**
   * MIME type of the blob.
   *
   * @remarks
   * Common MIME types in Chive:
   * - `application/pdf` - Eprint PDFs
   * - `image/png`, `image/jpeg` - Figures, author avatars
   * - `application/zip` - Supplementary materials
   */
  readonly mimeType: string;

  /**
   * Size of the blob in bytes.
   *
   * @remarks
   * Used for:
   * - Storage quota checks
   * - Download progress indicators
   * - Large file warnings (e.g., > 50 MB)
   */
  readonly size: number;
}

/**
 * Binary data wrapper.
 *
 * @remarks
 * Bytes represent arbitrary binary data (e.g., cryptographic signatures,
 * encrypted payloads, raw file contents).
 *
 * Uses Uint8Array for efficient binary operations and compatibility with
 * Web Crypto API, file I/O, and network protocols.
 *
 * @example
 * ```typescript
 * const signature: Bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) as Bytes;
 * ```
 *
 * @public
 */
export type Bytes = Uint8Array & { readonly __brand: 'Bytes' };

/**
 * Unix timestamp in milliseconds.
 *
 * @remarks
 * Timestamps represent points in time as milliseconds since Unix epoch
 * (January 1, 1970 00:00:00 UTC).
 *
 * Millisecond precision is standard in JavaScript and sufficient for most
 * timestamp use cases. For higher precision (nanoseconds), use separate
 * timestamp + nanos fields.
 *
 * @example
 * ```typescript
 * const now: Timestamp = Date.now() as Timestamp;
 * const date = new Date(now);
 * ```
 *
 * @public
 */
export type Timestamp = number & { readonly __brand: 'Timestamp' };
