import { FieldCardSkeleton } from '@/components/knowledge-graph';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for the fields page.
 */
export default function FieldsLoading() {
  return <FieldsPageSkeleton />;
}

/**
 * Skeleton component for the fields page content.
 */
export function FieldsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search skeleton */}
      <Skeleton className="h-8 w-64" />

      {/* Fields grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <FieldCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
