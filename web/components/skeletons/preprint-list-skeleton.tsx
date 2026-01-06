import { PreprintCardSkeleton } from './preprint-card-skeleton';

interface PreprintListSkeletonProps {
  count?: number;
}

/**
 * Loading skeleton for a list of preprints.
 */
export function PreprintListSkeleton({ count = 6 }: PreprintListSkeletonProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <PreprintCardSkeleton key={i} />
      ))}
    </div>
  );
}
