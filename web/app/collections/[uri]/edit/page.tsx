'use client';

/**
 * Edit collection page.
 *
 * @remarks
 * Fetches existing collection data and pre-populates the CollectionWizard
 * in edit mode. Uses TanStack Query for data fetching.
 */

import { useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import {
  CollectionWizard,
  type CollectionFormValues,
} from '@/components/collection/collection-wizard';
import { useCollection, type CollectionView } from '@/lib/hooks/use-collections';

/**
 * Edit collection route parameters.
 */
interface EditCollectionPageProps {
  params: Promise<{
    uri: string;
  }>;
}

/**
 * Loading skeleton for the edit page.
 */
function EditCollectionSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96 mt-2" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-48" />
      </div>
    </div>
  );
}

export default function EditCollectionPage({ params }: EditCollectionPageProps) {
  const { uri: encodedUri } = use(params);
  const decodedUri = decodeURIComponent(encodedUri);

  const router = useRouter();
  const { data, isLoading, error } = useCollection(decodedUri);

  const initialValues: Partial<CollectionFormValues> | undefined = useMemo(() => {
    if (!data?.collection) return undefined;

    const collection = data.collection;
    return {
      name: collection.name,
      description: collection.description,
      visibility: collection.visibility,
      tags: collection.tags ?? [],
      fields: [],
      items: (data.items ?? []).map((item) => ({
        uri: item.itemUri,
        type: item.itemType,
        label: item.title ?? item.itemUri,
        note: item.note,
      })),
      subcollections: (data.subcollections ?? []).map((sub) => ({
        name: sub.name,
        items: [],
      })),
      edges: [],
      enableSembleMirror: false,
    };
  }, [data]);

  const handleSuccess = useCallback(
    (collection: CollectionView) => {
      router.push(`/collections/${encodeURIComponent(collection.uri)}`);
    },
    [router]
  );

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  if (isLoading) {
    return <EditCollectionSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <h2 className="text-lg font-semibold text-destructive">Failed to load collection</h2>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!data?.collection) {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Collection</h1>
        <p className="mt-1 text-muted-foreground">
          Update &quot;{data.collection.name}&quot; and its contents.
        </p>
      </div>
      <CollectionWizard
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        initialValues={initialValues}
        isEditMode
        existingUri={decodedUri}
      />
    </div>
  );
}
