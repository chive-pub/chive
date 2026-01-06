import {
  AuthorHeaderSkeleton,
  AuthorStatsSkeleton,
  AuthorPreprintsSkeleton,
} from '@/components/preprints';
import { Separator } from '@/components/ui/separator';

/**
 * Loading skeleton for the author page.
 *
 * @remarks
 * Displayed while the author page is loading or during Suspense.
 */
export default function AuthorLoading() {
  return <AuthorPageSkeleton />;
}

/**
 * Skeleton component for the author page content.
 */
export function AuthorPageSkeleton() {
  return (
    <div className="space-y-8">
      <AuthorHeaderSkeleton />
      <AuthorStatsSkeleton />
      <Separator />
      <section>
        <div className="mb-6 h-8 w-32 animate-pulse rounded bg-muted" />
        <AuthorPreprintsSkeleton count={5} />
      </section>
    </div>
  );
}
