/**
 * AT-URI utilities for constructing and validating AT Protocol URIs.
 *
 * @remarks
 * AT-URIs follow the format: at://<did>/<collection>/<rkey>
 * This module provides utilities for constructing AT-URIs from internal IDs.
 * Uses the @atproto/api library for parsing.
 *
 * @packageDocumentation
 * @public
 */

import { AtUri as AtUriParser } from '@atproto/api';

import { GRAPH_PDS_DID } from '../config/graph.js';
import type { AtUri, DID } from '../types/atproto.js';

/**
 * The collection NSID for knowledge graph nodes.
 * @public
 */
export const GRAPH_NODE_COLLECTION = 'pub.chive.graph.node';

/**
 * Checks if a string is a valid AT-URI.
 *
 * @param uri - String to check
 * @returns True if the string is a valid AT-URI
 *
 * @example
 * ```typescript
 * isAtUri('at://did:plc:abc/pub.chive.graph.node/123'); // true
 * isAtUri('9cfe6371-0a2c-5aee-8302-f7b170b0d2d8'); // false
 * ```
 *
 * @public
 */
export function isAtUri(uri: string): boolean {
  return uri.startsWith('at://');
}

/**
 * Extracts the rkey (record key/UUID) from an AT-URI.
 *
 * @param uri - The AT-URI to parse
 * @returns The rkey portion of the URI
 *
 * @example
 * ```typescript
 * extractRkey('at://did:plc:abc/pub.chive.graph.node/123-456');
 * // => '123-456'
 * ```
 *
 * @public
 */
export function extractRkey(uri: string): string {
  const parsed = new AtUriParser(uri);
  return parsed.rkey;
}

/**
 * Constructs an AT-URI for a knowledge graph node from a UUID.
 *
 * @param uuid - The UUID or rkey of the node
 * @param graphPdsDid - Optional graph PDS DID (defaults to GRAPH_PDS_DID)
 * @returns The properly formatted AT-URI
 *
 * @example
 * ```typescript
 * const uri = makeGraphNodeUri('9cfe6371-0a2c-5aee-8302-f7b170b0d2d8');
 * // => 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/9cfe6371-0a2c-5aee-8302-f7b170b0d2d8'
 * ```
 *
 * @public
 */
export function makeGraphNodeUri(uuid: string, graphPdsDid?: DID): AtUri {
  const did = graphPdsDid ?? GRAPH_PDS_DID;
  return `at://${did}/${GRAPH_NODE_COLLECTION}/${uuid}` as AtUri;
}

/**
 * Ensures a field URI is in proper AT-URI format.
 *
 * @remarks
 * If the URI is already an AT-URI, it is returned unchanged.
 * If it's a UUID, it's converted to an AT-URI using the graph PDS DID.
 *
 * @param uri - The URI to normalize (may be UUID or AT-URI)
 * @param graphPdsDid - Optional graph PDS DID (defaults to GRAPH_PDS_DID)
 * @returns The properly formatted AT-URI
 *
 * @example
 * ```typescript
 * // Already an AT-URI
 * normalizeFieldUri('at://did:plc:abc/pub.chive.graph.node/123');
 * // => 'at://did:plc:abc/pub.chive.graph.node/123'
 *
 * // UUID to AT-URI
 * normalizeFieldUri('9cfe6371-0a2c-5aee-8302-f7b170b0d2d8');
 * // => 'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/9cfe6371-0a2c-5aee-8302-f7b170b0d2d8'
 * ```
 *
 * @public
 */
export function normalizeFieldUri(uri: string, graphPdsDid?: DID): AtUri {
  if (isAtUri(uri)) {
    return uri as AtUri;
  }
  return makeGraphNodeUri(uri, graphPdsDid);
}

/**
 * Extracts the rkey from an AT-URI, or returns the string as-is if not an AT-URI.
 *
 * @remarks
 * Useful for normalizing field URIs to UUIDs for Elasticsearch filtering.
 *
 * @param uri - The AT-URI or UUID
 * @returns The rkey/UUID
 *
 * @public
 */
export function extractRkeyOrPassthrough(uri: string): string {
  if (isAtUri(uri)) {
    return extractRkey(uri);
  }
  return uri;
}

/**
 * Checks if a string looks like a UUID.
 *
 * @param str - String to check
 * @returns True if the string matches UUID format
 *
 * @public
 */
export function isUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
