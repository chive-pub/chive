'use client';

/**
 * Client-side collection detail content.
 *
 * @remarks
 * Renders the full collection detail UI including header, subcollections,
 * items, inter-item edge relationships, and activity feed. Extracted from
 * the page component to allow the page to be a server component with
 * generateMetadata.
 */

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GripVertical, X } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CollectionFeed } from '@/components/collection/collection-feed';
import {
  CollectionHeader,
  CollectionHeaderSkeleton,
} from '@/components/collection/collection-header';
import { SortableItemList, type DragHandleProps } from '@/components/collection/sortable-item-list';
import { SubcollectionTree } from '@/components/collection/subcollection-tree';
import { NodeCard, type EdgeSummary } from '@/components/knowledge-graph/node-card';
import { NodeDetailModal } from '@/components/knowledge-graph/node-detail-modal';
import { collectionItemToCardData } from '@/components/knowledge-graph/types';
import { useCurrentUser } from '@/lib/auth';
import {
  useCollection,
  useParentCollection,
  useDeleteCollection,
  useRemoveFromCollection,
  useUpdateCollectionItem,
  useReorderItems,
  type CollectionItemView,
  type InterItemEdge,
} from '@/lib/hooks/use-collections';

/**
 * Props for the collection detail client component.
 */
interface CollectionDetailClientProps {
  /** Decoded AT-URI of the collection. */
  uri: string;
}

/**
 * Loading skeleton for the collection detail page.
 */
