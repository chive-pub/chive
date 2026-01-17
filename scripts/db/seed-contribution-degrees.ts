/**
 * Seed script for contribution degree type nodes.
 *
 * @remarks
 * Seeds contribution level modifiers (lead, equal, supporting).
 *
 * @packageDocumentation
 */

import { NodeCreator } from './lib/node-creator.js';

/**
 * Contribution degree definitions.
 */
const CONTRIBUTION_DEGREES = [
  {
    slug: 'lead',
    label: 'Lead',
    description: 'Primary contributor with major responsibility for this contribution type.',
    displayOrder: 1,
  },
  {
    slug: 'equal',
    label: 'Equal',
    description: 'Shared equal responsibility with other contributors for this contribution type.',
    displayOrder: 2,
  },
  {
    slug: 'supporting',
    label: 'Supporting',
    description: 'Supporting contributor with minor or partial responsibility.',
    displayOrder: 3,
  },
] as const;

/**
 * Seeds all contribution degree nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedContributionDegrees(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const degree of CONTRIBUTION_DEGREES) {
    await nodeCreator.createNode({
      slug: degree.slug,
      kind: 'type',
      subkind: 'contribution-degree',
      label: degree.label,
      description: degree.description,
      metadata: {
        displayOrder: degree.displayOrder,
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
