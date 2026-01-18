/**
 * Seed script for annotation motivation type nodes.
 *
 * @remarks
 * Seeds W3C-based annotation motivation types.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';

/**
 * Annotation motivation definitions based on W3C Web Annotation vocabulary.
 */
const MOTIVATION_DEFINITIONS = [
  {
    slug: 'commenting',
    label: 'Commenting',
    description: 'The motivation for when the user intends to comment about the Target.',
    w3cUri: 'http://www.w3.org/ns/oa#commenting',
    displayOrder: 1,
  },
  {
    slug: 'questioning',
    label: 'Questioning',
    description: 'The motivation for when the user intends to ask a question about the Target.',
    w3cUri: 'http://www.w3.org/ns/oa#questioning',
    displayOrder: 2,
  },
  {
    slug: 'highlighting',
    label: 'Highlighting',
    description: 'The motivation for when the user intends to highlight the Target.',
    w3cUri: 'http://www.w3.org/ns/oa#highlighting',
    displayOrder: 3,
  },
  {
    slug: 'replying',
    label: 'Replying',
    description: 'The motivation for when the user intends to reply to a previous comment.',
    w3cUri: 'http://www.w3.org/ns/oa#replying',
    displayOrder: 4,
  },
  {
    slug: 'linking',
    label: 'Linking',
    description: 'The motivation for when the user intends to link to another resource.',
    w3cUri: 'http://www.w3.org/ns/oa#linking',
    displayOrder: 5,
  },
  {
    slug: 'describing',
    label: 'Describing',
    description: 'The motivation for when the user intends to describe the Target.',
    w3cUri: 'http://www.w3.org/ns/oa#describing',
    displayOrder: 6,
  },
  {
    slug: 'classifying',
    label: 'Classifying',
    description: 'The motivation for when the user intends to classify the Target.',
    w3cUri: 'http://www.w3.org/ns/oa#classifying',
    displayOrder: 7,
  },
  {
    slug: 'tagging',
    label: 'Tagging',
    description: 'The motivation for when the user intends to tag the Target.',
    w3cUri: 'http://www.w3.org/ns/oa#tagging',
    displayOrder: 8,
  },
  {
    slug: 'editing',
    label: 'Editing',
    description: 'The motivation for when the user intends to request an edit to the Target.',
    w3cUri: 'http://www.w3.org/ns/oa#editing',
    displayOrder: 9,
  },
  {
    slug: 'bookmarking',
    label: 'Bookmarking',
    description: 'The motivation for when the user intends to bookmark the Target.',
    w3cUri: 'http://www.w3.org/ns/oa#bookmarking',
    displayOrder: 10,
  },
] as const;

/**
 * Seeds all annotation motivation nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedMotivations(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const motivation of MOTIVATION_DEFINITIONS) {
    const externalIds: ExternalId[] = [
      {
        system: 'w3c-oa',
        identifier: motivation.slug,
        uri: motivation.w3cUri,
        matchType: 'exact',
      },
    ];

    await nodeCreator.createNode({
      slug: motivation.slug,
      kind: 'type',
      subkind: 'motivation',
      label: motivation.label,
      description: motivation.description,
      externalIds,
      metadata: {
        displayOrder: motivation.displayOrder,
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
