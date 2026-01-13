import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton for the eprints page content.
 */
export function EprintsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Eprint list */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading state for eprints page.
 */
export default function EprintsLoading() {
  return <EprintsPageSkeleton />;
}
