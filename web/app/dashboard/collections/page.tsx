'use client';

import Link from 'next/link';
import { Library, Plus, GitFork } from 'lucide-react';

import { CollectionCard } from '@/components/collection/collection-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/lib/auth';
import { useMyCollections } from '@/lib/hooks/use-collections';

/**
 * Loading skeleton for collection grid.
 */
function CollectionGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Empty state when user has no collections.
 */
function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed p-12 text-center">
      <Library className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">No collections yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a collection to organize eprints into reading lists, topic groups, or curated sets
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button asChild>
          <Link href="/collections/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Collection
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/collections/clone">
            <GitFork className="mr-2 h-4 w-4" />
            Clone from Graph
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Dashboard page for viewing and managing the user's collections.
 */
export default function MyCollectionsPage() {
  const currentUser = useCurrentUser();
  const { data, isLoading, error } = useMyCollections(currentUser?.did ?? '', {
    enabled: !!currentUser?.did,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Collections</h1>
          <p className="text-muted-foreground">
            Curated sets of eprints and resources
            {data?.total != null && data.total > 0 && ` (${data.total})`}
          </p>
        </div>
        {data?.collections && data.collections.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button asChild size="sm">
              <Link href="/collections/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Collection
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/collections/clone">
                <GitFork className="mr-2 h-4 w-4" />
                Clone from Graph
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <CollectionGridSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <h3 className="font-semibold text-destructive">Failed to load collections</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      ) : !data?.collections?.length ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.collections.map((collection) => (
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
