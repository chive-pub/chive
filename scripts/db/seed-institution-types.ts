/**
 * Seed script for institution type nodes.
 *
 * @remarks
 * Seeds institution classification types (university, research-institute, etc.).
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { INSTITUTION_TYPE_CONCEPTS } from './lib/concepts.js';

/**
 * Seeds all institution type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedInstitutionTypes(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const concept of INSTITUTION_TYPE_CONCEPTS) {
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
      subkind: 'institution-type',
      label: concept.name,
      description: concept.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
    });
    count++;
  }

  return count;
}
