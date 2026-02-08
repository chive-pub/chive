/**
 * Seed script for endorsement-type to endorsement-kind edges.
 *
 * @remarks
 * Creates relationships between endorsement types (methodological, analytical, etc.)
 * and endorsement kinds (core research, technical, etc.).
 *
 * This mapping allows the system to categorize endorsement types into broader kinds.
 *
 * @packageDocumentation
 */

import { EdgeCreator } from './lib/edge-creator.js';
import { NodeCreator } from './lib/node-creator.js';

/**
 * Mapping from endorsement-type slugs to endorsement-kind slugs.
 *
 * @remarks
 * Each endorsement type can belong to one or more endorsement kinds.
 */
const ENDORSEMENT_TYPE_TO_KIND_MAPPINGS: readonly {
  endorsementTypeSlug: string;
  kindSlugs: readonly string[];
}[] = [
  {
    endorsementTypeSlug: 'methodological',
    kindSlugs: ['methodological', 'core-research'],
  },
  {
    endorsementTypeSlug: 'analytical',
    kindSlugs: ['core-research', 'technical'],
  },
  {
    endorsementTypeSlug: 'theoretical',
    kindSlugs: ['theoretical', 'core-research'],
  },
  {
    endorsementTypeSlug: 'empirical',
    kindSlugs: ['empirical', 'core-research'],
  },
  {
    endorsementTypeSlug: 'conceptual',
    kindSlugs: ['theoretical', 'core-research'],
  },
  {
    endorsementTypeSlug: 'technical',
    kindSlugs: ['technical', 'applied'],
  },
  {
    endorsementTypeSlug: 'data',
    kindSlugs: ['empirical', 'technical'],
  },
  {
    endorsementTypeSlug: 'replication',
    kindSlugs: ['replication', 'methodological'],
  },
  {
    endorsementTypeSlug: 'reproducibility',
    kindSlugs: ['replication', 'methodological'],
  },
  {
    endorsementTypeSlug: 'synthesis',
    kindSlugs: ['synthesis', 'theoretical'],
  },
  {
    endorsementTypeSlug: 'interdisciplinary',
    kindSlugs: ['synthesis', 'applied'],
  },
  {
    endorsementTypeSlug: 'pedagogical',
    kindSlugs: ['applied'],
  },
  {
    endorsementTypeSlug: 'visualization',
    kindSlugs: ['technical', 'applied'],
  },
  {
    endorsementTypeSlug: 'societal-impact',
    kindSlugs: ['applied'],
  },
  {
    endorsementTypeSlug: 'clinical',
    kindSlugs: ['applied', 'empirical'],
  },
];

/**
 * Seeds edges connecting endorsement-type nodes to endorsement-kind nodes.
 *
 * @param edgeCreator - Edge creator instance
 * @param nodeCreator - Node creator instance (for generating URIs)
 * @returns Number of edges created
 */
export async function seedEndorsementTypeKindEdges(
  edgeCreator: EdgeCreator,
  nodeCreator: NodeCreator
): Promise<number> {
  let count = 0;

  for (const mapping of ENDORSEMENT_TYPE_TO_KIND_MAPPINGS) {
    // Get the endorsement-type node URI
    const endorsementTypeUri = nodeCreator.getNodeUri(
      'endorsement-type',
      mapping.endorsementTypeSlug
    );

    for (const kindSlug of mapping.kindSlugs) {
      // Get the endorsement-kind node URI
      const kindUri = nodeCreator.getNodeUri('endorsement-kind', kindSlug);

      // Create the edge from endorsement-type to endorsement-kind
      await edgeCreator.createEdge({
        sourceUri: endorsementTypeUri,
        targetUri: kindUri,
        relationSlug: 'relates-to',
        metadata: {
          source: 'chive-seed',
        },
        status: 'established',
      });
      count++;
    }
  }

  return count;
}
