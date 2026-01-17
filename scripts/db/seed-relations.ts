/**
 * Seed script for relation type nodes.
 *
 * @remarks
 * Seeds all relation type definitions as type nodes with `subkind=relation`.
 * These define what kinds of edges can exist between nodes.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { RELATIONS } from './lib/relations.js';

/**
 * Seeds all relation type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedRelations(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const relation of RELATIONS) {
    const externalIds: ExternalId[] = [];

    if (relation.skosUri) {
      externalIds.push({
        system: 'skos',
        identifier: relation.slug,
        uri: relation.skosUri,
        matchType: 'exact',
      });
    }

    if (relation.wikidataProperty) {
      externalIds.push({
        system: 'wikidata',
        identifier: relation.wikidataProperty,
        uri: `https://www.wikidata.org/wiki/Property:${relation.wikidataProperty}`,
        matchType: 'exact',
      });
    }

    await nodeCreator.createNode({
      slug: relation.slug,
      kind: 'type',
      subkind: 'relation',
      label: relation.label,
      description: relation.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
    });
    count++;
  }

  return count;
}
