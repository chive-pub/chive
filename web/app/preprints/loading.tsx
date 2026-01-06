import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton for the preprints page content.
 */
export function PreprintsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Preprint list */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading state for preprints page.
 */
export default function PreprintsLoading() {
  return <PreprintsPageSkeleton />;
}
