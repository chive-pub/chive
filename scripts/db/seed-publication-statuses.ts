/**
 * Seed script for publication status type nodes.
 *
 * @remarks
 * Seeds publication lifecycle status types.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { PUBLICATION_STATUS_CONCEPTS } from './lib/concepts.js';

/**
 * Display order for publication statuses (by lifecycle progression).
 */
const DISPLAY_ORDER: Record<string, number> = {
  eprint: 1,
  preprint: 2,
  'under-review': 3,
  'revision-requested': 4,
  accepted: 5,
  'in-press': 6,
  published: 7,
  retracted: 8,
  withdrawn: 9,
};

/**
 * Seeds all publication status nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedPublicationStatuses(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const concept of PUBLICATION_STATUS_CONCEPTS) {
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
      subkind: 'publication-status',
      label: concept.name,
      description: concept.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      metadata: {
        displayOrder: DISPLAY_ORDER[concept.slug],
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
