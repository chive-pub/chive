/**
 * Seed script for CRediT contribution type nodes.
 *
 * @remarks
 * Seeds the 14 standard CRediT contributor roles per ANSI/NISO Z39.104-2022.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { CONTRIBUTION_TYPE_CONCEPTS } from './lib/concepts.js';

/**
 * Seeds all CRediT contribution type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedContributionTypes(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const concept of CONTRIBUTION_TYPE_CONCEPTS) {
    const externalIds: ExternalId[] = [];

    if (concept.creditUri) {
      externalIds.push({
        system: 'credit',
        identifier: concept.slug,
        uri: concept.creditUri,
        matchType: 'exact',
      });
    }

    if (concept.croUri) {
      externalIds.push({
        system: 'cro',
        identifier: concept.croUri.split('/').pop() ?? '',
        uri: concept.croUri,
        matchType: 'exact',
      });
    }

    await nodeCreator.createNode({
      slug: concept.slug,
      kind: 'type',
      subkind: 'contribution-type',
      label: concept.name,
      description: concept.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
    });
    count++;
  }

  return count;
}
