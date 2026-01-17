/**
 * Seed script for document format type nodes.
 *
 * @remarks
 * Seeds document format types (PDF, LaTeX, Jupyter, etc.).
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { DOCUMENT_FORMAT_CONCEPTS } from './lib/concepts.js';

/**
 * MIME type mappings for document formats.
 */
const MIME_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  latex: ['application/x-latex', 'text/x-latex'],
  'jupyter-notebook': ['application/x-ipynb+json'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  html: ['text/html'],
  markdown: ['text/markdown'],
  odt: ['application/vnd.oasis.opendocument.text'],
  epub: ['application/epub+zip'],
};

/**
 * Seeds all document format nodes.
 *
 * @param nodeCreator - Node creator instance
 * @returns Number of nodes created
 */
export async function seedDocumentFormats(nodeCreator: NodeCreator): Promise<number> {
  let count = 0;

  for (const concept of DOCUMENT_FORMAT_CONCEPTS) {
    const externalIds: ExternalId[] = [];

    if (concept.wikidataId) {
      externalIds.push({
        system: 'wikidata',
        identifier: concept.wikidataId,
        uri: `https://www.wikidata.org/wiki/${concept.wikidataId}`,
        matchType: 'exact',
      });
    }

    await nodeCreator.createNode({
      slug: concept.slug,
      kind: 'type',
      subkind: 'document-format',
      label: concept.name,
      description: concept.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      metadata: {
        mimeTypes: MIME_TYPES[concept.slug],
      },
      status: 'established',
    });
    count++;
  }

  return count;
}
