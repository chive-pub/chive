'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';

import { useCurrentUser } from '@/lib/auth';
import { useAuthorEprints } from '@/lib/hooks/use-author';
import { EprintCardSkeleton, EprintList } from '@/components/eprints';
import { Button } from '@/components/ui/button';

/**
 * User's eprints page.
 *
 * @remarks
 * This lists every eprint the user has, a page at a time. It previously used
 * `useEprintsByAuthor`, a plain query with no cursor and a cache key that did
 * not include one, so it showed the first twenty and offered no way to reach
 * the rest. It now shares the infinite query the public profile uses.
 */
export default function MyEprintsPage() {
  const user = useCurrentUser();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useAuthorEprints(user?.did ?? '', { limit: 20 });

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const eprints = data?.pages.flatMap((page) => page.eprints) ?? [];
  const total = data?.pages[0]?.total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Eprints</h1>
          <p className="text-muted-foreground">
            {total === undefined
              ? 'Eprints you have authored or co-authored'
              : `${total} eprint${total === 1 ? '' : 's'} you have authored or co-authored`}
          </p>
        </div>
        <Button asChild>
          <Link href="/submit">
            <Plus className="mr-2 h-4 w-4" />
            Submit Eprint
          </Link>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <EprintCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Failed to load eprints</p>
        </div>
      ) : eprints.length > 0 ? (
        <EprintList
          eprints={eprints}
          layout="grid"
          hasMore={hasNextPage}
          onLoadMore={handleLoadMore}
          isLoadingMore={isFetchingNextPage}
        />
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No eprints yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by submitting your first eprint
          </p>
          <Button className="mt-4" asChild>
            <Link href="/submit">Submit Eprint</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
