'use client';

/**
 * New collection page.
 *
 * @remarks
 * Hosts the CollectionWizard for creating a new collection.
 * Protected by AuthGuard via the layout.
 *
 * Reads optional `item`, `type`, and `label` query params to pre-populate
 * the wizard with an initial item (e.g., when navigating from the
 * "Create new collection" action on an eprint or review page).
 */

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { CollectionWizard } from '@/components/collection/collection-wizard';
import type { CollectionView } from '@/lib/hooks/use-collections';
import type { CollectionItemFormData } from '@/components/collection/wizard-steps/types';

function NewCollectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialValues = useMemo(() => {
    const itemUri = searchParams.get('item');
    const itemType = searchParams.get('type');
    const itemLabel = searchParams.get('label');

    if (itemUri && itemType && itemLabel) {
      const items: CollectionItemFormData[] = [{ uri: itemUri, type: itemType, label: itemLabel }];
      return { items };
    }
    return undefined;
  }, [searchParams]);

  const handleSuccess = useCallback(
    (collection: CollectionView) => {
      router.push(`/collections/${encodeURIComponent(collection.uri)}`);
    },
    [router]
  );

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Collection</h1>
        <p className="mt-1 text-muted-foreground">
          Build a curated collection of eprints, authors, and resources.
        </p>
      </div>
      <CollectionWizard
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        initialValues={initialValues}
      />
    </div>
  );
}

export default function NewCollectionPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Collection</h1>
            <p className="mt-1 text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <NewCollectionContent />
    </Suspense>
  );
}
