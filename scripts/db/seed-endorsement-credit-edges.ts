/**
 * Seed script for endorsement-contribution to CRediT contribution-type edges.
 *
 * @remarks
 * Creates relationships between endorsement qualities (what users select when
 * endorsing a paper) and CRediT contributor roles (ANSI/NISO Z39.104-2022).
 *
 * This mapping allows the system to suggest relevant CRediT roles based on
 * endorsement selections, enhancing discoverability and attribution.
 *
 * @packageDocumentation
 */

import { EdgeCreator } from './lib/edge-creator.js';
import { NodeCreator } from './lib/node-creator.js';

/**
 * Mapping from endorsement-contribution slugs to related CRediT contribution-type slugs.
 *
 * @remarks
 * Each endorsement quality can relate to multiple CRediT roles. The weight
 * indicates the strength of the relationship (0-1).
 */
const ENDORSEMENT_TO_CREDIT_MAPPINGS: readonly {
  endorsementSlug: string;
  creditSlugs: readonly { slug: string; weight: number }[];
}[] = [
  {
    endorsementSlug: 'methodological',
    creditSlugs: [
      { slug: 'methodology', weight: 1.0 },
      { slug: 'investigation', weight: 0.7 },
    ],
  },
  {
    endorsementSlug: 'analytical',
    creditSlugs: [
      { slug: 'formal-analysis', weight: 1.0 },
      { slug: 'investigation', weight: 0.6 },
    ],
  },
  {
    endorsementSlug: 'theoretical',
    creditSlugs: [
      { slug: 'conceptualization', weight: 0.8 },
      { slug: 'writing-original-draft', weight: 0.5 },
    ],
  },
  {
    endorsementSlug: 'empirical',
    creditSlugs: [
      { slug: 'investigation', weight: 1.0 },
      { slug: 'validation', weight: 0.7 },
      { slug: 'data-curation', weight: 0.6 },
    ],
  },
  {
    endorsementSlug: 'conceptual',
    creditSlugs: [{ slug: 'conceptualization', weight: 1.0 }],
  },
  {
    endorsementSlug: 'technical',
    creditSlugs: [
      { slug: 'software', weight: 1.0 },
      { slug: 'methodology', weight: 0.6 },
      { slug: 'resources', weight: 0.5 },
    ],
  },
  {
    endorsementSlug: 'data',
    creditSlugs: [
      { slug: 'data-curation', weight: 1.0 },
      { slug: 'resources', weight: 0.6 },
    ],
  },
  {
    endorsementSlug: 'replication',
    creditSlugs: [
      { slug: 'validation', weight: 1.0 },
      { slug: 'investigation', weight: 0.7 },
    ],
  },
  {
    endorsementSlug: 'reproducibility',
    creditSlugs: [
      { slug: 'validation', weight: 1.0 },
      { slug: 'software', weight: 0.5 },
      { slug: 'data-curation', weight: 0.5 },
    ],
  },
  {
    endorsementSlug: 'synthesis',
    creditSlugs: [
      { slug: 'formal-analysis', weight: 0.8 },
      { slug: 'conceptualization', weight: 0.7 },
      { slug: 'writing-original-draft', weight: 0.6 },
    ],
  },
  {
    endorsementSlug: 'interdisciplinary',
    creditSlugs: [
      { slug: 'conceptualization', weight: 0.7 },
      { slug: 'methodology', weight: 0.6 },
    ],
  },
  {
    endorsementSlug: 'pedagogical',
    creditSlugs: [
      { slug: 'writing-original-draft', weight: 0.8 },
      { slug: 'visualization', weight: 0.6 },
    ],
  },
  {
    endorsementSlug: 'visualization',
    creditSlugs: [{ slug: 'visualization', weight: 1.0 }],
  },
  {
    endorsementSlug: 'societal-impact',
    creditSlugs: [
      { slug: 'conceptualization', weight: 0.6 },
      { slug: 'writing-original-draft', weight: 0.5 },
    ],
  },
  {
    endorsementSlug: 'clinical',
    creditSlugs: [
      { slug: 'investigation', weight: 0.8 },
      { slug: 'validation', weight: 0.7 },
      { slug: 'resources', weight: 0.5 },
    ],
  },
];

/**
 * Seeds edges connecting endorsement-contribution nodes to CRediT contribution-type nodes.
 *
 * @param edgeCreator - Edge creator instance
 * @param nodeCreator - Node creator instance (for generating URIs)
 * @returns Number of edges created
 */
export async function seedEndorsementCreditEdges(
  edgeCreator: EdgeCreator,
  nodeCreator: NodeCreator
): Promise<number> {
  let count = 0;

  for (const mapping of ENDORSEMENT_TO_CREDIT_MAPPINGS) {
    // Get the endorsement-contribution node URI
    const endorsementUri = nodeCreator.getNodeUri(
      'endorsement-contribution',
      mapping.endorsementSlug
    );

    for (const credit of mapping.creditSlugs) {
      // Get the contribution-type node URI
      const creditUri = nodeCreator.getNodeUri('contribution-type', credit.slug);

      // Create the edge from endorsement-contribution to contribution-type
      await edgeCreator.createEdge({
        sourceUri: endorsementUri,
        targetUri: creditUri,
        relationSlug: 'relates-to',
        weight: credit.weight,
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
