import { EprintHeaderSkeleton } from '@/components/eprints';
import { Separator } from '@/components/ui/separator';

/**
 * Loading skeleton for the eprint detail page.
 */
export default function EprintLoading() {
  return <EprintDetailSkeleton />;
}

/**
 * Skeleton component for the eprint detail page content.
 */
export function EprintDetailSkeleton() {
  return (
    <article className="space-y-8">
      <EprintHeaderSkeleton />
      <Separator />
      <div className="space-y-6">
        {/* Tab skeleton */}
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded bg-muted" />
          <div className="h-9 w-16 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>

        {/* Button skeleton */}
        <div className="flex gap-4">
          <div className="h-10 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </article>
  );
}
