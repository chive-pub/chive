/**
 * Seed script for endorsement type nodes.
 *
 * @remarks
 * Seeds scholarly contribution qualities for endorsements.
 * These are now called "endorsement-type" (renamed from endorsement-contribution).
 *
 * @packageDocumentation
 */

import { NodeCreator } from './lib/node-creator.js';

/**
 * Endorsement type definitions.
 *
 * @remarks
 * These slugs MUST match the knownValues in pub.chive.review.endorsement lexicon.
 * See lexicons/pub/chive/review/endorsement.json for the source of truth.
 */
const ENDORSEMENT_TYPE_DEFINITIONS = [
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
    slug: 'conceptual',
    label: 'Conceptual Innovation',
    description: 'The work introduces novel concepts or reframes existing understanding.',
    displayOrder: 5,
  },
  {
    slug: 'technical',
    label: 'Technical Excellence',
    description: 'The work demonstrates high technical quality in implementation or analysis.',
    displayOrder: 6,
  },
  {
    slug: 'data',
    label: 'Data Quality',
    description: 'The work provides high-quality data collection, curation, or analysis.',
    displayOrder: 7,
  },
  {
    slug: 'replication',
    label: 'Replication Value',
    description: 'The work replicates or extends existing findings with rigor.',
    displayOrder: 8,
  },
  {
    slug: 'reproducibility',
    label: 'Reproducibility',
    description: 'The work provides sufficient detail and materials for replication.',
    displayOrder: 9,
  },
  {
    slug: 'synthesis',
    label: 'Synthesis & Integration',
    description: 'The work synthesizes diverse sources or integrates multiple perspectives.',
    displayOrder: 10,
  },
  {
    slug: 'interdisciplinary',
    label: 'Interdisciplinary Impact',
    description: 'The work bridges multiple disciplines or has cross-domain applications.',
    displayOrder: 11,
  },
  {
    slug: 'pedagogical',
    label: 'Pedagogical Value',
    description: 'The work is valuable for teaching or educational purposes.',
    displayOrder: 12,
  },
  {
    slug: 'visualization',
    label: 'Visualization Quality',
    description: 'The work provides excellent data visualization or graphical presentation.',
    displayOrder: 13,
  },
  {
    slug: 'societal-impact',
    label: 'Societal Impact',
    description: 'The work has meaningful implications for society or public policy.',
    displayOrder: 14,
  },
  {
    slug: 'clinical',
    label: 'Clinical Relevance',
    description: 'The work has direct applications to clinical practice or patient care.',
    displayOrder: 15,
  },
] as const;

/**
 * Seeds all endorsement type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedEndorsementTypes(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const endorsementType of ENDORSEMENT_TYPE_DEFINITIONS) {
    await nodeCreator.createNode({
      slug: endorsementType.slug,
      kind: 'type',
      subkind: 'endorsement-type',
      label: endorsementType.label,
      description: endorsementType.description,
      metadata: {
        displayOrder: endorsementType.displayOrder,
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
