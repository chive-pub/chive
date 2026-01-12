'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FeedEprintCard, FeedEprintCardSkeleton } from './feed-eprint-card';
import { FeedEmptyState } from './feed-empty-state';
import { useForYouFeed, useRecordInteraction } from '@/lib/hooks/use-discovery';
import { cn } from '@/lib/utils';
import type { RecommendedEprint } from '@/lib/api/schema';

/**
 * Props for ForYouFeed component.
 */
export interface ForYouFeedProps {
  /** Whether the user is authenticated */
  isAuthenticated?: boolean;
  /** Whether the user has linked accounts */
  hasLinkedAccounts?: boolean;
  /** Whether the user has claimed papers */
  hasClaimedPapers?: boolean;
  /** Initial page size */
  limit?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Personalized "For You" feed with infinite scroll.
 *
 * @remarks
 * Displays paper recommendations based on the user's research profile,
 * claimed papers, and interaction history. Supports:
 * - Infinite scroll loading
 * - Dismiss functionality for negative feedback
 * - Click tracking for positive signals
 * - Empty states for onboarding
 *
 * @example
 * ```tsx
 * <ForYouFeed
 *   isAuthenticated={!!user}
 *   hasLinkedAccounts={!!profile?.orcid}
 *   hasClaimedPapers={claimedCount > 0}
 * />
 * ```
 */
export function ForYouFeed({
  isAuthenticated = false,
  hasLinkedAccounts = false,
  hasClaimedPapers = false,
  limit = 10,
  className,
}: ForYouFeedProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useForYouFeed({ limit, enabled: isAuthenticated });

  const { mutate: recordInteraction } = useRecordInteraction();

  // Flatten pages into single array
  const recommendations: RecommendedEprint[] =
    data?.pages.flatMap((page) => page.recommendations) ?? [];

  // Handle dismiss
  const handleDismiss = useCallback(
    (uri: string) => {
      recordInteraction({
        eprintUri: uri,
        type: 'dismiss',
      });
    },
    [recordInteraction]
  );

  // Handle click (for tracking)
  const handleClick = useCallback(
    (uri: string) => {
      recordInteraction({
        eprintUri: uri,
        type: 'click',
      });
    },
    [recordInteraction]
  );

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Not authenticated - show sign in prompt
  if (!isAuthenticated) {
    return (
      <div className={cn(className)}>
        <FeedEmptyState isAuthenticated={false} />
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <FeedEprintCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center',
          className
        )}
      >
        <p className="text-sm text-destructive">
          Failed to load recommendations: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  // Empty state - show onboarding
  if (recommendations.length === 0) {
    return (
      <div className={cn(className)}>
        <FeedEmptyState
          isAuthenticated
          hasLinkedAccounts={hasLinkedAccounts}
          hasClaimedPapers={hasClaimedPapers}
        />
      </div>
    );
  }

  // Recommendations list
  return (
    <div className={cn('space-y-4', className)}>
      {recommendations.map((eprint) => (
        <FeedEprintCard
          key={eprint.uri}
          eprint={eprint}
          onDismiss={handleDismiss}
          onClick={handleClick}
        />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-4">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more...
          </div>
        )}
        {!hasNextPage && recommendations.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            You&apos;ve seen all recommendations. Check back later for more.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the entire feed.
 */
export function ForYouFeedSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <FeedEprintCardSkeleton key={i} />
      ))}
    </div>
  );
}
