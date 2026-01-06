import { SearchResultsSkeleton } from '@/components/search';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for the search page.
 *
 * @remarks
 * Displayed while the search page is loading or during Suspense.
 */
export default function SearchLoading() {
  return <SearchPageSkeleton />;
}

/**
 * Skeleton component for the search page content.
 */
export function SearchPageSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:block">
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="mb-4 h-6 w-20" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="space-y-6">
        {/* Search input skeleton */}
        <Skeleton className="h-12 w-full" />

        {/* Results header skeleton */}
        <Skeleton className="h-5 w-48" />

        {/* Results skeleton */}
        <SearchResultsSkeleton count={5} />
      </div>
    </div>
  );
}
