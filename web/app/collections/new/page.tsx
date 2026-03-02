'use client';

/**
 * New collection page.
 *
 * @remarks
 * Hosts the CollectionWizard for creating a new collection.
 * Protected by AuthGuard and AlphaGate via the layout.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { CollectionWizard } from '@/components/collection/collection-wizard';
import type { CollectionView } from '@/lib/hooks/use-collections';

export default function NewCollectionPage() {
  const router = useRouter();

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
      <CollectionWizard onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}
