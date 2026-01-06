import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for tags page.
 */
export function TagsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search skeleton */}
      <Skeleton className="h-10 w-full max-w-md" />

      {/* Trending tags skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-6 rounded-full"
                style={{ width: `${60 + (i % 4) * 20}px` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tag cloud skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-3">
            {Array.from({ length: 20 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-4 rounded"
                style={{ width: `${40 + (i % 5) * 15}px` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TagsPageSkeleton;
