'use client';

import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';

import { useCurrentUser } from '@/lib/auth';
import { usePreprintsByAuthor } from '@/lib/hooks/use-preprint';
import { PreprintCard, PreprintCardSkeleton } from '@/components/preprints';
import { Button } from '@/components/ui/button';

/**
 * User's preprints page.
 */
export default function MyPreprintsPage() {
  const user = useCurrentUser();
  const { data, isLoading, error } = usePreprintsByAuthor({ did: user?.did ?? '' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Preprints</h1>
          <p className="text-muted-foreground">Preprints you have authored or co-authored</p>
        </div>
        <Button asChild>
          <Link href="/submit">
            <Plus className="mr-2 h-4 w-4" />
            Submit Preprint
          </Link>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <PreprintCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Failed to load preprints</p>
        </div>
      ) : data?.preprints && data.preprints.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.preprints.map((preprint) => (
            <PreprintCard key={preprint.uri} preprint={preprint} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No preprints yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by submitting your first preprint
          </p>
          <Button className="mt-4" asChild>
            <Link href="/submit">Submit Preprint</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
