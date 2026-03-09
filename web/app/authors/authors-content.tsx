'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  DidAutocompleteInput,
  type SelectedAtprotoUser,
} from '@/components/forms/did-autocomplete-input';
import {
  AuthorDiscoveryCard,
  AuthorDiscoveryCardSkeleton,
} from '@/components/authors/author-discovery-card';
import { usePersonalizedAuthors } from '@/lib/hooks/use-personalized-authors';

/**
 * Client-side authors page content with personalization.
 *
 * @remarks
 * Authenticated users with fields see authors who recently posted in their fields.
 * Authenticated users without fields see a prompt to set up their profile,
 * with trending authors below. Anonymous users see trending authors.
 */
export function AuthorsPageContent() {
  const router = useRouter();
  const { isPersonalized, needsFieldSetup, authors, isLoading, error } = usePersonalizedAuthors({
    limit: 20,
  });

  const handleAuthorSelect = useCallback(
    (user: SelectedAtprotoUser) => {
      router.push(`/authors/${encodeURIComponent(user.did)}`);
    },
    [router]
  );

  const heading = isPersonalized ? 'Active in Your Fields' : 'Trending Authors';

  return (
    <div className="space-y-6">
      {/* Author search */}
      <div className="max-w-md">
        <DidAutocompleteInput
          onSelect={handleAuthorSelect}
          placeholder="Search by name or handle..."
        />
      </div>

      {/* Profile setup prompt */}
      {needsFieldSetup && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950/30">
          <h3 className="text-base font-medium">Personalize your feed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add research fields to your profile to see active authors in your areas of interest.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/dashboard/settings">Set Up Profile</Link>
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <AuthorDiscoveryCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Failed to load authors</p>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && authors.length === 0 && !needsFieldSetup && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No authors yet</h3>
          <p className="mt-2 text-muted-foreground">Be the first to share your research on Chive</p>
          <Button asChild className="mt-4">
            <Link href="/submit">Submit an Eprint</Link>
          </Button>
        </div>
      )}

      {/* Author grid */}
      {!isLoading && !error && authors.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{heading}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/browse">View All</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {authors.map((author) => (
              <AuthorDiscoveryCard key={author.did} author={author} />
            ))}
          </div>

          {authors.length >= 20 && (
            <div className="flex justify-center">
              <Button asChild variant="outline">
                <Link href="/browse">Browse All Authors</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
