import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

/**
 * Loading skeleton for EprintCard.
 *
 * @remarks
 * Displays a placeholder with animated pulse effect while eprint data is loading.
 * Matches the layout of EprintCard for seamless transitions.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useEprint(uri);
 *
 * if (isLoading) return <EprintCardSkeleton />;
 *
 * return <EprintCard eprint={data} />;
 * ```
 *
 * @returns React element displaying the skeleton
 */
export function EprintCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Abstract */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />

        {/* Field badges */}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        {/* Author */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Date */}
        <Skeleton className="h-4 w-24" />
      </CardFooter>
    </Card>
  );
}
