'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { X } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RecommendationBadge } from './recommendation-badge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/format-date';
import type { RecommendedEprint } from '@/lib/api/schema';

/**
 * Props for FeedEprintCard component.
 */
export interface FeedEprintCardProps {
  /** Recommended eprint data */
  eprint: RecommendedEprint;
  /** Callback when eprint is dismissed */
  onDismiss?: (uri: string) => void;
  /** Callback when card is clicked (for tracking) */
  onClick?: (uri: string) => void;
  /** Callback for prefetching on hover */
  onPrefetch?: (uri: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a recommended eprint card with explanation badge.
 *
 * @remarks
 * Extends the base eprint card with recommendation-specific features:
 * - Explanation badge showing why it was recommended
 * - Dismiss button to remove from feed
 * - Click tracking for feedback loop
 *
 * @example
 * ```tsx
 * <FeedEprintCard
 *   eprint={recommendation}
 *   onDismiss={(uri) => dismissMutation.mutate({ eprintUri: uri, type: 'dismiss' })}
 *   onClick={(uri) => trackMutation.mutate({ eprintUri: uri, type: 'click' })}
 * />
 * ```
 */
export function FeedEprintCard({
  eprint,
  onDismiss,
  onClick,
  onPrefetch,
  className,
}: FeedEprintCardProps) {
  const handleMouseEnter = useCallback(() => {
    if (onPrefetch) {
      onPrefetch(eprint.uri);
    }
  }, [onPrefetch, eprint.uri]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(eprint.uri);
    }
  }, [onClick, eprint.uri]);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onDismiss) {
        onDismiss(eprint.uri);
      }
    },
    [onDismiss, eprint.uri]
  );

  const eprintUrl = `/eprints/${encodeURIComponent(eprint.uri)}`;

  // Get first author name
  const firstAuthor = eprint.authors?.[0]?.name ?? 'Unknown author';
  const authorCount = eprint.authors?.length ?? 0;
  const authorDisplay = authorCount > 1 ? `${firstAuthor} et al.` : firstAuthor;

  return (
    <Card
      className={cn('group relative transition-shadow hover:shadow-md', className)}
      onMouseEnter={handleMouseEnter}
    >
      {/* Dismiss button */}
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleDismiss}
          aria-label="Dismiss recommendation"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardHeader className="pb-2">
        {/* Recommendation badge */}
        <div className="mb-2">
          <RecommendationBadge explanation={eprint.explanation} size="sm" />
        </div>

        {/* Title */}
        <Link
          href={eprintUrl}
          className="block font-semibold leading-tight hover:text-primary hover:underline"
          onClick={handleClick}
        >
          <h3 className="line-clamp-2 pr-8">{eprint.title}</h3>
        </Link>

        {/* Author and date */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{authorDisplay}</span>
          {eprint.publicationDate && (
            <>
              <span className="text-xs">·</span>
              <span className="text-xs">
                {formatDate(eprint.publicationDate, { relative: true })}
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Abstract */}
        {eprint.abstract && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{eprint.abstract}</p>
        )}

        {/* Categories */}
        {eprint.categories && eprint.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {eprint.categories.slice(0, 3).map((category) => (
              <span
                key={category}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {category}
              </span>
            ))}
            {eprint.categories.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{eprint.categories.length - 3}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for FeedEprintCard.
 */
export function FeedEprintCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="mb-2 h-5 w-24 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-full animate-pulse rounded bg-muted" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-1">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
