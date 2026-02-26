/**
 * Field URI expansion utility.
 *
 * @remarks
 * Expands field URIs to include narrower (child) fields from the
 * knowledge graph hierarchy. Used by both searchSubmissions and
 * getTrending to ensure consistent field matching behavior.
 *
 * @packageDocumentation
 */

import type { KnowledgeGraphService } from '../services/knowledge-graph/graph-service.js';
import type { GraphNode } from '../types/interfaces/graph.interface.js';

import { normalizeFieldUri } from './at-uri.js';

/**
 * Hierarchy type returned by KnowledgeGraphService.getHierarchy.
 *
 * @internal
 */
interface HierarchyNode {
  node: GraphNode;
  children: HierarchyNode[];
  depth: number;
}

/**
 * Flattens a hierarchy to extract all URIs including children.
 *
 * @param hierarchy - the node hierarchy to flatten
 * @returns array of all node URIs in the hierarchy
 */
function flattenHierarchy(hierarchy: HierarchyNode): string[] {
  const uris: string[] = [];
  if (hierarchy.node.uri) {
    uris.push(hierarchy.node.uri);
  }
  for (const child of hierarchy.children) {
    uris.push(...flattenHierarchy(child));
  }
  return uris;
}

/**
 * Expands field URIs to include narrower (child) fields.
 *
 * @param graph - the knowledge graph service
 * @param fieldUris - array of field URIs to expand
 * @param maxDepth - maximum depth to traverse (default: 3)
 * @returns expanded array including original and child field URIs
 *
 * @example
 * ```typescript
 * const expanded = await expandFieldsWithNarrower(graph, ['at://did/col/cs'], 2);
 * // ['at://did/col/cs', 'at://did/col/cs.ai', 'at://did/col/cs.ml']
 * ```
 */
export async function expandFieldsWithNarrower(
  graph: KnowledgeGraphService | undefined,
  fieldUris: readonly string[] | undefined,
  maxDepth = 3
): Promise<string[]> {
  if (!graph || !fieldUris || fieldUris.length === 0) {
    return fieldUris ? [...fieldUris] : [];
  }

  // Normalize all field URIs to AT-URI format before hierarchy lookup
  const normalizedUris = fieldUris.map((uri) => normalizeFieldUri(uri));
  const expanded = new Set<string>(normalizedUris);

  const expansionPromises = normalizedUris.map(async (uri) => {
    try {
      const hierarchy = await graph.getHierarchy(uri, maxDepth);
      if (!hierarchy) {
        return [uri];
      }
      const childUris = flattenHierarchy(hierarchy as HierarchyNode);
      return childUris;
    } catch {
      // If hierarchy lookup fails, just use the original URI
      return [uri];
    }
  });

  const results = await Promise.all(expansionPromises);
  for (const uris of results) {
    for (const uri of uris) {
      expanded.add(uri);
    }
  }

  return Array.from(expanded);
}
