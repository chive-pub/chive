/**
 * Shared hook for adding items to collections with personal node creation.
 *
 * @remarks
 * Collection items must be personal graph nodes in the user's PDS. This hook
 * wraps the raw `useAddToCollection` mutation with a personal-node-creation
 * step that mirrors the logic in the collection wizard. It maps item types
 * (eprint, author, review, endorsement) to the appropriate personal node
 * subkind and metadata before creating the CONTAINS edge.
 *
 * @packageDocumentation
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

import { useAddToCollection, type CollectionView } from '@/lib/hooks/use-collections';
import { createLogger } from '@/lib/observability/logger';
import { useCreatePersonalNode } from '@/lib/hooks/use-personal-graph';

const logger = createLogger({ context: { component: 'add-to-collection' } });

/**
 * Input for adding an item to a collection via the shared hook.
 */
interface AddItemInput {
  collection: CollectionView;
  itemUri: string;
  itemType: string;
  itemLabel: string;
  /** All user collections, used to walk up the parent chain and propagate items. */
  allCollections?: CollectionView[];
}

/**
 * Maps an item type and URI to a personal graph node input.
 */
function buildPersonalNodeInput(
  itemType: string,
  itemUri: string,
  itemLabel: string
): { kind: string; subkind: string; label: string; metadata?: Record<string, unknown> } {
  switch (itemType) {
    case 'eprint':
      return {
        kind: 'object',
        subkind: 'eprint',
        label: itemLabel,
        metadata: { eprintUri: itemUri },
      };
    case 'author':
      return {
        kind: 'object',
        subkind: 'person',
        label: itemLabel,
        metadata: {
          did: itemUri.startsWith('did:') ? itemUri : itemUri.split('/')[2],
        },
      };
    case 'review':
      return {
        kind: 'object',
        subkind: 'review',
        label: itemLabel,
        metadata: { reviewUri: itemUri },
      };
    case 'endorsement':
      return {
        kind: 'object',
        subkind: 'endorsement',
        label: itemLabel,
        metadata: { endorsementUri: itemUri },
      };
    case 'graphNode':
      return {
        kind: 'object',
        subkind: 'concept',
        label: itemLabel,
        metadata: { clonedFrom: itemUri },
      };
    default:
      return {
        kind: 'object',
        subkind: 'reference',
        label: itemLabel,
        metadata: { referenceUri: itemUri },
      };
  }
}

/**
 * Hook that handles creating a personal graph node and adding it to a collection.
 *
 * @returns Object with `addItem` callback and `isPending` state
 */
export function useAddItemToCollection() {
  const createPersonalNode = useCreatePersonalNode();
  const addToCollection = useAddToCollection();
  const isPending = createPersonalNode.isPending || addToCollection.isPending;
  // Track pending state across the async gap between create + add
  const isAdding = useRef(false);

  const addItem = useCallback(
    async ({ collection, itemUri, itemType, itemLabel, allCollections }: AddItemInput) => {
      if (isAdding.current) return;
      isAdding.current = true;

      try {
        // Step 1: Create a personal graph node wrapping this item
        const nodeInput = buildPersonalNodeInput(itemType, itemUri, itemLabel);
        const personalNode = await createPersonalNode.mutateAsync(nodeInput);

        logger.info('Personal node created for collection item', {
          itemUri,
          itemType,
          personalNodeUri: personalNode.uri,
        });

        // Step 2: Add the personal node to the collection via CONTAINS edge
        await addToCollection.mutateAsync({
          collectionUri: collection.uri,
          itemUri: personalNode.uri,
          label: itemLabel,
          // Cosmik dual-write (no-op when collection has no Cosmik mirror)
          cosmikCollectionUri: collection.cosmikCollectionUri,
          cosmikCollectionCid: collection.cosmikCollectionCid,
          itemUrl: itemUri,
          itemTitle: itemLabel,
          itemType,
        });

        logger.info('Item added to collection', {
          collectionUri: collection.uri,
          itemUri,
          itemType,
          personalNodeUri: personalNode.uri,
        });

        // Step 3: Propagate to ancestor collections
        if (allCollections) {
          let parentUri = collection.parentCollectionUri;
          while (parentUri) {
            const parent = allCollections.find((c) => c.uri === parentUri);
            if (!parent) break;
            try {
              await addToCollection.mutateAsync({
                collectionUri: parent.uri,
                itemUri: personalNode.uri,
                label: itemLabel,
                cosmikCollectionUri: parent.cosmikCollectionUri,
                cosmikCollectionCid: parent.cosmikCollectionCid,
                itemUrl: itemUri,
                itemTitle: itemLabel,
                itemType,
              });
              logger.info('Propagated item to parent collection', {
                parentUri: parent.uri,
                itemUri,
              });
            } catch (err) {
              logger.warn('Failed to propagate item to parent collection', {
                parentUri: parent.uri,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            parentUri = parent.parentCollectionUri;
          }
        }

        toast.success(`Added to "${collection.label}"`);
      } catch (error) {
        logger.error(
          'Failed to add item to collection',
          error instanceof Error ? error : undefined,
          { collectionUri: collection.uri, itemUri, itemType }
        );
        toast.error(error instanceof Error ? error.message : 'Failed to add to collection');
      } finally {
        isAdding.current = false;
      }
    },
    [createPersonalNode, addToCollection]
  );

  return { addItem, isPending };
}
