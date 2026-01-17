/**
 * Deterministic UUID v5 generation for seed scripts.
 *
 * @remarks
 * Provides UUID v5 generation that produces the same UUID for the same input,
 * ensuring idempotent seeding operations. All seed scripts share this module
 * to guarantee consistent UUID generation across different node types.
 *
 * @packageDocumentation
 */

import { createHash } from 'crypto';

/**
 * Chive namespace UUID for deterministic UUID generation.
 * This is a well-known UUID used as the namespace for all Chive entities.
 * Using the DNS namespace UUID as base (RFC 4122).
 */
export const CHIVE_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generates a deterministic UUID v5 from a namespace and name.
 *
 * @remarks
 * UUID v5 uses SHA-1 hashing to generate a reproducible UUID from a namespace
 * and name combination. The same inputs always produce the same output.
 *
 * @param namespace - Namespace UUID string (formatted with hyphens)
 * @param name - Name to hash with namespace
 * @returns Deterministic UUID v5 string
 *
 * @example
 * ```ts
 * const uuid = uuidv5(CHIVE_NAMESPACE, 'node:contribution-type:conceptualization');
 * // Always returns the same UUID for this input
 * ```
 */
export function uuidv5(namespace: string, name: string): string {
  // Parse namespace UUID to bytes (remove hyphens, convert hex to buffer)
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');

  // Create SHA-1 hash of namespace + name (per RFC 4122)
  const hash = createHash('sha1').update(namespaceBytes).update(name, 'utf8').digest();

  // Set version (5) and variant (RFC 4122) bits
  // Version 5: set bits 4-7 of byte 6 to 0101
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  // Variant: set bits 6-7 of byte 8 to 10
  hash[8] = (hash[8]! & 0x3f) | 0x80;

  // Format as UUID string (8-4-4-4-12)
  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// =============================================================================
// Unified Node/Edge UUID functions
// =============================================================================

/**
 * Generates a deterministic UUID for a node.
 *
 * @param subkind - Subkind slug (e.g., 'contribution-type', 'field')
 * @param id - Node identifier (e.g., 'conceptualization', 'computer-science')
 * @returns Deterministic UUID for use in AT-URIs
 *
 * @example
 * ```ts
 * const uuid = nodeUuid('contribution-type', 'conceptualization');
 * // Returns same UUID every time for this input
 * ```
 */
export function nodeUuid(subkind: string, id: string): string {
  return uuidv5(CHIVE_NAMESPACE, `node:${subkind}:${id}`);
}

/**
 * Generates a deterministic UUID for an edge.
 *
 * @param sourceUri - Source node AT-URI
 * @param targetUri - Target node AT-URI
 * @param relationSlug - Relation type slug (e.g., 'broader', 'narrower')
 * @returns Deterministic UUID for use in AT-URIs
 *
 * @example
 * ```ts
 * const uuid = edgeUuid(
 *   'at://did:plc:chive-governance/pub.chive.graph.node/abc123',
 *   'at://did:plc:chive-governance/pub.chive.graph.node/def456',
 *   'broader'
 * );
 * ```
 */
export function edgeUuid(sourceUri: string, targetUri: string, relationSlug: string): string {
  return uuidv5(CHIVE_NAMESPACE, `edge:${relationSlug}:${sourceUri}:${targetUri}`);
}

// =============================================================================
// Legacy functions (kept for backward compatibility during migration)
// =============================================================================

/**
 * Generates a deterministic UUID for a contribution type.
 * @deprecated Use nodeUuid('contribution-type', slug) instead
 */
export function contributionTypeUuid(slug: string): string {
  return nodeUuid('contribution-type', slug);
}

/**
 * Generates a deterministic UUID for an academic field.
 * @deprecated Use nodeUuid('field', slug) instead
 */
export function fieldUuid(slug: string): string {
  return nodeUuid('field', slug);
}

/**
 * Generates a deterministic UUID for a facet.
 * @deprecated Use nodeUuid('facet', slug) instead
 */
export function facetUuid(slug: string): string {
  return nodeUuid('facet', slug);
}

/**
 * Generates a deterministic UUID for a concept.
 * @deprecated Use nodeUuid(subkind, slug) instead
 */
export function conceptUuid(slug: string): string {
  return uuidv5(CHIVE_NAMESPACE, `concept:${slug}`);
}
