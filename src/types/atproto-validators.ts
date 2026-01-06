/**
 * Type guard functions for AT Protocol primitive types.
 *
 * @remarks
 * This module provides runtime validation functions that construct branded
 * types from strings and primitives. Each function validates the input
 * against AT Protocol specifications and returns either a branded type or
 * null if validation fails.
 *
 * These validators are the only safe way to construct branded types. Direct
 * type assertions should never be used as they bypass validation.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, BlobRef, CID, DID, NSID, Timestamp } from './atproto.js';

/**
 * Validates and brands an AT URI string.
 *
 * @remarks
 * AT URI format: `at://did/collection/rkey`
 *
 * Validation rules:
 * - Must start with `at://`
 * - DID must be valid (did:method:identifier)
 * - Collection must be valid NSID
 * - Record key must be non-empty, alphanumeric with periods, underscores, hyphens
 *
 * This function performs format validation only. It does not verify that
 * the DID exists or that the record is retrievable.
 *
 * @param uri - Potential AT URI string
 * @returns Branded AtUri if valid, null otherwise
 *
 * @example
 * ```typescript
 * const valid = toAtUri('at://did:plc:abc123/pub.chive.preprint.submission/xyz789');
 * console.log(valid); // 'at://did:plc:abc123/pub.chive.preprint.submission/xyz789'
 *
 * const invalid = toAtUri('https://example.com');
 * console.log(invalid); // null
 * ```
 *
 * @public
 */
export function toAtUri(uri: string): AtUri | null {
  // AT URI regex: at://did:method:identifier/nsid/rkey
  const atUriPattern = /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/;

  if (!atUriPattern.test(uri)) {
    return null;
  }

  return uri as AtUri;
}

/**
 * Validates and brands a DID string.
 *
 * @remarks
 * DID format: `did:method:identifier`
 *
 * Validation rules:
 * - Must start with `did:`
 * - Method must be lowercase alphabetic
 * - Identifier must be non-empty, alphanumeric with periods, underscores, hyphens
 *
 * Supported methods:
 * - `did:plc:*` (Placeholder, AT Protocol default)
 * - `did:web:*` (Web-based)
 * - Other methods allowed but may not be resolvable
 *
 * @param did - Potential DID string
 * @returns Branded DID if valid, null otherwise
 *
 * @example
 * ```typescript
 * const valid = toDID('did:plc:z72i7hdynmk6r22z27h6tvur');
 * console.log(valid); // 'did:plc:z72i7hdynmk6r22z27h6tvur'
 *
 * const invalid = toDID('not-a-did');
 * console.log(invalid); // null
 * ```
 *
 * @public
 */
export function toDID(did: string): DID | null {
  // DID regex: did:method:identifier
  const didPattern = /^did:[a-z]+:[a-zA-Z0-9._:-]+$/;

  if (!didPattern.test(did)) {
    return null;
  }

  return did as DID;
}

/**
 * Validates and brands an NSID string.
 *
 * @remarks
 * NSID format: `authority.name.subname` (reverse domain notation)
 *
 * Validation rules:
 * - Lowercase alphabetic segments separated by periods
 * - At least two segments (e.g., "pub.chive")
 * - Each segment must be non-empty
 * - No leading or trailing periods
 *
 * Common Chive NSIDs:
 * - `pub.chive.preprint.submission`
 * - `pub.chive.review.comment`
 * - `pub.chive.graph.fieldProposal`
 *
 * @param nsid - Potential NSID string
 * @returns Branded NSID if valid, null otherwise
 *
 * @example
 * ```typescript
 * const valid = toNSID('pub.chive.preprint.submission');
 * console.log(valid); // 'pub.chive.preprint.submission'
 *
 * const invalid = toNSID('InvalidNSID');
 * console.log(invalid); // null
 * ```
 *
 * @public
 */
export function toNSID(nsid: string): NSID | null {
  // NSID regex: domain authority (lowercase segments) + name segment (lowerCamelCase)
  // Domain authority: one or more segments of lowercase letters/digits/hyphens
  // Name segment: starts lowercase, can contain uppercase (lowerCamelCase per ATProto spec)
  const nsidPattern = /^([a-z][a-z0-9-]*\.)+[a-z][a-zA-Z0-9]*$/;

  if (!nsidPattern.test(nsid)) {
    return null;
  }

  return nsid as NSID;
}

