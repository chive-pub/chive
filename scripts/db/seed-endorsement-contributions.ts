/**
 * Seed script for endorsement contribution type nodes.
 *
 * @remarks
 * Seeds scholarly contribution qualities for endorsements.
 *
 * @packageDocumentation
 */

import { NodeCreator } from './lib/node-creator.js';

/**
 * Endorsement contribution definitions.
 */
const ENDORSEMENT_CONTRIBUTION_DEFINITIONS = [
  {
    slug: 'methodological',
    label: 'Methodological Rigor',
    description: 'The work demonstrates sound methodology and appropriate research design.',
    displayOrder: 1,
  },
  {
    slug: 'analytical',
    label: 'Analytical Depth',
    description: 'The work provides thorough and insightful analysis of data or arguments.',
    displayOrder: 2,
  },
  {
    slug: 'theoretical',
    label: 'Theoretical Contribution',
    description: 'The work advances theoretical understanding or proposes novel frameworks.',
    displayOrder: 3,
  },
  {
    slug: 'empirical',
    label: 'Empirical Contribution',
    description: 'The work provides new empirical evidence or validates existing theories.',
    displayOrder: 4,
  },
  {
    slug: 'reproducibility',
    label: 'Reproducibility',
    description: 'The work provides sufficient detail and materials for replication.',
    displayOrder: 5,
  },
  {
    slug: 'clarity',
    label: 'Clarity of Presentation',
    description: 'The work is well-written and clearly presents its findings.',
    displayOrder: 6,
  },
  {
    slug: 'novelty',
    label: 'Novelty',
    description: 'The work presents original ideas or approaches not previously explored.',
    displayOrder: 7,
  },
  {
    slug: 'significance',
    label: 'Significance',
    description: 'The work addresses an important problem with meaningful implications.',
    displayOrder: 8,
  },
  {
    slug: 'interdisciplinary',
    label: 'Interdisciplinary Impact',
    description: 'The work bridges multiple disciplines or has cross-domain applications.',
    displayOrder: 9,
  },
  {
    slug: 'practical',
    label: 'Practical Application',
    description: 'The work has clear practical applications or societal impact.',
    displayOrder: 10,
  },
] as const;

/**
 * Seeds all endorsement contribution type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedEndorsementContributions(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const contribution of ENDORSEMENT_CONTRIBUTION_DEFINITIONS) {
    await nodeCreator.createNode({
      slug: contribution.slug,
      kind: 'type',
      subkind: 'endorsement-contribution',
      label: contribution.label,
      description: contribution.description,
      metadata: {
        displayOrder: contribution.displayOrder,
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
