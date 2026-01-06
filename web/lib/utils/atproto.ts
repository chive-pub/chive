/**
 * AT Protocol URI parsing utilities for Chive frontend.
 *
 * @remarks
 * Provides utilities for parsing and constructing AT Protocol URIs.
 * AT URIs follow the format: at://did:plc:xxx/collection/rkey
 *
 * @packageDocumentation
 */

/**
 * Parsed AT Protocol URI components.
 */
export interface ParsedAtUri {
  /** The protocol (always "at") */
  protocol: 'at';
  /** The DID (e.g., "did:plc:abc123") */
  did: string;
  /** The collection NSID (e.g., "pub.chive.preprint.submission") */
  collection: string;
  /** The record key */
  rkey: string;
}

/**
 * Regular expression for validating AT URIs.
 */
const AT_URI_REGEX = /^at:\/\/(did:[a-z]+:[a-zA-Z0-9._:%-]+)\/([a-zA-Z0-9.]+)\/([a-zA-Z0-9._~-]+)$/;

/**
 * Parses an AT Protocol URI into its components.
 *
 * @param uri - The AT URI to parse
 * @returns Parsed URI components, or null if invalid
 *
 * @example
 * ```typescript
 * parseAtUri('at://did:plc:abc123/pub.chive.preprint.submission/xyz789')
 * // Returns {
 * //   protocol: 'at',
 * //   did: 'did:plc:abc123',
 * //   collection: 'pub.chive.preprint.submission',
 * //   rkey: 'xyz789'
 * // }
 *
 * parseAtUri('invalid-uri')
 * // Returns null
 * ```
 */
export function parseAtUri(uri: string): ParsedAtUri | null {
  const match = uri.match(AT_URI_REGEX);

  if (!match) {
    return null;
  }

  const [, did, collection, rkey] = match;

  return {
    protocol: 'at',
    did,
    collection,
    rkey,
  };
}

/**
 * Constructs an AT Protocol URI from its components.
 *
 * @param did - The DID
 * @param collection - The collection NSID
 * @param rkey - The record key
 * @returns The constructed AT URI
 *
 * @example
 * ```typescript
 * buildAtUri('did:plc:abc123', 'pub.chive.preprint.submission', 'xyz789')
 * // Returns 'at://did:plc:abc123/pub.chive.preprint.submission/xyz789'
 * ```
 */
export function buildAtUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

/**
 * Validates whether a string is a valid AT Protocol URI.
 *
 * @param uri - The string to validate
 * @returns True if the string is a valid AT URI
 *
 * @example
 * ```typescript
 * isValidAtUri('at://did:plc:abc123/pub.chive.preprint.submission/xyz789')
 * // Returns true
 *
 * isValidAtUri('https://example.com')
 * // Returns false
 * ```
 */
export function isValidAtUri(uri: string): boolean {
  return AT_URI_REGEX.test(uri);
}

/**
 * Extracts the DID from an AT Protocol URI.
 *
 * @param uri - The AT URI
 * @returns The DID, or null if the URI is invalid
 *
 * @example
 * ```typescript
 * extractDid('at://did:plc:abc123/pub.chive.preprint.submission/xyz789')
 * // Returns 'did:plc:abc123'
 * ```
 */
export function extractDid(uri: string): string | null {
  const parsed = parseAtUri(uri);
  return parsed?.did ?? null;
}

/**
 * Extracts the collection from an AT Protocol URI.
 *
 * @param uri - The AT URI
 * @returns The collection NSID, or null if the URI is invalid
 *
 * @example
 * ```typescript
 * extractCollection('at://did:plc:abc123/pub.chive.preprint.submission/xyz789')
 * // Returns 'pub.chive.preprint.submission'
 * ```
 */
export function extractCollection(uri: string): string | null {
  const parsed = parseAtUri(uri);
  return parsed?.collection ?? null;
}

/**
 * Extracts the record key from an AT Protocol URI.
 *
 * @param uri - The AT URI
 * @returns The record key, or null if the URI is invalid
 *
 * @example
 * ```typescript
 * extractRkey('at://did:plc:abc123/pub.chive.preprint.submission/xyz789')
 * // Returns 'xyz789'
 * ```
 */
export function extractRkey(uri: string): string | null {
  const parsed = parseAtUri(uri);
  return parsed?.rkey ?? null;
}

/**
 * Encodes an AT URI for use in URL paths.
 *
 * @param uri - The AT URI to encode
 * @returns URL-safe encoded string
 *
 * @remarks
 * AT URIs contain characters (://) that need to be encoded for URL paths.
 * This function encodes the URI for safe use in route parameters.
 *
 * @example
 * ```typescript
 * encodeAtUriForPath('at://did:plc:abc123/pub.chive.preprint.submission/xyz789')
 * // Returns 'at%3A%2F%2Fdid%3Aplc%3Aabc123%2Fpub.chive.preprint.submission%2Fxyz789'
 * ```
 */
export function encodeAtUriForPath(uri: string): string {
  return encodeURIComponent(uri);
}

/**
 * Decodes an AT URI from URL path encoding.
 *
 * @param encoded - The encoded AT URI
 * @returns Decoded AT URI
 *
 * @example
 * ```typescript
 * decodeAtUriFromPath('at%3A%2F%2Fdid%3Aplc%3Aabc123%2Fpub.chive.preprint.submission%2Fxyz789')
 * // Returns 'at://did:plc:abc123/pub.chive.preprint.submission/xyz789'
 * ```
 */
export function decodeAtUriFromPath(encoded: string): string {
  return decodeURIComponent(encoded);
}

/**
 * Constructs a blob URL from a PDS endpoint and blob reference.
 *
 * @param pdsEndpoint - The PDS endpoint URL
 * @param did - The DID of the blob owner
 * @param cid - The CID of the blob
 * @returns The blob URL
 *
 * @example
 * ```typescript
 * buildBlobUrl('https://pds.example.com', 'did:plc:abc123', 'bafyreiabc...')
 * // Returns 'https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=did:plc:abc123&cid=bafyreiabc...'
 * ```
 */
export function buildBlobUrl(pdsEndpoint: string, did: string, cid: string): string {
  const base = pdsEndpoint.replace(/\/$/, '');
  const params = new URLSearchParams({ did, cid });
  return `${base}/xrpc/com.atproto.sync.getBlob?${params.toString()}`;
}

/**
 * Validates whether a string is a valid DID.
 *
 * @param did - The string to validate
 * @returns True if the string is a valid DID
 *
 * @example
 * ```typescript
 * isValidDid('did:plc:abc123')
 * // Returns true
 *
 * isValidDid('invalid')
 * // Returns false
 * ```
 */
export function isValidDid(did: string): boolean {
  return /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(did);
}

/**
 * Shortens a DID for display purposes.
 *
 * @param did - The DID to shorten
 * @param length - Number of characters to show from the end (default: 8)
 * @returns Shortened DID string
 *
 * @example
 * ```typescript
 * shortenDid('did:plc:abc123def456')
 * // Returns 'did:plc:...3def456'
 * ```
 */
export function shortenDid(did: string, length: number = 8): string {
  if (!isValidDid(did)) {
    return did;
  }

  const prefix = did.substring(0, did.lastIndexOf(':') + 1);
  const identifier = did.substring(prefix.length);

  if (identifier.length <= length) {
    return did;
  }

  return `${prefix}...${identifier.slice(-length)}`;
}
