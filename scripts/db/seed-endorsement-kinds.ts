/**
 * Seed script for endorsement kind nodes.
 *
 * @remarks
 * Seeds endorsement kind subtypes (e.g., "core research", "technical").
 * These are distinct from endorsement types and represent broader categories.
 *
 * @packageDocumentation
 */

import { NodeCreator } from './lib/node-creator.js';

/**
 * Endorsement kind definitions.
 *
 * @remarks
 * These represent broader categories that endorsement types can belong to.
 */
const ENDORSEMENT_KIND_DEFINITIONS = [
  {
    slug: 'core-research',
    label: 'Core Research',
    description: 'Fundamental research contributions advancing core knowledge',
    displayOrder: 1,
  },
  {
    slug: 'technical',
    label: 'Technical',
    description: 'Technical contributions including methods, tools, and implementations',
    displayOrder: 2,
  },
  {
    slug: 'applied',
    label: 'Applied',
    description: 'Applied research with practical applications and real-world impact',
    displayOrder: 3,
  },
  {
    slug: 'theoretical',
    label: 'Theoretical',
    description: 'Theoretical contributions advancing conceptual understanding',
    displayOrder: 4,
  },
  {
    slug: 'methodological',
    label: 'Methodological',
    description: 'Methodological contributions improving research practices',
    displayOrder: 5,
  },
  {
    slug: 'empirical',
    label: 'Empirical',
    description: 'Empirical contributions providing new data and evidence',
    displayOrder: 6,
  },
  {
    slug: 'synthesis',
    label: 'Synthesis',
    description: 'Synthesis contributions integrating diverse perspectives',
    displayOrder: 7,
  },
  {
    slug: 'replication',
    label: 'Replication',
    description: 'Replication and reproducibility contributions',
    displayOrder: 8,
  },
] as const;

/**
 * Seeds all endorsement kind nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedEndorsementKinds(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const kind of ENDORSEMENT_KIND_DEFINITIONS) {
    await nodeCreator.createNode({
      slug: kind.slug,
      kind: 'type',
      subkind: 'endorsement-kind',
      label: kind.label,
      description: kind.description,
      metadata: {
        displayOrder: kind.displayOrder,
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
