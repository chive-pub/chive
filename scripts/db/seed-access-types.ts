/**
 * Seed script for access type nodes.
 *
 * @remarks
 * Seeds access type nodes with hierarchy (open-access has subtypes).
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { EdgeCreator } from './lib/edge-creator.js';
import { ACCESS_TYPE_CONCEPTS } from './lib/concepts.js';

/**
 * Seeds all access type nodes and hierarchy edges.
 *
 * @param nodeCreator - Node creator instance
 * @param edgeCreator - Edge creator instance
 * @returns Number of nodes created
 */
export async function seedAccessTypes(
  nodeCreator: NodeCreator,
  edgeCreator: EdgeCreator
): Promise<number> {
  let count = 0;

  // First pass: create all nodes
  for (const concept of ACCESS_TYPE_CONCEPTS) {
    const externalIds: ExternalId[] = [];

    if (concept.wikidataId) {
      externalIds.push({
        system: 'wikidata',
        identifier: concept.wikidataId,
        uri: `https://www.wikidata.org/wiki/${concept.wikidataId}`,
        matchType: 'exact',
      });
    }

    await nodeCreator.createNode({
      slug: concept.slug,
      kind: 'type',
      subkind: 'access-type',
      label: concept.name,
      description: concept.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
    });
    count++;
  }

  // Second pass: create hierarchy edges for subtypes
  for (const concept of ACCESS_TYPE_CONCEPTS) {
    if (concept.parentSlug) {
      const childUri = nodeCreator.getNodeUri('access-type', concept.slug);
      const parentUri = nodeCreator.getNodeUri('access-type', concept.parentSlug);

      await edgeCreator.createEdgeWithInverse(
        {
          sourceUri: childUri,
          targetUri: parentUri,
          relationSlug: 'broader',
        },
        'narrower'
      );
    }
  }

  return count;
}
