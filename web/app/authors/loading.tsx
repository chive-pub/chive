import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton for the authors page content.
 */
export function AuthorsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search bar skeleton */}
      <Skeleton className="h-10 max-w-md" />

      {/* Author cards grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading state for authors page.
 */
export default function AuthorsLoading() {
  return <AuthorsPageSkeleton />;
}
