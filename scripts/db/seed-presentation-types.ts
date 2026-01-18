/**
 * Seed script for presentation type nodes.
 *
 * @remarks
 * Seeds conference presentation types (oral, poster, keynote, etc.).
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { PRESENTATION_TYPE_CONCEPTS } from './lib/concepts.js';

/**
 * Seeds all presentation type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedPresentationTypes(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const concept of PRESENTATION_TYPE_CONCEPTS) {
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
      subkind: 'presentation-type',
      label: concept.name,
      description: concept.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
    });
    count++;
  }

  return count;
}