function CollectionDetailSkeleton() {
  return (
    <div className="space-y-8">
      <CollectionHeaderSkeleton />
      <Separator />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Separator />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-start gap-3 p-4">
              <Skeleton className="h-6 w-6 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Collection detail client component.
 *
 * Displays a collection's header (name, description, owner, visibility),
 * parent breadcrumb, subcollections grid, ordered item list, inter-item
 * edge badges, and an activity feed.
 *
 * @param props - Component props containing the collection URI
 */
export function CollectionDetailClient({ uri }: CollectionDetailClientProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { data, isLoading, error } = useCollection(uri);
  const { data: parentCollection } = useParentCollection(uri);
  const deleteCollection = useDeleteCollection();
  const removeFromCollection = useRemoveFromCollection();
  const updateCollectionItem = useUpdateCollectionItem();
  const reorderItems = useReorderItems();

  const collection = data?.collection;
  const items = data?.items ?? [];
  const subcollections = data?.subcollections ?? [];
  const isOwner = !!currentUser?.did && currentUser.did === collection?.ownerDid;

  const interItemEdges: InterItemEdge[] = data?.interItemEdges ?? [];

  /** Returns a compact edge summary for an item. */
  const getEdgeSummary = useCallback(
    (itemUri: string): EdgeSummary | undefined => {
      const count = interItemEdges.filter(
        (edge) => edge.sourceUri === itemUri || edge.targetUri === itemUri
      ).length;
      return count > 0 ? { count } : undefined;
    },
    [interItemEdges]
  );

  const [selectedItemUri, setSelectedItemUri] = useState<string | null>(null);

  // Derive selectedItem from the live items array so it stays fresh after mutations
  const selectedItem = useMemo(
    () => (selectedItemUri ? (items.find((i) => i.itemUri === selectedItemUri) ?? null) : null),
    [selectedItemUri, items]
  );
  const setSelectedItem = useCallback(
    (item: CollectionItemView | null) => setSelectedItemUri(item?.itemUri ?? null),
    []
  );

  const handleDelete = useCallback(
    async (deleteSubcollections: boolean) => {
      if (!collection) return;
      try {
        await deleteCollection.mutateAsync({
          uri: collection.uri,
          ownerDid: collection.ownerDid,
          cascadeSubcollections: !deleteSubcollections,
          deleteSubcollections,
          cosmikCollectionUri: collection.cosmikCollectionUri,
          cosmikItems: collection.cosmikItems,
          subcollections: deleteSubcollections ? subcollections : undefined,
        });
        toast.success('Collection deleted');
        router.push('/dashboard/collections');
      } catch (deleteError) {
        toast.error(
          deleteError instanceof Error ? deleteError.message : 'Failed to delete collection'
        );
      }
    },
    [collection, deleteCollection, router, subcollections]
  );

  const handleRemoveItem = useCallback(
    async (item: CollectionItemView) => {
      if (!collection) return;

      // Look up the item's Cosmik card/link URIs from the collection metadata
      const cosmikItems = collection.cosmikItems;
      const cosmikMapping = cosmikItems
        ? Object.entries(cosmikItems).find(([url]) => url === item.itemUri)?.[1]
        : undefined;

      try {
        await removeFromCollection.mutateAsync({
          edgeUri: item.edgeUri,
          collectionUri: collection.uri,
          itemUri: item.itemUri,
          cosmikCardUri: cosmikMapping?.cardUri,
          cosmikLinkUri: cosmikMapping?.linkUri,
          cosmikItemUrl: cosmikMapping ? item.itemUri : undefined,
        });
        toast.success('Item removed from collection');
      } catch (removeError) {
        toast.error(removeError instanceof Error ? removeError.message : 'Failed to remove item');
      }
    },
    [collection, removeFromCollection]
  );

  const handleSaveItem = useCallback(
    async (updates: { label?: string; note?: string }) => {
      if (!collection || !selectedItem) return;
      try {
        await updateCollectionItem.mutateAsync({
          edgeUri: selectedItem.edgeUri,
          collectionUri: collection.uri,
          itemUri: selectedItem.itemUri,
          ...updates,
        });
        toast.success('Item updated');
      } catch (saveError) {
        toast.error(saveError instanceof Error ? saveError.message : 'Failed to update item');
      }
    },
    [collection, selectedItem, updateCollectionItem]
  );

  /** Items with `id` field for SortableItemList compatibility. */
  const sortableItems = useMemo(
    () => items.map((item) => ({ ...item, id: item.edgeUri })),
    [items]
  );

  const handleReorder = useCallback(
    (reordered: Array<CollectionItemView & { id: string }>) => {
      if (!collection) return;
      const itemOrder = reordered.map((item) => item.edgeUri);
      reorderItems.mutate(
        { collectionUri: collection.uri, itemOrder },
        {
          onError: (reorderError) => {
            toast.error(
              reorderError instanceof Error ? reorderError.message : 'Failed to reorder items'
            );
          },
        }
      );
    },
    [collection, reorderItems]
  );

  if (isLoading) {
    return <CollectionDetailSkeleton />;
  }

  if (error) {
    if (error.message.includes('not found') || error.message.includes('404')) {
      return (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Collection not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This collection may have been deleted or is not accessible.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <h2 className="text-lg font-semibold text-destructive">Failed to load collection</h2>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="rounded-lg border-2 border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Collection not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This collection may have been deleted or is not accessible.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Collection header */}
      <CollectionHeader
        collection={collection}
        isOwner={isOwner}
        subcollectionNames={subcollections.map((s) => s.label)}
        onDelete={handleDelete}
        isDeleting={deleteCollection.isPending}
      />

      <Separator />

      {/* 2. Parent breadcrumb and 3. Subcollections */}
      <SubcollectionTree
        subcollections={subcollections}
        currentUri={uri}
        parentCollection={parentCollection}
        isOwner={isOwner}
      />

      {/* Separator between subcollections and items */}
      {subcollections.length > 0 && items.length > 0 && <Separator />}

      {/* 4. Items */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Items
          {items.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({items.length})</span>
          )}
        </h2>
        {items.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">This collection has no items yet.</p>
          </div>
        ) : isOwner ? (
          <SortableItemList
            items={sortableItems}
            onReorder={handleReorder}
            layout="grid"
            className="sm:grid-cols-2 lg:grid-cols-3"
            renderItem={(item, dragHandleProps: DragHandleProps) => (
              <NodeCard
                node={collectionItemToCardData(item)}
                onClick={() => setSelectedItem(item)}
                showSubkind
                edgeSummary={getEdgeSummary(item.itemUri)}
                actions={
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground"
                      ref={dragHandleProps.ref}
                      {...(dragHandleProps.attributes as React.HTMLAttributes<HTMLButtonElement>)}
                      {...(dragHandleProps.listeners as React.HTMLAttributes<HTMLButtonElement>)}
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item);
                      }}
                      title="Remove from collection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                }
              />
            )}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <NodeCard
                key={item.edgeUri}
                node={collectionItemToCardData(item)}
                onClick={() => setSelectedItem(item)}
                showSubkind
                edgeSummary={getEdgeSummary(item.itemUri)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Activity feed */}
      <Separator />
      <CollectionFeed
        collectionUri={collection.uri}
        onItemClick={(itemUri) => setSelectedItemUri(itemUri)}
      />

      {/* Node detail modal */}
      <NodeDetailModal
        node={selectedItem ? collectionItemToCardData(selectedItem) : null}
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        collectionEdges={interItemEdges}
        collectionItems={items}
        editable={isOwner}
        onSave={handleSaveItem}
        isSaving={updateCollectionItem.isPending}
      />
    </div>
  );
}
