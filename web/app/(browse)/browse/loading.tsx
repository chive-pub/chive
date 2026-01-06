import { FacetPanelSkeleton } from '@/components/search';
import { SearchResultsSkeleton } from '@/components/search';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for the browse page.
 *
 * @remarks
 * Displayed while the browse page is loading or during Suspense.
 */
export default function BrowseLoading() {
  return <BrowsePageSkeleton />;
}

/**
 * Skeleton component for the browse page content.
 */
export function BrowsePageSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:block">
        <div className="space-y-4">
          {/* Active filters card */}
          <div className="rounded-lg border bg-card p-4">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>

          {/* PMEST section */}
          <div>
            <Skeleton className="mb-3 h-4 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <FacetPanelSkeleton key={`pmest-${i}`} rows={3} />
              ))}
            </div>
          </div>

          {/* FAST section */}
          <div>
            <Skeleton className="mb-3 h-4 w-20" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <FacetPanelSkeleton key={`fast-${i}`} rows={3} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="space-y-6">
        {/* Search input skeleton */}
        <Skeleton className="h-10 w-full" />

        {/* Results header skeleton */}
        <Skeleton className="h-5 w-48" />

        {/* Results skeleton */}
        <SearchResultsSkeleton count={5} />
      </div>
    </div>
  );
}
