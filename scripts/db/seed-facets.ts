/**
 * Seed script for facet dimension nodes.
 *
 * @remarks
 * Seeds the 10 PMEST+FAST classification dimensions as nodes with `subkind=facet`.
 * These are the facet categories, NOT the facet values. Values are seeded
 * separately and linked via `has-value` edges.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { FACET_DEFINITIONS } from './lib/facets.js';

/**
 * Seeds the 10 facet dimension nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedFacets(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const facet of FACET_DEFINITIONS) {
    const externalIds: ExternalId[] = facet.externalMappings.map((mapping) => ({
      system: mapping.system,
      identifier: mapping.identifier,
      uri: mapping.uri,
      matchType:
        mapping.matchType === 'exact-match'
          ? 'exact'
          : mapping.matchType === 'close-match'
            ? 'close'
            : 'related',
    }));

    await nodeCreator.createNode({
      slug: facet.slug,
      kind: 'type',
      subkind: 'facet',
      label: facet.label,
      description: facet.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
      metadata: { displayOrder: facet.displayOrder },
    });
    count++;
  }

  return count;
}
