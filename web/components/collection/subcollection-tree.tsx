'use client';

/**
 * Subcollection tree component.
 *
 * @remarks
 * Renders subcollections as a grid of CollectionCard components, with an
 * optional parent breadcrumb link at the top.
 */

import Link from 'next/link';
import { ChevronRight, FolderOpen } from 'lucide-react';

import { CollectionCard } from '@/components/collection/collection-card';
import type { CollectionView } from '@/lib/hooks/use-collections';

/**
 * Props for the SubcollectionTree component.
 */
interface SubcollectionTreeProps {
  subcollections: CollectionView[];
  currentUri: string;
  parentCollection?: CollectionView | null;
  className?: string;
}

/**
 * Renders a parent breadcrumb and subcollection cards.
 *
 * If a parent collection exists, displays a breadcrumb link at the top.
 * Subcollections are rendered as a responsive grid of CollectionCard elements.
 */
export function SubcollectionTree({
  subcollections,
  currentUri: _currentUri,
  parentCollection,
  className,
}: SubcollectionTreeProps) {
  const hasParent = !!parentCollection;
  const hasSubcollections = subcollections.length > 0;

  if (!hasParent && !hasSubcollections) {
    return null;
  }

  return (
    <div className={className}>
      {/* Parent breadcrumb */}
      {parentCollection && (
        <div className="mb-4">
          <Link
            href={`/collections/${encodeURIComponent(parentCollection.uri)}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Parent:</span>
            <span className="font-medium">{parentCollection.name}</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Subcollections grid */}
      {hasSubcollections && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Subcollections</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subcollections.map((sub) => (
              <CollectionCard
                key={sub.uri}
                uri={sub.uri}
                name={sub.name}
                description={sub.description}
                itemCount={sub.itemCount}
                visibility={sub.visibility}
                tags={sub.tags}
                createdAt={sub.createdAt}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
