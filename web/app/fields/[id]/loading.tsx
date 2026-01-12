import {
  FieldBreadcrumbSkeleton,
  FieldRelationshipsSkeleton,
  FieldExternalIdsSkeleton,
  FieldEprintsSkeleton,
} from '@/components/knowledge-graph';
import { Separator } from '@/components/ui/separator';

/**
 * Loading skeleton for the field detail page.
 */
export default function FieldLoading() {
  return <FieldDetailSkeleton />;
}

/**
 * Skeleton component for the field detail page content.
 */
export function FieldDetailSkeleton() {
  return (
    <div className="space-y-8">
      <FieldBreadcrumbSkeleton />

      {/* Header skeleton */}
      <header className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-6 w-96 animate-pulse rounded bg-muted" />
        <div className="flex gap-6">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <FieldEprintsSkeleton count={5} />
        </div>
        <aside className="space-y-6">
          <FieldRelationshipsSkeleton />
          <Separator />
          <FieldExternalIdsSkeleton />
        </aside>
      </div>
    </div>
  );
}
