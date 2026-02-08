/**
 * Seed script for paper type nodes.
 *
 * @remarks
 * Seeds research document types (original-research, review, meta-analysis, etc.).
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';

/**
 * Paper type definitions.
 */
const PAPER_TYPE_DEFINITIONS = [
  {
    slug: 'original-research',
    label: 'Original Research',
    description: 'Primary research presenting new findings or original data.',
    wikidataId: 'Q13442814',
    displayOrder: 1,
  },
  {
    slug: 'review',
    label: 'Review Article',
    description: 'Survey of existing research on a topic, synthesizing findings.',
    wikidataId: 'Q7318358',
    displayOrder: 2,
  },
  {
    slug: 'systematic-review',
    label: 'Systematic Review',
    description: 'Comprehensive review using systematic methodology to synthesize research.',
    wikidataId: 'Q1504425',
    displayOrder: 3,
  },
  {
    slug: 'meta-analysis',
    label: 'Meta-Analysis',
    description: 'Statistical analysis combining results from multiple studies.',
    wikidataId: 'Q815382',
    displayOrder: 4,
  },
  {
    slug: 'case-study',
    label: 'Case Study',
    description: 'In-depth analysis of a particular case or example.',
    wikidataId: 'Q155207',
    displayOrder: 5,
  },
  {
    slug: 'methods-paper',
    label: 'Methods Paper',
    description: 'Paper describing a new method, technique, or protocol.',
    displayOrder: 6,
  },
  {
    slug: 'data-paper',
    label: 'Data Paper',
    description: 'Paper describing a dataset and its collection methodology.',
    displayOrder: 7,
  },
  {
    slug: 'software-paper',
    label: 'Software Paper',
    description: 'Paper describing research software.',
    displayOrder: 8,
  },
  {
    slug: 'perspective',
    label: 'Perspective/Opinion',
    description: 'Opinion or viewpoint piece on a scientific topic.',
    displayOrder: 9,
  },
  {
    slug: 'commentary',
    label: 'Commentary',
    description: 'Brief commentary or response to previously published work.',
    displayOrder: 10,
  },
  {
    slug: 'letter',
    label: 'Letter/Brief Communication',
    description: 'Short communication presenting preliminary or time-sensitive findings.',
    wikidataId: 'Q591041',
    displayOrder: 11,
  },
  {
    slug: 'conference-paper',
    label: 'Conference Paper',
    description: 'Paper presented at a conference or symposium.',
    wikidataId: 'Q23927052',
    displayOrder: 12,
  },
  {
    slug: 'thesis',
    label: 'Thesis/Dissertation',
    description: 'Academic thesis or dissertation.',
    wikidataId: 'Q1266946',
    displayOrder: 13,
  },
  {
    slug: 'technical-report',
    label: 'Technical Report',
    description: 'Technical document describing research or development.',
    wikidataId: 'Q3099732',
    displayOrder: 14,
  },
  {
    slug: 'registered-report',
    label: 'Registered Report',
    description: 'Study with pre-registered methods reviewed before data collection.',
    displayOrder: 15,
  },
  {
    slug: 'replication-study',
    label: 'Replication Study',
    description: 'Study attempting to replicate previous research findings.',
    displayOrder: 16,
  },
] as const;

/**
 * Seeds all paper type nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedPaperTypes(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const paperType of PAPER_TYPE_DEFINITIONS) {
    const externalIds: ExternalId[] = [];

    if ('wikidataId' in paperType && paperType.wikidataId) {
      externalIds.push({
        system: 'wikidata',
        identifier: paperType.wikidataId,
        uri: `https://www.wikidata.org/wiki/${paperType.wikidataId}`,
        matchType: 'exact',
      });
    }

    await nodeCreator.createNode({
      slug: `paper-type-${paperType.slug}`,
      kind: 'type',
      subkind: 'paper-type',
      label: paperType.label,
      description: paperType.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      metadata: {
        displayOrder: paperType.displayOrder,
      },
      status: 'established',
    });
    count++;
  }

  return count;
}

/**
 * Export paper type slugs for edge creation.
 */
export const PAPER_TYPE_SLUGS = PAPER_TYPE_DEFINITIONS.map((p) => p.slug);
