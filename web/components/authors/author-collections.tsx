'use client';

/**
 * AuthorCollections component displays a user's public collections on their profile.
 *
 * @remarks
 * Shows collections owned by the author, with an optional featured collection
 * displayed prominently at the top. Supports both individual and organization
 * layout variants.
 *
 * @packageDocumentation
 */

import { Library, Star } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CollectionCard } from '@/components/collection/collection-card';
import { useMyCollections, type CollectionView } from '@/lib/hooks/use-collections';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils/format-date';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the AuthorCollections component.
 */
export interface AuthorCollectionsProps {
  /** Author DID */
  did: string;
  /** AT-URI of the featured collection (if any) */
  featuredCollectionUri?: string;
  /** Layout variant: 'compact' for individual profiles, 'prominent' for organizations */
  variant?: 'compact' | 'prominent';
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// FEATURED COLLECTION CARD
// =============================================================================

/**
 * Expanded card for a featured/pinned collection.
 */
function FeaturedCollectionCard({ collection }: { collection: CollectionView }) {
  return (
    <Link href={`/collections/${encodeURIComponent(collection.uri)}`} className="block">
      <Card className="border-amber-200 bg-amber-50/50 transition-colors hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 dark:hover:bg-amber-950/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-700 dark:text-amber-400 text-xs"
            >
              Featured
            </Badge>
          </div>
          <CardTitle className="text-lg">{collection.label}</CardTitle>
          {collection.description && (
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
            </span>
            {collection.tags && collection.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {collection.tags.slice(0, 5).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <span className="ml-auto text-xs">{formatRelativeDate(collection.createdAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Displays an author's public collections on their profile page.
 *
 * @param props - Component props
 * @returns React element with the author's collections grid
 */
export function AuthorCollections({
  did,
  featuredCollectionUri,
  variant = 'compact',
  className,
}: AuthorCollectionsProps) {
  const { data, isLoading, error } = useMyCollections(did);

  if (isLoading) {
    return <AuthorCollectionsSkeleton variant={variant} className={className} />;
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center',
          className
        )}
      >
        <p className="text-destructive">Failed to load collections</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  // Filter to public collections only for profile display
  const publicCollections = (data?.collections ?? []).filter((c) => c.visibility === 'public');

  if (publicCollections.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-muted/50 p-8 text-center', className)}>
        <Library className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-medium">No collections yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This author hasn&apos;t created any public collections.
        </p>
      </div>
    );
  }

  // Separate featured collection from the rest
  const featuredCollection = featuredCollectionUri
    ? publicCollections.find((c) => c.uri === featuredCollectionUri)
    : undefined;

  const remainingCollections = featuredCollection
    ? publicCollections.filter((c) => c.uri !== featuredCollectionUri)
    : publicCollections;

  const gridCols =
    variant === 'prominent'
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Collection count */}
      <p className="text-sm text-muted-foreground">
        {publicCollections.length} public collection{publicCollections.length !== 1 ? 's' : ''}
      </p>

      {/* Featured collection (expanded card) */}
      {featuredCollection && <FeaturedCollectionCard collection={featuredCollection} />}

      {/* Remaining collections grid */}
      {remainingCollections.length > 0 && (
        <div className={cn('grid gap-4', gridCols)}>
          {remainingCollections.map((collection) => (
            <CollectionCard
              key={collection.uri}
              uri={collection.uri}
              name={collection.label}
              description={collection.description}
              itemCount={collection.itemCount}
              visibility={collection.visibility}
              tags={collection.tags}
              createdAt={collection.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

/**
 * Props for the AuthorCollectionsSkeleton component.
 */
export interface AuthorCollectionsSkeletonProps {
  variant?: 'compact' | 'prominent';
  count?: number;
  className?: string;
}

/**
 * Loading skeleton for AuthorCollections component.
 */
export function AuthorCollectionsSkeleton({
  variant = 'compact',
  count = 4,
  className,
}: AuthorCollectionsSkeletonProps) {
  const gridCols =
    variant === 'prominent'
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={cn('space-y-4', className)}>
      <Skeleton className="h-4 w-32" />
      <div className={cn('grid gap-4', gridCols)}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
