/**
 * Seed script for subkind meta-type nodes.
 *
 * @remarks
 * Seeds all subkind definitions as type nodes with `subkind=subkind`.
 * These meta-types define what kinds of nodes can exist in the knowledge graph.
 *
 * @packageDocumentation
 */

import { NodeCreator } from './lib/node-creator.js';
import { SUBKINDS } from './lib/subkinds.js';

/**
 * Seeds all subkind meta-type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedSubkinds(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const subkind of SUBKINDS) {
    await nodeCreator.createNode({
      slug: subkind.slug,
      kind: 'type',
      subkind: 'subkind',
      label: subkind.label,
      description: subkind.description,
      metadata: {
        displayOrder: subkind.displayOrder,
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
