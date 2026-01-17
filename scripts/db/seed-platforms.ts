/**
 * Seed script for platform type nodes.
 *
 * @remarks
 * Seeds all platform types: code, data, preprint, preregistration, protocol.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import {
  CODE_PLATFORM_CONCEPTS,
  DATA_PLATFORM_CONCEPTS,
  PREPRINT_PLATFORM_CONCEPTS,
  PREREGISTRATION_PLATFORM_CONCEPTS,
  PROTOCOL_PLATFORM_CONCEPTS,
} from './lib/concepts.js';

/**
 * Platform category to subkind mapping.
 */
const CATEGORY_TO_SUBKIND: Record<string, string> = {
  'platform-code': 'platform-code',
  'platform-data': 'platform-data',
  'platform-preprint': 'platform-preprint',
  'platform-preregistration': 'platform-preregistration',
  'platform-protocol': 'platform-protocol',
};

/**
 * Seeds all platform nodes for a given category.
 */
async function seedPlatformCategory(
  nodeCreator: NodeCreator,
  concepts: readonly {
    slug: string;
    name: string;
    description: string;
    category: string;
    wikidataId?: string;
  }[],
  subkind: string
): Promise<number> {
  let count = 0;

  for (const concept of concepts) {
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
      kind: 'object',
      subkind,
      label: concept.name,
      description: concept.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
    });
    count++;
  }

  return count;
}

/**
 * Seeds all platform type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedPlatforms(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  count += await seedPlatformCategory(nodeCreator, CODE_PLATFORM_CONCEPTS, 'platform-code');
  count += await seedPlatformCategory(nodeCreator, DATA_PLATFORM_CONCEPTS, 'platform-data');
  count += await seedPlatformCategory(nodeCreator, PREPRINT_PLATFORM_CONCEPTS, 'platform-preprint');
  count += await seedPlatformCategory(
    nodeCreator,
    PREREGISTRATION_PLATFORM_CONCEPTS,
    'platform-preregistration'
  );
  count += await seedPlatformCategory(nodeCreator, PROTOCOL_PLATFORM_CONCEPTS, 'platform-protocol');

  return count;
}
