'use client';

import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';

import { useCurrentUser } from '@/lib/auth';
import { useEprintsByAuthor } from '@/lib/hooks/use-eprint';
import { EprintCard, EprintCardSkeleton } from '@/components/eprints';
import { Button } from '@/components/ui/button';

/**
 * User's eprints page.
 */
export default function MyEprintsPage() {
  const user = useCurrentUser();
  const { data, isLoading, error } = useEprintsByAuthor({ did: user?.did ?? '' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Eprints</h1>
          <p className="text-muted-foreground">Eprints you have authored or co-authored</p>
        </div>
        <Button asChild>
          <Link href="/submit">
            <Plus className="mr-2 h-4 w-4" />
            Submit Eprint
          </Link>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <EprintCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Failed to load eprints</p>
        </div>
      ) : data?.eprints && data.eprints.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.eprints.map((eprint) => (
            <EprintCard key={eprint.uri} eprint={eprint} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No eprints yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by submitting your first eprint
          </p>
          <Button className="mt-4" asChild>
            <Link href="/submit">Submit Eprint</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
