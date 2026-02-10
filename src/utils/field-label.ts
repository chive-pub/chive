/**
 * Unified field label resolution utility.
 *
 * @remarks
 * Single source of truth for detecting unresolved field labels
 * (UUIDs, AT-URIs, empty strings) and resolving them to
 * human-readable names via the Neo4j knowledge graph.
 *
 * @packageDocumentation
 * @public
 */

import { extractRkeyOrPassthrough, isAtUri, isUuid, normalizeFieldUri } from './at-uri.js';

/**
 * Minimal interface for batch node lookups.
 *
 * @remarks
 * Satisfied by `NodeRepository` in the app server and by lightweight
 * wrappers around a raw Neo4j driver in CLI scripts.
 *
 * @public
 */
export interface NodeLookup {
  getNodesByIds(ids: readonly string[]): Promise<Map<string, { label: string }>>;
}

/**
 * Field reference with a URI, human-readable label, and extracted ID.
 * @public
 */
export interface ResolvedField {
  uri: string;
  label: string;
  id: string;
}

/**
 * Checks whether a field label needs resolution from the knowledge graph.
 *
 * @remarks
 * A label needs resolution if it is:
 * - A UUID (e.g. `9cfe6371-0a2c-5aee-8302-f7b170b0d2d8`)
 * - An AT-URI (e.g. `at://did:plc:abc/pub.chive.graph.node/uuid`)
 * - Empty or whitespace-only
 *
 * @param label - The label to check
 * @returns True if the label needs resolution
 *
 * @public
 */
export function needsLabelResolution(label: string): boolean {
  if (!label || label.trim().length === 0) return true;
  if (isUuid(label)) return true;
  if (isAtUri(label)) return true;
  return false;
}

/**
 * Resolves field labels from the Neo4j knowledge graph.
 *
 * @remarks
 * Normalizes URIs, extracts IDs, and batch-fetches labels from Neo4j
 * for any fields whose labels are unresolved. Fields with already-resolved
 * labels are returned unchanged.
 *
 * @param fields - Fields with potentially unresolved labels
 * @param nodeLookup - Batch node lookup (NodeRepository or script wrapper)
 * @returns Fields with resolved human-readable labels
 *
 * @public
 */
export async function resolveFieldLabels(
  fields: readonly { uri: string; label: string; id?: string }[] | undefined,
  nodeLookup: NodeLookup
): Promise<ResolvedField[]> {
  if (!fields || fields.length === 0) return [];

  // Normalize URIs and extract IDs
  const normalized = fields.map((f) => {
    const uri = normalizeFieldUri(f.uri);
    const id = f.id ?? extractRkeyOrPassthrough(uri);
    return { uri, label: f.label, id };
  });

  // Find fields that need label resolution
  const unresolvedIds = normalized.filter((f) => needsLabelResolution(f.label)).map((f) => f.id);

  if (unresolvedIds.length === 0) return normalized;

  // Batch fetch from Neo4j
  try {
    const nodeMap = await nodeLookup.getNodesByIds(unresolvedIds);
    return normalized.map((f) => {
      if (needsLabelResolution(f.label)) {
        const node = nodeMap.get(f.id);
        return { ...f, label: node?.label ?? f.label };
      }
      return f;
    });
  } catch {
    // On failure, return fields with existing labels
    return normalized;
  }
}
