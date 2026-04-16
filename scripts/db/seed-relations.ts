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

    if (relation.citoUri) {
      externalIds.push({
        system: 'schema-org',
        identifier: relation.citoUri.split('/').pop() ?? relation.slug,
        uri: relation.citoUri,
        matchType: 'exact',
      });
    }

    if (relation.cosmikConnectionType) {
      externalIds.push({
        system: 'cosmik',
        identifier: relation.cosmikConnectionType,
        uri: `cosmik://connectionType/${relation.cosmikConnectionType}`,
        matchType: 'exact',
      });
    }

    const metadata: Record<string, string | boolean> = {};
    if (relation.symmetric) metadata.symmetric = true;
    if (relation.inverseSlug) metadata.inverseSlug = relation.inverseSlug;
    if (relation.transitive) metadata.transitive = true;
    if (relation.reflexive) metadata.reflexive = true;
    if (relation.functional) metadata.functional = true;

    await nodeCreator.createNode({
      slug: relation.slug,
      kind: 'type',
      subkind: 'relation',
      label: relation.label,
      description: relation.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      status: 'established',
    });
    count++;
  }

  return count;
}
