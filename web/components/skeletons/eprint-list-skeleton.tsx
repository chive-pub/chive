import { EprintCardSkeleton } from './eprint-card-skeleton';

interface EprintListSkeletonProps {
  count?: number;
}

/**
 * Loading skeleton for a list of eprints.
 */
export function EprintListSkeleton({ count = 6 }: EprintListSkeletonProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <EprintCardSkeleton key={i} />
      ))}
    </div>
  );
}
