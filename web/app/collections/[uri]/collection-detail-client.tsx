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
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FolderTree, GripVertical, Layers, X } from 'lucide-react';

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
import { NodeDetailModal, type AddEdgeInput } from '@/components/knowledge-graph/node-detail-modal';
import { collectionItemToCardData } from '@/components/knowledge-graph/types';
import { useCurrentUser } from '@/lib/auth';
import {
  useCollection,
  useParentCollection,
  useDeleteCollection,
  useRemoveFromCollection,
  useUpdateCollectionItem,
  useReorderItems,
  useRepairCosmikMirror,
  findContainsEdge,
  getSubcollectionUris,
  collectionKeys,
  type CollectionItemView,
  type InterItemEdge,
} from '@/lib/hooks/use-collections';
import { useCreatePersonalEdge } from '@/lib/hooks/use-personal-graph';
import { deleteRecord } from '@/lib/atproto/record-creator';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'collection-detail-client' } });

/** Maps a subkind key to a human-readable plural section heading. */
function subkindHeading(key: string): string {
  const map: Record<string, string> = {
    eprint: 'Eprints',
    person: 'People',
    concept: 'Concepts',
    relation: 'Relations',
    field: 'Fields',
    institution: 'Institutions',
    event: 'Events',
    review: 'Reviews',
    endorsement: 'Endorsements',
    reference: 'References',
    object: 'Items',
    type: 'Types',
  };
  return map[key] ?? key.charAt(0).toUpperCase() + key.slice(1) + 's';
}

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
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const [directOnly, setDirectOnly] = useState(false);
  const { data, isLoading, error } = useCollection(uri, {
    excludeSubcollectionItems: directOnly,
  });
  const { data: parentCollection } = useParentCollection(uri);
  const deleteCollection = useDeleteCollection();
  const removeFromCollection = useRemoveFromCollection();
  const updateCollectionItem = useUpdateCollectionItem();
  const repairCosmikMirror = useRepairCosmikMirror();
  const reorderItems = useReorderItems();
  const createPersonalEdge = useCreatePersonalEdge();

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

        // Propagate deletion to ancestor collections
        let parentUri = collection.parentCollectionUri;
        while (parentUri) {
          try {
            const edgeInfo = await findContainsEdge(parentUri, item.itemUri);
            if (!edgeInfo.found || !edgeInfo.edgeUri) break;

            await removeFromCollection.mutateAsync({
              edgeUri: edgeInfo.edgeUri,
              collectionUri: parentUri,
              itemUri: item.itemUri,
              cosmikCardUri: edgeInfo.cosmikCardUri,
              cosmikLinkUri: edgeInfo.cosmikLinkUri,
              cosmikItemUrl: edgeInfo.cosmikItemUrl,
            });

            logger.info('Propagated deletion to parent collection', {
              parentUri,
              itemUri: item.itemUri,
            });

            parentUri = edgeInfo.parentCollectionUri;
          } catch (err) {
            logger.warn('Failed to propagate deletion to parent', {
              parentUri,
              error: err instanceof Error ? err.message : String(err),
            });
            break;
          }
        }

        // Propagate deletion to descendant subcollections
        const subQueue = [...subcollections.map((s) => s.uri)];
        while (subQueue.length > 0) {
          const subUri = subQueue.shift()!;
          try {
            const edgeInfo = await findContainsEdge(subUri, item.itemUri);
            if (!edgeInfo.found || !edgeInfo.edgeUri) continue;

            await removeFromCollection.mutateAsync({
              edgeUri: edgeInfo.edgeUri,
              collectionUri: subUri,
              itemUri: item.itemUri,
              cosmikCardUri: edgeInfo.cosmikCardUri,
              cosmikLinkUri: edgeInfo.cosmikLinkUri,
              cosmikItemUrl: edgeInfo.cosmikItemUrl,
            });

            logger.info('Propagated deletion to subcollection', {
              subUri,
              itemUri: item.itemUri,
            });

            // Fetch this subcollection's children to continue walking down
            const childUris = await getSubcollectionUris(subUri);
            subQueue.push(...childUris);
          } catch (err) {
            logger.warn('Failed to propagate deletion to subcollection', {
              subUri,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        toast.success('Item removed from collection');
      } catch (removeError) {
        toast.error(removeError instanceof Error ? removeError.message : 'Failed to remove item');
      }
    },
    [collection, removeFromCollection, subcollections]
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

  const handleAddEdge = useCallback(
    async (input: AddEdgeInput) => {
      if (!currentUser?.did) return;
      try {
        await createPersonalEdge.mutateAsync({
          sourceUri: input.sourceUri,
          targetUri: input.targetUri,
          relationSlug: input.relationSlug,
          ownerDid: currentUser.did,
        });
        await queryClient.invalidateQueries({ queryKey: collectionKeys.detail(uri) });
        toast.success('Relation added');
      } catch (edgeError) {
        toast.error(edgeError instanceof Error ? edgeError.message : 'Failed to add relation');
        throw edgeError;
      }
    },
    [currentUser?.did, createPersonalEdge, queryClient, uri]
  );

  const handleRemoveEdge = useCallback(
    async (edgeUri: string) => {
      const agent = getCurrentAgent();
      if (!agent) {
        toast.error('Not authenticated');
        return;
      }
      try {
        await deleteRecord(agent, edgeUri);
        await queryClient.invalidateQueries({ queryKey: collectionKeys.detail(uri) });
        toast.success('Relation removed');
      } catch (edgeError) {
        toast.error(edgeError instanceof Error ? edgeError.message : 'Failed to remove relation');
        throw edgeError;
      }
    },
    [queryClient, uri]
  );

  /** Items with `id` field for SortableItemList compatibility. */
  const sortableItems = useMemo(
    () => items.map((item) => ({ ...item, id: item.edgeUri })),
    [items]
  );

  /** Items grouped by subkind, preserving order within each group. */
  const groupedItems = useMemo(() => {
    const groups = new Map<string, Array<CollectionItemView & { id: string }>>();
    for (const item of sortableItems) {
      const key = item.subkind ?? item.kind ?? 'other';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    return groups;
  }, [sortableItems]);

  const handleReorder = useCallback(
    (reordered: Array<CollectionItemView & { id: string }>) => {
      if (!collection) return;
      // Merge the reordered group back into the full item list:
      // replace the group's items in-place, keeping other groups' positions.
      const reorderedSet = new Set(reordered.map((r) => r.edgeUri));
      const merged: string[] = [];
      let groupIdx = 0;
      for (const item of sortableItems) {
        if (reorderedSet.has(item.edgeUri)) {
          // Insert next item from the reordered group
          if (groupIdx < reordered.length) {
            merged.push(reordered[groupIdx].edgeUri);
            groupIdx++;
          }
        } else {
          merged.push(item.edgeUri);
        }
      }
      reorderItems.mutate(
        { collectionUri: collection.uri, itemOrder: merged },
        {
          onError: (reorderError) => {
            toast.error(
              reorderError instanceof Error ? reorderError.message : 'Failed to reorder items'
            );
          },
        }
      );
    },
    [collection, reorderItems, sortableItems]
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

  const handleRepairMirror = useCallback(async () => {
    if (!collection?.cosmikCollectionUri) return;
    try {
      const result = await repairCosmikMirror.mutateAsync({
        collectionUri: collection.uri,
        interItemEdges: interItemEdges.map((edge) => ({
          edgeUri: edge.edgeUri,
          sourceUri: edge.sourceUri,
          targetUri: edge.targetUri,
          relationSlug: edge.relationSlug,
        })),
        itemUrls: items.map((item) => item.itemUri),
      });
      toast.success(
        `Mirror repaired — ${result.created} connections created, ${result.pruned} orphans pruned.`
      );
    } catch (err) {
      logger.error('Repair mirror failed', err);
      toast.error('Could not repair mirror.');
    }
  }, [collection, interItemEdges, items, repairCosmikMirror]);

  return (
    <div className="space-y-8">
      {/* 1. Collection header */}
      <CollectionHeader
        collection={collection}
        isOwner={isOwner}
        subcollectionNames={subcollections.map((s) => s.label)}
        onDelete={handleDelete}
        isDeleting={deleteCollection.isPending}
        onRepairMirror={isOwner && collection.cosmikCollectionUri ? handleRepairMirror : undefined}
        isRepairing={repairCosmikMirror.isPending}
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Items
            {items.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({items.length})
              </span>
            )}
          </h2>
          {subcollections.length > 0 && (
            <Button
              variant={directOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDirectOnly(!directOnly)}
              title={
                directOnly
                  ? 'Showing only items not in subcollections'
                  : 'Showing all items including those in subcollections'
              }
            >
              {directOnly ? (
                <>
                  <FolderTree className="h-4 w-4 mr-1.5" />
                  Direct only
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4 mr-1.5" />
                  All items
                </>
              )}
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">This collection has no items yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...groupedItems.entries()].map(([subkind, groupItems]) => (
              <div key={subkind}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {subkindHeading(subkind)}
                  <span className="ml-1.5 text-xs">({groupItems.length})</span>
                </h3>
                {isOwner ? (
                  <SortableItemList
                    items={groupItems}
                    onReorder={handleReorder}
                    layout="grid"
                    className="sm:grid-cols-2 lg:grid-cols-3"
                    renderItem={(item, dragHandleProps: DragHandleProps) => (
                      <NodeCard
                        node={collectionItemToCardData(item)}
                        onClick={() => setSelectedItem(item)}
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
                    {groupItems.map((item) => (
                      <NodeCard
                        key={item.edgeUri}
                        node={collectionItemToCardData(item)}
                        onClick={() => setSelectedItem(item)}
                        edgeSummary={getEdgeSummary(item.itemUri)}
                      />
                    ))}
                  </div>
                )}
              </div>
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
        onAddEdge={handleAddEdge}
        onRemoveEdge={handleRemoveEdge}
      />
    </div>
  );
}
