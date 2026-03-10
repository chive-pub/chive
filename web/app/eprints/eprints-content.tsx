'use client';

import { useMemo } from 'react';
import Link from 'next/link';

import { EprintCard, EprintCardSkeleton } from '@/components/eprints';
import { Button } from '@/components/ui/button';
import { usePersonalizedFeed } from '@/lib/hooks/use-personalized-feed';
import { useMutedAuthors, filterMutedContent } from '@/lib/hooks/use-muted-authors';
import type { EprintCardData } from '@/lib/api/schema';

/**
 * Client-side eprints page content with personalization.
 *
 * @remarks
 * Authenticated users with fields see recent papers in their fields.
 * Authenticated users without fields see a prompt to set up their profile,
 * with the global trending feed below. Anonymous users see global trending.
 * Eprints by muted authors are filtered out.
 */
export function EprintsPageContent() {
  const {
    isPersonalized,
    needsFieldSetup,
    eprints: rawEprints,
    isLoading,
    error,
  } = usePersonalizedFeed({
    limit: 20,
  });
  const { mutedDids } = useMutedAuthors();

  const eprints = useMemo(
    () =>
      filterMutedContent(rawEprints, mutedDids, (eprint) => {
        const authors = (eprint as Record<string, unknown>).authors as
          | { did?: string }[]
          | undefined;
        return authors?.map((a) => a.did).filter((d): d is string => !!d) ?? [];
      }),
    [rawEprints, mutedDids]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <EprintCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <p className="text-destructive">Failed to load eprints</p>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (eprints.length === 0 && !needsFieldSetup) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No eprints yet</h3>
        <p className="mt-2 text-muted-foreground">Be the first to share your research on Chive</p>
        <Button asChild className="mt-4">
          <Link href="/submit">Submit an Eprint</Link>
        </Button>
      </div>
    );
  }

  const heading = isPersonalized ? 'New in Your Fields' : 'Trending This Week';

  return (
    <div className="space-y-6">
      {/* Profile setup prompt for authenticated users without fields */}
      {needsFieldSetup && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950/30">
          <h3 className="text-base font-medium">Personalize your feed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add research fields to your profile to see recent papers in your areas of interest.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/dashboard/settings">Set Up Profile</Link>
          </Button>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{heading}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/browse">View All</Link>
        </Button>
      </div>

      {/* Eprint grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {eprints.map((eprint) => (
          <EprintCard key={eprint.uri} eprint={eprint as unknown as EprintCardData} />
        ))}
      </div>

      {/* Browse all link */}
      {eprints.length >= 20 && (
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/browse">Browse All Eprints</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
