'use client';

/**
 * Dialog for adding an item to a user's collection.
 *
 * @remarks
 * Modal variant of the add-to-collection UI, intended for contexts where a
 * dropdown trigger cannot be used (e.g., inside an existing dropdown menu).
 * Lists the user's collections with checkmarks for items already added,
 * and provides a "Create new collection" action that navigates to the
 * collection wizard with the item pre-populated.
 *
 * Supports Cosmik/Semble dual-write: when a collection has Cosmik mirroring
 * enabled, the mutation automatically creates corresponding Cosmik cards.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FolderPlus, Check, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCurrentUser } from '@/lib/auth';
import {
  useMyCollections,
  useCollectionsContaining,
  type CollectionView,
} from '@/lib/hooks/use-collections';
import { createLogger } from '@/lib/observability/logger';
import { useAddItemToCollection } from './use-add-to-collection';

const logger = createLogger({ context: { component: 'add-to-collection-dialog' } });

/**
 * Props for the AddToCollectionDialog component.
 */
export interface AddToCollectionDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void;
  /** AT-URI of the item to add */
  itemUri: string;
  /** Type of the item (e.g., 'eprint', 'review') */
  itemType: string;
  /** Human-readable label for the item */
  itemLabel: string;
}

/**
 * Modal dialog for adding an item to one of the user's collections.
 *
 * @param props - Component props
 * @returns Dialog element
 */
export function AddToCollectionDialog({
  open,
  onOpenChange,
  itemUri,
  itemType,
  itemLabel,
}: AddToCollectionDialogProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();

  const { data: collectionsData, isLoading } = useMyCollections(currentUser?.did ?? '', {
    enabled: open && !!currentUser?.did,
  });

  const { data: containingData } = useCollectionsContaining(itemUri, {
    enabled: open && !!itemUri,
  });

  const { addItem, isPending } = useAddItemToCollection();

  const collections = useMemo(
    () => collectionsData?.collections ?? [],
    [collectionsData?.collections]
  );

  const containingUris = useMemo(() => {
    const uris = new Set<string>();
    if (containingData?.collections) {
      for (const c of containingData.collections) {
        uris.add(c.uri);
      }
    }
    return uris;
  }, [containingData?.collections]);

  const handleCollectionClick = useCallback(
    async (collection: CollectionView) => {
      if (containingUris.has(collection.uri)) {
        logger.info('Item already in collection', {
          itemUri,
          collectionUri: collection.uri,
        });
        toast.info(`"${itemLabel}" is already in "${collection.label}"`);
        return;
      }

      await addItem({ collection, itemUri, itemType, itemLabel, allCollections: collections });
      onOpenChange(false);
    },
    [addItem, containingUris, itemUri, itemType, itemLabel, onOpenChange, collections]
  );

  const handleCreateNew = useCallback(() => {
    logger.info('Navigating to create new collection with item', { itemUri, itemType });
    const params = new URLSearchParams({
      item: itemUri,
      type: itemType,
      label: itemLabel,
    });
    router.push(`/collections/new?${params.toString()}`);
    onOpenChange(false);
  }, [router, itemUri, itemType, itemLabel, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
          <DialogDescription>Choose a collection or create a new one.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-64">
          <div className="space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : collections.length === 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground">
                No collections yet
              </div>
            ) : (
              collections.map((collection) => {
                const isContained = containingUris.has(collection.uri);

                return (
                  <Button
                    key={collection.uri}
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => handleCollectionClick(collection)}
                    disabled={isPending}
                  >
                    {isContained ? (
                      <Check className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <FolderPlus className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{collection.label}</span>
                    {isContained && (
                      <span className="ml-auto text-xs text-muted-foreground">Added</span>
                    )}
                  </Button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Button variant="outline" className="w-full gap-2" onClick={handleCreateNew}>
          <Plus className="h-4 w-4" />
          Create new collection
        </Button>
      </DialogContent>
    </Dialog>
  );
}
