/**
 * Seed script for academic field nodes with hierarchy edges.
 *
 * @remarks
 * Seeds academic field nodes with `subkind=field` and creates hierarchy
 * edges using broader/narrower relations. Also creates related edges for
 * interdisciplinary connections.
 *
 * @packageDocumentation
 */

import { NodeCreator, type ExternalId } from './lib/node-creator.js';
import { EdgeCreator } from './lib/edge-creator.js';
import { ALL_FIELDS, type FieldDefinition } from './lib/fields.js';

/**
 * Sorts fields so parents are created before children.
 */
function sortFieldsForCreation(fields: readonly FieldDefinition[]): readonly FieldDefinition[] {
  return [...fields].sort((a, b) => {
    // Sort by type: domain > division > group > field
    const typeOrder: Record<string, number> = { domain: 0, division: 1, group: 2, field: 3 };
    const aOrder = typeOrder[a.type] ?? 4;
    const bOrder = typeOrder[b.type] ?? 4;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // Then by whether they have a parent
    if (!a.parentSlug && b.parentSlug) return -1;
    if (a.parentSlug && !b.parentSlug) return 1;

    return 0;
  });
}

/**
 * Seeds all academic field nodes and hierarchy edges.
 *
 * @param nodeCreator - Node creator instance
 * @param edgeCreator - Edge creator instance
 * @returns Object with counts of nodes and edges created
 */
export async function seedFields(
  nodeCreator: NodeCreator,
  edgeCreator: EdgeCreator
): Promise<{ nodeCount: number; edgeCount: number }> {
  let nodeCount = 0;
  let edgeCount = 0;

  const sortedFields = sortFieldsForCreation(ALL_FIELDS);

  // First pass: create all field nodes
  for (const field of sortedFields) {
    const externalIds: ExternalId[] = [];

    if (field.wikidataId) {
      externalIds.push({
        system: 'wikidata',
        identifier: field.wikidataId,
        uri: `https://www.wikidata.org/wiki/${field.wikidataId}`,
        matchType: 'exact',
      });
    }

    if (field.anzsrcCode) {
      externalIds.push({
        system: 'anzsrc',
        identifier: field.anzsrcCode,
        matchType: 'exact',
      });
    }

    await nodeCreator.createNode({
      slug: field.slug,
      kind: 'object',
      subkind: 'field',
      label: field.label,
      description: field.description,
      externalIds: externalIds.length > 0 ? externalIds : undefined,
      status: 'established',
    });
    nodeCount++;
  }

  // Second pass: create hierarchy edges (broader/narrower)
  for (const field of ALL_FIELDS) {
    if (field.parentSlug) {
      const childUri = nodeCreator.getNodeUri('field', field.slug);
      const parentUri = nodeCreator.getNodeUri('field', field.parentSlug);

      // Create broader edge (child -> parent)
      await edgeCreator.createEdge({
        sourceUri: childUri,
        targetUri: parentUri,
        relationSlug: 'broader',
      });
      edgeCount++;

      // Create narrower edge (parent -> child)
      await edgeCreator.createEdge({
        sourceUri: parentUri,
        targetUri: childUri,
        relationSlug: 'narrower',
      });
      edgeCount++;
    }
  }

  // Third pass: create related edges for interdisciplinary connections
  for (const field of ALL_FIELDS) {
    if (field.relatedSlugs) {
      const sourceUri = nodeCreator.getNodeUri('field', field.slug);

      for (const relatedSlug of field.relatedSlugs) {
        const targetUri = nodeCreator.getNodeUri('field', relatedSlug);

        // Only create one direction since 'related' is symmetric
        // Use alphabetical ordering to avoid duplicates
        if (field.slug < relatedSlug) {
          await edgeCreator.createEdge({
            sourceUri,
            targetUri,
            relationSlug: 'related',
          });
          edgeCount++;
        }
      }
    }
  }

  return { nodeCount, edgeCount };
}
