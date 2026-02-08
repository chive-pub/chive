/**
 * Seed script for research methodology nodes.
 *
 * @remarks
 * Seeds research methodologies (energy facet values) with no subkind.
 * These values are linked to the `energy` facet via `has-value` edges.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';

/**
 * Research methodology definitions.
 */
const METHODOLOGIES = [
  {
    slug: 'qualitative-research',
    label: 'Qualitative Research',
    description:
      'Research methodology collecting and analyzing non-numerical data to understand concepts, opinions, or experiences.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q839486', uri: 'https://www.wikidata.org/wiki/Q839486' },
    ],
  },
  {
    slug: 'quantitative-research',
    label: 'Quantitative Research',
    description: 'Research methodology focused on collecting and analyzing numerical data.',
    externalIds: [
      { system: 'fast', identifier: '1916262', uri: 'https://id.worldcat.org/fast/1916262' },
      { system: 'wikidata', identifier: 'Q730675', uri: 'https://www.wikidata.org/wiki/Q730675' },
    ],
  },
  {
    slug: 'mixed-methods',
    label: 'Mixed Methods Research',
    description: 'Research combining qualitative and quantitative approaches in a single study.',
    externalIds: [
      { system: 'fast', identifier: '1762526', uri: 'https://id.worldcat.org/fast/1762526' },
    ],
  },
  {
    slug: 'case-study',
    label: 'Case Study',
    description: 'In-depth investigation of a single case or small number of cases.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q155207', uri: 'https://www.wikidata.org/wiki/Q155207' },
    ],
  },
  {
    slug: 'systematic-review',
    label: 'Systematic Review',
    description: 'Comprehensive, reproducible review of existing research on a specific question.',
    externalIds: [
      { system: 'wikidata', identifier: 'Q1504425', uri: 'https://www.wikidata.org/wiki/Q1504425' },
    ],
  },
  {
    slug: 'meta-analysis',
    label: 'Meta-Analysis',
    description: 'Statistical technique combining results from multiple studies.',
    externalIds: [
      { system: 'fast', identifier: '1017318', uri: 'https://id.worldcat.org/fast/1017318' },
      { system: 'wikidata', identifier: 'Q815382', uri: 'https://www.wikidata.org/wiki/Q815382' },
    ],
  },
  {
    slug: 'randomized-controlled-trial',
    label: 'Randomized Controlled Trial',
    description:
      'Experimental study randomly assigning participants to treatment and control groups.',
    externalIds: [
      { system: 'fast', identifier: '1089997', uri: 'https://id.worldcat.org/fast/1089997' },
      { system: 'wikidata', identifier: 'Q1436668', uri: 'https://www.wikidata.org/wiki/Q1436668' },
    ],
  },
  {
    slug: 'longitudinal-study',
    label: 'Longitudinal Study',
    description: 'Research following subjects over an extended period of time.',
    externalIds: [
      { system: 'fast', identifier: '1002387', uri: 'https://id.worldcat.org/fast/1002387' },
      { system: 'wikidata', identifier: 'Q1758614', uri: 'https://www.wikidata.org/wiki/Q1758614' },
    ],
  },
  {
    slug: 'cross-sectional-study',
    label: 'Cross-Sectional Study',
    description: 'Research analyzing data from a population at a single point in time.',
    externalIds: [
      { system: 'fast', identifier: '884677', uri: 'https://id.worldcat.org/fast/884677' },
      { system: 'wikidata', identifier: 'Q954027', uri: 'https://www.wikidata.org/wiki/Q954027' },
    ],
  },
  {
    slug: 'ethnography',
    label: 'Ethnography',
    description:
      'Qualitative research involving immersive observation of people in their natural setting.',
    externalIds: [
      { system: 'fast', identifier: '916106', uri: 'https://id.worldcat.org/fast/916106' },
      { system: 'wikidata', identifier: 'Q132151', uri: 'https://www.wikidata.org/wiki/Q132151' },
    ],
  },
  {
    slug: 'grounded-theory',
    label: 'Grounded Theory',
    description: 'Methodology developing theory from systematically gathered and analyzed data.',
    externalIds: [
      { system: 'fast', identifier: '1738512', uri: 'https://id.worldcat.org/fast/1738512' },
      { system: 'wikidata', identifier: 'Q1152864', uri: 'https://www.wikidata.org/wiki/Q1152864' },
    ],
  },
  {
    slug: 'content-analysis',
    label: 'Content Analysis',
    description: 'Systematic analysis of text, images, or other content for patterns and meaning.',
    externalIds: [
      { system: 'fast', identifier: '876592', uri: 'https://id.worldcat.org/fast/876592' },
    ],
  },
  {
    slug: 'discourse-analysis',
    label: 'Discourse Analysis',
    description: 'Analysis of language use in texts, conversations, and social contexts.',
    externalIds: [
      { system: 'fast', identifier: '894930', uri: 'https://id.worldcat.org/fast/894930' },
      { system: 'wikidata', identifier: 'Q1129466', uri: 'https://www.wikidata.org/wiki/Q1129466' },
    ],
  },
  {
    slug: 'survey-research',
    label: 'Survey Research',
    description: 'Data collection through structured questionnaires administered to samples.',
    externalIds: [
      { system: 'fast', identifier: '1139696', uri: 'https://id.worldcat.org/fast/1139696' },
    ],
  },
  {
    slug: 'experimental-design',
    label: 'Experimental Design',
    description: 'Methodology involving controlled manipulation of variables to test hypotheses.',
    externalIds: [
      { system: 'fast', identifier: '918523', uri: 'https://id.worldcat.org/fast/918523' },
    ],
  },
  {
    slug: 'statistical-analysis',
    label: 'Statistical Analysis',
    description: 'Application of statistical methods to collect, analyze, and interpret data.',
    externalIds: [
      { system: 'fast', identifier: '1132103', uri: 'https://id.worldcat.org/fast/1132103' },
      { system: 'wikidata', identifier: 'Q12483', uri: 'https://www.wikidata.org/wiki/Q12483' },
    ],
  },
  {
    slug: 'machine-learning',
    label: 'Machine Learning',
    description:
      'Computational methods enabling systems to learn from data without explicit programming.',
    externalIds: [
      { system: 'fast', identifier: '1762775', uri: 'https://id.worldcat.org/fast/1762775' },
      { system: 'wikidata', identifier: 'Q2539', uri: 'https://www.wikidata.org/wiki/Q2539' },
    ],
  },
  {
    slug: 'simulation',
    label: 'Computer Simulation',
    description: 'Use of computational models to simulate real-world systems and processes.',
    externalIds: [
      { system: 'fast', identifier: '872389', uri: 'https://id.worldcat.org/fast/872389' },
      { system: 'wikidata', identifier: 'Q925667', uri: 'https://www.wikidata.org/wiki/Q925667' },
    ],
  },
  {
    slug: 'field-research',
    label: 'Field Research',
    description: 'Research conducted outside the laboratory in natural settings.',
    externalIds: [
      { system: 'fast', identifier: '923632', uri: 'https://id.worldcat.org/fast/923632' },
    ],
  },
  {
    slug: 'archival-research',
    label: 'Archival Research',
    description: 'Research using historical documents and records from archives.',
    externalIds: [
      { system: 'fast', identifier: '813501', uri: 'https://id.worldcat.org/fast/813501' },
      { system: 'wikidata', identifier: 'Q4787243', uri: 'https://www.wikidata.org/wiki/Q4787243' },
    ],
  },
] as const;

/**
 * Seeds research methodology nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedMethodologies(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const methodology of METHODOLOGIES) {
    const externalIds: ExternalId[] = methodology.externalIds.map((ext) => ({
      system: ext.system,
      identifier: ext.identifier,
      uri: ext.uri,
      matchType: 'exact' as const,
    }));

    await nodeCreator.createNode({
      slug: `method-${methodology.slug}`,
      kind: 'object',
      // No subkind - specific methodology, display determined by context
      label: methodology.label,
      description: methodology.description,
      externalIds,
      status: 'established',
    });
    count++;
  }

  return count;
}

/**
 * Export methodology slugs for edge creation.
 */
export const METHODOLOGY_SLUGS = METHODOLOGIES.map((m) => m.slug);
