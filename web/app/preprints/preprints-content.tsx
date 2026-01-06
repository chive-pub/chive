'use client';

import Link from 'next/link';

import { PreprintCard, PreprintCardSkeleton } from '@/components/preprints';
import { Button } from '@/components/ui/button';
import { useTrending } from '@/lib/hooks';

/**
 * Client-side preprints page content.
 *
 * @remarks
 * Displays trending/recent preprints with links to browse more.
 */
export function PreprintsPageContent() {
  const { data, isLoading, error } = useTrending({ window: '7d', limit: 20 });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <PreprintCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <p className="text-destructive">Failed to load preprints</p>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  const preprints = data?.trending ?? [];

  if (preprints.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No preprints yet</h3>
        <p className="mt-2 text-muted-foreground">Be the first to share your research on Chive</p>
        <Button asChild className="mt-4">
          <Link href="/submit">Submit a Preprint</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Trending This Week</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/browse">View All</Link>
        </Button>
      </div>

      {/* Preprint grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {preprints.map((preprint: import('@/lib/api/schema').TrendingPreprint) => (
          <PreprintCard key={preprint.uri} preprint={preprint} />
        ))}
      </div>

      {/* Load more / View all */}
      {data?.hasMore && (
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/browse">Browse All Preprints</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