/**
 * Validates and brands a CID string.
 *
 * @remarks
 * CID format: Base32-encoded multihash with codec prefix
 *
 * Validation rules:
 * - Common prefixes: `bafy`, `bafk`, `bafm`, `Qm` (CIDv0)
 * - Case-sensitive base32 encoding
 * - Minimum length for valid CID
 *
 * This function performs basic format validation. It does not verify that
 * the CID corresponds to retrievable content.
 *
 * @param cid - Potential CID string
 * @returns Branded CID if valid, null otherwise
 *
 * @example
 * ```typescript
 * const valid = toCID('bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q');
 * console.log(valid); // 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q'
 *
 * const invalid = toCID('not-a-cid');
 * console.log(invalid); // null
 * ```
 *
 * @public
 */
export function toCID(cid: string): CID | null {
  // CID regex: base32 encoded (bafy*, bafk*, etc.) or CIDv0 (Qm*)
  const cidPattern = /^(bafy|bafk|bafm|Qm)[a-zA-Z0-9]{30,}$/;

  if (!cidPattern.test(cid)) {
    return null;
  }

  return cid as CID;
}

/**
 * Type guard for BlobRef objects.
 *
 * @remarks
 * Validates that an unknown value conforms to the BlobRef interface:
 * - Has `$type` property equal to `'blob'`
 * - Has `ref` property (CID)
 * - Has `mimeType` property (string)
 * - Has `size` property (number)
 *
 * This guard performs structural validation but does not validate the
 * CID format or MIME type validity.
 *
 * @param value - Value to check
 * @returns True if value is a valid BlobRef
 *
 * @example
 * ```typescript
 * const blob = {
 *   $type: 'blob' as const,
 *   ref: 'bafyreib...' as CID,
 *   mimeType: 'application/pdf',
 *   size: 2048576
 * };
 *
 * if (isBlobRef(blob)) {
 *   console.log('Valid BlobRef:', blob.ref);
 * }
 * ```
 *
 * @public
 */
export function isBlobRef(value: unknown): value is BlobRef {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    obj.$type === 'blob' &&
    typeof obj.ref === 'string' &&
    typeof obj.mimeType === 'string' &&
    typeof obj.size === 'number'
  );
}

/**
 * Type guard for valid MIME type strings.
 *
 * @remarks
 * Validates MIME type format: `type/subtype` with optional parameters.
 *
 * Common MIME types in Chive:
 * - `application/pdf`
 * - `image/png`, `image/jpeg`
 * - `application/zip`
 * - `text/plain; charset=utf-8`
 *
 * This function validates format only, not whether the MIME type is
 * registered with IANA.
 *
 * @param value - Potential MIME type string
 * @returns True if value is a valid MIME type format
 *
 * @example
 * ```typescript
 * console.log(isValidMimeType('application/pdf')); // true
 * console.log(isValidMimeType('invalid')); // false
 * ```
 *
 * @public
 */
export function isValidMimeType(value: string): boolean {
  // MIME type regex: type/subtype with optional parameters
  const mimeTypePattern = /^[a-z]+\/[a-z0-9-+.]+(\s*;\s*[a-z0-9-]+=.+)*$/i;

  return mimeTypePattern.test(value);
}

/**
 * Creates a branded Timestamp from a Date object.
 *
 * @remarks
 * Timestamps are milliseconds since Unix epoch (January 1, 1970 00:00:00 UTC).
 * This function provides type-safe conversion from JavaScript Date objects.
 *
 * @param date - Date to convert to timestamp
 * @returns Branded Timestamp (milliseconds since epoch)
 *
 * @example
 * ```typescript
 * const now = new Date();
 * const timestamp = toTimestamp(now);
 * console.log(timestamp); // 1699564800000
 *
 * // Reconstruct Date
 * const reconstructed = new Date(timestamp);
 * ```
 *
 * @public
 */
export function toTimestamp(date: Date): Timestamp {
  return date.getTime() as Timestamp;
}
