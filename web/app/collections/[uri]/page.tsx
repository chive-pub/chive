'use client';

/**
 * Collection detail page.
 *
 * @remarks
 * Client-side rendered page that displays a collection's full contents,
 * including header, subcollections, items, and inter-item edges.
 * Uses TanStack Query hooks for data fetching.
 */

import { useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  CollectionHeader,
  CollectionHeaderSkeleton,
} from '@/components/collection/collection-header';
import { CollectionItemList } from '@/components/collection/collection-item-list';
import { SubcollectionTree } from '@/components/collection/subcollection-tree';
import {
  CollectionEdgeDisplay,
  type CollectionEdge,
} from '@/components/collection/collection-edge-display';
import { useCurrentUser } from '@/lib/auth';
import {
  useCollection,
  useParentCollection,
  useDeleteCollection,
  useRemoveFromCollection,
  type CollectionItemView,
} from '@/lib/hooks/use-collections';

/**
 * Collection detail route parameters.
 */
interface CollectionPageProps {
  params: Promise<{
    uri: string;
  }>;
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
 * Collection detail page component.
 *
 * Displays a collection's header (name, description, owner, visibility),
 * parent breadcrumb, subcollections grid, ordered item list, and
 * inter-item edge relationships.
 */
export default function CollectionDetailPage({ params }: CollectionPageProps) {
  const { uri: encodedUri } = use(params);
  const decodedUri = decodeURIComponent(encodedUri);

  const router = useRouter();
  const currentUser = useCurrentUser();
  const { data, isLoading, error } = useCollection(decodedUri);
  const { data: parentCollection } = useParentCollection(decodedUri);
  const deleteCollection = useDeleteCollection();
  const removeFromCollection = useRemoveFromCollection();

  const collection = data?.collection;
  const items = data?.items ?? [];
  const subcollections = data?.subcollections ?? [];
  const isOwner = !!currentUser?.did && currentUser.did === collection?.ownerDid;

  // Extract custom edges from items (edges beyond CONTAINS)
  // These would come from additional API data; for now we filter
  // based on edge metadata if available
  const customEdges: CollectionEdge[] = [];

  const handleDelete = useCallback(async () => {
    if (!collection) return;
    try {
      await deleteCollection.mutateAsync({
        uri: collection.uri,
        ownerDid: collection.ownerDid,
        cascadeSubcollections: true,
      });
      toast.success('Collection deleted');
      router.push('/dashboard/collections');
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete collection'
      );
    }
  }, [collection, deleteCollection, router]);

  const handleRemoveItem = useCallback(
    async (item: CollectionItemView) => {
      if (!collection) return;
      try {
        await removeFromCollection.mutateAsync({
          edgeUri: item.edgeUri,
          collectionUri: collection.uri,
          itemUri: item.itemUri,
        });
        toast.success('Item removed from collection');
      } catch (removeError) {
        toast.error(removeError instanceof Error ? removeError.message : 'Failed to remove item');
      }
    },
    [collection, removeFromCollection]
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
        subcollectionNames={subcollections.map((s) => s.name)}
        onDelete={handleDelete}
        isDeleting={deleteCollection.isPending}
      />

      <Separator />

      {/* 2. Parent breadcrumb and 3. Subcollections */}
      <SubcollectionTree
        subcollections={subcollections}
        currentUri={decodedUri}
        parentCollection={parentCollection}
      />

      {/* Separator between subcollections and items */}
      {subcollections.length > 0 && items.length > 0 && <Separator />}

      {/* 4. Items list */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Items
          {items.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({items.length})</span>
          )}
        </h2>
        <CollectionItemList
          items={items}
          editable={isOwner}
          onRemove={handleRemoveItem}
          isRemoving={removeFromCollection.isPending}
        />
      </section>

      {/* 5. Custom edge relationships */}
      {customEdges.length > 0 && (
        <>
          <Separator />
          <CollectionEdgeDisplay edges={customEdges} items={items} />
        </>
      )}
    </div>
  );
}
